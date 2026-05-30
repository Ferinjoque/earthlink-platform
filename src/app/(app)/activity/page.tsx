import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { getEvidenceFilesBatch } from '@/actions/evidence';
import { TopBar } from '@/components/shell/TopBar';
import { ActivityList } from '@/components/activity/ActivityList';
import { BulkImportPanel } from '@/components/activity/BulkImportPanel';
import { ClipboardList } from 'lucide-react';
import type { ActivityEntryView } from '@/components/activity/ActivityList';
import type {
  MembershipRow,
  SupplierRow,
  ReportingPeriodRow,
  ActivityEntryRow,
  AnomalyFlagRow,
  ActivityEntryStatus,
} from '@/types/database';

export const metadata: Metadata = { title: 'Actividad' };

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ActividadPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id, supplier_id, role')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<
    MembershipRow,
    'organization_id' | 'supplier_id' | 'role'
  >[];

  // Rol 'supplier' → acceso directo a su proveedor
  const supplierRoleIds = memberships
    .map((m) => m.supplier_id)
    .filter((id): id is string => id !== null);

  // admin/consultant → acceso a todos los proveedores de sus orgs
  const adminOrgIds = memberships
    .filter((m) => m.role === 'admin' || m.role === 'consultant')
    .map((m) => m.organization_id);

  const adminSupplierIds: string[] = [];
  if (adminOrgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('organization_id', adminOrgIds)
      .is('archived_at', null);
    if (data)
      adminSupplierIds.push(...(data as Pick<SupplierRow, 'id' | 'name'>[]).map((s) => s.id));
  }

  const supplierIds = [...new Set([...supplierRoleIds, ...adminSupplierIds])];

  type SupplierItem = Pick<SupplierRow, 'id' | 'name' | 'archived_at'>;
  const suppliersData: SupplierItem[] = [];
  if (supplierIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, archived_at')
      .in('id', supplierIds);
    if (data) suppliersData.push(...(data as SupplierItem[]));
  }
  // Solo proveedores activos para el panel de importación y la lista de actividad
  const activeSuppliersForImport = suppliersData.filter((s) => s.archived_at === null);
  const activeSupplierIds = activeSuppliersForImport.map((s) => s.id);
  const periodsData: Pick<
    ReportingPeriodRow,
    'id' | 'label' | 'supplier_id' | 'status' | 'start_date'
  >[] = [];
  if (activeSupplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('id, label, supplier_id, status, start_date')
      .in('supplier_id', activeSupplierIds)
      .order('start_date', { ascending: false });
    if (data) periodsData.push(...data);
  }

  const periods = periodsData.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  const periodIds = periodsData.map((p) => p.id);

  type EntryRow = Pick<
    ActivityEntryRow,
    | 'id'
    | 'reporting_period_id'
    | 'source_type'
    | 'raw_quantity'
    | 'raw_unit'
    | 'status'
    | 'submitted_at'
    | 'notes'
    | 'voided_at'
    | 'void_reason'
  >;
  const entriesData: EntryRow[] = [];
  let totalEntries = 0;
  const offset = (page - 1) * PAGE_SIZE;

  if (periodIds.length) {
    const { data, count } = await supabase
      .from('activity_entries')
      .select(
        'id, reporting_period_id, source_type, raw_quantity, raw_unit, status, submitted_at, notes, voided_at, void_reason',
        { count: 'exact' },
      )
      .in('reporting_period_id', periodIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (data) entriesData.push(...(data as EntryRow[]));
    totalEntries = count ?? 0;
  }

  const entryIds = entriesData.map((e) => e.id);

  // Mapa period_id → label para mostrar etiqueta en la lista
  const periodLabelMap = new Map(periodsData.map((p) => [p.id, p.label]));
  const periodStatusMap = new Map(periodsData.map((p) => [p.id, p.status]));

  const flagsData: Pick<
    AnomalyFlagRow,
    'activity_entry_id' | 'severity' | 'z_score' | 'message'
  >[] = [];

  // Carga anomalías y archivos de evidencia en paralelo
  let evidenceBatchMap = new Map<string, import('@/actions/evidence').EvidenceFileView[]>();

  if (entryIds.length) {
    const [flagsResult, evidenceMap] = await Promise.all([
      supabase
        .from('anomaly_flags')
        .select('activity_entry_id, severity, z_score, message')
        .in('activity_entry_id', entryIds)
        .eq('is_resolved', false)
        .order('flagged_at', { ascending: false }),
      getEvidenceFilesBatch(entryIds),
    ]);
    if (flagsResult.data) flagsData.push(...flagsResult.data);
    evidenceBatchMap = evidenceMap;
  }

  const flagMap = new Map<
    string,
    { severity: 'low' | 'medium' | 'high'; z_score: number | null; message: string }
  >();
  for (const f of flagsData) {
    if (!flagMap.has(f.activity_entry_id)) {
      flagMap.set(f.activity_entry_id, {
        severity: f.severity as 'low' | 'medium' | 'high',
        z_score: f.z_score,
        message: f.message,
      });
    }
  }

  const entries: ActivityEntryView[] = entriesData.map((e) => {
    const evidenceFiles = evidenceBatchMap.get(e.id) ?? [];
    return {
      id: e.id,
      period_id: e.reporting_period_id,
      period_label: periodLabelMap.get(e.reporting_period_id) ?? '—',
      period_status: periodStatusMap.get(e.reporting_period_id),
      source_type: e.source_type,
      raw_quantity: e.raw_quantity,
      raw_unit: e.raw_unit,
      status: e.status as ActivityEntryStatus,
      submitted_at: e.submitted_at,
      notes: e.notes,
      voided_at: e.voided_at,
      void_reason: e.void_reason,
      evidence_count: evidenceFiles.length,
      evidence_files: evidenceFiles,
      anomaly: flagMap.get(e.id),
    };
  });

  const nEntradas = totalEntries;

  // Estado vacío: sin proveedores accesibles
  if (suppliersData.length === 0) {
    return (
      <>
        <TopBar title="Registros de actividad" email={user?.email} section="Alcance 1 y 2" />
        <main style={{ padding: 'var(--space-8)' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-5)',
              padding: 'var(--space-16) var(--space-8)',
              textAlign: 'center',
              maxWidth: '480px',
              margin: '0 auto',
            }}
          >
            <span
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-ink-3)',
              }}
            >
              <ClipboardList size={24} />
            </span>
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--color-ink-1)',
                  margin: '0 0 var(--space-2)',
                }}
              >
                Sin proveedores disponibles
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
                No hay proveedores asignados a tu cuenta. Crea un proveedor desde la sección de
                proveedores para poder registrar actividad.
              </p>
            </div>
            <Link
              href="/suppliers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-accent)',
                textDecoration: 'none',
                padding: 'var(--space-2) var(--space-4)',
                border: '1px solid var(--color-accent)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              Ir a proveedores
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Registros de actividad" email={user?.email} section="Alcance 1 y 2" />
      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
        }}
      >
        {/* Registro de consumo — unified panel */}
        <section className="animate-fade-up stagger-1">
          <CabeceraSección
            titulo="Registro de consumo"
            subtitulo="Registra consumos manualmente o importa desde CSV / Excel."
          />
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              maxWidth: '960px',
            }}
          >
            <BulkImportPanel
              suppliers={activeSuppliersForImport}
              defaultSupplierId={activeSuppliersForImport[0]?.id}
            />
          </div>
        </section>

        {/* Lista de registros */}
        <section className="animate-fade-up stagger-2">
          <CabeceraSección
            titulo="Registros recientes"
            subtitulo={
              nEntradas === 0
                ? 'Sin registros aún.'
                : `${nEntradas} ${nEntradas === 1 ? 'registro' : 'registros'} recientes.`
            }
          />
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: nEntradas === 0 ? 'var(--space-8)' : 'var(--space-4) 0',
            }}
          >
            {nEntradas === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-2)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--color-ink-3)',
                  }}
                >
                  <ClipboardList size={18} />
                </span>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
                  Usa el formulario de arriba para registrar el primer dato de actividad.
                </p>
              </div>
            ) : (
              <ActivityList
                entries={entries}
                periodos={periods}
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  total: totalEntries,
                  basePath: '/activity',
                }}
              />
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function CabeceraSección({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <h2
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--color-ink-1)',
          margin: 0,
        }}
      >
        {titulo}
      </h2>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-ink-3)',
          margin: 'var(--space-1) 0 0',
        }}
      >
        {subtitulo}
      </p>
    </div>
  );
}

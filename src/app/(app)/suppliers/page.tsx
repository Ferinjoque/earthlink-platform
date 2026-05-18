import type { Metadata } from 'next';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { Badge } from '@/components/ui/Badge';
import type { MembershipRow, SupplierRow, ReportingPeriodRow } from '@/types/database';

export const metadata: Metadata = { title: 'Proveedores' };

export default async function ProveedoresPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', user?.id ?? '');
  const memberships = (rawMemberships ?? []) as MembershipRow[];

  const orgIds = [...new Set(memberships.map((m) => m.organization_id).filter(Boolean))];

  const suppliersData: SupplierRow[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, category, contact_email, ruc, organization_id, created_at, updated_at')
      .in('organization_id', orgIds)
      .order('name', { ascending: true });
    if (data) suppliersData.push(...data);
  }

  const supplierIds = suppliersData.map((s) => s.id);

  const periodsData: Pick<ReportingPeriodRow, 'supplier_id' | 'status'>[] = [];
  if (supplierIds.length) {
    const { data } = await supabase
      .from('reporting_periods')
      .select('supplier_id, status')
      .in('supplier_id', supplierIds);
    if (data) periodsData.push(...data);
  }

  const conteoAbiertos = new Map<string, number>();
  for (const p of periodsData) {
    if (p.status === 'open') {
      conteoAbiertos.set(p.supplier_id, (conteoAbiertos.get(p.supplier_id) ?? 0) + 1);
    }
  }

  const nProveedores = suppliersData.length;

  return (
    <>
      <TopBar title="Proveedores" email={user?.email} section="Registro de cadena" />
      <main style={{ padding: 'var(--space-8)' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--color-ink-1)',
              margin: 0,
            }}
          >
            Registro de proveedores
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              margin: 'var(--space-1) 0 0',
            }}
          >
            {nProveedores} {nProveedores !== 1 ? 'proveedores' : 'proveedor'} en tu
            {orgIds.length > 1 ? 's organizaciones' : ' organización'}.
          </p>
        </div>

        {suppliersData.length === 0 ? (
          <p
            style={{
              color: 'var(--color-ink-3)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              padding: 'var(--space-8) 0',
              textAlign: 'center',
            }}
          >
            No se encontraron proveedores para tu cuenta.
          </p>
        ) : (
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              overflowX: 'auto',
            }}
          >
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}
            >
              <thead>
                <tr>
                  {['Nombre', 'Categoría', 'RUC', 'Contacto', 'Periodos abiertos'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: 'var(--space-3) var(--space-4)',
                        color: 'var(--color-ink-3)',
                        fontWeight: 600,
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        borderBottom: '1px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliersData.map((s) => {
                  const abiertos = conteoAbiertos.get(s.id) ?? 0;
                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background =
                          'var(--color-surface-2)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')
                      }
                    >
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-1)',
                          fontWeight: 500,
                        }}
                      >
                        {s.name}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-2)',
                        }}
                      >
                        {s.category}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-3)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        {s.ruc ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          color: 'var(--color-ink-2)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        {s.contact_email ?? '—'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {abiertos > 0 ? (
                          <Badge variant="open">
                            {abiertos} {abiertos === 1 ? 'abierto' : 'abiertos'}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">ninguno</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

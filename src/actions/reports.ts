'use server';

import { createHash } from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/services/supabase/server';
import type {
  MembershipRow,
  EmissionResultRow,
  ActivityEntryRow,
  ReportingPeriodRow,
  SupplierRow,
} from '@/types/database';

const exportSchema = z.object({
  period_ids: z.string().min(1, 'Selecciona al menos un periodo'),
});

export interface ExportCsvState {
  error?: string | undefined;
  success?: boolean | undefined;
  csvContent?: string | undefined;
  filename?: string | undefined;
  sha256?: string | undefined;
}

export async function exportCsv(
  _prevState: ExportCsvState | null,
  formData: FormData,
): Promise<ExportCsvState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = exportSchema.safeParse({ period_ids: formData.get('period_ids') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };
  }

  const periodIds = parsed.data.period_ids.split(',').filter(Boolean);
  if (periodIds.length === 0) return { error: 'Selecciona al menos un periodo' };

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (periodIds.some((id) => !uuidRe.test(id))) {
    return { error: 'ID de periodo inválido' };
  }

  // Verify membership
  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<MembershipRow, 'organization_id'>[];
  const orgIds = memberships
    .map((m) => m.organization_id)
    .filter((id): id is string => id !== null);
  if (orgIds.length === 0) return { error: 'Sin organizaciones asociadas' };

  // Fetch period + supplier info
  type FilaPeriodo = Pick<ReportingPeriodRow, 'id' | 'label' | 'supplier_id'>;
  const { data: periodsRaw } = await supabase
    .from('reporting_periods')
    .select('id, label, supplier_id')
    .in('id', periodIds);
  const periods = (periodsRaw ?? []) as FilaPeriodo[];

  const supplierIds = [...new Set(periods.map((p) => p.supplier_id))];
  type FilaSupplier = Pick<SupplierRow, 'id' | 'name' | 'organization_id'>;
  const { data: suppliersRaw } = await supabase
    .from('suppliers')
    .select('id, name, organization_id')
    .in('id', supplierIds);
  const suppliers = (suppliersRaw ?? []) as FilaSupplier[];

  // Authorization: periods must belong to user's orgs
  const allowedSupplierIds = new Set(
    suppliers.filter((s) => orgIds.includes(s.organization_id)).map((s) => s.id),
  );
  const authorizedPeriodIds = periods
    .filter((p) => allowedSupplierIds.has(p.supplier_id))
    .map((p) => p.id);
  if (authorizedPeriodIds.length === 0) {
    return { error: 'Sin acceso a los periodos seleccionados' };
  }

  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const periodMap = new Map(periods.map((p) => [p.id, p]));

  // Fetch emission results
  type FilaResultado = Pick<
    EmissionResultRow,
    | 'id'
    | 'activity_entry_id'
    | 'reporting_period_id'
    | 'scope'
    | 'co2e_kg'
    | 'factor_used'
    | 'factor_unit'
    | 'calc_hash'
    | 'calc_version'
    | 'calculated_at'
  >;
  const { data: resultsRaw } = await supabase
    .from('emission_results')
    .select(
      'id, activity_entry_id, reporting_period_id, scope, co2e_kg, factor_used, factor_unit, calc_hash, calc_version, calculated_at',
    )
    .in('reporting_period_id', authorizedPeriodIds)
    .order('calculated_at', { ascending: true });
  const results = (resultsRaw ?? []) as FilaResultado[];

  if (results.length === 0) {
    return { error: 'Los periodos seleccionados no tienen resultados calculados' };
  }

  // Fetch activity entries for source info
  const entryIds = [...new Set(results.map((r) => r.activity_entry_id))];
  type FilaEntrada = Pick<ActivityEntryRow, 'id' | 'source_type' | 'raw_quantity' | 'raw_unit'>;
  const { data: entriesRaw } = await supabase
    .from('activity_entries')
    .select('id, source_type, raw_quantity, raw_unit')
    .in('id', entryIds);
  const entries = (entriesRaw ?? []) as FilaEntrada[];
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  // Build CSV
  const CSV_HEADER = [
    'periodo',
    'proveedor',
    'fuente',
    'cantidad',
    'unidad',
    'alcance',
    'co2e_kg',
    'factor',
    'unidad_factor',
    'version_calculo',
    'hash_calculo',
    'calculado_en',
  ].join(',');

  const csvRows: string[] = [CSV_HEADER];
  for (const r of results) {
    const periodo = periodMap.get(r.reporting_period_id);
    const entrada = entryMap.get(r.activity_entry_id);
    if (!periodo || !entrada) continue;

    const supplierName = supplierMap.get(periodo.supplier_id) ?? '';

    const row = [
      csvEscape(periodo.label),
      csvEscape(supplierName),
      csvEscape(entrada.source_type),
      entrada.raw_quantity.toString(),
      csvEscape(entrada.raw_unit),
      r.scope.toString(),
      r.co2e_kg.toFixed(6),
      r.factor_used.toFixed(6),
      csvEscape(r.factor_unit),
      csvEscape(r.calc_version),
      csvEscape(r.calc_hash),
      csvEscape(r.calculated_at),
    ].join(',');
    csvRows.push(row);
  }

  const csvContent = csvRows.join('\n');
  const sha256 = createHash('sha256').update(csvContent, 'utf8').digest('hex');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `earthlink-export-${timestamp}.csv`;

  // Save one export record per org covered by the authorized periods
  const authorizedPeriods = periods.filter((p) => authorizedPeriodIds.includes(p.id));
  const periodIdsByOrg = new Map<string, string[]>();
  for (const p of authorizedPeriods) {
    const supplier = suppliers.find((s) => s.id === p.supplier_id);
    if (!supplier) continue;
    const orgId = supplier.organization_id;
    const existing = periodIdsByOrg.get(orgId) ?? [];
    existing.push(p.id);
    periodIdsByOrg.set(orgId, existing);
  }
  for (const [orgId, periodIdsForOrg] of periodIdsByOrg) {
    await supabase.from('report_exports').insert({
      organization_id: orgId,
      reporting_period_ids: periodIdsForOrg,
      format: 'csv',
      scope_filter: [1, 2],
      file_url: `local://${filename}`,
      file_sha256: sha256,
      generated_by: user.id,
    });
  }

  return { success: true, csvContent, filename, sha256 };
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

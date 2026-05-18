'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/services/supabase/server';
import { AnomalyService } from '@/services/AnomalyService';
import { AnomalyFlag } from '@/domain/AnomalyFlag';
import { ActivityEntry } from '@/domain/ActivityEntry';
import { ActivityEntryRepository } from '@/repos/ActivityEntryRepository';
import { AnomalyFlagRepository } from '@/repos/AnomalyFlagRepository';
import { parseCsvText } from '@/lib/csv';
import type { ActivityKind, Unit } from '@/calc/types';
import type { EmissionSourceType } from '@/types/database';

// ── Zod validation schema ─────────────────────────────────────────────────────

const createEntrySchema = z.object({
  reporting_period_id: z.string().uuid('Periodo de reporte inválido'),
  source_type: z.enum([
    'stationary_combustion',
    'mobile_combustion',
    'purchased_electricity',
    'purchased_steam',
    'fugitive',
  ]),
  secondary: z.string().default(''),
  raw_quantity: z.coerce.number().positive('La cantidad debe ser positiva'),
  raw_unit: z.string().min(1, 'La unidad es obligatoria'),
  notes: z.string().optional(),
});

// ── State types ───────────────────────────────────────────────────────────────

export interface ActivityFormState {
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
  success?: boolean | undefined;
}

export interface CsvImportState {
  error?: string | undefined;
  imported?: number | undefined;
  skipped?: number | undefined;
  success?: boolean | undefined;
}

// ── Build ActivityKind discriminated union from flat form values ───────────────

function buildActivityKind(sourceType: EmissionSourceType, secondary: string): ActivityKind | null {
  switch (sourceType) {
    case 'stationary_combustion': {
      const fuel = secondary as 'natural_gas' | 'diesel' | 'lpg';
      if (!['natural_gas', 'diesel', 'lpg'].includes(fuel)) return null;
      return { kind: 'stationary_combustion', fuel };
    }
    case 'mobile_combustion': {
      const fuel = secondary as 'diesel' | 'gasoline' | 'lpg';
      if (!['diesel', 'gasoline', 'lpg'].includes(fuel)) return null;
      return { kind: 'mobile_combustion', fuel };
    }
    case 'purchased_electricity': {
      const gridRegion = secondary as 'SEIN_PERU' | 'LATAM_AVG' | 'US_AVERAGE' | 'EU_AVERAGE';
      if (!['SEIN_PERU', 'LATAM_AVG', 'US_AVERAGE', 'EU_AVERAGE'].includes(gridRegion)) return null;
      return { kind: 'purchased_electricity', gridRegion };
    }
    case 'purchased_steam':
      return { kind: 'purchased_steam' };
    case 'fugitive': {
      const refrigerant = secondary as 'R410A' | 'R134A' | 'R32';
      if (!['R410A', 'R134A', 'R32'].includes(refrigerant)) return null;
      return { kind: 'fugitive', refrigerant };
    }
  }
}

// ── createActivityEntry ───────────────────────────────────────────────────────

export async function createActivityEntry(
  _prevState: ActivityFormState | null,
  formData: FormData,
): Promise<ActivityFormState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = createEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { fieldErrors };
  }

  const { reporting_period_id, source_type, secondary, raw_quantity, raw_unit } = parsed.data;

  // Verify user belongs to the org that owns this period
  type PeriodOwner = { supplier_id: string };
  type SupplierOrg = { organization_id: string };
  const { data: periodRaw } = await supabase
    .from('reporting_periods')
    .select('supplier_id')
    .eq('id', reporting_period_id)
    .maybeSingle();
  const periodOwner = periodRaw as PeriodOwner | null;
  if (!periodOwner) return { error: 'Periodo de reporte no encontrado' };

  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', periodOwner.supplier_id)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor del periodo no encontrado' };

  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para registrar actividad en este periodo' };

  const activityKind = buildActivityKind(source_type, secondary);
  if (!activityKind) {
    return {
      error: `Valor inválido "${secondary}" para el tipo de fuente "${source_type}"`,
    };
  }

  const entryRepo = new ActivityEntryRepository(supabase);
  const anomalyRepo = new AnomalyFlagRepository(supabase);

  const now = new Date();
  const newEntry = new ActivityEntry({
    id: crypto.randomUUID(),
    reportingPeriodId: reporting_period_id,
    sourceType: source_type,
    activityKind,
    rawQuantity: raw_quantity,
    rawUnit: raw_unit as Unit,
    status: 'submitted',
    submittedAt: now,
    submittedBy: user.id,
    createdAt: now,
  });

  try {
    await entryRepo.save(newEntry);
  } catch {
    return { error: 'Error al guardar el registro. Intenta nuevamente.' };
  }

  // Anomaly detection — best-effort, non-fatal
  try {
    const historical = await entryRepo.findByPeriodId(reporting_period_id);
    const svc = new AnomalyService();
    const anomalies = svc.detect(
      [newEntry],
      historical.filter((e) => e.id !== newEntry.id),
    );

    for (const a of anomalies) {
      const flag = new AnomalyFlag({
        id: crypto.randomUUID(),
        activityEntryId: a.entryId,
        detector: 'zscore_monthly',
        severity: a.severity,
        zScore: a.zScore,
        thresholdUsed: AnomalyService.Z_THRESHOLD_LOW,
        message: a.message,
        isResolved: false,
        resolvedBy: null,
        resolvedAt: null,
        flaggedAt: now,
        createdAt: now,
      });
      await anomalyRepo.save(flag);
    }
  } catch {
    // Entry saved — anomaly detection is non-critical
  }

  revalidatePath('/activity');
  return { success: true };
}

// ── importActivityCsv ─────────────────────────────────────────────────────────

export async function importActivityCsv(
  _prevState: CsvImportState | null,
  formData: FormData,
): Promise<CsvImportState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const csvText = formData.get('csv_text');
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return { error: 'No se proporcionaron datos CSV' };
  }
  if (csvText.length > 512_000) {
    return { error: 'El archivo CSV supera el límite de 512 KB' };
  }

  const rows = parseCsvText(csvText);
  const validRows = rows.filter((r) => r.errors.length === 0 && r.data !== null);
  let skipped = rows.length - validRows.length;

  if (validRows.length === 0) {
    return {
      error: `No se encontraron filas válidas. ${skipped} fila(s) con errores de validación.`,
      skipped,
    };
  }

  // Batch ownership check — verify user belongs to all orgs referenced in the CSV
  const uniquePeriodIds = [...new Set(validRows.map((r) => r.data!.reporting_period_id))];

  type PeriodBatchRow = { id: string; supplier_id: string };
  type SupplierBatchRow = { id: string; organization_id: string };
  type MembershipBatchRow = { organization_id: string };

  const { data: periodsRaw } = await supabase
    .from('reporting_periods')
    .select('id, supplier_id')
    .in('id', uniquePeriodIds);
  const periods = (periodsRaw ?? []) as PeriodBatchRow[];
  if (periods.length === 0) return { error: 'Periodos de reporte no encontrados', skipped };

  const supplierIds = [...new Set(periods.map((p) => p.supplier_id))];
  const { data: suppliersRaw } = await supabase
    .from('suppliers')
    .select('id, organization_id')
    .in('id', supplierIds);
  const suppliers = (suppliersRaw ?? []) as SupplierBatchRow[];

  const orgIds = [...new Set(suppliers.map((s) => s.organization_id))];
  const { data: membershipsRaw } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .in('organization_id', orgIds);
  const memberships = (membershipsRaw ?? []) as MembershipBatchRow[];
  const authorizedOrgIds = new Set(memberships.map((m) => m.organization_id));

  if (orgIds.some((id) => !authorizedOrgIds.has(id))) {
    return { error: 'Sin permisos para importar actividad en estos periodos' };
  }

  const entryRepo = new ActivityEntryRepository(supabase);
  let imported = 0;
  const now = new Date();

  for (const row of validRows) {
    if (!row.data) continue;

    const activityKind = buildActivityKind(row.data.source_type, row.data.secondary);
    if (!activityKind) {
      skipped = skipped + 1;
      continue;
    }

    const entry = new ActivityEntry({
      id: crypto.randomUUID(),
      reportingPeriodId: row.data.reporting_period_id,
      sourceType: row.data.source_type,
      activityKind,
      rawQuantity: row.data.raw_quantity,
      rawUnit: row.data.raw_unit as Unit,
      status: 'submitted',
      submittedAt: now,
      submittedBy: user.id,
      createdAt: now,
    });

    try {
      await entryRepo.save(entry);
      imported = imported + 1;
    } catch {
      skipped = skipped + 1;
    }
  }

  revalidatePath('/activity');
  return { success: true, imported, skipped };
}

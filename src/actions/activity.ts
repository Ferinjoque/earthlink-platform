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
import { parseXlsxBuffer } from '@/lib/xlsx';
import type { ActivityKind, Unit, WaterSubtype, WasteSubtype } from '@/calc/types';
import type { EmissionSourceType } from '@/types/database';


const SOURCE_TYPES_ENUM = [
  'stationary_combustion',
  'mobile_combustion',
  'purchased_electricity',
  'purchased_steam',
  'fugitive',
  'water_use',
  'waste',
] as const;

const DATA_QUALITY_VALUES = ['measured', 'estimated', 'calculated'] as const;

const createEntrySchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  year_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato de mes inválido (YYYY-MM)'),
  source_type: z.enum(SOURCE_TYPES_ENUM),
  secondary: z.string().default(''),
  raw_quantity: z.coerce.number().positive('La cantidad debe ser positiva'),
  raw_unit: z.string().min(1, 'La unidad es obligatoria'),
  data_quality: z.enum(DATA_QUALITY_VALUES).default('measured'),
  notes: z.string().optional(),
});


export interface ActivityFormState {
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
  success?: boolean | undefined;
  submittedAt?: number | undefined;
}

export interface CsvImportState {
  error?: string | undefined;
  imported?: number | undefined;
  skipped?: number | undefined;
  success?: boolean | undefined;
  submittedAt?: number | undefined;
}


const STATIONARY_FUELS = [
  'natural_gas', 'diesel', 'lpg', 'fuel_oil_no2', 'propane',
] as const;

const MOBILE_FUELS = ['diesel', 'gasoline', 'lpg'] as const;

const GRID_REGIONS = ['SEIN_PERU', 'LATAM_AVG', 'US_AVERAGE', 'EU_AVERAGE'] as const;

const REFRIGERANTS = ['R410A', 'R134A', 'R32'] as const;

const WATER_SUBTYPES: WaterSubtype[] = [
  'all_sources', 'potable_mixed', 'potable_indoor', 'reclaimed_mixed', 'well_outdoor', 'other_mixed',
];

const WASTE_SUBTYPES: WasteSubtype[] = ['disposed_trash', 'recycled', 'composted'];

function buildActivityKind(sourceType: string, secondary: string): ActivityKind | null {
  switch (sourceType) {
    case 'stationary_combustion': {
      const fuel = secondary as (typeof STATIONARY_FUELS)[number];
      if (!(STATIONARY_FUELS as readonly string[]).includes(fuel)) return null;
      return { kind: 'stationary_combustion', fuel };
    }
    case 'mobile_combustion': {
      const fuel = secondary as (typeof MOBILE_FUELS)[number];
      if (!(MOBILE_FUELS as readonly string[]).includes(fuel)) return null;
      return { kind: 'mobile_combustion', fuel };
    }
    case 'purchased_electricity': {
      const gridRegion = secondary as (typeof GRID_REGIONS)[number];
      if (!(GRID_REGIONS as readonly string[]).includes(gridRegion)) return null;
      return { kind: 'purchased_electricity', gridRegion };
    }
    case 'purchased_steam':
      return { kind: 'purchased_steam' };
    case 'fugitive': {
      const refrigerant = secondary as (typeof REFRIGERANTS)[number];
      if (!(REFRIGERANTS as readonly string[]).includes(refrigerant)) return null;
      return { kind: 'fugitive', refrigerant };
    }
    case 'water_use': {
      const subtype = secondary as WaterSubtype;
      if (!WATER_SUBTYPES.includes(subtype)) return null;
      return { kind: 'water_use', subtype };
    }
    case 'waste': {
      const subtype = secondary as WasteSubtype;
      if (!WASTE_SUBTYPES.includes(subtype)) return null;
      return { kind: 'waste', subtype };
    }
    default:
      return null;
  }
}


const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] as const;

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

async function findOrCreatePeriod(
  supabase: SupabaseClient,
  supplierId: string,
  yearMonth: string, // "YYYY-MM"
): Promise<{ periodId: string } | { error: string }> {
  const parts = yearMonth.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { error: 'Formato de mes inválido' };
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  type PeriodRow = { id: string; status: string };
  const { data: existing } = await supabase
    .from('reporting_periods')
    .select('id, status')
    .eq('supplier_id', supplierId)
    .eq('start_date', startDate)
    .maybeSingle();

  const existingPeriod = existing as PeriodRow | null;

  if (existingPeriod) {
    if (existingPeriod.status === 'locked') {
      return { error: 'El periodo de ese mes está bloqueado y no acepta nuevas entradas' };
    }
    return { periodId: existingPeriod.id };
  }

  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = `${MESES_CORTO[month - 1] ?? ''} ${year}`;

  type NewPeriodRow = { id: string };
  const { data: newPeriod, error: insertError } = await supabase
    .from('reporting_periods')
    .insert({
      supplier_id: supplierId,
      label,
      start_date: startDate,
      end_date: endDate,
      status: 'open' as const,
    })
    .select('id')
    .single();

  if (insertError || !newPeriod) {
    return { error: 'No se pudo crear el periodo de reporte' };
  }

  revalidatePath('/suppliers');
  revalidatePath('/audit');

  return { periodId: (newPeriod as NewPeriodRow).id };
}


type SupplierOrg = { organization_id: string };
type MembershipCheck = { role: string; supplier_id: string | null };

async function verifySupplierAccess(
  supabase: SupabaseClient,
  supplierId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplierId)
    .maybeSingle();
  const supplier = supplierRaw as SupplierOrg | null;
  if (!supplier) return { error: 'Proveedor no encontrado' };

  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role, supplier_id')
    .eq('user_id', userId)
    .eq('organization_id', supplier.organization_id)
    .maybeSingle();
  const mem = memRaw as MembershipCheck | null;
  if (!mem) return { error: 'Sin permisos para registrar actividad en este proveedor' };

  // Rol 'supplier' solo puede escribir en su proveedor asignado
  if (mem.role === 'supplier' && mem.supplier_id !== supplierId) {
    return { error: 'Sin permisos para registrar actividad en este proveedor' };
  }

  return { ok: true };
}


export async function createActivityEntry(
  _prevState: ActivityFormState | null,
  formData: FormData,
): Promise<ActivityFormState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', submittedAt: Date.now() };

  const parsed = createEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { fieldErrors };
  }

  const { supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, data_quality } = parsed.data;

  const accessCheck = await verifySupplierAccess(supabase, supplier_id, user.id);
  if ('error' in accessCheck) return { error: accessCheck.error, submittedAt: Date.now() };

  const periodResult = await findOrCreatePeriod(supabase, supplier_id, year_month);
  if ('error' in periodResult) return { error: periodResult.error, submittedAt: Date.now() };

  const reporting_period_id = periodResult.periodId;

  const activityKind = buildActivityKind(source_type, secondary);
  if (!activityKind) {
    return {
      error: `Valor inválido "${secondary}" para el tipo de fuente "${source_type}"`,
      submittedAt: Date.now(),
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
    dataQuality: data_quality,
  });

  try {
    await entryRepo.save(newEntry);
  } catch {
    return { error: 'Error al guardar el registro. Intenta nuevamente.', submittedAt: Date.now() };
  }

  // Detección de anomalías — no crítica, no bloquea si falla
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
    // Entrada guardada — la detección de anomalías es opcional
  }

  revalidatePath('/activity');
  return { success: true, submittedAt: Date.now() };
}


export async function importActivityCsv(
  _prevState: CsvImportState | null,
  formData: FormData,
): Promise<CsvImportState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', submittedAt: Date.now() };

  const csvText = formData.get('csv_text');
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return { error: 'No se proporcionaron datos CSV', submittedAt: Date.now() };
  }
  if (csvText.length > 512_000) {
    return { error: 'El archivo CSV supera el límite de 512 KB', submittedAt: Date.now() };
  }

  const rows = parseCsvText(csvText);
  const validRows = rows.filter((r) => r.errors.length === 0 && r.data !== null);
  let skipped = rows.length - validRows.length;

  if (validRows.length === 0) {
    return {
      error: `No se encontraron filas válidas. ${skipped} fila(s) con errores de validación.`,
      skipped,
      submittedAt: Date.now(),
    };
  }

  // Verificar que el usuario tenga acceso a todos los proveedores del lote
  const uniqueSupplierIds = [...new Set(validRows.map((r) => r.data!.supplier_id))];
  for (const supplierId of uniqueSupplierIds) {
    const check = await verifySupplierAccess(supabase, supplierId, user.id);
    if ('error' in check) return { error: check.error, submittedAt: Date.now() };
  }

  const entryRepo = new ActivityEntryRepository(supabase);
  let imported = 0;
  const now = new Date();

  for (const row of validRows) {
    if (!row.data) continue;

    const periodResult = await findOrCreatePeriod(supabase, row.data.supplier_id, row.data.year_month);
    if ('error' in periodResult) {
      skipped = skipped + 1;
      continue;
    }

    const activityKind = buildActivityKind(row.data.source_type, row.data.secondary);
    if (!activityKind) {
      skipped = skipped + 1;
      continue;
    }

    const entry = new ActivityEntry({
      id: crypto.randomUUID(),
      reportingPeriodId: periodResult.periodId,
      sourceType: row.data.source_type,
      activityKind,
      rawQuantity: row.data.raw_quantity,
      rawUnit: row.data.raw_unit as Unit,
      status: 'submitted',
      submittedAt: now,
      submittedBy: user.id,
      createdAt: now,
      dataQuality: row.data.data_quality,
    });

    try {
      await entryRepo.save(entry);
      imported = imported + 1;
    } catch {
      skipped = skipped + 1;
    }
  }

  revalidatePath('/activity');
  return { success: true, imported, skipped, submittedAt: Date.now() };
}


const bulkEntrySchema = z.array(
  z.object({
    supplier_id: z.string().uuid('UUID de proveedor inválido'),
    year_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato YYYY-MM inválido'),
    source_type: z.enum(SOURCE_TYPES_ENUM),
    secondary: z.string().default(''),
    raw_quantity: z.coerce.number().positive('La cantidad debe ser positiva'),
    raw_unit: z.string().min(1, 'Unidad obligatoria'),
    data_quality: z.enum(DATA_QUALITY_VALUES).default('measured'),
    notes: z.string().optional(),
  }),
).min(1, 'Se requiere al menos una fila');

export async function importActivityBulk(
  _prevState: CsvImportState | null,
  formData: FormData,
): Promise<CsvImportState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', submittedAt: Date.now() };

  const rawJson = formData.get('json_entries');
  if (typeof rawJson !== 'string' || !rawJson.trim()) {
    return { error: 'No se proporcionaron datos', submittedAt: Date.now() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { error: 'Formato de datos inválido', submittedAt: Date.now() };
  }

  const validation = bulkEntrySchema.safeParse(parsed);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Datos inválidos', submittedAt: Date.now() };
  }

  const bulkRows = validation.data;

  // Verificar acceso por lote
  const uniqueSupplierIds = [...new Set(bulkRows.map((r) => r.supplier_id))];
  for (const supplierId of uniqueSupplierIds) {
    const check = await verifySupplierAccess(supabase, supplierId, user.id);
    if ('error' in check) return { error: check.error, submittedAt: Date.now() };
  }

  const entryRepo = new ActivityEntryRepository(supabase);
  let importedCount = 0;
  let skippedCount = 0;
  const now = new Date();

  for (const row of bulkRows) {
    const periodResult = await findOrCreatePeriod(supabase, row.supplier_id, row.year_month);
    if ('error' in periodResult) { skippedCount++; continue; }

    const activityKind = buildActivityKind(row.source_type, row.secondary);
    if (!activityKind) { skippedCount++; continue; }

    const entry = new ActivityEntry({
      id: crypto.randomUUID(),
      reportingPeriodId: periodResult.periodId,
      sourceType: row.source_type,
      activityKind,
      rawQuantity: row.raw_quantity,
      rawUnit: row.raw_unit as Unit,
      status: 'submitted',
      submittedAt: now,
      submittedBy: user.id,
      createdAt: now,
      dataQuality: row.data_quality,
    });

    try {
      await entryRepo.save(entry);
      importedCount++;
    } catch {
      skippedCount++;
    }
  }

  revalidatePath('/activity');
  return { success: true, imported: importedCount, skipped: skippedCount, submittedAt: Date.now() };
}


export interface VoidEntryState {
  error?: string | undefined;
  success?: boolean | undefined;
}

export async function voidActivityEntry(
  _prev: VoidEntryState | null,
  formData: FormData,
): Promise<VoidEntryState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const entryId = formData.get('entry_id');
  const reason = formData.get('void_reason');
  if (typeof entryId !== 'string' || !entryId) return { error: 'Falta el ID del registro' };
  if (typeof reason !== 'string' || !reason.trim()) {
    return { error: 'La razón de anulación es obligatoria' };
  }

  type EntryPeriod = {
    voided_at: string | null;
    reporting_period_id: string;
    reporting_periods: { status: string; suppliers: { organization_id: string } };
  };
  const { data: entryRaw } = await supabase
    .from('activity_entries')
    .select('voided_at, reporting_period_id, reporting_periods(status, suppliers(organization_id))')
    .eq('id', entryId)
    .maybeSingle();
  const entryData = entryRaw as EntryPeriod | null;
  if (!entryData) return { error: 'Registro no encontrado' };
  if (entryData.voided_at) return { error: 'Este registro ya está anulado' };

  const periodStatus = entryData.reporting_periods?.status;
  const orgId = entryData.reporting_periods?.suppliers?.organization_id;
  if (!orgId) return { error: 'Proveedor del registro no encontrado' };

  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle();
  const mem = memRaw as { role: string } | null;
  if (!mem) return { error: 'Sin permisos para este registro' };

  if (periodStatus === 'locked' && mem.role !== 'admin') {
    return { error: 'Solo administradores pueden anular registros en periodos bloqueados' };
  }

  const { error: updateError } = await supabase
    .from('activity_entries')
    .update({
      voided_at: new Date().toISOString(),
      void_reason: reason.trim(),
      voided_by: user.id,
    })
    .eq('id', entryId);
  if (updateError) return { error: `Error al anular: ${updateError.message}` };

  revalidatePath('/activity');
  revalidatePath('/audit');
  return { success: true };
}


export interface DeleteEntryState {
  error?: string | undefined;
  success?: boolean | undefined;
}

export async function deleteActivityEntry(
  _prev: DeleteEntryState | null,
  formData: FormData,
): Promise<DeleteEntryState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const entryId = formData.get('entry_id');
  if (typeof entryId !== 'string' || !entryId) return { error: 'Falta el ID del registro' };

  // Obtener estado del periodo y org mediante join
  type EntryPeriod = {
    reporting_period_id: string;
    reporting_periods: { status: string; suppliers: { organization_id: string } };
  };
  const { data: entryRaw } = await supabase
    .from('activity_entries')
    .select('reporting_period_id, reporting_periods(status, suppliers(organization_id))')
    .eq('id', entryId)
    .maybeSingle();
  const entryData = entryRaw as EntryPeriod | null;
  if (!entryData) return { error: 'Registro no encontrado' };

  const periodStatus = entryData.reporting_periods?.status;
  const orgId = entryData.reporting_periods?.suppliers?.organization_id;

  if (!orgId) return { error: 'Proveedor del registro no encontrado' };

  // Verificar membresía en la organización
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para eliminar este registro' };

  if (periodStatus === 'locked') {
    return { error: 'Periodo bloqueado. Contacta al administrador.' };
  }

  const { error: deleteError } = await supabase
    .from('activity_entries')
    .delete()
    .eq('id', entryId);
  if (deleteError) return { error: `Error al eliminar: ${deleteError.message}` };

  revalidatePath('/activity');
  return { success: true };
}


export async function importActivityXlsx(
  _prevState: CsvImportState | null,
  formData: FormData,
): Promise<CsvImportState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado', submittedAt: Date.now() };

  const file = formData.get('xlsx_file') as File | null;
  if (!file) return { error: 'No se subió ningún archivo', submittedAt: Date.now() };

  if (file.size > 5_000_000) {
    return { error: 'El archivo supera el límite de 5 MB', submittedAt: Date.now() };
  }

  const buffer = await file.arrayBuffer();
  const rows = await parseXlsxBuffer(buffer);

  const validRows = rows.filter((r) => r.errors.length === 0 && r.data !== null);
  let skipped = rows.length - validRows.length;

  if (validRows.length === 0) {
    return {
      error: `No se encontraron filas válidas. ${skipped} fila(s) con errores.`,
      skipped,
      submittedAt: Date.now(),
    };
  }

  // Verificar acceso por lote
  const uniqueSupplierIds = [...new Set(validRows.map((r) => r.data!.supplier_id))];
  for (const supplierId of uniqueSupplierIds) {
    const check = await verifySupplierAccess(supabase, supplierId, user.id);
    if ('error' in check) return { error: check.error, skipped, submittedAt: Date.now() };
  }

  const entryRepo = new ActivityEntryRepository(supabase);
  let importedCount = 0;
  const now = new Date();

  for (const row of validRows) {
    if (!row.data) continue;

    const periodResult = await findOrCreatePeriod(supabase, row.data.supplier_id, row.data.year_month);
    if ('error' in periodResult) { skipped++; continue; }

    const activityKind = buildActivityKind(row.data.source_type, row.data.secondary);
    if (!activityKind) { skipped++; continue; }

    const entry = new ActivityEntry({
      id: crypto.randomUUID(),
      reportingPeriodId: periodResult.periodId,
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
      importedCount++;
    } catch {
      skipped++;
    }
  }

  revalidatePath('/activity');
  return { success: true, imported: importedCount, skipped, submittedAt: Date.now() };
}

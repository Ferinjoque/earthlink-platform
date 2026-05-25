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
import type { Database } from '@/types/database';

type ActivityEntryInsert = Database['public']['Tables']['activity_entries']['Insert'];


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
  secondary: z.string().max(100, 'El subtipo no puede superar 100 caracteres').default(''),
  raw_quantity: z.coerce.number().nonnegative('La cantidad debe ser mayor o igual a cero'),
  raw_unit: z.string().min(1, 'La unidad es obligatoria').max(50, 'La unidad no puede superar 50 caracteres'),
  data_quality: z.enum(DATA_QUALITY_VALUES).default('measured'),
  notes: z.string().max(1000, 'Las notas no pueden superar 1000 caracteres').optional(),
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
  entryIds?: string[] | undefined;
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
    // Conflicto de unicidad: otra solicitud concurrente creó el periodo primero
    if (insertError?.code === '23505') {
      const { data: retryRaw } = await supabase
        .from('reporting_periods')
        .select('id, status')
        .eq('supplier_id', supplierId)
        .eq('start_date', startDate)
        .maybeSingle();
      const retryPeriod = retryRaw as PeriodRow | null;
      if (retryPeriod) {
        if (retryPeriod.status === 'locked') {
          return { error: 'El periodo de ese mes está bloqueado y no acepta nuevas entradas' };
        }
        return { periodId: retryPeriod.id };
      }
    }
    return { error: 'No se pudo crear el periodo de reporte' };
  }

  revalidatePath('/suppliers');
  revalidatePath('/audit');

  return { periodId: (newPeriod as NewPeriodRow).id };
}


interface ImportRowData {
  supplier_id: string;
  year_month: string;
  source_type: string;
  secondary: string;
  raw_quantity: number;
  raw_unit: string;
  data_quality: string;
  notes?: string;
}

/**
 * Resuelve periodos en batch (deduplica pares supplier+mes) y construye las filas de BD
 * listas para un INSERT masivo. Reduce N consultas a K (K = periodos únicos).
 */
async function buildBatchEntries(
  supabase: SupabaseClient,
  rows: ImportRowData[],
  userId: string,
  now: Date,
): Promise<{ entryRows: ActivityEntryInsert[]; skipped: number }> {
  const uniqueKeys = [...new Set(rows.map((r) => `${r.supplier_id}|${r.year_month}`))];
  const periodMap = new Map<string, string>();

  for (const key of uniqueKeys) {
    const pipeIdx = key.indexOf('|');
    const supplierId = key.slice(0, pipeIdx);
    const yearMonth = key.slice(pipeIdx + 1);
    const result = await findOrCreatePeriod(supabase, supplierId, yearMonth);
    if (!('error' in result)) periodMap.set(key, result.periodId);
  }

  let skipped = 0;
  const entryRows: ActivityEntryInsert[] = [];

  for (const row of rows) {
    const key = `${row.supplier_id}|${row.year_month}`;
    const periodId = periodMap.get(key);
    if (!periodId) { skipped = skipped + 1; continue; }
    const activityKind = buildActivityKind(row.source_type, row.secondary);
    if (!activityKind) { skipped = skipped + 1; continue; }
    entryRows.push({
      id: crypto.randomUUID(),
      reporting_period_id: periodId,
      source_type: row.source_type,
      activity_kind: activityKind as ActivityEntryInsert['activity_kind'],
      raw_quantity: row.raw_quantity,
      raw_unit: row.raw_unit,
      status: 'submitted',
      submitted_at: now.toISOString(),
      submitted_by: userId,
      created_at: now.toISOString(),
      data_quality: row.data_quality,
      notes: row.notes ?? null,
    });
  }

  return { entryRows, skipped };
}


type SupplierOrg = { organization_id: string; archived_at: string | null };
type MembershipCheck = { role: string; supplier_id: string | null };

async function verifySupplierAccess(
  supabase: SupabaseClient,
  supplierId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id, archived_at')
    .eq('id', supplierId)
    .maybeSingle();
  const supplier = supplierRaw as SupplierOrg | null;
  if (!supplier) return { error: 'Proveedor no encontrado' };
  if (supplier.archived_at) return { error: 'No se puede registrar actividad en un proveedor archivado' };

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

  const { supplier_id, year_month, source_type, secondary, raw_quantity, raw_unit, data_quality, notes } = parsed.data;

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
    notes: notes ?? null,
  });

  try {
    await entryRepo.save(newEntry);
  } catch {
    return { error: 'Error al guardar el registro. Intenta nuevamente.', submittedAt: Date.now() };
  }

  // Detección de anomalías — no crítica, no bloquea si falla
  // Línea base: entradas del año anterior del mismo proveedor (igual que calculatePeriod)
  try {
    const entryYear = Number(year_month.split('-')[0]);
    const priorYear = entryYear - 1;
    const { data: priorPeriodsRaw } = await supabase
      .from('reporting_periods')
      .select('id')
      .eq('supplier_id', supplier_id)
      .gte('start_date', `${priorYear}-01-01`)
      .lte('start_date', `${priorYear}-12-31`);
    const priorPeriodIds = (priorPeriodsRaw ?? []).map((p: { id: string }) => p.id);
    const historical = priorPeriodIds.length > 0
      ? await entryRepo.findByPeriodIds(priorPeriodIds)
      : [];
    const svc = new AnomalyService();
    const anomalies = svc.detect([newEntry], historical);

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
  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers', 'layout');
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

  if (validRows.length > 500) {
    return {
      error: 'El CSV contiene más de 500 filas válidas. Divide el archivo en lotes de máximo 500 filas.',
      skipped,
      submittedAt: Date.now(),
    };
  }

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
    if ('error' in check) return { error: check.error, skipped, submittedAt: Date.now() };
  }

  const now = new Date();
  const rowData: ImportRowData[] = validRows
    .filter((r) => r.data !== null)
    .map((r) => {
      const d = r.data!;
      const base: ImportRowData = {
        supplier_id: d.supplier_id,
        year_month: d.year_month,
        source_type: d.source_type,
        secondary: d.secondary,
        raw_quantity: d.raw_quantity,
        raw_unit: d.raw_unit,
        data_quality: d.data_quality,
      };
      if (d.notes !== undefined) base.notes = d.notes;
      return base;
    });

  const { entryRows, skipped: periodSkipped } = await buildBatchEntries(supabase, rowData, user.id, now);
  skipped = skipped + periodSkipped;

  if (entryRows.length > 0) {
    const { error: insertError } = await supabase.from('activity_entries').insert(entryRows);
    if (insertError) return { error: 'Error al guardar registros. Intenta nuevamente.', skipped, submittedAt: Date.now() };
  }

  revalidatePath('/activity');
  revalidatePath('/audit');
  return { success: true, imported: entryRows.length, skipped, submittedAt: Date.now() };
}


const bulkEntrySchema = z.array(
  z.object({
    supplier_id: z.string().uuid('UUID de proveedor inválido'),
    year_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato YYYY-MM inválido'),
    source_type: z.enum(SOURCE_TYPES_ENUM),
    secondary: z.string().max(100, 'El subtipo no puede superar 100 caracteres').default(''),
    raw_quantity: z.coerce.number().nonnegative('La cantidad debe ser mayor o igual a cero'),
    raw_unit: z.string().min(1, 'Unidad obligatoria').max(50, 'La unidad no puede superar 50 caracteres'),
    data_quality: z.enum(DATA_QUALITY_VALUES).default('measured'),
    notes: z.string().max(1000, 'Las notas no pueden superar 1000 caracteres').optional(),
  }),
).min(1, 'Se requiere al menos una fila').max(500, 'No se pueden importar más de 500 filas por lote');

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
  if (rawJson.length > 500_000) {
    return { error: 'El lote supera el límite permitido (500 KB)', submittedAt: Date.now() };
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

  const now = new Date();
  const rowData: ImportRowData[] = bulkRows.map((row) => {
    const base: ImportRowData = {
      supplier_id: row.supplier_id,
      year_month: row.year_month,
      source_type: row.source_type,
      secondary: row.secondary,
      raw_quantity: row.raw_quantity,
      raw_unit: row.raw_unit,
      data_quality: row.data_quality,
    };
    if (row.notes !== undefined) base.notes = row.notes;
    return base;
  });

  const { entryRows, skipped } = await buildBatchEntries(supabase, rowData, user.id, now);

  if (entryRows.length > 0) {
    const { error: insertError } = await supabase.from('activity_entries').insert(entryRows);
    if (insertError) return { error: 'Error al guardar registros. Intenta nuevamente.', skipped, submittedAt: Date.now() };
  }

  revalidatePath('/activity');
  revalidatePath('/audit');
  return {
    success: true,
    imported: entryRows.length,
    skipped,
    entryIds: entryRows.map((r) => r.id as string),
    submittedAt: Date.now(),
  };
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
  if (typeof entryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId))
    return { error: 'ID de registro inválido' };
  if (typeof reason !== 'string' || !reason.trim()) {
    return { error: 'La razón de anulación es obligatoria' };
  }
  if (reason.trim().length > 1000) {
    return { error: 'La razón de anulación no puede superar 1000 caracteres' };
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
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  const mem = memRaw as { role: string } | null;
  if (!mem) return { error: 'Sin permisos para este registro' };

  if (periodStatus === 'calculating') {
    return { error: 'No se puede anular registros mientras el periodo está siendo calculado' };
  }
  if (periodStatus === 'under_review' && mem.role !== 'admin') {
    return { error: 'Solo administradores pueden anular registros en periodos bajo revisión' };
  }
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
  if (updateError) return { error: 'Error al anular el registro. Intenta nuevamente.' };

  revalidatePath('/activity');
  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
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
  if (typeof entryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId))
    return { error: 'ID de registro inválido' };

  // Obtener estado del periodo y org mediante join
  type EntryPeriod = {
    reporting_period_id: string;
    voided_at: string | null;
    reporting_periods: { status: string; suppliers: { organization_id: string } };
  };
  const { data: entryRaw } = await supabase
    .from('activity_entries')
    .select('reporting_period_id, voided_at, reporting_periods(status, suppliers(organization_id))')
    .eq('id', entryId)
    .maybeSingle();
  const entryData = entryRaw as EntryPeriod | null;
  if (!entryData) return { error: 'Registro no encontrado' };

  if (entryData.voided_at !== null) {
    return { error: 'El registro ya fue anulado y no puede eliminarse. Usa la anulación para mantener la trazabilidad.' };
  }

  const periodStatus = entryData.reporting_periods?.status;
  const orgId = entryData.reporting_periods?.suppliers?.organization_id;

  if (!orgId) return { error: 'Proveedor del registro no encontrado' };

  // Solo admin/consultant pueden eliminar entradas
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para eliminar este registro' };

  if (periodStatus === 'calculating') {
    return { error: 'No se puede eliminar registros mientras el periodo está siendo calculado' };
  }
  if (periodStatus === 'locked') {
    return { error: 'Periodo bloqueado. Contacta al administrador.' };
  }

  const { error: deleteError } = await supabase
    .from('activity_entries')
    .delete()
    .eq('id', entryId);
  if (deleteError) return { error: 'Error al eliminar el registro. Intenta nuevamente.' };

  revalidatePath('/activity');
  revalidatePath('/audit');
  revalidatePath('/suppliers');
  revalidatePath('/dashboard');
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

  // Verificar magic bytes de ZIP/XLSX (PK\x03\x04) para rechazar binarios arbitrarios
  const magic = new Uint8Array(buffer.slice(0, 4));
  if (magic.length < 4 || magic[0] !== 0x50 || magic[1] !== 0x4b || magic[2] !== 0x03 || magic[3] !== 0x04) {
    return { error: 'El archivo no es un Excel válido (.xlsx)', submittedAt: Date.now() };
  }

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

  const now = new Date();
  const rowData: ImportRowData[] = validRows
    .filter((r) => r.data !== null)
    .map((r) => {
      const d = r.data!;
      const base: ImportRowData = {
        supplier_id: d.supplier_id,
        year_month: d.year_month,
        source_type: d.source_type,
        secondary: d.secondary,
        raw_quantity: d.raw_quantity,
        raw_unit: d.raw_unit,
        data_quality: d.data_quality,
      };
      if (d.notes !== undefined) base.notes = d.notes;
      return base;
    });

  const { entryRows, skipped: periodSkipped } = await buildBatchEntries(supabase, rowData, user.id, now);
  skipped = skipped + periodSkipped;

  if (entryRows.length > 0) {
    const { error: insertError } = await supabase.from('activity_entries').insert(entryRows);
    if (insertError) return { error: 'Error al guardar registros. Intenta nuevamente.', skipped, submittedAt: Date.now() };
  }

  revalidatePath('/activity');
  revalidatePath('/audit');
  return { success: true, imported: entryRows.length, skipped, submittedAt: Date.now() };
}

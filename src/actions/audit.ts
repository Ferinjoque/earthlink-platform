'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/services/supabase/server';
import { AuditService } from '@/services/AuditService';
import { EvaluationService } from '@/services/EvaluationService';
import { ActivityEntryRepository } from '@/repos/ActivityEntryRepository';
import { EmissionFactorRepository } from '@/repos/EmissionFactorRepository';
import { UnitConversionRepository } from '@/repos/UnitConversionRepository';
import { EmissionResultRepository } from '@/repos/EmissionResultRepository';
import { ReportingPeriodRepository } from '@/repos/ReportingPeriodRepository';
import { AuditLogRepository } from '@/repos/AuditLogRepository';

// ── State types ───────────────────────────────────────────────────────────────

export interface AuditActionState {
  error?: string | undefined;
  success?: boolean | undefined;
  totals?:
    | {
        totalCo2eKg: number;
        scope1Co2eKg: number;
        scope2Co2eKg: number;
        entryCount: number;
        errorCount: number;
      }
    | undefined;
}

// ── calculatePeriod ───────────────────────────────────────────────────────────

export async function calculatePeriod(
  _prevState: AuditActionState | null,
  formData: FormData,
): Promise<AuditActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const periodId = formData.get('period_id');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Falta el ID del periodo' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verify caller belongs to the org that owns this period
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor del periodo no encontrado' };
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para gestionar este periodo' };

  if (period.status !== 'open') {
    return {
      error: `El periodo está en estado "${period.status}" — solo los periodos abiertos pueden calcularse`,
    };
  }

  const auditSvc = new AuditService(periodRepo, auditLogRepo);

  try {
    await auditSvc.transitionStatus(periodId, 'calculating', user.id);
  } catch {
    return { error: 'Error al iniciar el cálculo del periodo' };
  }

  const evalSvc = new EvaluationService(
    new ActivityEntryRepository(supabase),
    new EmissionFactorRepository(supabase),
    new UnitConversionRepository(supabase),
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  let outcome: Awaited<ReturnType<EvaluationService['evaluate']>>;
  try {
    outcome = await evalSvc.evaluate(periodId);
  } catch (err) {
    return {
      error: `Error en la evaluación: ${err instanceof Error ? err.message : 'error desconocido'}`,
    };
  }

  try {
    await auditSvc.transitionStatus(periodId, 'under_review', user.id);
  } catch {
    return { error: 'Evaluación completada pero error al transicionar el periodo a revisión' };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return {
    success: true,
    totals: {
      totalCo2eKg: outcome.totals.totalCo2eKg,
      scope1Co2eKg: outcome.totals.byScope.scope1,
      scope2Co2eKg: outcome.totals.byScope.scope2,
      entryCount: outcome.totals.recordCount,
      errorCount: outcome.errors.length,
    },
  };
}

// ── lockPeriod ────────────────────────────────────────────────────────────────

export async function lockPeriod(
  _prevState: AuditActionState | null,
  formData: FormData,
): Promise<AuditActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const periodId = formData.get('period_id');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Falta el ID del periodo' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verify caller belongs to the org that owns this period
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor del periodo no encontrado' };
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para gestionar este periodo' };

  if (period.status !== 'under_review') {
    return {
      error: `El periodo está en estado "${period.status}" — solo los periodos en revisión pueden bloquearse`,
    };
  }

  const auditSvc = new AuditService(periodRepo, auditLogRepo);

  try {
    await auditSvc.lock(periodId, user.id);
  } catch (err) {
    return {
      error: `Error al bloquear el periodo: ${err instanceof Error ? err.message : 'error desconocido'}`,
    };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true };
}

// ── recalculatePeriod ─────────────────────────────────────────────────────────

export interface RecalculateState {
  error?: string | undefined;
  success?: boolean | undefined;
  totals?:
    | {
        totalCo2eKg: number;
        scope1Co2eKg: number;
        scope2Co2eKg: number;
        entryCount: number;
      }
    | undefined;
}

export async function recalculatePeriod(
  _prevState: RecalculateState | null,
  formData: FormData,
): Promise<RecalculateState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const periodId = formData.get('period_id');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Falta el ID del periodo' };

  const periodRepo = new ReportingPeriodRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verify caller belongs to the org that owns this period
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor del periodo no encontrado' };
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin'])
    .maybeSingle();
  if (!memRaw) return { error: 'Solo administradores pueden recalcular periodos bloqueados' };

  // Delete existing emission_results for this period, then re-run evaluation
  const { error: deleteError } = await supabase
    .from('emission_results')
    .delete()
    .eq('reporting_period_id', periodId);
  if (deleteError) return { error: `Error al limpiar resultados previos: ${deleteError.message}` };

  const evalSvc = new EvaluationService(
    new ActivityEntryRepository(supabase),
    new EmissionFactorRepository(supabase),
    new UnitConversionRepository(supabase),
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  let outcome: Awaited<ReturnType<EvaluationService['evaluate']>>;
  try {
    outcome = await evalSvc.evaluate(periodId);
  } catch (err) {
    return {
      error: `Error en la evaluación: ${err instanceof Error ? err.message : 'error desconocido'}`,
    };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return {
    success: true,
    totals: {
      totalCo2eKg: outcome.totals.totalCo2eKg,
      scope1Co2eKg: outcome.totals.byScope.scope1,
      scope2Co2eKg: outcome.totals.byScope.scope2,
      entryCount: outcome.totals.recordCount,
    },
  };
}

// ── calculateYear ─────────────────────────────────────────────────────────────

export interface BatchYearState {
  error?: string | undefined;
  success?: boolean | undefined;
  calculated?: number | undefined;
  skipped?: number | undefined;
  errors?: string[] | undefined;
}

const calculateYearSchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function calculateYear(
  _prevState: BatchYearState | null,
  formData: FormData,
): Promise<BatchYearState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = calculateYearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const { supplier_id, year } = parsed.data;

  // Verify caller belongs to the org that owns this supplier
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplier_id)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor no encontrado' };
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para gestionar este proveedor' };

  // Find all open or under_review periods for this supplier+year
  type FilaPeriodo = { id: string; status: string };
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const { data: periodsRaw } = await supabase
    .from('reporting_periods')
    .select('id, status')
    .eq('supplier_id', supplier_id)
    .gte('start_date', startOfYear)
    .lte('start_date', endOfYear)
    .in('status', ['open', 'under_review']);

  const candidatos = (periodsRaw ?? []) as FilaPeriodo[];
  if (candidatos.length === 0) {
    return { success: true, calculated: 0, skipped: 0, errors: [] };
  }

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);
  const auditSvc = new AuditService(periodRepo, auditLogRepo);
  const evalSvc = new EvaluationService(
    new ActivityEntryRepository(supabase),
    new EmissionFactorRepository(supabase),
    new UnitConversionRepository(supabase),
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  let calculated = 0;
  let skipped = 0;
  const errores: string[] = [];

  for (const p of candidatos) {
    // Only calculate open periods (under_review already calculated — skip)
    if (p.status !== 'open') {
      skipped = skipped + 1;
      continue;
    }

    try {
      await auditSvc.transitionStatus(p.id, 'calculating', user.id);
    } catch {
      skipped = skipped + 1;
      continue;
    }

    try {
      await evalSvc.evaluate(p.id);
      await auditSvc.transitionStatus(p.id, 'under_review', user.id);
      calculated = calculated + 1;
    } catch (err) {
      errores.push(
        `Periodo ${p.id}: ${err instanceof Error ? err.message : 'error desconocido'}`,
      );
      skipped = skipped + 1;
    }
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true, calculated, skipped, errors: errores };
}

// ── closeYear ─────────────────────────────────────────────────────────────────

const closeYearSchema = z.object({
  supplier_id: z.string().uuid('ID de proveedor inválido'),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function closeYear(
  _prevState: BatchYearState | null,
  formData: FormData,
): Promise<BatchYearState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = closeYearSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const { supplier_id, year } = parsed.data;

  // Verify caller belongs to the org with admin/consultant role
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplier_id)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor no encontrado' };
  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permisos para gestionar este proveedor' };

  // Find only under_review periods for this supplier+year (must NOT include open/locked)
  type FilaPeriodo = { id: string; status: string };
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const { data: periodsRaw } = await supabase
    .from('reporting_periods')
    .select('id, status')
    .eq('supplier_id', supplier_id)
    .gte('start_date', startOfYear)
    .lte('start_date', endOfYear);

  const todosLosPeriodos = (periodsRaw ?? []) as FilaPeriodo[];
  const hayAbiertos = todosLosPeriodos.some((p) => p.status === 'open');
  if (hayAbiertos) {
    return {
      error:
        'Hay periodos abiertos sin calcular. Calcula todos los periodos antes de cerrar el año.',
    };
  }

  const enRevision = todosLosPeriodos.filter((p) => p.status === 'under_review');
  if (enRevision.length === 0) {
    return { success: true, calculated: 0, skipped: 0, errors: [] };
  }

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);
  const auditSvc = new AuditService(periodRepo, auditLogRepo);

  let bloqueados = 0;
  let skipped = 0;
  const errores: string[] = [];

  for (const p of enRevision) {
    try {
      await auditSvc.lock(p.id, user.id);
      bloqueados = bloqueados + 1;
    } catch (err) {
      errores.push(
        `Periodo ${p.id}: ${err instanceof Error ? err.message : 'error desconocido'}`,
      );
      skipped = skipped + 1;
    }
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true, calculated: bloqueados, skipped, errors: errores };
}

// ── resolveAnomaly ────────────────────────────────────────────────────────────

export interface ResolveAnomalyState {
  error?: string | undefined;
  success?: boolean | undefined;
}

export async function resolveAnomaly(
  _prevState: ResolveAnomalyState | null,
  formData: FormData,
): Promise<ResolveAnomalyState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const flagId = formData.get('flag_id');
  if (typeof flagId !== 'string' || !flagId) return { error: 'Falta el ID de la anomalía' };
  const resolutionNote = formData.get('resolution_note');
  const note = typeof resolutionNote === 'string' && resolutionNote.trim() ? resolutionNote.trim() : null;

  // Verify caller belongs to same org as the anomaly flag
  type FlagOrg = {
    activity_entries: { reporting_periods: { suppliers: { organization_id: string } } };
  };
  const { data: flagRaw } = await supabase
    .from('anomaly_flags')
    .select('activity_entries(reporting_periods(suppliers(organization_id)))')
    .eq('id', flagId)
    .maybeSingle();
  const flagData = flagRaw as FlagOrg | null;
  const flagOrgId = flagData?.activity_entries?.reporting_periods?.suppliers?.organization_id;
  if (!flagOrgId) return { error: 'Anomalía no encontrada' };

  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', flagOrgId)
    .in('role', ['admin', 'consultant'])
    .maybeSingle();
  if (!memRaw) return { error: 'Sin permiso para resolver esta anomalía' };

  const { error } = await supabase
    .from('anomaly_flags')
    .update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_note: note,
    })
    .eq('id', flagId);

  if (error) return { error: `Error al resolver anomalía: ${error.message}` };

  revalidatePath('/audit');
  return { success: true };
}

// ── unlockPeriod ──────────────────────────────────────────────────────────────

export interface UnlockPeriodState {
  error?: string | undefined;
  success?: boolean | undefined;
}

export async function unlockPeriod(
  _prevState: UnlockPeriodState | null,
  formData: FormData,
): Promise<UnlockPeriodState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const periodId = formData.get('period_id');
  const reason = formData.get('unlock_reason');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Falta el ID del periodo' };
  if (typeof reason !== 'string' || !reason.trim()) {
    return { error: 'La razón de desbloqueo es obligatoria' };
  }

  const periodRepo = new ReportingPeriodRepository(supabase);
  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .maybeSingle();
  const supplierOrg = supplierRaw as SupplierOrg | null;
  if (!supplierOrg) return { error: 'Proveedor del periodo no encontrado' };

  const { data: memRaw } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplierOrg.organization_id)
    .in('role', ['admin'])
    .maybeSingle();
  if (!memRaw) return { error: 'Solo administradores pueden desbloquear periodos' };

  if (period.status !== 'locked') {
    return { error: `El periodo no está bloqueado (estado actual: "${period.status}")` };
  }

  const { error: updateError } = await supabase
    .from('reporting_periods')
    .update({
      status: 'under_review',
      unlocked_at: new Date().toISOString(),
      unlock_reason: reason.trim(),
      unlocked_by: user.id,
    })
    .eq('id', periodId);

  if (updateError) return { error: `Error al desbloquear: ${updateError.message}` };

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true };
}


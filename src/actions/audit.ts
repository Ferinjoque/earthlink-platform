'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/services/supabase/server';
import { AuditService } from '@/services/AuditService';
import { EvaluationService } from '@/services/EvaluationService';
import { ActivityEntryRepository } from '@/repos/ActivityEntryRepository';
import { EmissionFactorRepository } from '@/repos/EmissionFactorRepository';
import { UnitConversionRepository } from '@/repos/UnitConversionRepository';
import { EmissionResultRepository } from '@/repos/EmissionResultRepository';
import { ReportingPeriodRepository } from '@/repos/ReportingPeriodRepository';
import { AuditLogRepository } from '@/repos/AuditLogRepository';
import { AnomalyService } from '@/services/AnomalyService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (typeof periodId !== 'string' || !UUID_RE.test(periodId)) return { error: 'ID de periodo inválido' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verificar que el usuario pertenece a la org propietaria del periodo
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .is('archived_at', null)
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

  const activityEntryRepo = new ActivityEntryRepository(supabase);
  const evalSvc = new EvaluationService(
    activityEntryRepo,
    new EmissionFactorRepository(supabase),
    new UnitConversionRepository(supabase),
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  let outcome: Awaited<ReturnType<EvaluationService['evaluate']>>;
  try {
    outcome = await evalSvc.evaluate(periodId);
  } catch {
    // Restablecer a 'open' para que el periodo pueda reintentarse — no dejarlo en 'calculating'
    const adminClient = createAdminClient();
    const { error: recoveryError } = await adminClient
      .from('reporting_periods')
      .update({ status: 'open' })
      .eq('id', periodId);
    if (recoveryError) {
      revalidatePath('/audit');
      revalidatePath('/dashboard');
      return { error: 'Error crítico al calcular: no se pudo restablecer el estado del periodo. Contacta al administrador.' };
    }
    revalidatePath('/audit');
    revalidatePath('/dashboard');
    return { error: 'Error al calcular las emisiones del periodo. Intenta nuevamente.' };
  }

  // Detección de anomalías usando entradas del año anterior como línea base
  try {
    const priorYear = period.startDate.getUTCFullYear() - 1;
    const { data: priorPeriodsRaw } = await supabase
      .from('reporting_periods')
      .select('id')
      .eq('supplier_id', period.supplierId)
      .gte('start_date', `${priorYear}-01-01`)
      .lte('start_date', `${priorYear}-12-31`);
    const priorPeriodIds = (priorPeriodsRaw ?? []).map((p: { id: string }) => p.id);

    const [currentEntries, historicalEntries] = await Promise.all([
      activityEntryRepo.findByPeriodId(periodId),
      activityEntryRepo.findByPeriodIds(priorPeriodIds),
    ]);

    const anomalies = new AnomalyService().detect(currentEntries, historicalEntries);

    if (currentEntries.length > 0) {
      await supabase
        .from('anomaly_flags')
        .delete()
        .in('activity_entry_id', currentEntries.map((e) => e.id))
        .eq('is_resolved', false);
    }

    if (anomalies.length > 0) {
      await supabase.from('anomaly_flags').insert(
        anomalies.map((a) => ({
          activity_entry_id: a.entryId,
          detector: 'zscore_monthly',
          severity: a.severity,
          z_score: a.zScore,
          message: a.message,
          threshold_used: AnomalyService.Z_THRESHOLD_LOW,
        })),
      );
    }
  } catch {
    // Detección de anomalías no crítica — no bloquear la transición
  }

  try {
    await auditSvc.transitionStatus(periodId, 'under_review', user.id);
  } catch {
    revalidatePath('/audit');
    revalidatePath('/dashboard');
    return { error: 'Evaluación completada pero error al transicionar el periodo a revisión' };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
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
  if (typeof periodId !== 'string' || !UUID_RE.test(periodId)) return { error: 'ID de periodo inválido' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verificar que el usuario pertenece a la org propietaria del periodo
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .is('archived_at', null)
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
  } catch {
    return { error: 'Error al bloquear el periodo. Intenta nuevamente.' };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
  return { success: true };
}


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
  if (typeof periodId !== 'string' || !UUID_RE.test(periodId)) return { error: 'ID de periodo inválido' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  // Verificar que el usuario pertenece a la org propietaria del periodo (antes de revelar estado)
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .is('archived_at', null)
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

  // Solo periodos bloqueados o en revisión pueden recalcularse
  if (period.status !== 'locked' && period.status !== 'under_review') {
    return {
      error: `El periodo está en estado "${period.status}" — solo los periodos bloqueados o en revisión pueden recalcularse`,
    };
  }

  // Borrar resultados previos del periodo para recalcular desde cero.
  // emission_results es append-only (trigger bloquea DELETE directo).
  // fn_admin_delete_period_results usa set_config local para autorizar el borrado.
  const adminClient = createAdminClient();
  const { error: deleteError } = await adminClient.rpc(
    'fn_admin_delete_period_results',
    { p_period_id: periodId },
  );
  if (deleteError) return { error: 'Error al limpiar resultados previos. Intenta nuevamente.' };

  const activityEntryRepo = new ActivityEntryRepository(supabase);
  const evalSvc = new EvaluationService(
    activityEntryRepo,
    new EmissionFactorRepository(supabase),
    new UnitConversionRepository(supabase),
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  let outcome: Awaited<ReturnType<EvaluationService['evaluate']>>;
  try {
    outcome = await evalSvc.evaluate(periodId);
  } catch {
    // Los resultados ya fueron eliminados — restablecer a under_review para que
    // el periodo no quede bloqueado sin resultados y pueda recalcularse.
    // Usar supabase (server client con RLS) — no se necesita admin para actualizar estado.
    const { error: recoveryError } = await supabase
      .from('reporting_periods')
      .update({ status: 'under_review' })
      .eq('id', periodId);
    if (recoveryError) {
      revalidatePath('/audit');
      revalidatePath('/dashboard');
      return { error: 'Error crítico al recalcular: no se pudo restablecer el estado del periodo. Contacta al administrador.' };
    }
    revalidatePath('/audit');
    revalidatePath('/dashboard');
    return { error: 'Error al recalcular las emisiones del periodo. Intenta nuevamente.' };
  }

  // Re-ejecutar detección de anomalías con los resultados actualizados
  try {
    const priorYear = period.startDate.getUTCFullYear() - 1;
    const { data: priorPeriodsRaw } = await supabase
      .from('reporting_periods')
      .select('id')
      .eq('supplier_id', period.supplierId)
      .gte('start_date', `${priorYear}-01-01`)
      .lte('start_date', `${priorYear}-12-31`);
    const priorPeriodIds = (priorPeriodsRaw ?? []).map((p: { id: string }) => p.id);

    const [currentEntries, historicalEntries] = await Promise.all([
      activityEntryRepo.findByPeriodId(periodId),
      activityEntryRepo.findByPeriodIds(priorPeriodIds),
    ]);
    const anomalies = new AnomalyService().detect(currentEntries, historicalEntries);

    if (currentEntries.length > 0) {
      await supabase
        .from('anomaly_flags')
        .delete()
        .in('activity_entry_id', currentEntries.map((e) => e.id))
        .eq('is_resolved', false);
    }
    if (anomalies.length > 0) {
      await supabase.from('anomaly_flags').insert(
        anomalies.map((a) => ({
          activity_entry_id: a.entryId,
          detector: 'zscore_monthly',
          severity: a.severity,
          z_score: a.zScore,
          message: a.message,
          threshold_used: AnomalyService.Z_THRESHOLD_LOW,
        })),
      );
    }
  } catch {
    // Detección de anomalías no crítica — no bloquear el recálculo
  }

  try {
    await auditLogRepo.log('RECALCULATE', 'reporting_periods', periodId, user.id, {
      oldValues: { status: period.status },
      newValues: { recalculated_at: new Date().toISOString() },
    });
  } catch {
    // El log de auditoría es no-crítico — no bloquear el recálculo exitoso
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
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

  // Verificar que el usuario pertenece a la org propietaria del proveedor
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplier_id)
    .is('archived_at', null)
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

  // Buscar todos los periodos abiertos o en revisión del proveedor en el año
  type FilaPeriodo = { id: string; status: string };
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const { data: periodsRaw } = await supabase
    .from('reporting_periods')
    .select('id, status')
    .eq('supplier_id', supplier_id)
    .gte('start_date', startOfYear)
    .lte('start_date', endOfYear)
    .eq('status', 'open');

  const candidatos = (periodsRaw ?? []) as FilaPeriodo[];
  if (candidatos.length === 0) {
    return { success: true, calculated: 0, skipped: 0, errors: [] };
  }

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);
  const auditSvc = new AuditService(periodRepo, auditLogRepo);
  const activityEntryRepoYear = new ActivityEntryRepository(supabase);
  const emissionFactorRepoYear = new EmissionFactorRepository(supabase);
  const unitConversionRepoYear = new UnitConversionRepository(supabase);
  const evalSvc = new EvaluationService(
    activityEntryRepoYear,
    emissionFactorRepoYear,
    unitConversionRepoYear,
    new EmissionResultRepository(supabase),
    periodRepo,
  );

  // Pre-cargar tablas de referencia una sola vez para todo el lote (K periodos → 1 fetch cada una)
  const priorYear = year - 1;
  const [factorTable, conversionTable, priorPeriodsYearRaw] = await Promise.all([
    emissionFactorRepoYear.buildFactorTable(),
    unitConversionRepoYear.buildConversionTable(),
    supabase
      .from('reporting_periods')
      .select('id')
      .eq('supplier_id', supplier_id)
      .gte('start_date', `${priorYear}-01-01`)
      .lte('start_date', `${priorYear}-12-31`),
  ]);
  const priorPeriodIdsYear = ((priorPeriodsYearRaw as { data: Array<{ id: string }> | null }).data ?? []).map((p) => p.id);
  const historicalEntriesYear = await activityEntryRepoYear.findByPeriodIds(priorPeriodIdsYear);

  const adminClientYear = createAdminClient();
  let calculated = 0;
  let skipped = 0;
  const errores: string[] = [];

  for (const p of candidatos) {
    try {
      await auditSvc.transitionStatus(p.id, 'calculating', user.id);
    } catch {
      skipped = skipped + 1;
      continue;
    }

    try {
      await evalSvc.evaluateWithCache(p.id, factorTable, conversionTable);

      // Detección de anomalías contra línea base del año anterior (no crítica)
      try {
        const currentEntries = await activityEntryRepoYear.findByPeriodId(p.id);
        const anomalies = new AnomalyService().detect(currentEntries, historicalEntriesYear);
        if (currentEntries.length > 0) {
          await supabase
            .from('anomaly_flags')
            .delete()
            .in('activity_entry_id', currentEntries.map((e) => e.id))
            .eq('is_resolved', false);
        }
        if (anomalies.length > 0) {
          await supabase.from('anomaly_flags').insert(
            anomalies.map((a) => ({
              activity_entry_id: a.entryId,
              detector: 'zscore_monthly',
              severity: a.severity,
              z_score: a.zScore,
              message: a.message,
              threshold_used: AnomalyService.Z_THRESHOLD_LOW,
            })),
          );
        }
      } catch {
        // Detección de anomalías no crítica — no bloquear el cálculo del lote
      }

      await auditSvc.transitionStatus(p.id, 'under_review', user.id);
      calculated = calculated + 1;
    } catch (err) {
      // Restablecer a 'open' para que el periodo pueda reintentarse
      await adminClientYear.from('reporting_periods').update({ status: 'open' }).eq('id', p.id);
      errores.push(`Periodo ${calculated + skipped + 1} de ${candidatos.length}: error al calcular`);
      skipped = skipped + 1;
    }
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
  return { success: true, calculated, skipped, errors: errores };
}


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

  // Verificar que el usuario es admin o consultant de la org del proveedor
  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplier_id)
    .is('archived_at', null)
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

  // Solo periodos en revisión — los abiertos deben calcularse primero
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
  const hayCalculando = todosLosPeriodos.some((p) => p.status === 'calculating');
  if (hayCalculando) {
    return {
      error:
        'Hay periodos en proceso de cálculo. Espera a que finalicen antes de cerrar el año.',
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
      const idx = bloqueados + skipped + 1;
      errores.push(`Periodo ${idx} de ${enRevision.length}: error al bloquear`);
      if (err instanceof Error) {
        // Log interno — no exponer al cliente
        void err;
      }
      skipped = skipped + 1;
    }
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
  return { success: true, calculated: bloqueados, skipped, errors: errores };
}


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
  if (typeof flagId !== 'string' || !UUID_RE.test(flagId)) return { error: 'ID de anomalía inválido' };
  const resolutionNote = formData.get('resolution_note');
  const rawNote = typeof resolutionNote === 'string' ? resolutionNote.trim().slice(0, 1000) : '';
  const note = rawNote || null;

  // Verificar que el usuario pertenece a la misma org que la anomalía
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
    .eq('id', flagId)
    .eq('is_resolved', false);

  if (error) return { error: 'Error al resolver la anomalía. Intenta nuevamente.' };

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true };
}


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
  if (typeof periodId !== 'string' || !UUID_RE.test(periodId)) return { error: 'ID de periodo inválido' };
  if (typeof reason !== 'string' || !reason.trim()) {
    return { error: 'La razón de desbloqueo es obligatoria' };
  }
  if (reason.trim().length > 1000) {
    return { error: 'La razón de desbloqueo no puede superar 1000 caracteres' };
  }

  const periodRepo = new ReportingPeriodRepository(supabase);
  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Periodo de reporte no encontrado' };

  type SupplierOrg = { organization_id: string };
  const { data: supplierRaw } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', period.supplierId)
    .is('archived_at', null)
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

  if (updateError) return { error: 'Error al desbloquear el periodo. Intenta nuevamente.' };

  const auditLogRepo = new AuditLogRepository(supabase);
  try {
    await auditLogRepo.log('UNLOCK', 'reporting_periods', periodId, user.id, {
      oldValues: { status: 'locked' },
      newValues: { status: 'under_review' },
    });
  } catch {
    // El log de auditoría es no-crítico — no bloquear el desbloqueo exitoso
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  revalidatePath('/suppliers');
  return { success: true };
}


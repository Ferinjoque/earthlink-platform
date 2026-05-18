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

  const { error } = await supabase
    .from('anomaly_flags')
    .update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    } as never)
    .eq('id', flagId);

  if (error) return { error: `Error al resolver anomalía: ${error.message}` };

  revalidatePath('/audit');
  return { success: true };
}

// ── createPeriod ──────────────────────────────────────────────────────────────

const crearPeriodoSchema = z
  .object({
    supplier_id: z.string().uuid('ID de proveedor inválido'),
    label: z.string().min(1, 'La etiqueta es obligatoria'),
    fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria'),
    fecha_fin: z.string().min(1, 'La fecha de fin es obligatoria'),
  })
  .refine((d) => d.fecha_fin > d.fecha_inicio, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    path: ['fecha_fin'],
  });

export interface CreatePeriodState {
  error?: string | undefined;
  success?: boolean | undefined;
}

export async function createPeriod(
  _prevState: CreatePeriodState | null,
  formData: FormData,
): Promise<CreatePeriodState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = crearPeriodoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };
  }
  const { supplier_id, label, fecha_inicio, fecha_fin } = parsed.data;

  const { data: mem } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'consultant'])
    .limit(1)
    .maybeSingle();
  const membership = mem as { role: string } | null;
  if (!membership) return { error: 'No tienes permiso para crear periodos' };

  const { error } = await supabase.from('reporting_periods').insert({
    supplier_id,
    label,
    start_date: fecha_inicio,
    end_date: fecha_fin,
    status: 'open',
  } as never);

  if (error) return { error: `Error al crear el periodo: ${error.message}` };

  revalidatePath('/audit');
  revalidatePath('/suppliers');
  return { success: true };
}

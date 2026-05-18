'use server';

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
  if (!user) return { error: 'Not authenticated' };

  const periodId = formData.get('period_id');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Missing period ID' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Reporting period not found' };
  if (period.status !== 'open') {
    return { error: `Period is "${period.status}" — only open periods can be calculated` };
  }

  const auditSvc = new AuditService(periodRepo, auditLogRepo);

  try {
    await auditSvc.transitionStatus(periodId, 'calculating', user.id);
  } catch {
    return { error: 'Failed to transition period to calculating' };
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
    return { error: `Evaluation failed: ${err instanceof Error ? err.message : 'unknown error'}` };
  }

  try {
    await auditSvc.transitionStatus(periodId, 'under_review', user.id);
  } catch {
    return { error: 'Evaluation complete but failed to transition period to under_review' };
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
  if (!user) return { error: 'Not authenticated' };

  const periodId = formData.get('period_id');
  if (typeof periodId !== 'string' || !periodId) return { error: 'Missing period ID' };

  const periodRepo = new ReportingPeriodRepository(supabase);
  const auditLogRepo = new AuditLogRepository(supabase);

  const period = await periodRepo.findById(periodId);
  if (!period) return { error: 'Reporting period not found' };
  if (period.status !== 'under_review') {
    return {
      error: `Period is "${period.status}" — only periods under review can be locked`,
    };
  }

  const auditSvc = new AuditService(periodRepo, auditLogRepo);

  try {
    await auditSvc.lock(periodId, user.id);
  } catch (err) {
    return {
      error: `Failed to lock period: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }

  revalidatePath('/audit');
  revalidatePath('/dashboard');
  return { success: true };
}

import type { PeriodStatus } from '@/domain/ReportingPeriod';

type BadgeVariant = 'open' | 'calculating' | 'under_review' | 'locked' | 'neutral';

export function variantEstadoPeriodo(status: PeriodStatus): BadgeVariant {
  if (status === 'open') return 'open';
  if (status === 'calculating') return 'calculating';
  if (status === 'under_review') return 'under_review';
  if (status === 'locked') return 'locked';
  return 'neutral';
}

export function etiquetaEstadoPeriodo(status: PeriodStatus): string {
  if (status === 'open') return 'Abierto';
  if (status === 'calculating') return 'Calculando…';
  if (status === 'under_review') return 'En revisión';
  if (status === 'locked') return 'Bloqueado';
  return status;
}

import { describe, it, expect } from 'vitest';
import { variantEstadoPeriodo, etiquetaEstadoPeriodo } from '@/lib/reporting-period';
import type { PeriodStatus } from '@/domain/ReportingPeriod';

const STATUSES: PeriodStatus[] = ['open', 'calculating', 'under_review', 'locked'];

describe('variantEstadoPeriodo', () => {
  it('returns open for open', () => {
    expect(variantEstadoPeriodo('open')).toBe('open');
  });

  it('returns calculating for calculating', () => {
    expect(variantEstadoPeriodo('calculating')).toBe('calculating');
  });

  it('returns under_review for under_review', () => {
    expect(variantEstadoPeriodo('under_review')).toBe('under_review');
  });

  it('returns locked for locked', () => {
    expect(variantEstadoPeriodo('locked')).toBe('locked');
  });

  it('covers all known statuses without returning neutral', () => {
    for (const s of STATUSES) {
      expect(variantEstadoPeriodo(s)).not.toBe('neutral');
    }
  });
});

describe('etiquetaEstadoPeriodo', () => {
  it('returns Abierto for open', () => {
    expect(etiquetaEstadoPeriodo('open')).toBe('Abierto');
  });

  it('returns Calculando… for calculating', () => {
    expect(etiquetaEstadoPeriodo('calculating')).toBe('Calculando…');
  });

  it('returns En revisión for under_review', () => {
    expect(etiquetaEstadoPeriodo('under_review')).toBe('En revisión');
  });

  it('returns Bloqueado for locked', () => {
    expect(etiquetaEstadoPeriodo('locked')).toBe('Bloqueado');
  });

  it('all known statuses produce non-empty Spanish labels', () => {
    for (const s of STATUSES) {
      const label = etiquetaEstadoPeriodo(s);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(s);
    }
  });

  it('returns raw status string for unknown values', () => {
    const unknown = 'draft' as unknown as PeriodStatus;
    expect(etiquetaEstadoPeriodo(unknown)).toBe('draft');
  });
});

// Tests para ramas de fallback en variantEstadoPeriodo
describe('variantEstadoPeriodo — fallback', () => {
  it('returns neutral for unknown status values', () => {
    const unknown = 'archived' as unknown as PeriodStatus;
    expect(variantEstadoPeriodo(unknown)).toBe('neutral');
  });
});

import { describe, it, expect } from 'vitest';
import type { ActivityEntryView } from '@/components/activity/ActivityList';

// Pure filter logic extracted for testing
function filtrarEntradas(
  entries: ActivityEntryView[],
  filtroEstado: string,
  filtroFuente: string,
): ActivityEntryView[] {
  return entries.filter((e) => {
    if (filtroEstado !== 'todos' && e.status !== filtroEstado) return false;
    if (filtroFuente !== 'todos' && e.source_type !== filtroFuente) return false;
    return true;
  });
}

const BASE: ActivityEntryView[] = [
  {
    id: '1',
    period_label: 'Q1-2026',
    source_type: 'stationary_combustion',
    raw_quantity: 100,
    raw_unit: 'kWh',
    status: 'draft',
    submitted_at: null,
    notes: null,
  },
  {
    id: '2',
    period_label: 'Q1-2026',
    source_type: 'purchased_electricity',
    raw_quantity: 200,
    raw_unit: 'kWh',
    status: 'submitted',
    submitted_at: '2026-01-15T00:00:00Z',
    notes: null,
    anomaly: { severity: 'high', z_score: 45.88, message: 'Consumo muy elevado' },
  },
  {
    id: '3',
    period_label: 'Q4-2025',
    source_type: 'fugitive',
    raw_quantity: 5,
    raw_unit: 'kg',
    status: 'validated',
    submitted_at: '2025-12-10T00:00:00Z',
    notes: 'Gas refrigerante',
  },
];

describe('filtrarEntradas', () => {
  it('sin filtros devuelve todas las entradas', () => {
    expect(filtrarEntradas(BASE, 'todos', 'todos')).toHaveLength(3);
  });

  it('filtrar por estado draft', () => {
    const resultado = filtrarEntradas(BASE, 'draft', 'todos');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('1');
  });

  it('filtrar por estado validated', () => {
    const resultado = filtrarEntradas(BASE, 'validated', 'todos');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.status).toBe('validated');
  });

  it('filtrar por fuente purchased_electricity', () => {
    const resultado = filtrarEntradas(BASE, 'todos', 'purchased_electricity');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('2');
  });

  it('filtrar por fuente fugitive', () => {
    const resultado = filtrarEntradas(BASE, 'todos', 'fugitive');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.source_type).toBe('fugitive');
  });

  it('combinar estado + fuente', () => {
    const resultado = filtrarEntradas(BASE, 'submitted', 'purchased_electricity');
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('2');
  });

  it('filtros sin coincidencias devuelve array vacío', () => {
    const resultado = filtrarEntradas(BASE, 'rejected', 'todos');
    expect(resultado).toHaveLength(0);
  });

  it('array vacío de entrada devuelve array vacío', () => {
    expect(filtrarEntradas([], 'draft', 'stationary_combustion')).toHaveLength(0);
  });
});

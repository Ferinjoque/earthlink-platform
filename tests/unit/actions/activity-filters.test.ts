import { describe, it, expect } from 'vitest';
import type { ActivityEntryView } from '@/components/activity/ActivityList';

// Lógica de filtros pura, extraída para testing
function filtrarEntradas(
  entries: ActivityEntryView[],
  filtroEstado: string,
  filtroFuente: string,
  filtroPeriodo = 'todos',
): ActivityEntryView[] {
  return entries.filter((e) => {
    if (filtroEstado !== 'todos' && e.status !== filtroEstado) return false;
    if (filtroFuente !== 'todos' && e.source_type !== filtroFuente) return false;
    if (filtroPeriodo !== 'todos' && e.period_id !== filtroPeriodo) return false;
    return true;
  });
}

const PERIOD_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const PERIOD_B = 'bbbbbbbb-0000-4000-8000-000000000002';

const BASE: ActivityEntryView[] = [
  {
    id: '1',
    period_id: PERIOD_A,
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
    period_id: PERIOD_A,
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
    period_id: PERIOD_B,
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

  it('filtrar por periodo A devuelve 2 entradas', () => {
    const resultado = filtrarEntradas(BASE, 'todos', 'todos', PERIOD_A);
    expect(resultado).toHaveLength(2);
    expect(resultado.every((e) => e.period_id === PERIOD_A)).toBe(true);
  });

  it('filtrar por periodo B devuelve 1 entrada', () => {
    const resultado = filtrarEntradas(BASE, 'todos', 'todos', PERIOD_B);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('3');
  });

  it('combinar estado + periodo', () => {
    const resultado = filtrarEntradas(BASE, 'submitted', 'todos', PERIOD_A);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('2');
  });

  it('periodo sin entradas devuelve array vacío', () => {
    expect(filtrarEntradas(BASE, 'todos', 'todos', 'cccccccc-0000-4000-8000-000000000003')).toHaveLength(0);
  });
});

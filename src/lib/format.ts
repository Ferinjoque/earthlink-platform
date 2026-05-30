export function formatearKg(kg: number): string {
  if (!Number.isFinite(kg) || kg < 0) return '—';
  if (kg === 0) return '—';
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(2)} tCO₂e`;
  return `${kg.toFixed(2)} kg`;
}

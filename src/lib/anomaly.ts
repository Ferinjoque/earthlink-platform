const SOURCE_LABELS: Record<string, string> = {
  stationary_combustion: 'Combustión estacionaria',
  mobile_combustion: 'Combustión móvil',
  purchased_electricity: 'Electricidad',
  purchased_steam: 'Vapor',
  fugitive: 'Emisiones fugitivas',
};

export function traducirMensajeAnomalia(msg: string): string {
  if (!msg) return msg;
  if (msg.includes('sobre la media histórica') || msg.includes('Verificar datos')) return msg;

  // Seed format: "X consumption of Y Z in P is Nσ above the Q baseline of B Z. Verify ..."
  const m1 = msg.match(
    /^(.+?)\s+consumption of ([\d,.]+)\s+(\S+)\s+in\s+(.+?)\s+is\s+([\d.]+)σ\s+above the\s+(.+?)\s+baseline of\s+([\d,.]+)\s+\S+\./i,
  );
  if (m1) {
    const [, fuel = '', qty = '', unit = '', period = '', zscore = '', basePeriod = '', baseQty = ''] = m1;
    return `${fuel}: ${qty} ${unit} en ${period} es ${zscore}σ sobre la línea base de ${basePeriod} (${baseQty} ${unit}). Verificar facturas.`;
  }

  // Old AnomalyService English format
  const m2 = msg.match(
    /^(\S+)\s+quantity\s+([\d.]+)\s+(\S+)\s+is\s+([\d.]+)σ\s+above historical mean of\s+([\d.]+)/i,
  );
  if (m2) {
    const [, sourceType = '', qty = '', unit = '', zscore = '', mean = ''] = m2;
    return `${SOURCE_LABELS[sourceType] ?? sourceType}: ${qty} ${unit} es ${zscore}σ sobre la media histórica (${mean} ${unit}). Verificar datos.`;
  }

  return msg;
}

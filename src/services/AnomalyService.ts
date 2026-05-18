import type { ActivityEntry } from '../domain/ActivityEntry';
import type { EmissionSourceType } from '../types/database';

export interface DetectedAnomaly {
  entryId: string;
  sourceType: EmissionSourceType;
  zScore: number;
  value: number;
  historicalMean: number;
  historicalStddev: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export class AnomalyService {
  static readonly Z_THRESHOLD_LOW = 2.0;
  static readonly Z_THRESHOLD_MEDIUM = 3.0;
  static readonly Z_THRESHOLD_HIGH = 4.5;

  // Pure detection — no I/O. Historical entries provide the baseline population.
  detect(
    current: readonly ActivityEntry[],
    historical: readonly ActivityEntry[],
  ): readonly DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    for (const entry of current) {
      const baseline = historical.filter((h) => h.sourceType === entry.sourceType);
      if (baseline.length < 2) continue;

      const values = baseline.map((h) => h.rawQuantity);
      const z = AnomalyService.zScore(entry.rawQuantity, values);
      if (z === null || z < AnomalyService.Z_THRESHOLD_LOW) continue;

      const mean = AnomalyService.mean(values);
      const stddev = AnomalyService.stddev(values, mean);
      const severity = AnomalyService.severityFor(z);

      const SOURCE_LABELS: Partial<Record<EmissionSourceType, string>> = {
        stationary_combustion: 'Combustión estacionaria',
        mobile_combustion: 'Combustión móvil',
        purchased_electricity: 'Electricidad',
        purchased_steam: 'Vapor',
        fugitive: 'Emisiones fugitivas',
      };
      anomalies.push({
        entryId: entry.id,
        sourceType: entry.sourceType,
        zScore: z,
        value: entry.rawQuantity,
        historicalMean: mean,
        historicalStddev: stddev,
        severity,
        message: `${SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}: ${entry.rawQuantity.toLocaleString('es', { maximumFractionDigits: 2 })} ${entry.rawUnit} es ${z.toFixed(2)}σ sobre la media histórica (${mean.toFixed(2)} ${entry.rawUnit}). Verificar datos.`,
      });
    }

    return anomalies;
  }

  private static zScore(value: number, population: readonly number[]): number | null {
    if (population.length < 2) return null;
    const m = AnomalyService.mean(population);
    const s = AnomalyService.stddev(population, m);
    if (s === 0) return null;
    return Math.abs(value - m) / s;
  }

  private static mean(values: readonly number[]): number {
    return values.reduce((acc, v) => acc + v, 0) / values.length;
  }

  private static stddev(values: readonly number[], mean: number): number {
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private static severityFor(z: number): DetectedAnomaly['severity'] {
    if (z >= AnomalyService.Z_THRESHOLD_HIGH) return 'high';
    if (z >= AnomalyService.Z_THRESHOLD_MEDIUM) return 'medium';
    return 'low';
  }

  // Expose internals for testing
  static readonly _internals = {
    zScore: AnomalyService.zScore.bind(AnomalyService),
    mean: AnomalyService.mean.bind(AnomalyService),
    stddev: AnomalyService.stddev.bind(AnomalyService),
    severityFor: AnomalyService.severityFor.bind(AnomalyService),
  };
}

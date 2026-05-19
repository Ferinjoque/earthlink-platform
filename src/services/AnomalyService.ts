import type { ActivityEntry } from '../domain/ActivityEntry';
import type { ActivityKind, Unit } from '../calc/types';
import type { EmissionSourceType } from '../types/database';

export interface DetectedAnomaly {
  entryId: string;
  sourceType: EmissionSourceType;
  secondary: string;
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
  // Minimum data points needed for a statistically meaningful z-score
  static readonly MIN_BASELINE = 3;

  /**
   * Pure detection — no I/O.
   *
   * Compares each current entry against historical entries for the SAME
   * (sourceType × secondary × rawUnit) group. Entries with different fuel
   * types, refrigerants, grid regions, or measurement units are NEVER
   * mixed into the same baseline — mixing units (e.g. kWh vs MWh) would
   * produce meaningless z-scores, and mixing fuel types (diesel vs LPG)
   * conflates unrelated consumption patterns.
   *
   * Uses sample standard deviation (ddof = 1) for unbiased estimation.
   * Requires at least MIN_BASELINE data points in the group.
   */
  detect(
    current: readonly ActivityEntry[],
    historical: readonly ActivityEntry[],
  ): readonly DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    for (const entry of current) {
      const secondary = AnomalyService.extractSecondary(entry.activityKind);
      const groupKey = AnomalyService.groupKey(entry.sourceType, secondary, entry.rawUnit);

      const baseline = historical.filter(
        (h) =>
          AnomalyService.groupKey(
            h.sourceType,
            AnomalyService.extractSecondary(h.activityKind),
            h.rawUnit,
          ) === groupKey,
      );

      if (baseline.length < AnomalyService.MIN_BASELINE) continue;

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
        water_use: 'Consumo de agua',
        waste: 'Residuos',
      };

      const sourceLabel = SOURCE_LABELS[entry.sourceType] ?? entry.sourceType;
      const secondaryLabel = secondary && secondary !== 'default' ? ` (${secondary})` : '';

      anomalies.push({
        entryId: entry.id,
        sourceType: entry.sourceType,
        secondary,
        zScore: z,
        value: entry.rawQuantity,
        historicalMean: mean,
        historicalStddev: stddev,
        severity,
        message: `${sourceLabel}${secondaryLabel}: ${entry.rawQuantity.toLocaleString('es', { maximumFractionDigits: 2 })} ${entry.rawUnit} es ${z.toFixed(2)}σ sobre la media histórica (${mean.toFixed(2)} ${entry.rawUnit}). Verificar datos.`,
      });
    }

    return anomalies;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static groupKey(
    sourceType: EmissionSourceType,
    secondary: string,
    unit: Unit,
  ): string {
    return `${sourceType}:${secondary}:${unit}`;
  }

  private static extractSecondary(kind: ActivityKind): string {
    switch (kind.kind) {
      case 'stationary_combustion':
        return kind.fuel;
      case 'mobile_combustion':
        return kind.fuel;
      case 'purchased_electricity':
        return kind.gridRegion;
      case 'purchased_steam':
        return 'default';
      case 'fugitive':
        return kind.refrigerant;
      case 'water_use':
        return kind.subtype;
      case 'waste':
        return kind.subtype;
    }
  }

  /**
   * Z-score using sample standard deviation (ddof = 1).
   * Returns null when the population is too small or has zero variance.
   */
  private static zScore(value: number, population: readonly number[]): number | null {
    if (population.length < AnomalyService.MIN_BASELINE) return null;
    const m = AnomalyService.mean(population);
    const s = AnomalyService.stddev(population, m);
    if (s === 0) return null;
    return Math.abs(value - m) / s;
  }

  private static mean(values: readonly number[]): number {
    return values.reduce((acc, v) => acc + v, 0) / values.length;
  }

  /** Sample standard deviation (ddof = 1). */
  private static stddev(values: readonly number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
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
    extractSecondary: AnomalyService.extractSecondary.bind(AnomalyService),
    groupKey: AnomalyService.groupKey.bind(AnomalyService),
  };
}

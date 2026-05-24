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
  // Mínimo de puntos de datos para un z-score estadísticamente significativo
  static readonly MIN_BASELINE = 3;

  /**
   * Detección pura — sin I/O.
   *
   * Compara cada entrada actual contra las históricas del MISMO grupo
   * (sourceType × secondary × rawUnit). Nunca se mezclan tipos de combustible,
   * refrigerantes, regiones eléctricas ni unidades distintas en la misma línea base
   * — mezclar unidades (kWh vs MWh) produce z-scores sin sentido, y mezclar
   * combustibles (diesel vs LPG) confunde patrones de consumo no relacionados.
   *
   * Usa desviación estándar muestral (ddof = 1) para estimación sin sesgo.
   * Requiere al menos MIN_BASELINE puntos en el grupo.
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
      if (z === null || Math.abs(z) < AnomalyService.Z_THRESHOLD_LOW) continue;

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
      const direction = entry.rawQuantity >= mean ? 'sobre' : 'bajo';

      anomalies.push({
        entryId: entry.id,
        sourceType: entry.sourceType,
        secondary,
        zScore: z,
        value: entry.rawQuantity,
        historicalMean: mean,
        historicalStddev: stddev,
        severity,
        message: `${sourceLabel}${secondaryLabel}: ${entry.rawQuantity.toLocaleString('es', { maximumFractionDigits: 2 })} ${entry.rawUnit} es ${Math.abs(z).toFixed(2)}σ ${direction} la media histórica (${mean.toFixed(2)} ${entry.rawUnit}). Verificar datos.`,
      });
    }

    return anomalies;
  }


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

  // Retorna null si la población es muy pequeña o tiene varianza cero
  private static zScore(value: number, population: readonly number[]): number | null {
    if (population.length < AnomalyService.MIN_BASELINE) return null;
    const m = AnomalyService.mean(population);
    const s = AnomalyService.stddev(population, m);
    if (s === 0) return null;
    return (value - m) / s;
  }

  private static mean(values: readonly number[]): number {
    return values.reduce((acc, v) => acc + v, 0) / values.length;
  }

  // Desviación estándar muestral (ddof = 1) para estimación sin sesgo
  private static stddev(values: readonly number[], mean: number): number {
    if (values.length < 2) return 0;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private static severityFor(z: number): DetectedAnomaly['severity'] {
    const absZ = Math.abs(z);
    if (absZ >= AnomalyService.Z_THRESHOLD_HIGH) return 'high';
    if (absZ >= AnomalyService.Z_THRESHOLD_MEDIUM) return 'medium';
    return 'low';
  }

  // Expuesto para tests unitarios
  static readonly _internals = {
    zScore: AnomalyService.zScore.bind(AnomalyService),
    mean: AnomalyService.mean.bind(AnomalyService),
    stddev: AnomalyService.stddev.bind(AnomalyService),
    severityFor: AnomalyService.severityFor.bind(AnomalyService),
    extractSecondary: AnomalyService.extractSecondary.bind(AnomalyService),
    groupKey: AnomalyService.groupKey.bind(AnomalyService),
  };
}

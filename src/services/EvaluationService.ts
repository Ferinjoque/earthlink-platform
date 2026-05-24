import { calculate, aggregate, _internals } from '../calc/pipeline';
import type { EmissionFactor, EmissionResult, EvaluationTotals } from '../calc/types';

// Categorías sin factor GHG — CO2e = 0, no se persisten en emission_results
const NO_GHG_KINDS: ReadonlySet<string> = new Set(['water_use', 'waste']);
import type { ActivityEntryRepository } from '../repos/ActivityEntryRepository';
import type { EmissionFactorRepository } from '../repos/EmissionFactorRepository';
import type { UnitConversionRepository } from '../repos/UnitConversionRepository';
import type { EmissionResultRepository } from '../repos/EmissionResultRepository';
import type { ReportingPeriodRepository } from '../repos/ReportingPeriodRepository';

export interface EvaluationError {
  entryId: string;
  message: string;
}

export interface EvaluationOutcome {
  totals: EvaluationTotals;
  errors: readonly EvaluationError[];
}

export class EvaluationService {
  constructor(
    private readonly activityEntryRepo: Pick<ActivityEntryRepository, 'findByPeriodId'>,
    private readonly emissionFactorRepo: Pick<EmissionFactorRepository, 'buildFactorTable'>,
    private readonly unitConversionRepo: Pick<UnitConversionRepository, 'buildConversionTable'>,
    private readonly emissionResultRepo: Pick<EmissionResultRepository, 'insertMany'>,
    private readonly reportingPeriodRepo: Pick<ReportingPeriodRepository, 'findById'>,
  ) {}

  async evaluate(periodId: string): Promise<EvaluationOutcome> {
    const period = await this.reportingPeriodRepo.findById(periodId);
    if (!period) throw new Error(`Periodo de reporte "${periodId}" no encontrado`);

    const [entries, factors, conversions] = await Promise.all([
      this.activityEntryRepo.findByPeriodId(periodId),
      this.emissionFactorRepo.buildFactorTable(),
      this.unitConversionRepo.buildConversionTable(),
    ]);

    const successes: Array<{ result: EmissionResult; periodId: string; factor: EmissionFactor }> =
      [];
    const errors: EvaluationError[] = [];

    const noGhgResults: EmissionResult[] = [];

    for (const entry of entries) {
      const record = entry.toActivityRecord(period.supplierId);

      // Agua y residuos: CO2e = 0, sin factor, no se persiste el resultado
      if (NO_GHG_KINDS.has(record.activity.kind)) {
        const calcResult = calculate(record, factors, conversions);
        if (calcResult.ok) noGhgResults.push(calcResult.value);
        else errors.push({ entryId: entry.id, message: `Error de cálculo: ${calcResult.error.type}` });
        continue;
      }

      const factorResult = _internals.resolveFactor(record.activity, factors);
      if (!factorResult.ok) {
        errors.push({ entryId: entry.id, message: `Factor faltante: ${factorResult.error.type}` });
        continue;
      }
      const calcResult = calculate(record, factors, conversions);
      if (!calcResult.ok) {
        errors.push({ entryId: entry.id, message: `Error de cálculo: ${calcResult.error.type}` });
        continue;
      }
      successes.push({ result: calcResult.value, periodId, factor: factorResult.value });
    }

    if (successes.length > 0) {
      await this.emissionResultRepo.insertMany(successes);
    }

    const allResults = [...successes.map((s) => s.result), ...noGhgResults];
    const totals = aggregate(allResults);
    return { totals, errors };
  }
}

import type { ReportingPeriod } from '../domain/ReportingPeriod';
import type { ReportingPeriodRepository } from '../repos/ReportingPeriodRepository';
import type { AuditLogRepository } from '../repos/AuditLogRepository';

export class AuditService {
  constructor(
    private readonly reportingPeriodRepo: Pick<
      ReportingPeriodRepository,
      'findById' | 'updateStatus'
    >,
    private readonly auditLogRepo: Pick<AuditLogRepository, 'log'>,
  ) {}

  async lock(periodId: string, userId: string): Promise<ReportingPeriod> {
    const period = await this.reportingPeriodRepo.findById(periodId);
    if (!period) throw new Error(`Reporting period "${periodId}" not found`);
    if (period.isLocked()) throw new Error(`Reporting period "${periodId}" is already locked`);

    const locked = await this.reportingPeriodRepo.updateStatus(periodId, 'locked');
    await this.auditLogRepo.log('LOCK', 'reporting_periods', periodId, userId, {
      oldValues: { status: period.status },
      newValues: { status: 'locked' },
    });
    return locked;
  }

  async transitionStatus(
    periodId: string,
    targetStatus: 'calculating' | 'under_review',
    userId: string,
  ): Promise<ReportingPeriod> {
    const period = await this.reportingPeriodRepo.findById(periodId);
    if (!period) throw new Error(`Reporting period "${periodId}" not found`);
    if (period.isLocked()) throw new Error(`Reporting period "${periodId}" is locked`);

    const updated = await this.reportingPeriodRepo.updateStatus(periodId, targetStatus);
    await this.auditLogRepo.log('STATUS_CHANGE', 'reporting_periods', periodId, userId, {
      oldValues: { status: period.status },
      newValues: { status: targetStatus },
    });
    return updated;
  }
}

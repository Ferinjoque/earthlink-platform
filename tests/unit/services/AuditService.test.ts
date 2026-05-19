import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../../../src/services/AuditService';
import { ReportingPeriod } from '../../../src/domain/ReportingPeriod';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T00:00:00Z');

function makePeriod(
  status: 'open' | 'calculating' | 'under_review' | 'locked' = 'open',
): ReportingPeriod {
  return new ReportingPeriod({
    id: 'period-001',
    supplierId: 'supplier-001',
    label: 'Q1-2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    status,
    createdAt: NOW,
  });
}

function makeLockedPeriod(): ReportingPeriod {
  return new ReportingPeriod({
    id: 'period-locked',
    supplierId: 'supplier-001',
    label: 'Q4-2025',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-12-31'),
    status: 'locked',
    createdAt: NOW,
  });
}

function makeRepos(period: ReportingPeriod | null = makePeriod()) {
  const lockedPeriod = makeLockedPeriod();
  const reportingPeriodRepo = {
    findById: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'period-001') return period;
      if (id === 'period-locked') return lockedPeriod;
      return null;
    }),
    updateStatus: vi
      .fn()
      .mockImplementation(async (id: string, status: string) =>
        makePeriod(status as 'open' | 'locked' | 'calculating' | 'under_review'),
      ),
  };
  const auditLogRepo = {
    log: vi.fn().mockResolvedValue(undefined),
  };
  return { reportingPeriodRepo, auditLogRepo };
}

function makeService(period: ReportingPeriod | null = makePeriod()) {
  const repos = makeRepos(period);
  const service = new AuditService(repos.reportingPeriodRepo, repos.auditLogRepo);
  return { service, ...repos };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditService.lock()', () => {
  it('throws when period not found', async () => {
    const { service } = makeService(null);
    await expect(service.lock('period-001', 'user-001')).rejects.toThrow('not found');
  });

  it('throws when period already locked', async () => {
    const { service } = makeService(makePeriod('locked'));
    await expect(service.lock('period-001', 'user-001')).rejects.toThrow('already locked');
  });

  it('updates period status to locked', async () => {
    const { service, reportingPeriodRepo } = makeService();
    await service.lock('period-001', 'user-001');
    expect(reportingPeriodRepo.updateStatus).toHaveBeenCalledWith('period-001', 'locked');
  });

  it('writes LOCK event to audit log', async () => {
    const { service, auditLogRepo } = makeService();
    await service.lock('period-001', 'user-001');
    expect(auditLogRepo.log).toHaveBeenCalledWith(
      'LOCK',
      'reporting_periods',
      'period-001',
      'user-001',
      expect.objectContaining({ newValues: { status: 'locked' } }),
    );
  });

  it('returns the updated period', async () => {
    const { service } = makeService();
    const result = await service.lock('period-001', 'user-001');
    expect(result).toBeInstanceOf(ReportingPeriod);
  });

  it('records old status in audit log meta', async () => {
    const openPeriod = makePeriod('open');
    const { service, auditLogRepo } = makeService(openPeriod);
    await service.lock('period-001', 'user-001');
    const [, , , , meta] = auditLogRepo.log.mock.calls[0]!;
    expect(meta).toMatchObject({ oldValues: { status: 'open' } });
  });
});

describe('AuditService.transitionStatus()', () => {
  it('throws when period not found', async () => {
    const { service } = makeService(null);
    await expect(
      service.transitionStatus('period-001', 'calculating', 'user-001'),
    ).rejects.toThrow('not found');
  });

  it('throws when period is locked', async () => {
    const { service } = makeService(makePeriod('locked'));
    await expect(service.transitionStatus('period-001', 'calculating', 'user-001')).rejects.toThrow(
      'locked',
    );
  });

  it('transitions open → calculating', async () => {
    const { service, reportingPeriodRepo } = makeService();
    await service.transitionStatus('period-001', 'calculating', 'user-001');
    expect(reportingPeriodRepo.updateStatus).toHaveBeenCalledWith('period-001', 'calculating');
  });

  it('writes STATUS_CHANGE event to audit log', async () => {
    const { service, auditLogRepo } = makeService();
    await service.transitionStatus('period-001', 'under_review', 'user-001');
    expect(auditLogRepo.log).toHaveBeenCalledWith(
      'STATUS_CHANGE',
      'reporting_periods',
      'period-001',
      'user-001',
      expect.objectContaining({ newValues: { status: 'under_review' } }),
    );
  });
});

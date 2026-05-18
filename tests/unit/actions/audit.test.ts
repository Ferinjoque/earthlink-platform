import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditActionState } from '../../../src/actions/audit';
import { ReportingPeriod } from '../../../src/domain/ReportingPeriod';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
  auditLog: vi.fn(),
  transitionStatus: vi.fn(),
  lock: vi.fn(),
  evaluate: vi.fn(),
  insertMany: vi.fn(),
  findByPeriodId: vi.fn().mockResolvedValue([]),
  buildFactorTable: vi.fn().mockResolvedValue(new Map()),
  buildConversionTable: vi.fn().mockResolvedValue(new Map()),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    }),
  ),
}));
vi.mock('../../../src/services/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../../../src/repos/ReportingPeriodRepository', () => ({
  ReportingPeriodRepository: class {
    findById = mocks.findById;
    updateStatus = mocks.updateStatus;
  },
}));

vi.mock('../../../src/repos/AuditLogRepository', () => ({
  AuditLogRepository: class {
    log = mocks.auditLog;
  },
}));

vi.mock('../../../src/services/AuditService', () => ({
  AuditService: class {
    transitionStatus = mocks.transitionStatus;
    lock = mocks.lock;
  },
}));

vi.mock('../../../src/services/EvaluationService', () => ({
  EvaluationService: class {
    evaluate = mocks.evaluate;
  },
}));

vi.mock('../../../src/repos/ActivityEntryRepository', () => ({
  ActivityEntryRepository: class {
    findByPeriodId = mocks.findByPeriodId;
  },
}));

vi.mock('../../../src/repos/EmissionFactorRepository', () => ({
  EmissionFactorRepository: class {
    buildFactorTable = mocks.buildFactorTable;
  },
}));

vi.mock('../../../src/repos/UnitConversionRepository', () => ({
  UnitConversionRepository: class {
    buildConversionTable = mocks.buildConversionTable;
  },
}));

vi.mock('../../../src/repos/EmissionResultRepository', () => ({
  EmissionResultRepository: class {
    insertMany = mocks.insertMany;
  },
}));

import { createServerClient } from '../../../src/services/supabase/server';
import { calculatePeriod, lockPeriod } from '../../../src/actions/audit';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

function makePeriod(status: 'open' | 'calculating' | 'under_review' | 'locked') {
  return new ReportingPeriod({
    id: VALID_UUID,
    supplierId: 'supplier-1',
    label: 'Q1 2025',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-03-31'),
    status,
    createdAt: new Date(),
  });
}

function mockAuth(userId = 'user-abc') {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }) },
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

function mockNoAuth() {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const GOOD_EVAL_OUTCOME = {
  totals: {
    totalCo2eKg: 2500,
    byScope: { scope1: 1800, scope2: 700 },
    byActivity: {},
    recordCount: 5,
  },
  errors: [],
};

// ── calculatePeriod ───────────────────────────────────────────────────────────

describe('calculatePeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockNoAuth();
    const result: AuditActionState = await calculatePeriod(
      null,
      makeFormData({ period_id: VALID_UUID }),
    );
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when period_id is missing', async () => {
    mockAuth();
    const result = await calculatePeriod(null, makeFormData({}));
    expect(result.error).toMatch(/falta el id/i);
  });

  it('returns error when period is not found', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(null);
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/no encontrado/i);
  });

  it('returns error when period status is not open', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/locked/);
  });

  it('returns error when period is under_review', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toBeDefined();
  });

  it('returns success with totals for a valid open period', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus.mockResolvedValue(makePeriod('calculating'));
    mocks.evaluate.mockResolvedValueOnce(GOOD_EVAL_OUTCOME);

    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));

    expect(result.success).toBe(true);
    expect(result.totals?.totalCo2eKg).toBe(2500);
    expect(result.totals?.scope1Co2eKg).toBe(1800);
    expect(result.totals?.scope2Co2eKg).toBe(700);
    expect(result.totals?.entryCount).toBe(5);
    expect(result.totals?.errorCount).toBe(0);
  });

  it('includes errorCount when evaluation has partial errors', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus.mockResolvedValue(makePeriod('calculating'));
    mocks.evaluate.mockResolvedValueOnce({
      ...GOOD_EVAL_OUTCOME,
      errors: [{ entryId: 'e1', message: 'Missing factor' }],
    });

    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));

    expect(result.success).toBe(true);
    expect(result.totals?.errorCount).toBe(1);
  });
});

// ── lockPeriod ────────────────────────────────────────────────────────────────

describe('lockPeriod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockNoAuth();
    const result: AuditActionState = await lockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID }),
    );
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when period_id is missing', async () => {
    mockAuth();
    const result = await lockPeriod(null, makeFormData({}));
    expect(result.error).toMatch(/falta el id/i);
  });

  it('returns error when period is not found', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(null);
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/no encontrado/i);
  });

  it('returns error when period is not under_review', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/open/);
  });

  it('returns error when period is already locked', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toBeDefined();
  });

  it('returns success when period is under_review', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    mocks.lock.mockResolvedValueOnce(makePeriod('locked'));

    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

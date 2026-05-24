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
  findByPeriodIds: vi.fn().mockResolvedValue([]),
  buildFactorTable: vi.fn().mockResolvedValue(new Map()),
  buildConversionTable: vi.fn().mockResolvedValue(new Map()),
  adminRpc: vi.fn(),
  adminFrom: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
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
  createAdminClient: vi.fn(() => ({
    rpc: mocks.adminRpc,
    from: mocks.adminFrom,
  })),
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
    findByPeriodIds = mocks.findByPeriodIds;
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
import { calculatePeriod, lockPeriod, resolveAnomaly, recalculatePeriod, closeYear, calculateYear } from '../../../src/actions/audit';
import { createPeriod as createPeriodAudit } from '../../../src/actions/periods';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

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
    from: vi.fn().mockReturnValue(makeSelectChain({ organization_id: 'org-001', role: 'admin' })),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

function mockNoAuth() {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const GOOD_EVAL_OUTCOME = {
  totals: {
    totalCo2eKg: 2500,
    byScope: { scope1: 1800, scope2: 700, none: 0 },
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
    expect(result.error).toMatch(/ID de periodo inválido/i);
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
    expect(result.error).toMatch(/ID de periodo inválido/i);
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

  it('returns error when lock throws', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    mocks.lock.mockRejectedValueOnce(new Error('DB constraint violated'));
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/bloquear/i);
  });

  it('returns error when lock throws non-Error (generic fallback)', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    mocks.lock.mockRejectedValueOnce('string error');
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/bloquear/i);
  });

  it('returns error when supplier not found (lockPeriod ownership)', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn().mockReturnValueOnce(makeSelectChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/proveedor.*no encontrado/i);
  });

  it('returns error when membership denied (lockPeriod ownership)', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeSelectChain({ organization_id: VALID_ORG_ID }))
        .mockReturnValueOnce(makeSelectChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    const result = await lockPeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/permisos/i);
  });
});

// ── calculatePeriod error paths ───────────────────────────────────────────────

describe('calculatePeriod — error paths', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when transitionStatus (calculating) throws', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus.mockRejectedValueOnce(new Error('DB error'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/iniciar el cálculo/i);
  });

  it('returns error when evaluate throws', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus.mockResolvedValueOnce(makePeriod('calculating'));
    mocks.evaluate.mockRejectedValueOnce(new Error('factor table empty'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/calcular.*emisiones/i);
  });

  it('returns error when second transitionStatus (under_review) throws', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus
      .mockResolvedValueOnce(makePeriod('calculating'))
      .mockRejectedValueOnce(new Error('transition failed'));
    mocks.evaluate.mockResolvedValueOnce(GOOD_EVAL_OUTCOME);
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/revisión/i);
  });

  it('returns generic error when evaluate throws non-Error', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    mocks.transitionStatus.mockResolvedValueOnce(makePeriod('calculating'));
    mocks.evaluate.mockRejectedValueOnce('unexpected string');
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/calcular.*emisiones/i);
  });

  it('returns error when supplier not found (calculatePeriod ownership)', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn().mockReturnValueOnce(makeSelectChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/proveedor.*no encontrado/i);
  });

  it('returns error when membership denied (calculatePeriod ownership)', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeSelectChain({ organization_id: VALID_ORG_ID }))
        .mockReturnValueOnce(makeSelectChain(null)),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    const result = await calculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/permisos/i);
  });
});

// ── resolveAnomaly ────────────────────────────────────────────────────────────

const VALID_ORG_ID = '10000000-0000-4000-8000-000000000010';
const FLAG_ID = '20000000-0000-4000-8000-000000000020';

function makeSelectChain(data: unknown) {
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['in'] = () => c;
  c['maybeSingle'] = () => Promise.resolve({ data });
  return c;
}

function makeUpdateResolveChain(error: { message: string } | null) {
  return { update: () => ({ eq: () => Promise.resolve({ error }) }) };
}

function mockResolveClient({
  hasFlag = true,
  hasMembership = true,
  updateError = null as { message: string } | null,
} = {}) {
  const flagData = hasFlag
    ? { activity_entries: { reporting_periods: { suppliers: { organization_id: VALID_ORG_ID } } } }
    : null;
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeSelectChain(flagData))
      .mockReturnValueOnce(makeSelectChain(hasMembership ? { role: 'admin' } : null))
      .mockReturnValueOnce(makeUpdateResolveChain(updateError)),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('resolveAnomaly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    const result = await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID }));
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when flag_id is missing', async () => {
    mockResolveClient();
    const result = await resolveAnomaly(null, makeFormData({}));
    expect(result.error).toMatch(/ID de anomalía inválido/i);
  });

  it('returns error when flag not found', async () => {
    mockResolveClient({ hasFlag: false });
    const result = await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID }));
    expect(result.error).toMatch(/no encontrada/i);
  });

  it('returns error when user lacks permission', async () => {
    mockResolveClient({ hasMembership: false });
    const result = await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID }));
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns error when DB update fails', async () => {
    mockResolveClient({ updateError: { message: 'row not found' } });
    const result = await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID }));
    expect(result.error).toMatch(/resolver/i);
  });

  it('returns success for valid resolution', async () => {
    mockResolveClient();
    const result = await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID }));
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ── createPeriod (audit.ts) ───────────────────────────────────────────────────

const AUDIT_SUPPLIER_ID = '30000000-0000-4000-8000-000000000030';

function mockCreatePeriodAuditClient({
  hasSupplier = true,
  hasMembership = true,
  insertError = null as { message: string } | null,
} = {}) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeSelectChain(hasSupplier ? { organization_id: VALID_ORG_ID } : null))
      .mockReturnValueOnce(makeSelectChain(hasMembership ? { role: 'admin' } : null))
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: insertError }) }),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

const validAuditPeriodFields = {
  supplier_id: AUDIT_SUPPLIER_ID,
  label: 'Q2-2026',
  fecha_inicio: '2026-04-01',
  fecha_fin: '2026-06-30',
};

describe('createPeriod (audit.ts)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
    const result = await createPeriodAudit(null, makeFormData(validAuditPeriodFields));
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when supplier_id is not a valid UUID', async () => {
    mockCreatePeriodAuditClient();
    const result = await createPeriodAudit(
      null,
      makeFormData({ ...validAuditPeriodFields, supplier_id: 'not-a-uuid' }),
    );
    expect(result.error).toBeTruthy();
  });

  it('returns error when label is empty', async () => {
    mockCreatePeriodAuditClient();
    const result = await createPeriodAudit(
      null,
      makeFormData({ ...validAuditPeriodFields, label: '' }),
    );
    expect(result.error).toBeTruthy();
  });

  it('returns error when fecha_fin is before fecha_inicio', async () => {
    mockCreatePeriodAuditClient();
    const result = await createPeriodAudit(
      null,
      makeFormData({ ...validAuditPeriodFields, fecha_inicio: '2026-06-30', fecha_fin: '2026-04-01' }),
    );
    expect(result.error).toMatch(/posterior/i);
  });

  it('returns error when supplier not found', async () => {
    mockCreatePeriodAuditClient({ hasSupplier: false });
    const result = await createPeriodAudit(null, makeFormData(validAuditPeriodFields));
    expect(result.error).toMatch(/encontrado/i);
  });

  it('returns error when user lacks org membership', async () => {
    mockCreatePeriodAuditClient({ hasMembership: false });
    const result = await createPeriodAudit(null, makeFormData(validAuditPeriodFields));
    expect(result.error).toMatch(/permiso/i);
  });

  it('returns error when DB insert fails', async () => {
    mockCreatePeriodAuditClient({ insertError: { message: 'duplicate label' } });
    const result = await createPeriodAudit(null, makeFormData(validAuditPeriodFields));
    expect(result.error).toBeTruthy();
  });

  it('returns success on valid input', async () => {
    mockCreatePeriodAuditClient();
    const result = await createPeriodAudit(null, makeFormData(validAuditPeriodFields));
    expect(result.success).toBe(true);
  });
});

// ── recalculatePeriod ─────────────────────────────────────────────────────────

function mockRecalculateClient({
  hasSupplier = true,
  isAdmin = true,
  rpcError = null as { message: string } | null,
} = {}) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeSelectChain(hasSupplier ? { organization_id: VALID_ORG_ID } : null))
      .mockReturnValueOnce(makeSelectChain(isAdmin ? { role: 'admin' } : null)),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  // Reset antes de encolar para no acumular valores de tests anteriores que retornan antes del RPC
  mocks.adminRpc.mockReset();
  mocks.adminRpc.mockResolvedValueOnce({ data: 1, error: rpcError });
  return client;
}

describe('recalculatePeriod', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockNoAuth();
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when period_id is missing', async () => {
    mockAuth();
    const result = await recalculatePeriod(null, makeFormData({}));
    expect(result.error).toMatch(/ID de periodo inválido/i);
  });

  it('returns error when period not found', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(null);
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/no encontrado/i);
  });

  it('returns error when caller is not admin', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient({ isAdmin: false });
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/administrador/i);
  });

  it('returns error when supplier not found', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient({ hasSupplier: false });
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/proveedor/i);
  });

  it('returns error when delete of existing results fails', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient({ rpcError: { message: 'constraint violation' } });
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/limpiar/i);
  });

  it('returns error when re-evaluation throws', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient();
    mocks.evaluate.mockRejectedValueOnce(new Error('factor not found'));
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/recalcular.*emisiones/i);
  });

  it('resets period to under_review on evaluate failure to avoid locked period with no results', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient();
    mocks.evaluate.mockRejectedValueOnce(new Error('eval failure'));
    mocks.adminFrom.mockClear();

    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));

    expect(result.error).toBeDefined();
    expect(mocks.adminFrom).toHaveBeenCalledWith('reporting_periods');
  });

  it('returns success with updated totals', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    mockRecalculateClient();
    mocks.evaluate.mockResolvedValueOnce(GOOD_EVAL_OUTCOME);
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.success).toBe(true);
    expect(result.totals?.totalCo2eKg).toBe(2500);
    expect(result.totals?.scope1Co2eKg).toBe(1800);
    expect(result.totals?.scope2Co2eKg).toBe(700);
    expect(result.totals?.entryCount).toBe(5);
  });
});

// ── resolveAnomaly — resolution_note ─────────────────────────────────────────

describe('resolveAnomaly — resolution_note', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes resolution_note to DB update when provided', async () => {
    const flagData = {
      activity_entries: { reporting_periods: { suppliers: { organization_id: VALID_ORG_ID } } },
    };
    const updateSpy = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeSelectChain(flagData))
        .mockReturnValueOnce(makeSelectChain({ role: 'admin' }))
        .mockReturnValueOnce({ update: updateSpy }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    const result = await resolveAnomaly(
      null,
      makeFormData({ flag_id: FLAG_ID, resolution_note: 'Valor corregido manualmente' }),
    );

    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: 'Valor corregido manualmente' }),
    );
  });

  it('saves null resolution_note when input is blank', async () => {
    const flagData = {
      activity_entries: { reporting_periods: { suppliers: { organization_id: VALID_ORG_ID } } },
    };
    const updateSpy = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn()
        .mockReturnValueOnce(makeSelectChain(flagData))
        .mockReturnValueOnce(makeSelectChain({ role: 'admin' }))
        .mockReturnValueOnce({ update: updateSpy }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);

    await resolveAnomaly(null, makeFormData({ flag_id: FLAG_ID, resolution_note: '   ' }));

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: null }),
    );
  });
});

// ── recalculatePeriod — validación de estado ──────────────────────────────────

describe('recalculatePeriod — validación de estado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when period status is open', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/"open"/);
  });

  it('returns error when period status is calculating', async () => {
    mockAuth();
    mocks.findById.mockResolvedValueOnce(makePeriod('calculating'));
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.error).toMatch(/"calculating"/);
  });

  it('allows recalculation of under_review period', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('under_review'));
    mockRecalculateClient();
    mocks.evaluate.mockResolvedValueOnce(GOOD_EVAL_OUTCOME);
    const result = await recalculatePeriod(null, makeFormData({ period_id: VALID_UUID }));
    expect(result.success).toBe(true);
  });
});

// ── calculateYear ─────────────────────────────────────────────────────────────

const CALC_YEAR_SUPPLIER_ID = '60000000-0000-4000-8000-000000000060';

function makeQueryChain(resolvedData: unknown) {
  const resolved = Promise.resolve({ data: resolvedData });
  const c: Record<string, unknown> = {};
  c['select'] = () => c;
  c['eq'] = () => c;
  c['gte'] = () => c;
  c['lte'] = () => c;
  c['in'] = () => c;
  c['maybeSingle'] = () => Promise.resolve({ data: resolvedData });
  c['delete'] = () => c;
  c['insert'] = () => Promise.resolve({ error: null });
  // Encadenable en cualquier punto: await chain resuelve la promesa
  c['then'] = (onFulfilled: (v: unknown) => unknown) => resolved.then(onFulfilled);
  c['catch'] = (onRejected: (e: unknown) => unknown) => resolved.catch(onRejected);
  return c;
}

function makeCalculateYearClient({
  hasSupplier = true,
  hasMembership = true,
  candidatos = [] as Array<{ id: string; status: string }>,
} = {}) {
  const anomalyChain = {
    delete: () => ({
      in: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    insert: () => Promise.resolve({ error: null }),
  };

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'suppliers') return makeSelectChain(hasSupplier ? { organization_id: VALID_ORG_ID } : null);
      if (table === 'memberships') return makeSelectChain(hasMembership ? { role: 'admin' } : null);
      if (table === 'reporting_periods') return makeQueryChain(candidatos);
      if (table === 'anomaly_flags') return anomalyChain;
      return makeQueryChain([]);
    }),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('calculateYear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockNoAuth();
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error on invalid schema (year out of range)', async () => {
    makeCalculateYearClient();
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '1999' }),
    );
    expect(result.error).toBeTruthy();
  });

  it('returns error when supplier not found', async () => {
    makeCalculateYearClient({ hasSupplier: false });
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.error).toMatch(/proveedor/i);
  });

  it('returns error when user lacks membership', async () => {
    makeCalculateYearClient({ hasMembership: false });
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.error).toMatch(/permisos/i);
  });

  it('returns success with 0 calculated when no periods found', async () => {
    makeCalculateYearClient({ candidatos: [] });
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(0);
  });

  it('returns 0 calculated when no open periods found (only open status queried)', async () => {
    makeCalculateYearClient({ candidatos: [] });
    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('calculates open period successfully', async () => {
    makeCalculateYearClient({
      candidatos: [{ id: VALID_UUID, status: 'open' }],
    });
    mocks.findByPeriodIds.mockResolvedValueOnce([]);
    mocks.transitionStatus.mockResolvedValue(makePeriod('calculating'));
    mocks.evaluate.mockResolvedValueOnce(GOOD_EVAL_OUTCOME);

    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips period when transitionStatus throws', async () => {
    makeCalculateYearClient({
      candidatos: [{ id: VALID_UUID, status: 'open' }],
    });
    mocks.findByPeriodIds.mockResolvedValueOnce([]);
    mocks.transitionStatus.mockRejectedValueOnce(new Error('already calculating'));

    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('adds error message when evaluate throws', async () => {
    makeCalculateYearClient({
      candidatos: [{ id: VALID_UUID, status: 'open' }],
    });
    mocks.findByPeriodIds.mockResolvedValueOnce([]);
    mocks.transitionStatus.mockResolvedValue(makePeriod('calculating'));
    mocks.evaluate.mockRejectedValueOnce(new Error('factor missing'));

    const result = await calculateYear(
      null,
      makeFormData({ supplier_id: CALC_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});

// ── unlockPeriod ─────────────────────────────────────────────────────────────

function makeUnlockClient({
  hasSupplier = true,
  isAdmin = true,
  updateError = null as { message: string } | null,
} = {}) {
  const updateChain = { update: () => ({ eq: () => Promise.resolve({ error: updateError }) }) };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeSelectChain(hasSupplier ? { organization_id: VALID_ORG_ID } : null))
      .mockReturnValueOnce(makeSelectChain(isAdmin ? { role: 'admin' } : null))
      .mockReturnValueOnce(updateChain),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('unlockPeriod', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockNoAuth();
    const result = await (await import('../../../src/actions/audit')).unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/autenticado/i);
  });

  it('returns error when unlock_reason is empty', async () => {
    const { unlockPeriod } = await import('../../../src/actions/audit');
    makeUnlockClient();
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: '' }),
    );
    expect(result.error).toMatch(/razón/i);
  });

  it('returns error when unlock_reason is whitespace only', async () => {
    const { unlockPeriod } = await import('../../../src/actions/audit');
    makeUnlockClient();
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: '   ' }),
    );
    expect(result.error).toMatch(/razón/i);
  });

  it('returns error when period not found', async () => {
    makeUnlockClient();
    mocks.findById.mockResolvedValueOnce(null);
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/no encontrado/i);
  });

  it('returns error when supplier not found', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    makeUnlockClient({ hasSupplier: false });
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/proveedor/i);
  });

  it('returns error when caller is not admin', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    makeUnlockClient({ isAdmin: false });
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/administrador/i);
  });

  it('returns error when period is not locked', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('open'));
    makeUnlockClient();
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('returns error when DB update fails', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    makeUnlockClient({ updateError: { message: 'constraint error' } });
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'corrección' }),
    );
    expect(result.error).toMatch(/desbloquear/i);
  });

  it('returns success when locked period is unlocked by admin', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    makeUnlockClient();
    const { unlockPeriod } = await import('../../../src/actions/audit');
    const result = await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'Corrección de datos de enero' }),
    );
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('writes UNLOCK event to audit log', async () => {
    mocks.findById.mockResolvedValueOnce(makePeriod('locked'));
    makeUnlockClient();
    const { unlockPeriod } = await import('../../../src/actions/audit');
    await unlockPeriod(
      null,
      makeFormData({ period_id: VALID_UUID, unlock_reason: 'Revisión contable' }),
    );
    expect(mocks.auditLog).toHaveBeenCalledWith(
      'UNLOCK',
      'reporting_periods',
      VALID_UUID,
      VALID_UUID,
      expect.objectContaining({ oldValues: { status: 'locked' }, newValues: { status: 'under_review' } }),
    );
  });
});

// ── closeYear — guard contra periodos en cálculo ──────────────────────────────

const CLOSE_YEAR_SUPPLIER_ID = '40000000-0000-4000-8000-000000000040';

function mockCloseYearClient(periodsData: Array<{ id: string; status: string }>) {
  const periodsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: periodsData, error: null }),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn()
      .mockReturnValueOnce(makeSelectChain({ organization_id: VALID_ORG_ID }))
      .mockReturnValueOnce(makeSelectChain({ role: 'admin' }))
      .mockReturnValueOnce(periodsChain),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return client;
}

describe('closeYear — validación de estado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when any period is open', async () => {
    mockCloseYearClient([
      { id: VALID_UUID, status: 'open' },
      { id: VALID_ORG_ID, status: 'under_review' },
    ]);
    const result = await closeYear(
      null,
      makeFormData({ supplier_id: CLOSE_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.error).toMatch(/abiertos/i);
  });

  it('returns error when any period is calculating', async () => {
    mockCloseYearClient([
      { id: VALID_UUID, status: 'calculating' },
      { id: VALID_ORG_ID, status: 'under_review' },
    ]);
    const result = await closeYear(
      null,
      makeFormData({ supplier_id: CLOSE_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.error).toMatch(/proceso de cálculo/i);
  });

  it('returns success (0 locked) when no under_review periods', async () => {
    mockCloseYearClient([{ id: VALID_UUID, status: 'locked' }]);
    const result = await closeYear(
      null,
      makeFormData({ supplier_id: CLOSE_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(0);
  });

  it('locks under_review periods and returns success with count', async () => {
    const periodId2 = '50000000-0000-4000-8000-000000000050';
    mockCloseYearClient([
      { id: VALID_UUID, status: 'under_review' },
      { id: periodId2, status: 'under_review' },
    ]);
    mocks.lock.mockResolvedValue(makePeriod('locked'));
    const result = await closeYear(
      null,
      makeFormData({ supplier_id: CLOSE_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('increments skipped when lock throws for a period', async () => {
    mockCloseYearClient([
      { id: VALID_UUID, status: 'under_review' },
    ]);
    mocks.lock.mockRejectedValueOnce(new Error('already locked'));
    const result = await closeYear(
      null,
      makeFormData({ supplier_id: CLOSE_YEAR_SUPPLIER_ID, year: '2026' }),
    );
    expect(result.success).toBe(true);
    expect(result.calculated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});

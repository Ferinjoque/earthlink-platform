import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks hoisted ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  storageRemove: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ getAll: vi.fn(() => []), set: vi.fn() }),
  ),
}));

vi.mock('../../../src/services/supabase/server', () => {
  const makeStorage = () => ({
    from: vi.fn(() => ({
      createSignedUrls: mocks.createSignedUrls,
      upload: mocks.storageUpload,
      remove: mocks.storageRemove,
    })),
  });
  return {
    createServerClient: vi.fn(),
    createAdminClient: vi.fn(() => ({ storage: makeStorage() })),
  };
});

import { createServerClient } from '../../../src/services/supabase/server';
import { getEvidenceFiles, getEvidenceFilesBatch, deleteEvidence, uploadEvidence } from '../../../src/actions/evidence';

type MockClient = Awaited<ReturnType<typeof createServerClient>>;

// ── Funciones auxiliares ──────────────────────────────────────────────────────

const ENTRY_ID = '00000000-0000-4000-8000-000000000001';
const ENTRY_ID_2 = '00000000-0000-4000-8000-000000000002';
const ORG_ID = 'org-001';

function makeSelectChain(data: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then: undefined as unknown,
  };
  return {
    ...chain,
    [Symbol.asyncIterator]: undefined as unknown,
  };
}

function mockAuthWithOrg() {
  const entryCheck = {
    id: ENTRY_ID,
    reporting_periods: {
      supplier_id: 'supplier-1',
      suppliers: { organization_id: ORG_ID },
    },
  };
  const memCheck = { role: 'admin' };

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'activity_entries') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: entryCheck, error: null }),
      };
    }
    if (table === 'memberships') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: memCheck, error: null }),
      };
    }
    if (table === 'evidence_files') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }
    return makeSelectChain(null);
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }),
    },
    from: fromMock,
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
  return { client, fromMock };
}

function mockNoAuth() {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as unknown as MockClient);
}

function makeEvidenceRow(overrides: Partial<{
  id: string; storage_path: string; activity_entry_id: string;
}> = {}) {
  return {
    id: overrides.id ?? 'file-001',
    original_name: 'recibo.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1024,
    sha256: 'abc123',
    uploaded_at: '2025-01-01T00:00:00Z',
    storage_path: overrides.storage_path ?? `evidence/${ORG_ID}/${ENTRY_ID}/file-001.pdf`,
    activity_entry_id: overrides.activity_entry_id ?? ENTRY_ID,
  };
}

// ── getEvidenceFiles ──────────────────────────────────────────────────────────

describe('getEvidenceFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for invalid UUID', async () => {
    const result = await getEvidenceFiles('not-a-uuid');
    expect(result).toEqual([]);
  });

  it('returns empty array when not authenticated', async () => {
    mockNoAuth();
    const result = await getEvidenceFiles(ENTRY_ID);
    expect(result).toEqual([]);
  });

  it('returns empty array when entry not found', async () => {
    const fromMock = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: fromMock,
    } as unknown as MockClient);

    const result = await getEvidenceFiles(ENTRY_ID);
    expect(result).toEqual([]);
  });

  it('returns empty array when user has no membership', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ENTRY_ID,
              reporting_periods: { supplier_id: 's1', suppliers: { organization_id: ORG_ID } },
            },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: fromMock,
    } as unknown as MockClient);

    const result = await getEvidenceFiles(ENTRY_ID);
    expect(result).toEqual([]);
  });

  it('returns empty array when no files exist for the entry', async () => {
    mockAuthWithOrg();
    const result = await getEvidenceFiles(ENTRY_ID);
    expect(result).toEqual([]);
  });

  it('usa createSignedUrls en lote y retorna archivos con signedUrl', async () => {
    const { fromMock } = mockAuthWithOrg();
    const row = makeEvidenceRow();

    fromMock.mockImplementation((table: string) => {
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ENTRY_ID,
              reporting_periods: { supplier_id: 's1', suppliers: { organization_id: ORG_ID } },
            },
            error: null,
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        };
      }
      if (table === 'evidence_files') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [row], error: null }),
        };
      }
      return makeSelectChain(null);
    });

    mocks.createSignedUrls.mockResolvedValue({
      data: [{ path: row.storage_path, signedUrl: 'https://example.com/signed' }],
      error: null,
    });

    const result = await getEvidenceFiles(ENTRY_ID);

    expect(mocks.createSignedUrls).toHaveBeenCalledWith([row.storage_path], 3600);
    expect(result).toHaveLength(1);
    expect(result[0]?.signedUrl).toBe('https://example.com/signed');
    expect(result[0]?.id).toBe('file-001');
  });

  it('usa null como signedUrl cuando createSignedUrls falla para un archivo', async () => {
    const { fromMock } = mockAuthWithOrg();
    const row = makeEvidenceRow();

    fromMock.mockImplementation((table: string) => {
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ENTRY_ID,
              reporting_periods: { supplier_id: 's1', suppliers: { organization_id: ORG_ID } },
            },
            error: null,
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        };
      }
      if (table === 'evidence_files') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [row], error: null }),
        };
      }
      return makeSelectChain(null);
    });

    mocks.createSignedUrls.mockResolvedValue({ data: null, error: { message: 'Storage error' } });

    const result = await getEvidenceFiles(ENTRY_ID);
    expect(result[0]?.signedUrl).toBeNull();
  });
});

// ── getEvidenceFilesBatch ─────────────────────────────────────────────────────

describe('getEvidenceFilesBatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map for empty array', async () => {
    const result = await getEvidenceFilesBatch([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map when all IDs are invalid UUIDs', async () => {
    const result = await getEvidenceFilesBatch(['invalid', 'also-bad']);
    expect(result.size).toBe(0);
  });

  it('returns empty map when batch exceeds 200 entries', async () => {
    const ids = Array.from({ length: 201 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    const result = await getEvidenceFilesBatch(ids);
    expect(result.size).toBe(0);
  });

  it('returns empty map when not authenticated', async () => {
    mockNoAuth();
    const result = await getEvidenceFilesBatch([ENTRY_ID]);
    expect(result.size).toBe(0);
  });

  it('agrupa archivos por entry_id usando createSignedUrls en lote', async () => {
    const row1 = makeEvidenceRow({ id: 'file-001', activity_entry_id: ENTRY_ID, storage_path: `evidence/${ORG_ID}/${ENTRY_ID}/file-001.pdf` });
    const row2 = makeEvidenceRow({ id: 'file-002', activity_entry_id: ENTRY_ID_2, storage_path: `evidence/${ORG_ID}/${ENTRY_ID_2}/file-002.pdf` });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ organization_id: ORG_ID }],
            error: null,
          }),
        };
      }
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: ENTRY_ID, reporting_periods: { suppliers: { organization_id: ORG_ID } } },
              { id: ENTRY_ID_2, reporting_periods: { suppliers: { organization_id: ORG_ID } } },
            ],
            error: null,
          }),
        };
      }
      if (table === 'evidence_files') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [row1, row2], error: null }),
        };
      }
      return makeSelectChain(null);
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: fromMock,
    } as unknown as MockClient);

    mocks.createSignedUrls.mockResolvedValue({
      data: [
        { path: row1.storage_path, signedUrl: 'https://example.com/signed1' },
        { path: row2.storage_path, signedUrl: 'https://example.com/signed2' },
      ],
      error: null,
    });

    const result = await getEvidenceFilesBatch([ENTRY_ID, ENTRY_ID_2]);

    expect(mocks.createSignedUrls).toHaveBeenCalledWith(
      [row1.storage_path, row2.storage_path],
      3600,
    );
    expect(result.get(ENTRY_ID)).toHaveLength(1);
    expect(result.get(ENTRY_ID_2)).toHaveLength(1);
    expect(result.get(ENTRY_ID)?.[0]?.signedUrl).toBe('https://example.com/signed1');
    expect(result.get(ENTRY_ID_2)?.[0]?.signedUrl).toBe('https://example.com/signed2');
  });
});

// ── deleteEvidence ────────────────────────────────────────────────────────────

const FILE_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const USER_ID = 'user-uploader';
const OTHER_USER_ID = 'user-other';

const MOCK_FILE = {
  id: FILE_ID,
  storage_path: `evidence/${ORG_ID}/${ENTRY_ID}/${FILE_ID}.pdf`,
  uploaded_by: USER_ID,
  activity_entry_id: ENTRY_ID,
};

const MOCK_ENTRY_ORG = {
  reporting_periods: { suppliers: { organization_id: ORG_ID } },
};

function buildDeleteFromMock(opts: {
  file: typeof MOCK_FILE | null;
  entryOrg: typeof MOCK_ENTRY_ORG | null;
  membershipRole: string | null;
}) {
  let evidenceSelectCalled = 0;
  return vi.fn().mockImplementation((table: string) => {
    if (table === 'evidence_files') {
      evidenceSelectCalled += 1;
      if (evidenceSelectCalled === 1) {
        // Primera llamada: SELECT para leer el archivo
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: opts.file, error: null }),
        };
      }
      // Segunda llamada: DELETE
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    }
    if (table === 'activity_entries') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.entryOrg, error: null }),
      };
    }
    if (table === 'memberships') {
      const memData = opts.membershipRole ? { role: opts.membershipRole } : null;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: memData, error: null }),
      };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
  });
}

// ── uploadEvidence - guards de periodo y entrada ──────────────────────────────

describe('uploadEvidence - guards de periodo y entrada', () => {
  beforeEach(() => vi.clearAllMocks());

  function buildUploadClient(entryData: {
    voided_at?: string | null;
    periodo_status?: string;
  } | null) {
    const entryCheckRow = entryData === null ? null : {
      id: ENTRY_ID,
      voided_at: entryData?.voided_at ?? null,
      reporting_period_id: 'period-001',
      reporting_periods: {
        status: entryData?.periodo_status ?? 'open',
        supplier_id: 'supplier-1',
        suppliers: { organization_id: ORG_ID },
      },
    };
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: entryCheckRow, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: fromMock,
    } as unknown as MockClient);
  }

  it('rechaza ID de entrada inválido', async () => {
    const fd = new FormData();
    const result = await uploadEvidence('not-a-uuid', null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('rechaza cuando la entrada está anulada', async () => {
    buildUploadClient({ voided_at: '2025-01-01T00:00:00Z' });
    const fd = new FormData();
    // Simular archivo para pasar la validación de archivo vacío
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/jpeg' });
    fd.append('evidence', new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    const result = await uploadEvidence(ENTRY_ID, null, fd);
    expect(result.error).toMatch(/anulada/i);
  });

  it('rechaza cuando el periodo está bloqueado', async () => {
    buildUploadClient({ periodo_status: 'locked' });
    const fd = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/jpeg' });
    fd.append('evidence', new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    const result = await uploadEvidence(ENTRY_ID, null, fd);
    expect(result.error).toMatch(/bloqueado/i);
  });
});

// ── deleteEvidence - autorización ─────────────────────────────────────────────

describe('deleteEvidence - autorización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageRemove.mockResolvedValue({ data: null, error: null });
  });

  it('rechaza ID de archivo inválido', async () => {
    const fd = new FormData();
    const result = await deleteEvidence('not-a-uuid', null, fd);
    expect(result.error).toMatch(/inválido/i);
  });

  it('rechaza cuando no hay sesión autenticada', async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.error).toMatch(/autenticado/i);
  });

  it('rechaza cuando el uploader ya no tiene membresía activa en la org', async () => {
    // Mismo usuario que subió el archivo, pero ya no tiene membresía → debe rechazarse
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: buildDeleteFromMock({ file: MOCK_FILE, entryOrg: MOCK_ENTRY_ORG, membershipRole: null }),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('rechaza cuando usuario externo tiene rol consultant (no admin)', async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: OTHER_USER_ID } } }) },
      from: buildDeleteFromMock({ file: MOCK_FILE, entryOrg: MOCK_ENTRY_ORG, membershipRole: 'consultant' }),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.error).toMatch(/permisos/i);
  });

  it('permite que admin de la org borre archivo de otro usuario', async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: OTHER_USER_ID } } }) },
      from: buildDeleteFromMock({ file: MOCK_FILE, entryOrg: MOCK_ENTRY_ORG, membershipRole: 'admin' }),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rechaza cuando el archivo no existe', async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: buildDeleteFromMock({ file: null, entryOrg: MOCK_ENTRY_ORG, membershipRole: 'admin' }),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.error).toMatch(/encontrado/i);
  });

  it('rechaza cuando el periodo está bloqueado', async () => {
    const lockedEntryOrg = {
      reporting_periods: {
        status: 'locked',
        suppliers: { organization_id: ORG_ID },
      },
    };
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: buildDeleteFromMock({ file: MOCK_FILE, entryOrg: lockedEntryOrg as typeof MOCK_ENTRY_ORG, membershipRole: 'admin' }),
    } as unknown as MockClient);
    const fd = new FormData();
    const result = await deleteEvidence(FILE_ID, null, fd);
    expect(result.error).toMatch(/bloqueado/i);
  });
});

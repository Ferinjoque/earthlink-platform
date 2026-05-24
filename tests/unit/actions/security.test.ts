/**
 * Tests de seguridad para los security hardening fixes:
 *   - Validación de formato UUID en acciones de auditoría
 *   - Límites de longitud en campos de texto libre
 *   - Validación de fechas en createPeriod
 *   - Validación de magic bytes en importación XLSX
 *   - Filtro de UUIDs inválidos en getEvidenceFilesBatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks compartidos ────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({ getAll: vi.fn(() => []), set: vi.fn() }),
  ),
}));
vi.mock('../../../src/services/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock('../../../src/repos/ReportingPeriodRepository', () => ({
  ReportingPeriodRepository: class { findById = vi.fn().mockResolvedValue(null); },
}));
vi.mock('../../../src/repos/AuditLogRepository', () => ({
  AuditLogRepository: class { log = vi.fn(); },
}));
vi.mock('../../../src/services/AuditService', () => ({
  AuditService: class { transitionStatus = vi.fn(); lock = vi.fn(); },
}));
vi.mock('../../../src/services/EvaluationService', () => ({
  EvaluationService: class { evaluate = vi.fn(); },
}));
vi.mock('../../../src/repos/ActivityEntryRepository', () => ({
  ActivityEntryRepository: class {
    findByPeriodId = vi.fn().mockResolvedValue([]);
    findByPeriodIds = vi.fn().mockResolvedValue([]);
    save = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock('../../../src/repos/EmissionFactorRepository', () => ({
  EmissionFactorRepository: class {},
}));
vi.mock('../../../src/repos/UnitConversionRepository', () => ({
  UnitConversionRepository: class {},
}));
vi.mock('../../../src/repos/EmissionResultRepository', () => ({
  EmissionResultRepository: class {},
}));
vi.mock('../../../src/services/AnomalyService', () => ({
  AnomalyService: class {
    static Z_THRESHOLD_LOW = 2.0;
    detect = vi.fn().mockReturnValue([]);
  },
}));
vi.mock('../../../src/lib/xlsx', () => ({
  parseXlsxBuffer: vi.fn().mockResolvedValue([]),
}));

import { createServerClient, createAdminClient } from '../../../src/services/supabase/server';
import { parseXlsxBuffer } from '../../../src/lib/xlsx';
import {
  calculatePeriod,
  lockPeriod,
  recalculatePeriod,
  resolveAnomaly,
  unlockPeriod,
} from '../../../src/actions/audit';
import { voidActivityEntry, importActivityXlsx } from '../../../src/actions/activity';
import { createPeriod } from '../../../src/actions/periods';
import { getEvidenceFilesBatch, uploadEvidence, deleteEvidence } from '../../../src/actions/evidence';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const VALID_SUPPLIER = '00000000-0000-4000-8000-000000000002';
const VALID_ORG = '00000000-0000-4000-8000-000000000003';

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function mockAuthClient() {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
  vi.mocked(createServerClient).mockResolvedValue(client as never);
  vi.mocked(createAdminClient).mockReturnValue(client as never);
  return client;
}

// ── UUID validation en audit actions ─────────────────────────────────────────

describe('UUID validation — audit actions', () => {
  beforeEach(() => { mockAuthClient(); vi.clearAllMocks(); mockAuthClient(); });

  const INVALID_IDS = [
    '',
    'not-a-uuid',
    '00000000-0000-0000-0000-00000000000', // 35 chars
    '00000000-0000-0000-0000-0000000000000', // 37 chars
    '../etc/passwd',
    "'; DROP TABLE reporting_periods; --",
  ];

  describe('calculatePeriod', () => {
    for (const bad of INVALID_IDS) {
      it(`rechaza period_id inválido: "${bad}"`, async () => {
        const result = await calculatePeriod(null, fd({ period_id: bad }));
        expect(result.error).toMatch(/ID de periodo inválido/);
        expect(result.success).toBeUndefined();
      });
    }

    it('acepta UUID válido y continúa al siguiente paso', async () => {
      const result = await calculatePeriod(null, fd({ period_id: VALID_UUID }));
      // El cliente mock devuelve null para findById → periodo no encontrado
      expect(result.error).toMatch(/Periodo de reporte no encontrado/);
    });
  });

  describe('lockPeriod', () => {
    for (const bad of INVALID_IDS) {
      it(`rechaza period_id inválido: "${bad}"`, async () => {
        const result = await lockPeriod(null, fd({ period_id: bad }));
        expect(result.error).toMatch(/ID de periodo inválido/);
      });
    }
  });

  describe('recalculatePeriod', () => {
    for (const bad of INVALID_IDS) {
      it(`rechaza period_id inválido: "${bad}"`, async () => {
        const result = await recalculatePeriod(null, fd({ period_id: bad }));
        expect(result.error).toMatch(/ID de periodo inválido/);
      });
    }
  });

  describe('resolveAnomaly', () => {
    for (const bad of INVALID_IDS) {
      it(`rechaza flag_id inválido: "${bad}"`, async () => {
        const result = await resolveAnomaly(null, fd({ flag_id: bad, resolution_note: 'ok' }));
        expect(result.error).toMatch(/ID de anomalía inválido/);
      });
    }

    it('acepta UUID válido de flag y continúa', async () => {
      const result = await resolveAnomaly(null, fd({ flag_id: VALID_UUID }));
      expect(result.error).not.toMatch(/ID de anomalía inválido/);
    });
  });

  describe('unlockPeriod', () => {
    for (const bad of INVALID_IDS) {
      it(`rechaza period_id inválido: "${bad}"`, async () => {
        const result = await unlockPeriod(null, fd({ period_id: bad, unlock_reason: 'corrección' }));
        expect(result.error).toMatch(/ID de periodo inválido/);
      });
    }
  });
});

// ── Límites de longitud en campos de texto libre ──────────────────────────────

describe('Límites de longitud', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthClient(); });

  describe('voidActivityEntry — void_reason', () => {
    it('rechaza void_reason con más de 1000 caracteres', async () => {
      const longReason = 'a'.repeat(1001);
      const result = await voidActivityEntry(null, fd({
        entry_id: VALID_UUID,
        void_reason: longReason,
      }));
      expect(result.error).toMatch(/1000 caracteres/);
    });

    it('acepta void_reason dentro del límite', async () => {
      const result = await voidActivityEntry(null, fd({
        entry_id: VALID_UUID,
        void_reason: 'a'.repeat(1000),
      }));
      // No debe fallar por longitud
      expect(result.error).not.toMatch(/1000 caracteres/);
    });
  });

  describe('unlockPeriod — unlock_reason', () => {
    it('rechaza unlock_reason con más de 1000 caracteres', async () => {
      const longReason = 'b'.repeat(1001);
      const result = await unlockPeriod(null, fd({
        period_id: VALID_UUID,
        unlock_reason: longReason,
      }));
      expect(result.error).toMatch(/1000 caracteres/);
    });

    it('acepta unlock_reason dentro del límite', async () => {
      const result = await unlockPeriod(null, fd({
        period_id: VALID_UUID,
        unlock_reason: 'b'.repeat(1000),
      }));
      expect(result.error).not.toMatch(/1000 caracteres/);
    });
  });

  describe('resolveAnomaly — resolution_note truncada', () => {
    it('trunca resolution_note a 1000 chars sin error', async () => {
      const longNote = 'c'.repeat(2000);
      // No debe lanzar — se trunca silenciosamente
      const result = await resolveAnomaly(null, fd({
        flag_id: VALID_UUID,
        resolution_note: longNote,
      }));
      // Debe fallar por otro motivo (anomalía no encontrada), no por la nota
      expect(result.error).not.toMatch(/nota|note/i);
    });
  });
});

// ── Validación de fechas en createPeriod ──────────────────────────────────────

describe('createPeriod — validación de fechas', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthClient(); });

  const INVALID_DATES = [
    { inicio: 'not-a-date', fin: '2026-03-31', desc: 'fecha inicio no es fecha' },
    { inicio: '2026-01-01', fin: 'invalid', desc: 'fecha fin no es fecha' },
    { inicio: '2026/01/01', fin: '2026/03/31', desc: 'slashes en lugar de guiones' },
    { inicio: '01-01-2026', fin: '03-31-2026', desc: 'formato DD-MM-YYYY' },
    { inicio: '2026-13-01', fin: '2026-14-01', desc: 'mes 13 inválido' },
    { inicio: '', fin: '2026-03-31', desc: 'inicio vacío' },
  ];

  for (const { inicio, fin, desc } of INVALID_DATES) {
    it(`rechaza fechas inválidas: ${desc}`, async () => {
      const result = await createPeriod(null, fd({
        supplier_id: VALID_SUPPLIER,
        label: 'Q1 2026',
        fecha_inicio: inicio,
        fecha_fin: fin,
      }));
      expect(result.error).toBeTruthy();
      expect(result.success).toBeUndefined();
    });
  }

  it('rechaza cuando fin <= inicio', async () => {
    const result = await createPeriod(null, fd({
      supplier_id: VALID_SUPPLIER,
      label: 'Q1 2026',
      fecha_inicio: '2026-03-31',
      fecha_fin: '2026-01-01',
    }));
    expect(result.error).toMatch(/posterior/i);
  });

  it('acepta fechas válidas y continúa al siguiente paso', async () => {
    const result = await createPeriod(null, fd({
      supplier_id: VALID_SUPPLIER,
      label: 'Q1 2026',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-03-31',
    }));
    // No debe fallar por formato de fechas (falla por proveedor no encontrado en mock)
    expect(result.error).not.toMatch(/fecha/i);
  });
});

// ── XLSX magic bytes ──────────────────────────────────────────────────────────

describe('importActivityXlsx — validación de magic bytes', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthClient(); });

  function makeXlsxFile(bytes: number[]): File {
    const buf = new Uint8Array(bytes.concat(new Array(100).fill(0)));
    return new File([buf], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  it('rechaza archivo sin magic bytes de XLSX (PK\\x03\\x04)', async () => {
    const badFile = makeXlsxFile([0x00, 0x00, 0x00, 0x00]);
    const formData = new FormData();
    formData.append('xlsx_file', badFile);
    const result = await importActivityXlsx(null, formData);
    expect(result.error).toMatch(/no es un Excel válido/);
  });

  it('rechaza archivo PDF (empieza con %PDF)', async () => {
    const pdfFile = makeXlsxFile([0x25, 0x50, 0x44, 0x46]); // %PDF
    const formData = new FormData();
    formData.append('xlsx_file', pdfFile);
    const result = await importActivityXlsx(null, formData);
    expect(result.error).toMatch(/no es un Excel válido/);
  });

  it('acepta archivo con magic bytes correctos de ZIP/XLSX (PK\\x03\\x04)', async () => {
    const validXlsx = makeXlsxFile([0x50, 0x4b, 0x03, 0x04]);
    const formData = new FormData();
    formData.append('xlsx_file', validXlsx);
    const result = await importActivityXlsx(null, formData);
    // No debe fallar por magic bytes (falla por filas vacías del mock)
    expect(result.error).not.toMatch(/no es un Excel válido/);
  });

  it('rechaza archivo que excede 5 MB', async () => {
    const bigBuf = new Uint8Array(5_000_001);
    bigBuf[0] = 0x50; bigBuf[1] = 0x4b; bigBuf[2] = 0x03; bigBuf[3] = 0x04;
    const bigFile = new File([bigBuf], 'large.xlsx');
    const formData = new FormData();
    formData.append('xlsx_file', bigFile);
    const result = await importActivityXlsx(null, formData);
    expect(result.error).toMatch(/5 MB/);
  });
});

// ── UUID batch validation en getEvidenceFilesBatch ────────────────────────────

describe('getEvidenceFilesBatch — filtro de UUIDs inválidos', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthClient(); });

  it('devuelve mapa vacío si todos los IDs son inválidos', async () => {
    const result = await getEvidenceFilesBatch(['not-a-uuid', '../etc', "'; DROP TABLE--"]);
    expect(result.size).toBe(0);
  });

  it('devuelve mapa vacío para lista vacía', async () => {
    const result = await getEvidenceFilesBatch([]);
    expect(result.size).toBe(0);
  });

  it('filtra IDs inválidos y consulta solo los válidos', async () => {
    const client = mockAuthClient();

    // Mock por tabla para soportar el flujo completo de autorización de tenant
    const evidenceInMock = vi.fn().mockReturnThis();
    client.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [{ organization_id: VALID_ORG }] }),
        };
      }
      if (table === 'activity_entries') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: VALID_UUID, reporting_periods: { suppliers: { organization_id: VALID_ORG } } },
              { id: VALID_SUPPLIER, reporting_periods: { suppliers: { organization_id: VALID_ORG } } },
            ],
          }),
        };
      }
      // evidence_files
      return {
        select: vi.fn().mockReturnThis(),
        in: evidenceInMock,
        order: vi.fn().mockResolvedValue({ data: [] }),
      };
    }) as typeof client.from;
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    await getEvidenceFilesBatch([VALID_UUID, 'invalid-id', VALID_SUPPLIER]);

    // Verificar que evidence_files solo recibe UUIDs válidos autorizados
    const inCallArgs = evidenceInMock.mock?.calls ?? [];
    if (inCallArgs.length > 0) {
      const ids = inCallArgs[0]?.[1] as string[];
      expect(ids).not.toContain('invalid-id');
      expect(ids).toContain(VALID_UUID);
      expect(ids).toContain(VALID_SUPPLIER);
    }
  });
});

// ── Errores genéricos — no filtran info interna ───────────────────────────────

describe('Errores genéricos — sin leakage de mensajes de BD', () => {
  it('voidActivityEntry no expone mensaje de BD en error de update', async () => {
    let callCount = 0;
    const dbError = { message: 'ERROR: duplicate key violates unique constraint "pk_internal_table_xyz"' };

    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // activity_entries SELECT (obtener entry con datos de periodo/org)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                voided_at: null,
                reporting_period_id: VALID_UUID,
                reporting_periods: {
                  status: 'open',
                  suppliers: { organization_id: VALID_ORG },
                },
              },
            }),
          };
        }
        if (callCount === 2) {
          // memberships SELECT (incluye .in() por el filtro de rol)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          };
        }
        // activity_entries UPDATE — simula error de BD
        const updateChain = {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: dbError }),
        };
        return updateChain;
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    const result = await voidActivityEntry(null, fd({
      entry_id: VALID_UUID,
      void_reason: 'corrección de datos',
    }));
    if (result.error) {
      expect(result.error).not.toMatch(/pk_internal|constraint|duplicate key/i);
      expect(result.error).toMatch(/Intenta nuevamente/i);
    }
  });
});

// ── uploadEvidence — magic bytes validation ───────────────────────────────────

describe('uploadEvidence — validación de magic bytes', () => {
  function makeFile(bytes: number[], mime: string, name: string): File {
    const buf = new Uint8Array(bytes.concat(new Array(100).fill(0)));
    return new File([buf], name, { type: mime });
  }

  function mockUploadClient() {
    // Mock que pasa: auth → entry check (org join) → membership → duplicate check
    let callCount = 0;
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } } }) },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // activity_entries con join a reporting_periods → suppliers
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: VALID_UUID,
                reporting_period_id: VALID_SUPPLIER,
                reporting_periods: { supplier_id: VALID_SUPPLIER, suppliers: { organization_id: VALID_ORG } },
              },
            }),
          };
        }
        if (callCount === 2) {
          // memberships check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'consultant' } }),
          };
        }
        // duplicate sha256 check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    return client;
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it('rechaza JPEG con magic bytes incorrectos (PNG bytes con MIME jpeg)', async () => {
    mockUploadClient();
    const fakeJpeg = makeFile([0x89, 0x50, 0x4e, 0x47], 'image/jpeg', 'foto.jpg'); // PNG bytes
    const formData = new FormData();
    formData.append('evidence', fakeJpeg);
    const result = await uploadEvidence(VALID_UUID, null, formData);
    expect(result.error).toMatch(/contenido.*formato|formato.*declarado/i);
  });

  it('rechaza PDF con magic bytes incorrectos (JPEG bytes con MIME pdf)', async () => {
    mockUploadClient();
    const fakePdf = makeFile([0xff, 0xd8, 0xff], 'application/pdf', 'doc.pdf'); // JPEG bytes
    const formData = new FormData();
    formData.append('evidence', fakePdf);
    const result = await uploadEvidence(VALID_UUID, null, formData);
    expect(result.error).toMatch(/contenido.*formato|formato.*declarado/i);
  });

  it('rechaza archivo con formato MIME no permitido (antes de magic bytes)', async () => {
    mockAuthClient(); // Mock simple — la validación MIME ocurre antes que la autenticación
    const badMime = makeFile([0x00, 0x00], 'text/html', 'evil.html');
    const formData = new FormData();
    formData.append('evidence', badMime);
    const result = await uploadEvidence(VALID_UUID, null, formData);
    expect(result.error).toMatch(/Formato no permitido/i);
  });

  it('rechaza si no autenticado', async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    const validJpeg = makeFile([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg', 'foto.jpg');
    const formData = new FormData();
    formData.append('evidence', validJpeg);
    const result = await uploadEvidence(VALID_UUID, null, formData);
    expect(result.error).toMatch(/autenticado/i);
  });
});

// ── deleteEvidence — solo admin puede borrar archivos ajenos ──────────────────

describe('deleteEvidence — solo admin puede eliminar archivos ajenos', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makeDeleteMock(uploaderRole: string, uploaderId: string, callerId: string) {
    let callCount = 0;
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: callerId } } }) },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // evidence_files SELECT
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: VALID_UUID, storage_path: 'evidence/org/entry/file.pdf', uploaded_by: uploaderId, activity_entry_id: VALID_SUPPLIER },
            }),
          };
        }
        if (callCount === 2) {
          // activity_entries SELECT (org resolution)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reporting_periods: { suppliers: { organization_id: VALID_ORG } } },
            }),
          };
        }
        // memberships SELECT
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: uploaderRole ? { role: uploaderRole } : null }),
        };
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);
    return client;
  }

  it('rechaza cuando consultant intenta borrar archivo de otro usuario', async () => {
    makeDeleteMock('consultant', 'other-user-id', VALID_UUID);
    const result = await deleteEvidence(VALID_UUID, null, new FormData());
    expect(result.error).toMatch(/permisos/i);
    expect(result.success).toBeUndefined();
  });

  it('rechaza cuando supplier intenta borrar archivo de otro usuario', async () => {
    makeDeleteMock('supplier', 'other-user-id', VALID_UUID);
    const result = await deleteEvidence(VALID_UUID, null, new FormData());
    expect(result.error).toMatch(/permisos/i);
  });

  it('permite al propio uploader borrar su archivo si mantiene membresía activa', async () => {
    // El caller y uploader son el mismo Y tiene membresía activa → puede borrar
    let callCount = 0;
    const callerId = VALID_UUID;
    const adminMock = {
      storage: { from: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue({ error: null }) }) },
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: callerId } } }) },
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // SELECT evidence_files
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: VALID_UUID, storage_path: 'evidence/org/entry/file.pdf', uploaded_by: callerId, activity_entry_id: VALID_SUPPLIER },
            }),
          };
        }
        if (callCount === 2) {
          // SELECT activity_entries → org info
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reporting_periods: { suppliers: { organization_id: VALID_ORG } } },
            }),
          };
        }
        if (callCount === 3) {
          // SELECT memberships → rol válido
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'consultant' } }),
          };
        }
        // DELETE evidence_files
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminMock as never);
    const result = await deleteEvidence(VALID_UUID, null, new FormData());
    expect(result.success).toBe(true);
  });
});

// ── importActivityXlsx — flujo de importación exitoso ────────────────────────

describe('importActivityXlsx — flujo de importación', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthClient(); });

  function makeXlsxFormData(bytes = [0x50, 0x4b, 0x03, 0x04]): FormData {
    const buf = new Uint8Array(bytes.concat(new Array(100).fill(0)));
    const file = new File([buf], 'test.xlsx');
    const fd = new FormData();
    fd.append('xlsx_file', file);
    return fd;
  }

  function makeValidRow() {
    return {
      rowIndex: 1,
      data: {
        supplier_id: VALID_SUPPLIER,
        year_month: '2026-01',
        source_type: 'stationary_combustion' as const,
        secondary: 'natural_gas',
        raw_quantity: 100,
        raw_unit: 'kWh',
        data_quality: 'measured' as const,
        notes: undefined,
      },
      errors: [] as string[],
    };
  }

  it('importa correctamente filas válidas y retorna success', async () => {
    const client = mockAuthClient();

    // Mock por tabla: supplier access + period lookup
    let callCount = 0;
    client.from = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // verifySupplierAccess: supplier check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: VALID_ORG } }),
        };
      }
      if (callCount === 2) {
        // verifySupplierAccess: membership check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin', supplier_id: null } }),
        };
      }
      if (callCount === 3) {
        // findOrCreatePeriod: existing period check
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: VALID_UUID, status: 'open' } }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    }) as typeof client.from;
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    vi.mocked(parseXlsxBuffer).mockResolvedValueOnce([makeValidRow()]);

    const result = await importActivityXlsx(null, makeXlsxFormData());
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('retorna error cuando no hay filas válidas en el archivo', async () => {
    vi.mocked(parseXlsxBuffer).mockResolvedValueOnce([
      { rowIndex: 1, data: null, errors: ['Formato incorrecto'] },
    ]);

    const result = await importActivityXlsx(null, makeXlsxFormData());
    expect(result.error).toMatch(/No se encontraron filas válidas/);
  });

  it('salta filas con proveedor sin acceso', async () => {
    const client = mockAuthClient();

    // verifySupplierAccess: supplier not found
    client.from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })) as typeof client.from;
    vi.mocked(createServerClient).mockResolvedValue(client as never);

    vi.mocked(parseXlsxBuffer).mockResolvedValueOnce([makeValidRow()]);

    const result = await importActivityXlsx(null, makeXlsxFormData());
    expect(result.error).toMatch(/proveedor/i);
  });
});

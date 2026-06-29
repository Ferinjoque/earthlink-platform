import { describe, it, expect } from 'vitest';
import { ActivityEntry } from '../../../src/domain/ActivityEntry';
import { ActivityEntryRepository } from '../../../src/repos/ActivityEntryRepository';

// Acceso a métodos protegidos de forma segura para tests
class TestableRepo extends ActivityEntryRepository {
  public exposedToEntity(row: Record<string, unknown>): ActivityEntry {
    return this.toEntity(row);
  }

  public exposedToRow(entity: ActivityEntry): Record<string, unknown> {
    return this.toRow(entity);
  }
}

function makeRepo(): TestableRepo {
  return new TestableRepo(null as never);
}

function makeRowBase(): Record<string, unknown> {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    reporting_period_id: 'bbbbbbbb-0000-0000-0000-000000000002',
    source_type: 'purchased_electricity',
    activity_kind: JSON.stringify({ kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' }),
    raw_quantity: 1000,
    raw_unit: 'kWh',
    status: 'submitted',
    submitted_at: '2026-01-15T00:00:00.000Z',
    submitted_by: 'user-1',
    created_at: '2026-01-15T00:00:00.000Z',
    data_quality: 'measured',
    notes: null,
  };
}

function makeEntry(notes?: string | null): ActivityEntry {
  return new ActivityEntry({
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    reportingPeriodId: 'bbbbbbbb-0000-0000-0000-000000000002',
    sourceType: 'purchased_electricity',
    activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
    rawQuantity: 1000,
    rawUnit: 'kWh',
    status: 'submitted',
    submittedAt: new Date('2026-01-15T00:00:00.000Z'),
    submittedBy: 'user-1',
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    dataQuality: 'measured',
    notes: notes !== undefined ? notes : null,
  });
}

// ── Dominio ActivityEntry ─────────────────────────────────────────────────────

describe('ActivityEntry - campo notes', () => {
  it('acepta notes como string y lo expone', () => {
    const entry = makeEntry('Caldera A');
    expect(entry.notes).toBe('Caldera A');
  });

  it('acepta notes null y lo expone como null', () => {
    const entry = makeEntry(null);
    expect(entry.notes).toBeNull();
  });

  it('omitir notes en constructor resulta en null', () => {
    const entry = new ActivityEntry({
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      reportingPeriodId: 'bbbbbbbb-0000-0000-0000-000000000002',
      sourceType: 'purchased_electricity',
      activityKind: { kind: 'purchased_electricity', gridRegion: 'SEIN_PERU' },
      rawQuantity: 1000,
      rawUnit: 'kWh',
      status: 'submitted',
      submittedAt: null,
      submittedBy: null,
      createdAt: new Date('2026-01-15T00:00:00.000Z'),
    });
    expect(entry.notes).toBeNull();
  });
});

// ── ActivityEntryRepository.toEntity (fila → entidad) ───────────────────────

describe('ActivityEntryRepository.toEntity - notas', () => {
  it('mapea notes string desde la fila de BD', () => {
    const repo = makeRepo();
    const row = { ...makeRowBase(), notes: 'Caldera A' };
    const entity = repo.exposedToEntity(row);
    expect(entity.notes).toBe('Caldera A');
  });

  it('mapea notes null desde la fila de BD como null', () => {
    const repo = makeRepo();
    const row = { ...makeRowBase(), notes: null };
    const entity = repo.exposedToEntity(row);
    expect(entity.notes).toBeNull();
  });

  it('mapea notes ausente como null', () => {
    const repo = makeRepo();
    const { notes: _notes, ...rowSinNotes } = makeRowBase();
    const entity = repo.exposedToEntity(rowSinNotes);
    expect(entity.notes).toBeNull();
  });
});

// ── ActivityEntryRepository.toRow (entidad → fila) ───────────────────────────

describe('ActivityEntryRepository.toRow - notas', () => {
  it('incluye notes string en la fila resultante', () => {
    const repo = makeRepo();
    const entry = makeEntry('Generador de emergencia');
    const row = repo.exposedToRow(entry);
    expect(row['notes']).toBe('Generador de emergencia');
  });

  it('incluye notes null en la fila resultante', () => {
    const repo = makeRepo();
    const entry = makeEntry(null);
    const row = repo.exposedToRow(entry);
    expect(row['notes']).toBeNull();
  });

  it('la fila contiene la clave notes incluso cuando es null', () => {
    const repo = makeRepo();
    const entry = makeEntry(null);
    const row = repo.exposedToRow(entry);
    expect('notes' in row).toBe(true);
  });
});

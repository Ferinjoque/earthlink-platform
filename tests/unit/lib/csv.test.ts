import { describe, it, expect } from 'vitest';
import { parseCsvText, getCsvTemplate } from '../../../src/lib/csv';

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const VALID_YM = '2026-01';

describe('parseCsvText', () => {
  it('returns empty array for empty input', () => {
    expect(parseCsvText('')).toEqual([]);
    expect(parseCsvText('   ')).toEqual([]);
  });

  it('parses a single valid row without header', () => {
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,natural_gas,1000,m3_ng,Boiler A`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data).toMatchObject({
      supplier_id: VALID_UUID,
      year_month: VALID_YM,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: 1000,
      raw_unit: 'm3_ng',
    });
  });

  it('skips a header row when present', () => {
    const csv = [
      'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,notes',
      `${VALID_UUID},${VALID_YM},purchased_electricity,SEIN_PERU,5000,kWh,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data?.source_type).toBe('purchased_electricity');
  });

  it('assigns sequential rowIndex starting at 1', () => {
    const csv = [
      `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},2026-02,mobile_combustion,gasoline,50,gallon,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows[0]!.rowIndex).toBe(1);
    expect(rows[1]!.rowIndex).toBe(2);
  });

  it('records errors for invalid supplier UUID', () => {
    const csv = `not-a-uuid,${VALID_YM},stationary_combustion,diesel,100,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
    expect(rows[0]!.errors[0]).toMatch(/uuid/i);
  });

  it('records errors for invalid year_month format', () => {
    const csv = `${VALID_UUID},2026/01,stationary_combustion,diesel,100,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.some((e) => /mes/i.test(e) || /yyyy/i.test(e))).toBe(true);
  });

  it('records errors for invalid source_type', () => {
    const csv = `${VALID_UUID},${VALID_YM},bad_source,diesel,100,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('records errors for non-positive quantity', () => {
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,-5,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.some((e) => /positiv/i.test(e))).toBe(true);
  });

  it('parses purchased_steam with empty secondary', () => {
    const csv = `${VALID_UUID},${VALID_YM},purchased_steam,,100,kWh,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('purchased_steam');
    expect(rows[0]!.data?.secondary).toBe('');
  });

  it('handles quoted fields containing commas', () => {
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,natural_gas,1000,m3_ng,"Boiler, main"`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.notes).toBe('Boiler, main');
  });

  it('handles mixed valid and invalid rows', () => {
    const csv = [
      `${VALID_UUID},${VALID_YM},stationary_combustion,diesel,100,L,`,
      `bad-uuid,${VALID_YM},purchased_electricity,SEIN_PERU,500,kWh,`,
      `${VALID_UUID},2026-03,mobile_combustion,gasoline,200,gallon,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors.length).toBeGreaterThan(0);
    expect(rows[2]!.errors).toHaveLength(0);
  });

  it('coerces string numbers to numeric raw_quantity', () => {
    const csv = `${VALID_UUID},${VALID_YM},fugitive,R410A,5.75,kg,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.raw_quantity).toBe(5.75);
  });

  it('handles Windows CRLF line endings', () => {
    const csv =
      `${VALID_UUID},${VALID_YM},stationary_combustion,lpg,300,L,\r\n` +
      `${VALID_UUID},2026-02,purchased_electricity,US_AVERAGE,1200,kWh,\r\n`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it('positional parse handles row with fewer than 7 columns (undefined fields default to empty)', () => {
    // Row has only 4 cols — raw_unit and notes are undefined → ?? '' fallback fires
    const csv = `${VALID_UUID},${VALID_YM},stationary_combustion,1000`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowIndex).toBe(1);
  });

  it('positional parse handles 1-column row (year_month undefined → invalid)', () => {
    const csv = 'my_col';
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('positional parse handles 2-column row (source_type undefined → empty string)', () => {
    const csv = `${VALID_UUID},${VALID_YM}`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('colMap path returns empty string when data row is shorter than header', () => {
    // Header defines 7 columns; data row has only 3 → required fields missing
    const csv = [
      'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,notes',
      `${VALID_UUID},${VALID_YM},stationary_combustion`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('handles semicolon-delimited CSV', () => {
    const csv = `${VALID_UUID};${VALID_YM};stationary_combustion;natural_gas;1000;m3_ng;Caldera`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('stationary_combustion');
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
  });

  it('handles tab-delimited CSV', () => {
    const csv =
      `${VALID_UUID}\t${VALID_YM}\tstationary_combustion\tnatural_gas\t1000\tm3_ng\tCaldera\n` +
      `${VALID_UUID}\t2026-02\tpurchased_electricity\tSEIN_PERU\t5000\tkWh\t`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors).toHaveLength(0);
  });

  it('recognizes Spanish column aliases in header', () => {
    const csv = [
      'proveedor_id,mes,fuente,combustible,cantidad,unidad,notas',
      `${VALID_UUID},${VALID_YM},stationary_combustion,natural_gas,1000,m3_ng,Caldera`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
    expect(rows[0]!.data?.raw_unit).toBe('m3_ng');
  });

  it('ignores unknown columns in header, still parses required columns', () => {
    const csv = [
      'supplier_id,year_month,source_type,extra_col,raw_quantity,raw_unit,notes',
      `${VALID_UUID},${VALID_YM},fugitive,R410A,5,kg,HVAC`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('fugitive');
    expect(rows[0]!.data?.raw_quantity).toBe(5);
  });

  it('falls back to positional parsing when header lacks required columns', () => {
    // 'source_type' in header → looksLikeHeader = true
    // but missing supplier_id, year_month, raw_quantity, raw_unit → buildColMap returns null
    // data row is parsed positionally
    const csv = [
      'source_type,secondary_only',
      `${VALID_UUID},${VALID_YM},stationary_combustion,natural_gas,1000,m3_ng,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    // positional: cols[0]=UUID, cols[1]=year_month, cols[2]=source_type, ...
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.supplier_id).toBe(VALID_UUID);
    expect(rows[0]!.data?.year_month).toBe(VALID_YM);
  });

  it('treats first row as data when it has no header keywords and no UUID', () => {
    // 'my_label' has no header keywords → looksLikeHeader = false
    // all rows (including this first one) are parsed positionally
    const csv = `my_label,col2,col3,col4,col5,col6,col7`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    // fails validation since 'my_label' is not a UUID
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });
});

describe('getCsvTemplate', () => {
  it('returns a non-empty string', () => {
    const template = getCsvTemplate();
    expect(typeof template).toBe('string');
    expect(template.length).toBeGreaterThan(0);
  });

  it('contains the canonical header row', () => {
    const template = getCsvTemplate();
    const firstLine = template.split('\n')[0]!;
    expect(firstLine).toBe('supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,data_quality,notes');
  });

  it('has at least 8 lines — one header plus example rows for all source types', () => {
    const template = getCsvTemplate();
    const lines = template.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines[0]).toContain('supplier_id');
    expect(lines[0]).toContain('year_month');
  });

  it('each non-comment data row has 8 comma-separated fields', () => {
    const template = getCsvTemplate();
    const lines = template.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'));
    for (const line of lines) {
      expect(line.split(',').length).toBe(8);
    }
  });

  it('example rows cover all seven source types', () => {
    const template = getCsvTemplate();
    expect(template).toContain('stationary_combustion');
    expect(template).toContain('purchased_electricity');
    expect(template).toContain('mobile_combustion');
    expect(template).toContain('fugitive');
    expect(template).toContain('purchased_steam');
    expect(template).toContain('water_use');
    expect(template).toContain('waste');
  });

  // ── Template-as-input tests ──────────────────────────────────────────────

  it('header and comment lines are skipped — parseCsvText returns only data rows', () => {
    const template = getCsvTemplate();
    const dataLines = template
      .split('\n')
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('supplier_id'));
    const rows = parseCsvText(template);
    expect(rows).toHaveLength(dataLines.length);
  });

  it('example rows fail UUID validation because <UUID-del-proveedor> is not a UUID', () => {
    const template = getCsvTemplate();
    const rows = parseCsvText(template);
    // Every data row uses the placeholder, so every row must fail
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.data).toBeNull();
      expect(row.errors.some((e) => /uuid/i.test(e))).toBe(true);
    }
  });

  it('workflow: replace placeholder UUID → all rows parse successfully', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const filledCsv = getCsvTemplate().replace(/<UUID-del-proveedor>/g, REAL_UUID);
    const rows = parseCsvText(filledCsv);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.errors).toHaveLength(0);
      expect(row.data).not.toBeNull();
      expect(row.data?.supplier_id).toBe(REAL_UUID);
    }
  });

  it('workflow: filled template preserves source_type variety across all rows', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const filledCsv = getCsvTemplate().replace(/<UUID-del-proveedor>/g, REAL_UUID);
    const rows = parseCsvText(filledCsv);
    const sourceTypes = new Set(rows.map((r) => r.data?.source_type).filter(Boolean));
    // Template covers all 7 source types
    expect(sourceTypes.size).toBe(7);
  });
});

describe('parseCsvText — Spanish alias header', () => {
  // Uses the exact alias pattern documented in getCsvTemplate
  it('recognizes proveedor_id,mes,fuente,combustible,cantidad,unidad,notas aliases', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const csv = [
      'proveedor_id,mes,fuente,combustible,cantidad,unidad,notas',
      `${REAL_UUID},2026-01,stationary_combustion,natural_gas,1000,m3_ng,Caldera A`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.supplier_id).toBe(REAL_UUID);
    expect(rows[0]!.data?.year_month).toBe('2026-01');
    expect(rows[0]!.data?.source_type).toBe('stationary_combustion');
    expect(rows[0]!.data?.secondary).toBe('natural_gas');
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
    expect(rows[0]!.data?.raw_unit).toBe('m3_ng');
    expect(rows[0]!.data?.notes).toBe('Caldera A');
  });

  it('Spanish aliases work with multiple data rows', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const csv = [
      'proveedor_id,mes,fuente,combustible,cantidad,unidad,notas',
      `${REAL_UUID},2026-01,purchased_electricity,SEIN_PERU,5000,kWh,Piso 2`,
      `${REAL_UUID},2026-02,mobile_combustion,gasoline,200,L,Flota`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('purchased_electricity');
    expect(rows[1]!.data?.source_type).toBe('mobile_combustion');
  });
});

describe('parseCsvText — detectDelimiter on multi-line input', () => {
  it('detects semicolon delimiter from header + data row', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const csv = [
      'supplier_id;year_month;source_type;secondary;raw_quantity;raw_unit;notes',
      `${REAL_UUID};2026-01;stationary_combustion;natural_gas;1000;m3_ng;Caldera`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
  });

  it('detects tab delimiter from header + data row', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const header = 'supplier_id\tyear_month\tsource_type\tsecondary\traw_quantity\traw_unit\tnotes';
    const data = `${REAL_UUID}\t2026-01\tpurchased_electricity\tSEIN_PERU\t5000\tkWh\tPiso 2`;
    const rows = parseCsvText(`${header}\n${data}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('purchased_electricity');
  });

  it('detects comma delimiter from header + multiple data rows', () => {
    const REAL_UUID = '00000000-0000-4000-8000-000000000001';
    const csv = [
      'supplier_id,year_month,source_type,secondary,raw_quantity,raw_unit,notes',
      `${REAL_UUID},2026-01,fugitive,R410A,5,kg,HVAC`,
      `${REAL_UUID},2026-02,waste,recycled,1.2,ton_us,Reciclaje`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('fugitive');
    expect(rows[1]!.data?.source_type).toBe('waste');
  });
});

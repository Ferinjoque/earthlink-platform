import { describe, it, expect } from 'vitest';
import { parseCsvText, getCsvTemplate } from '../../../src/lib/csv';

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

describe('parseCsvText', () => {
  it('returns empty array for empty input', () => {
    expect(parseCsvText('')).toEqual([]);
    expect(parseCsvText('   ')).toEqual([]);
  });

  it('parses a single valid row without header', () => {
    const csv = `${VALID_UUID},stationary_combustion,natural_gas,1000,m3_ng,Boiler A`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data).toMatchObject({
      reporting_period_id: VALID_UUID,
      source_type: 'stationary_combustion',
      secondary: 'natural_gas',
      raw_quantity: 1000,
      raw_unit: 'm3_ng',
    });
  });

  it('skips a header row when present', () => {
    const csv = [
      'reporting_period_id,source_type,secondary,raw_quantity,raw_unit,notes',
      `${VALID_UUID},purchased_electricity,SEIN_PERU,5000,kWh,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data?.source_type).toBe('purchased_electricity');
  });

  it('assigns sequential rowIndex starting at 1', () => {
    const csv = [
      `${VALID_UUID},stationary_combustion,diesel,100,L,`,
      `${VALID_UUID},mobile_combustion,gasoline,50,gallon,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows[0]!.rowIndex).toBe(1);
    expect(rows[1]!.rowIndex).toBe(2);
  });

  it('records errors for invalid UUID', () => {
    const csv = `not-a-uuid,stationary_combustion,diesel,100,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
    expect(rows[0]!.errors[0]).toMatch(/uuid/i);
  });

  it('records errors for invalid source_type', () => {
    const csv = `${VALID_UUID},bad_source,diesel,100,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('records errors for non-positive quantity', () => {
    const csv = `${VALID_UUID},stationary_combustion,diesel,-5,L,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.some((e) => /positiv/i.test(e))).toBe(true);
  });

  it('parses purchased_steam with empty secondary', () => {
    const csv = `${VALID_UUID},purchased_steam,,100,kWh,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('purchased_steam');
    expect(rows[0]!.data?.secondary).toBe('');
  });

  it('handles quoted fields containing commas', () => {
    const csv = `${VALID_UUID},stationary_combustion,natural_gas,1000,m3_ng,"Boiler, main"`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.notes).toBe('Boiler, main');
  });

  it('handles mixed valid and invalid rows', () => {
    const csv = [
      `${VALID_UUID},stationary_combustion,diesel,100,L,`,
      `bad-uuid,purchased_electricity,SEIN_PERU,500,kWh,`,
      `${VALID_UUID},mobile_combustion,gasoline,200,gallon,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors.length).toBeGreaterThan(0);
    expect(rows[2]!.errors).toHaveLength(0);
  });

  it('coerces string numbers to numeric raw_quantity', () => {
    const csv = `${VALID_UUID},fugitive,R410A,5.75,kg,`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.raw_quantity).toBe(5.75);
  });

  it('handles Windows CRLF line endings', () => {
    const csv =
      `${VALID_UUID},stationary_combustion,lpg,300,L,\r\n` +
      `${VALID_UUID},purchased_electricity,US_AVERAGE,1200,kWh,\r\n`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });

  it('positional parse handles row with fewer than 6 columns (undefined fields default to empty)', () => {
    // Row has only 4 cols — raw_unit and notes are undefined → ?? '' fallback fires
    const csv = `${VALID_UUID},stationary_combustion,1000,L`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowIndex).toBe(1);
  });

  it('positional parse handles 1-column row (source_type undefined → empty string)', () => {
    // 'my_col' has no header keywords and is not a UUID → treated as data row positionally
    const csv = 'my_col';
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('positional parse handles 2-column row (secondary undefined → empty string)', () => {
    const csv = `${VALID_UUID},stationary_combustion`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('colMap path returns empty string when data row is shorter than header', () => {
    // Header defines 6 columns; data row has only 2 → cols[idx] is undefined → ?? '' fires
    const csv = [
      'reporting_period_id,source_type,secondary,raw_quantity,raw_unit,notes',
      `${VALID_UUID},stationary_combustion`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toBeNull();
    expect(rows[0]!.errors.length).toBeGreaterThan(0);
  });

  it('handles semicolon-delimited CSV', () => {
    const csv = `${VALID_UUID};stationary_combustion;natural_gas;1000;m3_ng;Caldera`;
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('stationary_combustion');
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
  });

  it('handles tab-delimited CSV', () => {
    const csv =
      `${VALID_UUID}\tstationary_combustion\tnatural_gas\t1000\tm3_ng\tCaldera\n` +
      `${VALID_UUID}\tpurchased_electricity\tSEIN_PERU\t5000\tkWh\t`;
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[1]!.errors).toHaveLength(0);
  });

  it('recognizes Spanish column aliases in header', () => {
    const csv = [
      'periodo_id,fuente,combustible,cantidad,unidad,notas',
      `${VALID_UUID},stationary_combustion,natural_gas,1000,m3_ng,Caldera`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.raw_quantity).toBe(1000);
    expect(rows[0]!.data?.raw_unit).toBe('m3_ng');
  });

  it('ignores unknown columns in header, still parses required columns', () => {
    const csv = [
      'reporting_period_id,source_type,extra_col,raw_quantity,raw_unit,notes',
      `${VALID_UUID},fugitive,R410A,5,kg,HVAC`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.source_type).toBe('fugitive');
    expect(rows[0]!.data?.raw_quantity).toBe(5);
  });

  it('falls back to positional parsing when header lacks required columns', () => {
    // 'source_type' in header → looksLikeHeader = true
    // but missing reporting_period_id, raw_quantity, raw_unit → buildColMap returns null
    // data row is parsed positionally
    const csv = [
      'source_type,secondary_only',
      `${VALID_UUID},stationary_combustion,natural_gas,1000,m3_ng,`,
    ].join('\n');
    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(1);
    // positional: cols[0]=UUID, cols[1]=stationary_combustion, cols[2]=natural_gas, cols[3]=1000, cols[4]=m3_ng
    expect(rows[0]!.errors).toHaveLength(0);
    expect(rows[0]!.data?.reporting_period_id).toBe(VALID_UUID);
  });

  it('treats first row as data when it has no header keywords and no UUID', () => {
    // 'my_label' has no header keywords → looksLikeHeader = false
    // all rows (including this first one) are parsed positionally
    const csv = `my_label,col2,col3,col4,col5,col6`;
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
    expect(firstLine).toBe('reporting_period_id,source_type,secondary,raw_quantity,raw_unit,notes');
  });

  it('has 6 lines — one header plus five example rows', () => {
    const template = getCsvTemplate();
    const lines = template.split('\n').filter(Boolean);
    expect(lines).toHaveLength(6);
  });

  it('each example row has 6 comma-separated fields', () => {
    const template = getCsvTemplate();
    const lines = template.split('\n').filter(Boolean);
    for (const line of lines) {
      expect(line.split(',').length).toBe(6);
    }
  });

  it('example rows cover all five source types', () => {
    const template = getCsvTemplate();
    expect(template).toContain('stationary_combustion');
    expect(template).toContain('purchased_electricity');
    expect(template).toContain('mobile_combustion');
    expect(template).toContain('fugitive');
    expect(template).toContain('purchased_steam');
  });
});

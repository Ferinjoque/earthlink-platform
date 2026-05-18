import { describe, it, expect } from 'vitest';
import { parseCsvText } from '../../../src/lib/csv';

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
});

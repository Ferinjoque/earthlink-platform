import { describe, it, expect } from 'vitest';
import { Organization } from '../../../src/domain/Organization';
import { Supplier } from '../../../src/domain/Supplier';
import { ReportingPeriod } from '../../../src/domain/ReportingPeriod';
import { ActivityEntry } from '../../../src/domain/ActivityEntry';
import { AnomalyFlag } from '../../../src/domain/AnomalyFlag';

describe('Organization', () => {
  const makeOrg = () =>
    new Organization({
      id: 'org-1',
      name: 'EarthLink Audit Co',
      industry: 'Consulting',
      ruc: '20612345678',
      createdAt: new Date('2026-01-01'),
    });

  it('stores all properties', () => {
    const org = makeOrg();
    expect(org.id).toBe('org-1');
    expect(org.name).toBe('EarthLink Audit Co');
    expect(org.industry).toBe('Consulting');
    expect(org.ruc).toBe('20612345678');
  });

  it('equals by id', () => {
    const a = makeOrg();
    const b = new Organization({
      ...{ id: 'org-1', name: 'Other', industry: 'X', ruc: '1', createdAt: new Date() },
    });
    expect(a.equals(b)).toBe(true);
  });
});

describe('Supplier', () => {
  const makeSupplier = () =>
    new Supplier({
      id: 'sup-1',
      organizationId: 'org-1',
      name: 'Pacific Foods SA',
      category: 'Food & Beverage',
      contactEmail: 'contact@pacific.pe',
      createdAt: new Date('2026-01-01'),
    });

  it('stores all properties', () => {
    const s = makeSupplier();
    expect(s.id).toBe('sup-1');
    expect(s.organizationId).toBe('org-1');
    expect(s.name).toBe('Pacific Foods SA');
    expect(s.category).toBe('Food & Beverage');
    expect(s.contactEmail).toBe('contact@pacific.pe');
  });

  it('equals by id', () => {
    const a = makeSupplier();
    const b = new Supplier({
      ...{
        id: 'sup-1',
        organizationId: 'x',
        name: 'y',
        category: 'z',
        contactEmail: 'e',
        createdAt: new Date(),
      },
    });
    expect(a.equals(b)).toBe(true);
  });
});

describe('ReportingPeriod', () => {
  const makePeriod = (status: 'open' | 'locked' = 'open') =>
    new ReportingPeriod({
      id: 'period-1',
      supplierId: 'sup-1',
      label: 'Q1-2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status,
      createdAt: new Date(),
    });

  it('stores all properties', () => {
    const p = makePeriod();
    expect(p.label).toBe('Q1-2026');
    expect(p.supplierId).toBe('sup-1');
    expect(p.status).toBe('open');
  });

  it('isEditable returns true when open', () => {
    expect(makePeriod('open').isEditable()).toBe(true);
  });

  it('isEditable returns false when locked', () => {
    expect(makePeriod('locked').isEditable()).toBe(false);
  });

  it('isLocked returns true when locked', () => {
    expect(makePeriod('locked').isLocked()).toBe(true);
  });

  it('isLocked returns false when open', () => {
    expect(makePeriod('open').isLocked()).toBe(false);
  });
});

describe('ActivityEntry', () => {
  const NOW = new Date('2026-01-15T00:00:00Z');

  it('toActivityRecord uses submittedAt when present', () => {
    const entry = new ActivityEntry({
      id: 'ae-1',
      reportingPeriodId: 'period-1',
      sourceType: 'mobile_combustion',
      activityKind: { kind: 'mobile_combustion', fuel: 'gasoline' },
      rawQuantity: 200,
      rawUnit: 'L',
      status: 'submitted',
      submittedAt: NOW,
      submittedBy: 'user-1',
      createdAt: NOW,
    });
    const record = entry.toActivityRecord('supplier-1');
    expect(record.supplierId).toBe('supplier-1');
    expect(record.rawValue).toBe(200);
    expect(record.submittedAt).toBe(NOW);
  });

  it('toActivityRecord falls back to createdAt when submittedAt is null', () => {
    const entry = new ActivityEntry({
      id: 'ae-2',
      reportingPeriodId: 'period-1',
      sourceType: 'fugitive',
      activityKind: { kind: 'fugitive', refrigerant: 'R410A' },
      rawQuantity: 5,
      rawUnit: 'kg',
      status: 'draft',
      submittedAt: null,
      submittedBy: null,
      createdAt: NOW,
    });
    const record = entry.toActivityRecord('supplier-1');
    expect(record.submittedAt).toBe(NOW);
  });
});

describe('AnomalyFlag', () => {
  const NOW = new Date('2026-01-15T00:00:00Z');
  const makeFlag = (severity: 'low' | 'medium' | 'high' = 'high', isResolved = false) =>
    new AnomalyFlag({
      id: 'flag-1',
      activityEntryId: 'ae-1',
      detector: 'zscore_monthly',
      severity,
      zScore: 4.6,
      thresholdUsed: 3.0,
      message: 'Outlier detected',
      isResolved,
      resolvedBy: null,
      resolvedAt: null,
      flaggedAt: NOW,
      createdAt: NOW,
    });

  it('stores all properties', () => {
    const flag = makeFlag();
    expect(flag.activityEntryId).toBe('ae-1');
    expect(flag.zScore).toBe(4.6);
    expect(flag.severity).toBe('high');
  });

  it('isHigh returns true for high severity', () => {
    expect(makeFlag('high').isHigh()).toBe(true);
  });

  it('isHigh returns false for medium severity', () => {
    expect(makeFlag('medium').isHigh()).toBe(false);
  });

  it('needsReview returns true for unresolved medium', () => {
    expect(makeFlag('medium', false).needsReview()).toBe(true);
  });

  it('needsReview returns false when resolved', () => {
    expect(makeFlag('high', true).needsReview()).toBe(false);
  });

  it('needsReview returns false for low severity', () => {
    expect(makeFlag('low', false).needsReview()).toBe(false);
  });
});

/**
 * Tests para la guardia de tenant en repositorios Supabase.
 * Verifica que findAll() lanza error en repos tenant-scoped para prevenir
 * acceso cross-tenant accidental.
 */

import { describe, it, expect } from 'vitest';
import { SupplierRepository } from '../../../src/repos/SupplierRepository';
import { OrganizationRepository } from '../../../src/repos/OrganizationRepository';
import { ActivityEntryRepository } from '../../../src/repos/ActivityEntryRepository';
import { ReportingPeriodRepository } from '../../../src/repos/ReportingPeriodRepository';
import { AnomalyFlagRepository } from '../../../src/repos/AnomalyFlagRepository';

describe('Guardia de tenant - repos tenant-scoped no exponen findAll()', () => {
  const NULL_CLIENT = null as never;

  it('SupplierRepository.findAll() lanza error descriptivo', () => {
    const repo = new SupplierRepository(NULL_CLIENT);
    expect(() => repo.findAll()).toThrow('SupplierRepository.findAll()');
    expect(() => repo.findAll()).toThrow('no permitido');
  });

  it('OrganizationRepository.findAll() lanza error descriptivo', () => {
    const repo = new OrganizationRepository(NULL_CLIENT);
    expect(() => repo.findAll()).toThrow('OrganizationRepository.findAll()');
    expect(() => repo.findAll()).toThrow('no permitido');
  });

  it('ActivityEntryRepository.findAll() lanza error descriptivo', () => {
    const repo = new ActivityEntryRepository(NULL_CLIENT);
    expect(() => repo.findAll()).toThrow('ActivityEntryRepository.findAll()');
    expect(() => repo.findAll()).toThrow('no permitido');
  });

  it('ReportingPeriodRepository.findAll() lanza error descriptivo', () => {
    const repo = new ReportingPeriodRepository(NULL_CLIENT);
    expect(() => repo.findAll()).toThrow('ReportingPeriodRepository.findAll()');
    expect(() => repo.findAll()).toThrow('no permitido');
  });

  it('AnomalyFlagRepository.findAll() lanza error descriptivo', () => {
    const repo = new AnomalyFlagRepository(NULL_CLIENT);
    expect(() => repo.findAll()).toThrow('AnomalyFlagRepository.findAll()');
    expect(() => repo.findAll()).toThrow('no permitido');
  });
});

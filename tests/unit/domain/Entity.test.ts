import { describe, it, expect } from 'vitest';
import { Entity } from '../../../src/domain/Entity';

class ConcreteEntity extends Entity {
  constructor(
    id: string,
    readonly name: string,
    createdAt = new Date(),
  ) {
    super(id, createdAt);
  }
}

describe('Entity', () => {
  it('equals by id', () => {
    const a = new ConcreteEntity('abc', 'Alpha');
    const b = new ConcreteEntity('abc', 'Beta');
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when ids differ', () => {
    const a = new ConcreteEntity('a1', 'Alpha');
    const b = new ConcreteEntity('b1', 'Alpha');
    expect(a.equals(b)).toBe(false);
  });

  it('toString includes class name and id', () => {
    const e = new ConcreteEntity('xyz', 'Test');
    const str = e.toString();
    expect(str).toContain('ConcreteEntity');
    expect(str).toContain('xyz');
  });

  it('preserves createdAt', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const e = new ConcreteEntity('id1', 'Test', date);
    expect(e.createdAt).toEqual(date);
  });
});

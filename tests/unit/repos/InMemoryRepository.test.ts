import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../../../src/repos/InMemoryRepository';
import { Entity } from '../../../src/domain/Entity';

class TestEntity extends Entity {
  constructor(
    id: string,
    readonly value: string,
  ) {
    super(id, new Date());
  }
}

describe('InMemoryRepository', () => {
  let repo: InMemoryRepository<TestEntity>;

  beforeEach(() => {
    repo = new InMemoryRepository<TestEntity>();
  });

  it('saves and retrieves entity', async () => {
    const entity = new TestEntity('1', 'hello');
    await repo.save(entity);
    const found = await repo.findById('1');
    expect(found).toEqual(entity);
  });

  it('returns null for missing id', async () => {
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findAll returns all saved entities', async () => {
    await repo.save(new TestEntity('1', 'a'));
    await repo.save(new TestEntity('2', 'b'));
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('delete removes entity', async () => {
    await repo.save(new TestEntity('1', 'a'));
    await repo.delete('1');
    expect(await repo.findById('1')).toBeNull();
  });

  it('seed pre-populates store', async () => {
    repo.seed([new TestEntity('x', 'seeded')]);
    const found = await repo.findById('x');
    expect(found?.value).toBe('seeded');
  });

  it('upserts on save with same id', async () => {
    const original = new TestEntity('1', 'original');
    const updated = new TestEntity('1', 'updated');
    await repo.save(original);
    await repo.save(updated);
    const found = await repo.findById('1');
    expect(found?.value).toBe('updated');
  });
});

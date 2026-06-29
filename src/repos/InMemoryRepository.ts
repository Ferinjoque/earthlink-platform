/**
 * Repositorio en memoria, usado en tests unitarios.
 * Reemplazo directo de SupabaseRepository sin cambios en los sitios de llamada.
 */
import type { Entity } from '../domain/Entity';
import { Repository } from './Repository';

export class InMemoryRepository<
  TEntity extends Entity<TId>,
  TId extends string = string,
> extends Repository<TEntity, TId> {
  private readonly store = new Map<TId, TEntity>();

  async findById(id: TId): Promise<TEntity | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<readonly TEntity[]> {
    return Array.from(this.store.values());
  }

  async save(entity: TEntity): Promise<TEntity> {
    this.store.set(entity.id, entity);
    return entity;
  }

  async delete(id: TId): Promise<void> {
    this.store.delete(id);
  }

  /** Precarga el almacén, usado en tests unitarios */
  seed(entities: readonly TEntity[]): this {
    for (const entity of entities) {
      this.store.set(entity.id, entity);
    }
    return this;
  }

  clear(): this {
    this.store.clear();
    return this;
  }
}

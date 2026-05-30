/**
 * Interfaz abstracta de repositorio.
 * Implementaciones concretas: SupabaseRepository (producción), InMemoryRepository (tests).
 */
import type { Entity } from '../domain/Entity';

export abstract class Repository<TEntity extends Entity<TId>, TId extends string = string> {
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract findAll(): Promise<readonly TEntity[]>;
  abstract save(entity: TEntity): Promise<TEntity>;
  abstract delete(id: TId): Promise<void>;
}

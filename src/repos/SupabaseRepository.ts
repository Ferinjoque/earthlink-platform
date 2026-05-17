/**
 * Generic Supabase implementation of Repository<T>.
 * Concrete repos extend this and provide table name + row mapper.
 * Implemented fully in feat/phase-3-domain-repos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entity } from '../domain/Entity';
import { Repository } from './Repository';

export abstract class SupabaseRepository<
  TEntity extends Entity<TId>,
  TId extends string = string,
> extends Repository<TEntity, TId> {
  protected abstract readonly tableName: string;

  constructor(protected readonly client: SupabaseClient) {
    super();
  }

  protected abstract toEntity(row: Record<string, unknown>): TEntity;
  protected abstract toRow(entity: TEntity): Record<string, unknown>;

  async findById(id: TId): Promise<TEntity | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error ?? !data) return null;
    return this.toEntity(data as Record<string, unknown>);
  }

  async findAll(): Promise<readonly TEntity[]> {
    const { data, error } = await this.client.from(this.tableName).select('*');
    if (error ?? !data) return [];
    return (data as Record<string, unknown>[]).map((row) => this.toEntity(row));
  }

  async save(entity: TEntity): Promise<TEntity> {
    const row = this.toRow(entity);
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(row)
      .select()
      .single();
    if (error ?? !data) throw new Error(`Failed to save ${this.tableName}: ${error?.message}`);
    return this.toEntity(data as Record<string, unknown>);
  }

  async delete(id: TId): Promise<void> {
    const { error } = await this.client.from(this.tableName).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete from ${this.tableName}: ${error.message}`);
  }
}

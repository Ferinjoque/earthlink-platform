/**
 * Abstract base class for all domain entities.
 * Provides identity, equality, and audit timestamps.
 */
export abstract class Entity<TId extends string = string> {
  readonly id: TId;
  readonly createdAt: Date;

  protected constructor(id: TId, createdAt: Date) {
    this.id = id;
    this.createdAt = createdAt;
  }

  equals(other: Entity<TId>): boolean {
    return this.id === other.id;
  }

  toString(): string {
    return `${this.constructor.name}(${this.id})`;
  }
}

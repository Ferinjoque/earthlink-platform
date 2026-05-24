/**
 * Clase base abstracta para todas las entidades de dominio.
 * Proporciona identidad, igualdad y marcas de tiempo de auditoría.
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

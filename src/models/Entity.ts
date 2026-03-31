/**
 * Clase abstracta base que proporciona propiedades comunes a todas las entidades del dominio.
 * Demuestra el principio de Abstracción y Herencia.
 */
export abstract class Entity {
    // Uso de protected y private para encapsulamiento
    protected constructor(
        private readonly _id: string,
        private readonly _createdAt: Date
    ) {}

    // Getters de solo lectura para proteger los identificadores
    get id(): string {
        return this._id;
    }

    get createdAt(): Date {
        return this._createdAt;
    }
}
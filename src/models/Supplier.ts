import { Entity } from './Entity';

/**
 * Representa un proveedor dentro de la cadena de suministro.
 * Hereda de Entity y encapsula sus propios atributos.
 */
export class Supplier extends Entity {
    private _name: string;
    private _category: string;
    private _contactEmail: string;
    private _companyId: string;

    constructor(
        id: string,
        createdAt: Date,
        name: string,
        category: string,
        contactEmail: string,
        companyId: string
    ) {
        super(id, createdAt);
        this._name = name;
        this._category = category;
        this._contactEmail = contactEmail;
        this._companyId = companyId;
    }

    // Getters
    get name(): string { return this._name; }
    get category(): string { return this._category; }
    get contactEmail(): string { return this._contactEmail; }
    get companyId(): string { return this._companyId; }

    // Setters con validación
    set name(value: string) {
        if (!value.trim()) {
            throw new Error('El nombre del proveedor no puede estar vacío.');
        }
        this._name = value;
    }

    set contactEmail(value: string) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            throw new Error('Formato de correo electrónico inválido.');
        }
        this._contactEmail = value;
    }
}
import { Entity } from './Entity';

/**
 * Representa el registro de auditoría de un proveedor.
 * Protege estrictamente los puntajes calculados para evitar manipulación externa.
 */
export class EnvironmentalEvaluation extends Entity {
    private _supplierId: string;
    private _evaluationPeriod: string;

    // Datos crudos
    private _rawElectricityValue: number;
    private _rawTransportValue: number;

    // Resultados calculados (Solo lectura desde el exterior tras instanciarse)
    private _totalCo2eEmissions: number;
    private _riskScore: number;

    constructor(
        id: string,
        createdAt: Date,
        supplierId: string,
        evaluationPeriod: string,
        rawElectricityValue: number = 0,
        rawTransportValue: number = 0
    ) {
        super(id, createdAt);
        this._supplierId = supplierId;
        this._evaluationPeriod = evaluationPeriod;
        this._rawElectricityValue = rawElectricityValue;
        this._rawTransportValue = rawTransportValue;

        // Inicializados en 0, se actualizan mediante la lógica multiparadigma
        this._totalCo2eEmissions = 0;
        this._riskScore = 0;
    }

    // Getters básicos
    get supplierId(): string { return this._supplierId; }
    get evaluationPeriod(): string { return this._evaluationPeriod; }
    get rawElectricityValue(): number { return this._rawElectricityValue; }
    get rawTransportValue(): number { return this._rawTransportValue; }
    get totalCo2eEmissions(): number { return this._totalCo2eEmissions; }
    get riskScore(): number { return this._riskScore; }

    /**
     * Único método público para actualizar métricas.
     * Se llama desde el motor de cálculo funcional.
     */
    public updateCalculatedMetrics(co2e: number, riskScore: number): void {
        if (co2e < 0 || riskScore < 0) {
            throw new Error('Las métricas ambientales no pueden ser negativas.');
        }
        this._totalCo2eEmissions = co2e;
        this._riskScore = riskScore;
    }
}
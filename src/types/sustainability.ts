/**
 * Tipos inmutables para garantizar la integridad de los datos en el paradigma funcional.
 */

export type ElectricityUnit = 'kWh' | 'MWh';
export type TransportUnit = 'liters' | 'gallons';

export interface RawMetrics {
    readonly electricity: { readonly value: number; readonly unit: ElectricityUnit };
    readonly transport: { readonly value: number; readonly unit: TransportUnit };
}

export interface EmissionFactors {
    readonly electricity_kWh: number;
    readonly transport_liters: number;
}

export interface CalculationResult {
    readonly totalCo2e: number;
    readonly riskScore: number;
    readonly breakdown: {
        readonly electricityCo2e: number;
        readonly transportCo2e: number;
    };
}
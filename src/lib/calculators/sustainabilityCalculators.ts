import { RawMetrics, EmissionFactors, CalculationResult, ElectricityUnit, TransportUnit } from '../../types/sustainability';

/**
 * PARADIGMA FUNCIONAL: Funciones puras para la estandarización de unidades.
 * No mutan variables externas y siempre devuelven el mismo resultado para los mismos inputs.
 */

const standardizeElectricity = (value: number, unit: ElectricityUnit): number => {
    if (value < 0) throw new Error('El consumo eléctrico no puede ser negativo.');
    return unit === 'MWh' ? value * 1000 : value;
};

const standardizeTransport = (value: number, unit: TransportUnit): number => {
    if (value < 0) throw new Error('El consumo de combustible no puede ser negativo.');
    // 1 Galón US = 3.78541 Litros
    return unit === 'gallons' ? value * 3.78541 : value;
};

/**
 * Función pura que calcula el score de riesgo basado en las emisiones totales.
 * Escala arbitraria de negocio: 0 (Excelente) a 100 (Riesgo Crítico).
 */
const calculateRiskScore = (totalCo2e: number): number => {
    if (totalCo2e <= 0) return 0;
    // Fórmula logística simple para acotar el riesgo entre 0 y 100
    const score = (totalCo2e / (totalCo2e + 5000)) * 100;
    return Math.min(Math.max(Math.round(score), 0), 100);
};

/**
 * Función de Orden Superior (Higher-Order concept) que orquesta el pipeline de cálculo.
 * Toma las métricas crudas y los factores de emisión, y devuelve un objeto inmutable con el resultado.
 * * Fórmula base: Emisiones = Dato de Actividad x Factor de Emisión
 */
export const calculateCarbonFootprint = (
    metrics: RawMetrics,
    factors: EmissionFactors
): CalculationResult => {

    // 1. Estandarización
    const electricityKwh = standardizeElectricity(metrics.electricity.value, metrics.electricity.unit);
    const transportLiters = standardizeTransport(metrics.transport.value, metrics.transport.unit);

    // 2. Cálculo de Huella (CO2e)
    const electricityCo2e = electricityKwh * factors.electricity_kWh;
    const transportCo2e = transportLiters * factors.transport_liters;
    const totalCo2e = electricityCo2e + transportCo2e;

    // 3. Generación de Score
    const riskScore = calculateRiskScore(totalCo2e);

    // 4. Retorno Inmutable
    return Object.freeze({
        totalCo2e: Number(totalCo2e.toFixed(2)),
        riskScore,
        breakdown: Object.freeze({
            electricityCo2e: Number(electricityCo2e.toFixed(2)),
            transportCo2e: Number(transportCo2e.toFixed(2))
        })
    });
};
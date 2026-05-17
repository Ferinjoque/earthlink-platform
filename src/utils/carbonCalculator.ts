// src/utils/carbonCalculator.ts

// 1. Tipado estricto basado en la base de datos (schema.sql)
export type ElectricityUnit = 'kWh' | 'MWh';
export type TransportUnit = 'liters' | 'gallons';

// 2. Diccionarios inmutables para la conversión
const electricityConversionRates: Record<ElectricityUnit, number> = {
  'kWh': 1,
  'MWh': 1000,
};

const transportConversionRates: Record<TransportUnit, number> = {
  'liters': 1,
  'gallons': 3.78541, // Factor para pasar galones a litros
};

/**
 * Funciones Puras para estandarización de unidades.
 * Garantizan que no hay efectos secundarios y siempre retornan el mismo cálculo.
 */
export const standardizeElectricity = (value: number, unit: ElectricityUnit): number => {
  const rate = electricityConversionRates[unit];
  if (!rate) throw new Error(`Unidad eléctrica no soportada: ${unit}`);
  return value * rate;
};

export const standardizeTransport = (value: number, unit: TransportUnit): number => {
  const rate = transportConversionRates[unit];
  if (!rate) throw new Error(`Unidad de transporte no soportada: ${unit}`);
  return value * rate;
};

/**
 * Motor de Cálculo - GHG Protocol
 * Emisiones = Dato de Actividad * Factor de Emisión
 */
export const calculateEmissions = (standardizedValue: number, factorCo2e: number): number => {
  return Number((standardizedValue * factorCo2e).toFixed(4));
};

/**
 * Pipe Funcional: Orquesta todo el flujo de una evaluación ambiental.
 * Recibe los datos crudos del proveedor y los factores de la BD, retorna el total de CO2e.
 */
export const processEnvironmentalEvaluation = (
  rawElectricity: number,
  elUnit: ElectricityUnit,
  elFactor: number,
  rawTransport: number,
  trUnit: TransportUnit,
  trFactor: number
): number => {
  // 1. Estandarizar
  const stdElectricity = standardizeElectricity(rawElectricity, elUnit);
  const stdTransport = standardizeTransport(rawTransport, trUnit);

  // 2. Calcular emisiones por fuente
  const electricityEmissions = calculateEmissions(stdElectricity, elFactor);
  const transportEmissions = calculateEmissions(stdTransport, trFactor);

  // 3. Retornar huella de carbono total consolidada
  return electricityEmissions + transportEmissions;
};
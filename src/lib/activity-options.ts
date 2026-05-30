import type { EmissionSourceType } from '@/types/database';
import type { Unit } from '@/calc/types';

export type UnitInfo = { unit: Unit; ayuda: string };

export const ETIQUETAS_FUENTE: Record<EmissionSourceType, string> = {
  stationary_combustion: 'Combustión estacionaria (Alcance 1)',
  mobile_combustion: 'Combustión móvil (Alcance 1)',
  purchased_electricity: 'Electricidad comprada (Alcance 2)',
  purchased_steam: 'Vapor comprado (Alcance 2)',
  fugitive: 'Emisiones fugitivas (Alcance 1)',
  water_use: 'Consumo de agua (GRESB)',
  waste: 'Generación de residuos (GRESB)',
};

export const AYUDA_FUENTE: Record<EmissionSourceType, string> = {
  stationary_combustion:
    'Quema de combustibles en equipos fijos: calderas, generadores, hornos. Alcance 1 según GHG Protocol. Fórmula: consumo × factor (kg CO₂e/L o kg CO₂e/kBtu).',
  mobile_combustion:
    'Quema de combustibles en vehículos o maquinaria móvil de la organización. Alcance 1 según GHG Protocol.',
  purchased_electricity:
    'Electricidad comprada de la red eléctrica. Alcance 2 según GHG Protocol. Fórmula: consumo (kWh) × factor de la región de red (kg CO₂e/kWh).',
  purchased_steam: 'Vapor o calor comprado a un proveedor externo. Alcance 2 según GHG Protocol.',
  fugitive:
    'Fugas no intencionales de gases refrigerantes en equipos HVAC/R. Alcance 1. Fórmula: masa fugada (kg) × GWP del refrigerante.',
  water_use:
    'Consumo de agua por tipo de fuente (municipal, reciclada, etc.). Se reporta en GRESB para indicadores de agua. No genera emisiones GHG directas.',
  waste:
    'Generación de residuos por método de disposición (vertedero, reciclaje, compostaje). Se reporta en GRESB. No genera emisiones GHG directas.',
};

export const OPCIONES_SECUNDARIAS: Partial<
  Record<EmissionSourceType, { value: string; label: string; ayuda?: string }[]>
> = {
  stationary_combustion: [
    {
      value: 'natural_gas',
      label: 'Gas natural',
      ayuda: 'Gas natural (metano). Factor DEFRA 2024: ~2.02 kg CO₂e/m³. Unidad estándar: m³.',
    },
    {
      value: 'diesel',
      label: 'Diésel',
      ayuda: 'Diésel (gasoil). Factor DEFRA 2024: ~2.51 kg CO₂e/L.',
    },
    {
      value: 'lpg',
      label: 'GLP',
      ayuda: 'Gas licuado de petróleo (propano/butano). Factor DEFRA 2024: ~1.56 kg CO₂e/L.',
    },
    {
      value: 'fuel_oil_no2',
      label: 'Fuel Oil No. 2 (Diésel pesado)',
      ayuda:
        'Diésel pesado / Gas oil. Factor DEFRA 2024: ~2.68 kg CO₂e/L. Usado en generadores de emergencia.',
    },
    {
      value: 'propane',
      label: 'Propano',
      ayuda:
        'Propano en cilindros. Factor DEFRA 2024: ~1.49 kg CO₂e/L. Usado en calefacción y cocinas.',
    },
  ],
  mobile_combustion: [
    { value: 'diesel', label: 'Diésel' },
    { value: 'gasoline', label: 'Gasolina' },
    { value: 'lpg', label: 'GLP' },
  ],
  purchased_electricity: [
    {
      value: 'SEIN_PERU',
      label: 'SEIN — Perú',
      ayuda:
        'Sistema Eléctrico Interconectado Nacional del Perú. Factor MINEM 2023: ~0.4517 kg CO₂e/kWh.',
    },
    { value: 'LATAM_AVG', label: 'Promedio LATAM' },
    { value: 'US_AVERAGE', label: 'Promedio EE.UU.' },
    { value: 'EU_AVERAGE', label: 'Promedio UE' },
  ],
  fugitive: [
    {
      value: 'R410A',
      label: 'R-410A',
      ayuda: 'Mezcla HFC. GWP 2088. Común en sistemas HVAC modernos.',
    },
    {
      value: 'R134A',
      label: 'R-134A',
      ayuda: 'HFC puro. GWP 1430. Común en refrigeración.',
    },
    {
      value: 'R32',
      label: 'R-32',
      ayuda: 'HFC puro. GWP 675. Eficiencia energética alta.',
    },
  ],
  water_use: [
    {
      value: 'all_sources',
      label: 'Todas las fuentes',
      ayuda: 'Total de agua consumida de todas las fuentes combinadas.',
    },
    {
      value: 'potable_mixed',
      label: 'Agua potable (red municipal)',
      ayuda: 'Agua potable suministrada por la red pública o municipal.',
    },
    {
      value: 'potable_indoor',
      label: 'Agua potable (uso interior)',
      ayuda: 'Agua potable usada exclusivamente en interiores del edificio.',
    },
    {
      value: 'reclaimed_mixed',
      label: 'Agua reciclada / tratada',
      ayuda: 'Agua que ha sido tratada y reutilizada. Reduce la presión sobre fuentes naturales.',
    },
    {
      value: 'well_outdoor',
      label: 'Agua de pozo (uso exterior)',
      ayuda: 'Agua extraída de pozo para riego u otros usos exteriores.',
    },
    {
      value: 'other_mixed',
      label: 'Otras fuentes',
      ayuda: 'Agua de lluvia, condensado u otras fuentes no clasificadas en las anteriores.',
    },
  ],
  waste: [
    {
      value: 'disposed_trash',
      label: 'Residuos enviados a vertedero',
      ayuda:
        'Residuos sólidos urbanos e industriales dispuestos en relleno sanitario o incinerados.',
    },
    {
      value: 'recycled',
      label: 'Reciclaje',
      ayuda: 'Residuos enviados a procesos de reciclaje (papel, plástico, metal, vidrio).',
    },
    {
      value: 'composted',
      label: 'Compostaje',
      ayuda: 'Residuos orgánicos enviados a compostaje o digestión anaerobia.',
    },
  ],
};

export const UNIDADES_POR_FUENTE: Record<EmissionSourceType, UnitInfo[]> = {
  stationary_combustion: [
    { unit: 'm3_ng', ayuda: 'Metro cúbico de gas natural. Unidad estándar para gas en redes.' },
    { unit: 'ft3_ng', ayuda: 'Pie cúbico de gas natural. 1 ft³ = 0.02832 m³.' },
    { unit: 'kBtu', ayuda: 'Mil BTU. Unidad de energía. 1 kBtu = 0.293 kWh = 0.001055 GJ.' },
    { unit: 'L', ayuda: 'Litro. Unidad de volumen líquido. Usada para diésel, fuel oil, propano.' },
    { unit: 'gallon', ayuda: 'Galón estadounidense. 1 gal EE.UU. = 3.785 L.' },
    { unit: 'GJ', ayuda: 'Gigajoule. Unidad de energía. 1 GJ = 277.78 kWh = 947.8 kBtu.' },
    { unit: 'kWh', ayuda: 'Kilovatio-hora. 1 kWh = 3.6 MJ = 3.412 kBtu.' },
    {
      unit: 'therms',
      ayuda: 'Therm. Unidad energética anglosajona. 1 therm = 100 kBtu = 29.3 kWh.',
    },
    { unit: 'MMBtu', ayuda: 'Millón de BTU. 1 MMBtu = 1000 kBtu = 293 kWh.' },
    { unit: 'MBtu', ayuda: 'Equivalente a MMBtu en convención GRESB. 1 MBtu = 1000 kBtu.' },
    { unit: 'MJ', ayuda: 'Megajoule. 1 MJ = 0.278 kWh = 0.948 kBtu.' },
  ],
  mobile_combustion: [
    { unit: 'L', ayuda: 'Litro. Unidad estándar para combustible líquido.' },
    { unit: 'gallon', ayuda: 'Galón estadounidense. 1 gal = 3.785 L.' },
    { unit: 'imp_gallon', ayuda: 'Galón imperial (Reino Unido). 1 gal imperial = 4.546 L.' },
  ],
  purchased_electricity: [
    { unit: 'kWh', ayuda: 'Kilovatio-hora. Unidad estándar de facturación eléctrica.' },
    { unit: 'MWh', ayuda: 'Megavatio-hora. 1 MWh = 1000 kWh. Para grandes consumos.' },
    { unit: 'GJ', ayuda: 'Gigajoule. 1 GJ = 277.78 kWh.' },
  ],
  purchased_steam: [
    { unit: 'kWh', ayuda: 'Kilovatio-hora equivalente de energía térmica.' },
    { unit: 'GJ', ayuda: 'Gigajoule. 1 GJ = 277.78 kWh.' },
    { unit: 'MWh', ayuda: 'Megavatio-hora. 1 MWh = 1000 kWh.' },
  ],
  fugitive: [
    { unit: 'kg', ayuda: 'Kilogramo. Masa del refrigerante recargado o fugado.' },
    { unit: 'lb', ayuda: 'Libra. 1 lb = 0.4536 kg.' },
    { unit: 'tonne', ayuda: 'Tonelada métrica. 1 t = 1000 kg.' },
  ],
  water_use: [
    {
      unit: 'kgal_us',
      ayuda: 'Mil galones (EE.UU.). Unidad GRESB estándar para agua. 1 kgal = 3,785 L = 3.785 m³.',
    },
    {
      unit: 'megaliter',
      ayuda:
        'Megalitro. Unidad GRESB estándar para grandes consumos. 1 ML = 1,000 m³ = 264,172 gal.',
    },
    { unit: 'm3', ayuda: 'Metro cúbico. Unidad métrica de volumen. 1 m³ = 1,000 L = 0.264 kgal.' },
    { unit: 'L', ayuda: 'Litro. Para consumos pequeños. 1 L = 0.001 m³.' },
    { unit: 'gallon', ayuda: 'Galón (EE.UU.). 1 galón = 3.785 L = 0.001 kgal.' },
  ],
  waste: [
    {
      unit: 'ton_us',
      ayuda:
        'Tonelada corta (EE.UU.). Unidad GRESB estándar para residuos. 1 ton corta = 0.907 toneladas métricas = 2,000 lb.',
    },
    { unit: 'tonne', ayuda: 'Tonelada métrica. 1 t = 1000 kg = 1.102 toneladas cortas.' },
    { unit: 'kg', ayuda: 'Kilogramo. Para residuos de menor volumen.' },
    { unit: 'lb', ayuda: 'Libra. 1 lb = 0.4536 kg = 0.000454 toneladas métricas.' },
  ],
};

export const ETIQUETA_UNIDAD: Partial<Record<string, string>> = {
  m3_ng: 'm³ gas natural',
  ft3_ng: 'ft³ gas natural',
  kBtu: 'Mil BTU (kBtu)',
  gallon: 'Galón US (gal)',
  imp_gallon: 'Galón imperial (imp_gal)',
  therms: 'Therms (US)',
  MMBtu: 'Millón BTU (MMBtu)',
  MBtu: 'Millón BTU GRESB (MBtu)',
  kgal_us: 'Mil gal. US (kgal)',
  megaliter: 'Megalitro (ML)',
  ton_us: 'Ton. corta US (ton)',
  tonne: 'Tonelada métrica (t)',
  lb: 'Libra (lb)',
};

export function etiquetaUnidad(unit: Unit): string {
  return (ETIQUETA_UNIDAD as Record<string, string>)[unit] ?? unit;
}

export function labelSecundarioPara(sourceType: EmissionSourceType): string {
  switch (sourceType) {
    case 'purchased_electricity':
      return 'Región de red eléctrica';
    case 'fugitive':
      return 'Refrigerante';
    case 'water_use':
      return 'Tipo de agua';
    case 'waste':
      return 'Método de disposición';
    default:
      return 'Tipo de combustible';
  }
}

export const ALL_SOURCE_TYPES = Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[];

export const ALL_UNITS: Unit[] = [
  ...new Set((Object.values(UNIDADES_POR_FUENTE) as UnitInfo[][]).flat().map((u) => u.unit)),
];

export const ALL_SECONDARIES: string[] = [
  ...new Set(
    (Object.values(OPCIONES_SECUNDARIAS) as { value: string }[][]).flat().map((o) => o.value),
  ),
];

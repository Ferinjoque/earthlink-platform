export const CATEGORIAS_VALIDAS = [
  'Manufactura',
  'Logística y transporte',
  'Energía y utilities',
  'Construcción e infraestructura',
  'Agricultura y agroindustria',
  'Tecnología y software',
  'Servicios profesionales',
  'Comercio y distribución',
  'Minería y extracción',
  'Química y materiales',
  'Salud y farmacia',
  'Otro',
] as const;

export type CategoriaValida = (typeof CATEGORIAS_VALIDAS)[number];

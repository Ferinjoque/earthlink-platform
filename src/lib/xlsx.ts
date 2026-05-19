import {
  OPCIONES_SECUNDARIAS,
  UNIDADES_POR_FUENTE,
  ETIQUETAS_FUENTE,
  ALL_SECONDARIES,
  ALL_UNITS,
} from './activity-options';
import { parseCsvText } from './csv';
import type { ParsedCsvRow } from './csv';
import type { EmissionSourceType } from '@/types/database';

export interface XlsxSupplier {
  id: string;
  name: string;
}

const HEADER_BG = 'FF1A2E1A';
const ACCENT_BG = 'FFE8F5E9';

// ── Template generation ───────────────────────────────────────────────────────

export async function generateXlsxTemplate(suppliers: XlsxSupplier[]): Promise<Uint8Array> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EarthLink';
  wb.created = new Date();

  // ── Sheet: Registros ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Registros', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'ID_Proveedor *', key: 'supplier_id', width: 38 },
    { header: 'Mes (YYYY-MM) *', key: 'year_month', width: 16 },
    { header: 'Fuente *', key: 'source_type', width: 26 },
    { header: 'Secundario', key: 'secondary', width: 24 },
    { header: 'Cantidad *', key: 'quantity', width: 14 },
    { header: 'Unidad *', key: 'unit', width: 16 },
    { header: 'Calidad_dato', key: 'data_quality', width: 14 },
    { header: 'Notas', key: 'notes', width: 32 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 22;

  const exampleSupplierId = suppliers[0]?.id ?? '00000000-0000-4000-8000-000000000001';
  const examples: unknown[][] = [
    [exampleSupplierId, '2026-01', 'stationary_combustion', 'natural_gas',    1000,  'm3_ng',   'measured',  'Caldera principal'],
    [exampleSupplierId, '2026-01', 'stationary_combustion', 'diesel',          500,  'L',       'measured',  'Generador emergencia'],
    [exampleSupplierId, '2026-01', 'stationary_combustion', 'lpg',             200,  'L',       'estimated', 'Cocina industrial'],
    [exampleSupplierId, '2026-01', 'stationary_combustion', 'fuel_oil_no2',    300,  'kBtu',    'measured',  'Caldera auxiliar'],
    [exampleSupplierId, '2026-01', 'stationary_combustion', 'propane',         100,  'L',       'estimated', 'Calefaccion exterior'],
    [exampleSupplierId, '2026-01', 'mobile_combustion',     'diesel',          200,  'L',       'measured',  'Flota vehicular'],
    [exampleSupplierId, '2026-01', 'mobile_combustion',     'gasoline',        150,  'L',       'measured',  'Vehiculos livianos'],
    [exampleSupplierId, '2026-01', 'purchased_electricity', 'SEIN_PERU',      5000,  'kWh',     'measured',  'Piso 2 oficinas'],
    [exampleSupplierId, '2026-01', 'purchased_electricity', 'LATAM_AVG',      1200,  'kWh',     'measured',  'Sede regional'],
    [exampleSupplierId, '2026-01', 'fugitive',              'R410A',           2.5,  'kg',      'measured',  'Mantenimiento HVAC'],
    [exampleSupplierId, '2026-01', 'fugitive',              'R134A',           2.0,  'kg',      'measured',  'Camara frigorifica'],
    [exampleSupplierId, '2026-01', 'fugitive',              'R32',             1.5,  'kg',      'measured',  'Minisplit oficina'],
    [exampleSupplierId, '2026-01', 'purchased_steam',       '',                100,  'GJ',      'calculated',''],
    [exampleSupplierId, '2026-01', 'water_use',             'potable_mixed',   150,  'kgal_us', 'measured',  'Medidor principal'],
    [exampleSupplierId, '2026-01', 'water_use',             'reclaimed_mixed',  30,  'kgal_us', 'estimated', 'Riego exterior'],
    [exampleSupplierId, '2026-01', 'waste',                 'disposed_trash',  2.5,  'ton_us',  'measured',  'Contenedor general'],
    [exampleSupplierId, '2026-01', 'waste',                 'recycled',        1.2,  'ton_us',  'measured',  'Reciclaje'],
    [exampleSupplierId, '2026-01', 'waste',                 'composted',       0.8,  'tonne',   'measured',  'Compost organico'],
  ];

  for (const row of examples) {
    const r = ws.addRow(row);
    r.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_BG } };
      cell.font = { name: 'Calibri', size: 10 };
    });
  }

  const sepRow = ws.addRow(['← Borrar filas de ejemplo antes de importar →']);
  sepRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' }, size: 9 };

  // Add 50 blank data rows
  for (let i = 0; i < 50; i++) ws.addRow([]);

  // ── Data validation ───────────────────────────────────────────────────────
  const sourceTypes = Object.keys(ETIQUETAS_FUENTE) as EmissionSourceType[];
  const nSources = sourceTypes.length;
  const nSecondaries = ALL_SECONDARIES.length;
  const nUnits = ALL_UNITS.length;

  const DATA_ROWS = 100;
  for (let r = 2; r <= DATA_ROWS; r++) {
    // Fuente: col C (3)
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`Listas!$A$2:$A$${nSources + 1}`],
      showErrorMessage: true,
      errorTitle: 'Fuente inválida',
      error: 'Selecciona un valor de la lista.',
    };
    // Secundario: col D (4)
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Listas!$B$2:$B$${nSecondaries + 1}`],
      showErrorMessage: false,
    };
    // Unidad: col F (6)
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`Listas!$C$2:$C$${nUnits + 1}`],
      showErrorMessage: false,
    };
    // Calidad_dato: col G (7)
    ws.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Listas!$D$2:$D$4`],
      showErrorMessage: false,
    };
  }

  // ── Sheet: Listas (hidden) ────────────────────────────────────────────────
  const wsList = wb.addWorksheet('Listas');
  wsList.state = 'hidden';

  wsList.getCell('A1').value = 'Fuentes';
  wsList.getCell('A1').font = { bold: true };
  for (let i = 0; i < sourceTypes.length; i++) {
    wsList.getCell(`A${i + 2}`).value = sourceTypes[i]!;
  }

  wsList.getCell('B1').value = 'Secundarios';
  wsList.getCell('B1').font = { bold: true };
  ALL_SECONDARIES.forEach((s, i) => {
    wsList.getCell(`B${i + 2}`).value = s;
  });

  wsList.getCell('C1').value = 'Unidades';
  wsList.getCell('C1').font = { bold: true };
  ALL_UNITS.forEach((u, i) => {
    wsList.getCell(`C${i + 2}`).value = u;
  });

  wsList.getCell('D1').value = 'Calidad';
  wsList.getCell('D1').font = { bold: true };
  ['measured', 'estimated', 'calculated'].forEach((q, i) => {
    wsList.getCell(`D${i + 2}`).value = q;
  });

  // ── Sheet: Proveedores ────────────────────────────────────────────────────
  const wsProv = wb.addWorksheet('Proveedores');
  wsProv.columns = [
    { header: 'UUID del Proveedor (copiar en col. A de Registros)', key: 'id', width: 44 },
    { header: 'Nombre', key: 'name', width: 34 },
  ];
  wsProv.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
  });
  for (const s of suppliers) {
    wsProv.addRow([s.id, s.name]);
  }

  // ── Sheet: Ayuda ──────────────────────────────────────────────────────────
  const wsHelp = wb.addWorksheet('Ayuda');
  wsHelp.getColumn(1).width = 35;
  wsHelp.getColumn(2).width = 50;
  wsHelp.getColumn(3).width = 55;
  wsHelp.getColumn(4).width = 32;

  const headerHelp = wsHelp.getRow(1);
  ['Fuente', 'Secundario válido', 'Unidades válidas', 'Calidad_dato (col G)'].forEach((h, i) => {
    const cell = headerHelp.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
  });

  const dqValues = 'measured | estimated | calculated';
  const ayudaRows: [string, string, string, string][] = [
    [
      'stationary_combustion',
      (OPCIONES_SECUNDARIAS['stationary_combustion'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['stationary_combustion'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'mobile_combustion',
      (OPCIONES_SECUNDARIAS['mobile_combustion'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['mobile_combustion'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'purchased_electricity',
      (OPCIONES_SECUNDARIAS['purchased_electricity'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['purchased_electricity'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'purchased_steam',
      '(vacío)',
      UNIDADES_POR_FUENTE['purchased_steam'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'fugitive',
      (OPCIONES_SECUNDARIAS['fugitive'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['fugitive'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'water_use',
      (OPCIONES_SECUNDARIAS['water_use'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['water_use'].map((u) => u.unit).join(', '),
      dqValues,
    ],
    [
      'waste',
      (OPCIONES_SECUNDARIAS['waste'] ?? []).map((o) => o.value).join(', '),
      UNIDADES_POR_FUENTE['waste'].map((u) => u.unit).join(', '),
      dqValues,
    ],
  ];

  for (const [fuente, sec, units, dq] of ayudaRows) {
    const r = wsHelp.addRow([fuente, sec, units, dq]);
    r.getCell(1).font = { bold: true, name: 'Courier New', size: 9 };
    r.getCell(2).font = { name: 'Courier New', size: 9 };
    r.getCell(3).font = { name: 'Courier New', size: 9 };
    r.getCell(4).font = { name: 'Courier New', size: 9 };
    r.alignment = { wrapText: true };
  }

  wsHelp.addRow([]);
  const notaRow = wsHelp.addRow([
    'NOTAS',
    'water_use y waste son indicadores GRESB — no afectan el CO₂e total.',
    'kgal_us = mil galones US · ton_us = tonelada corta (EE.UU.) · Mes en formato YYYY-MM (ej: 2026-01)',
  ]);
  notaRow.getCell(1).font = { bold: true, size: 10 };
  notaRow.getCell(2).font = { size: 9, color: { argb: 'FF555555' } };
  notaRow.getCell(3).font = { size: 9, color: { argb: 'FF555555' } };

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ── XLSX parser ───────────────────────────────────────────────────────────────

export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedCsvRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Registros') ?? wb.worksheets[0];
  if (!ws) return [];

  const rows: ParsedCsvRow[] = [];
  let rowIndex = 0;

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;

    const getCellStr = (col: number): string => {
      const cell = row.getCell(col);
      const v = cell.value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && v !== null) {
        if ('text' in v) return String((v as { text: unknown }).text ?? '').trim();
        if ('richText' in v) {
          return (v as { richText: { text: string }[] }).richText
            .map((r) => r.text)
            .join('')
            .trim();
        }
        if ('result' in v) return String((v as { result: unknown }).result ?? '').trim();
      }
      return String(v).trim();
    };

    const supplierId = getCellStr(1);
    const yearMonth = getCellStr(2);
    const sourceType = getCellStr(3);
    const secondary = getCellStr(4);
    const quantityRaw = getCellStr(5);
    const unit = getCellStr(6);
    const dataQuality = getCellStr(7) || 'measured';
    const notes = getCellStr(8);

    // Skip empty rows and separator rows
    if (!supplierId && !yearMonth && !sourceType && !quantityRaw) return;
    if (supplierId.startsWith('←') || supplierId.startsWith('Borrar')) return;

    rowIndex++;
    const escape = (v: string) => v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
    const csvLine = [supplierId, yearMonth, sourceType, secondary, quantityRaw, unit, dataQuality, escape(notes)].join(',');
    const [parsed] = parseCsvText(csvLine);

    if (parsed) {
      rows.push({ ...parsed, rowIndex });
    } else {
      rows.push({ rowIndex, data: null, errors: ['Fila vacía o inválida'] });
    }
  });

  return rows;
}

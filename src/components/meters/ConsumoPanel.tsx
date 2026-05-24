'use client';

import { useState, useMemo, useRef } from 'react';
import { BarChart2, Download } from 'lucide-react';
import type { EntryWithPeriod, MeterYearSummary } from '@/lib/meters';
import { getAvailableYears, aggregateByMonth, formatQuantity, MONTH_LABELS } from '@/lib/meters';
import { MonthlyChart } from './MonthlyChart';
import { MonthlyTable } from './MonthlyTable';
import type { EmissionSourceType } from '@/types/database';
import { ETIQUETAS_FUENTE } from '@/lib/activity-options';


type ConsumoCategory = 'energia' | 'agua' | 'residuos' | 'refrigerantes';

const CATEGORY_TYPES: Record<ConsumoCategory, EmissionSourceType[]> = {
  energia: ['stationary_combustion', 'mobile_combustion', 'purchased_electricity', 'purchased_steam'],
  agua: ['water_use'],
  residuos: ['waste'],
  refrigerantes: ['fugitive'],
};

const CATEGORY_LABELS: Record<ConsumoCategory, string> = {
  energia: 'Energía',
  agua: 'Agua',
  residuos: 'Residuos',
  refrigerantes: 'Refrigerantes',
};

function categorize(source: EmissionSourceType): ConsumoCategory | null {
  for (const [cat, types] of Object.entries(CATEGORY_TYPES) as [ConsumoCategory, EmissionSourceType[]][]) {
    if (types.includes(source)) return cat;
  }
  return null;
}


const PALETTE = [
  'oklch(58% 0.16 155)',  // green
  'oklch(55% 0.18 222)',  // blue
  'oklch(62% 0.15 62)',   // amber
  'oklch(56% 0.16 300)',  // purple
  'oklch(60% 0.18 185)',  // teal
  'oklch(62% 0.18 340)',  // pink
  'oklch(60% 0.14 25)',   // orange
  'oklch(55% 0.14 260)',  // indigo
];

function meterColor(index: number): string {
  return PALETTE[index % PALETTE.length] ?? PALETTE[0]!;
}


const CANONICAL_UNIT: Record<ConsumoCategory, string> = {
  energia: 'kWh',
  agua: 'm³',
  residuos: 'kg',
  refrigerantes: 'kg',
};

// Constantes de respaldo — usadas cuando la BD no tiene conversión para la unidad.
// Constantes físicas (MWh→kWh etc.) son exactas; el contenido energético de combustibles es aproximado.
const FALLBACK_TO_KWH: Record<string, number> = {
  kWh: 1, MWh: 1000, GJ: 277.778, MJ: 0.27778,
  kBtu: 0.29307, MMBtu: 293.07, MBtu: 293.07, therms: 29.307,
  m3_ng: 10.55, ft3_ng: 0.2988,
};

const FUEL_KWH_PER_L: Record<string, number> = {
  diesel: 10.7, fuel_oil_no2: 10.7, gasoline: 8.77,
  lpg: 6.9, propane: 6.9,
};

const FALLBACK_TO_M3: Record<string, number> = {
  m3: 1, L: 0.001, kgal_us: 3.785, megaliter: 1000, gallon: 0.003785,
};

const FALLBACK_TO_KG: Record<string, number> = {
  kg: 1, lb: 0.4536, tonne: 1000, ton_us: 907.185,
};

function makeToCanonical(
  dbToKwh: Record<string, number>,
  dbToM3: Record<string, number>,
  dbToKg: Record<string, number>,
) {
  const toKwh = { ...FALLBACK_TO_KWH, ...dbToKwh };
  const toM3 = { ...FALLBACK_TO_M3, ...dbToM3 };
  const toKg = { ...FALLBACK_TO_KG, ...dbToKg };

  return function toCanonical(qty: number, unit: string, secondary: string, cat: ConsumoCategory): number {
    if (cat === 'energia') {
      if (toKwh[unit] !== undefined) return qty * toKwh[unit]!;
      const kwhPerL = FUEL_KWH_PER_L[secondary] ?? 9.5;
      if (unit === 'gallon') return qty * kwhPerL * (toM3['gallon'] ?? 0.003785) * 1000;
      if (unit === 'imp_gallon') return qty * kwhPerL * 4.546;
      if (unit === 'L') return qty * kwhPerL;
      return qty;
    }
    if (cat === 'agua') return qty * (toM3[unit] ?? 1);
    return qty * (toKg[unit] ?? 1);
  };
}

function computeLegendH(nMeters: number): number {
  // separador(6) + línea de fecha(18) + entradas de leyenda desde 28 (13px c/u) + margen inferior(10)
  return 28 + nMeters * 13 + 10;
}

function aggregateStandardized(
  entries: EntryWithPeriod[],
  year: number,
  category: ConsumoCategory,
  toCanonical: (qty: number, unit: string, secondary: string, cat: ConsumoCategory) => number,
): MeterYearSummary[] {
  const types = CATEGORY_TYPES[category];
  const canonical = CANONICAL_UNIT[category];

  const meterMap = new Map<string, MeterYearSummary>();

  for (const e of entries) {
    if (!types.includes(e.source_type)) continue;
    const parts = e.period_start.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (y !== year || !isFinite(m) || m < 1 || m > 12) continue;

    const id = `${e.source_type}::${e.secondary}::${e.supplier_id}`;
    const qty = toCanonical(e.raw_quantity, e.raw_unit, e.secondary, category);

    if (!meterMap.has(id)) {
      const fuente = ETIQUETAS_FUENTE[e.source_type] ?? e.source_type;
      const sec = e.secondary ? ` — ${e.secondary}` : '';
      meterMap.set(id, {
        meter: {
          id,
          source_type: e.source_type,
          secondary: e.secondary,
          unit: canonical,
          label: `${fuente}${sec}`,
          supplier_label: e.supplier_name,
          supplier_id: e.supplier_id,
        },
        monthly: {},
        total: 0,
        peak: null,
      });
    }

    const s = meterMap.get(id)!;
    s.monthly[m] = (s.monthly[m] ?? 0) + qty;
    s.total += qty;
  }

  for (const s of meterMap.values()) {
    let peak: { month: number; value: number } | null = null;
    for (const [mo, v] of Object.entries(s.monthly)) {
      if (peak === null || v > peak.value) peak = { month: Number(mo), value: v };
    }
    s.peak = peak;
  }

  return [...meterMap.values()].sort((a, b) => b.total - a.total);
}


const SVG_W = 640;
const CHART_H = 190;
const TOP_PAD = 20;
const LABEL_H = 24;
const LEFT_PAD = 52;
const SVG_H = TOP_PAD + CHART_H + LABEL_H;

function axisLabel(val: number): string {
  if (val === 0) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
}

interface OverviewChartProps {
  summaries: MeterYearSummary[];
  year: number;
  suppliers: { id: string; name: string }[];
  filteredSupplierIds: Set<string>;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function OverviewChart({ summaries, year, suppliers, filteredSupplierIds, svgRef }: OverviewChartProps) {
  if (summaries.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '120px', color: 'var(--color-ink-3)', fontSize: 'var(--text-sm)',
      }}>
        Sin datos para {year} con los filtros seleccionados.
      </div>
    );
  }

  const slotW = (SVG_W - LEFT_PAD) / 12;

  // Si todas las series comparten unidad → mostrar valores reales en el eje
  const units = [...new Set(summaries.map((s) => s.meter.unit))];
  const singleUnit = units.length === 1 ? units[0] : null;

  // Máximo global para eje Y compartido (unidad única) o por serie en caso contrario
  const globalMax = singleUnit
    ? Math.max(...summaries.flatMap((s) => Object.values(s.monthly)), 1)
    : null;

  const gridFracs: [number, string][] = singleUnit && globalMax
    ? [
        [1, axisLabel(globalMax)],
        [0.5, axisLabel(globalMax / 2)],
        [0, '0'],
      ]
    : [
        [1, 'máx.'],
        [0.5, '50%'],
        [0, '0'],
      ];

  return (
    <>
      {/* Y-axis label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
        <span style={{
          fontSize: '10px', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {singleUnit ? `${singleUnit} por mes` : 'Escala relativa por medidor (máx. = 100%)'}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Tendencia mensual de consumo — ${year}`}
        style={{ maxHeight: '260px', display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines + Y axis labels */}
        {gridFracs.map(([frac, label]) => {
          const y = TOP_PAD + CHART_H - (frac as number) * CHART_H;
          return (
            <g key={frac as number}>
              <line
                x1={LEFT_PAD} y1={y} x2={SVG_W} y2={y}
                style={{
                  stroke: frac === 0 ? 'oklch(60% 0 0 / 25%)' : 'oklch(60% 0 0 / 10%)',
                  strokeDasharray: frac === 0 ? undefined : '4 3',
                  strokeWidth: 1,
                }}
              />
              <text
                x={LEFT_PAD - 5} y={y + 4} textAnchor="end"
                style={{ fontSize: '9px', fill: 'oklch(45% 0 0)', fontFamily: 'var(--font-mono)' }}
              >
                {label as string}
              </text>
            </g>
          );
        })}

        {/* One line per meter */}
        {summaries.map((s, idx) => {
          const color = meterColor(idx);
          const maxVal = globalMax ?? Math.max(...Object.values(s.monthly), 1);
          const pts: [number, number][] = [];
          for (let i = 0; i < 12; i++) {
            const m = i + 1;
            const val = s.monthly[m] ?? 0;
            const x = LEFT_PAD + i * slotW + slotW / 2;
            const y = TOP_PAD + CHART_H - (val / maxVal) * CHART_H;
            pts.push([x, y]);
          }
          const pointStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

          return (
            <g key={s.meter.id}>
              <polyline
                points={pointStr}
                style={{
                  fill: 'none',
                  stroke: color,
                  strokeWidth: 2,
                  strokeLinejoin: 'round',
                  strokeLinecap: 'round',
                  opacity: 0.82,
                }}
              />
              {pts.map(([x, y], i) => {
                const m = i + 1;
                const val = s.monthly[m] ?? 0;
                if (val === 0) return null;
                return (
                  <circle key={i} cx={x} cy={y} r={3.5}
                    style={{ fill: color, stroke: '#fff', strokeWidth: 1.5 }}>
                    <title>{`${s.meter.label} · ${MONTH_LABELS[i]}: ${formatQuantity(val, s.meter.unit)}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}

        {/* Month labels */}
        {MONTH_LABELS.map((lbl, i) => {
          const x = LEFT_PAD + i * slotW + slotW / 2;
          return (
            <text key={i} x={x} y={SVG_H - 4} textAnchor="middle"
              style={{ fontSize: '9px', fill: 'oklch(50% 0 0)', fontFamily: 'var(--font-mono)' }}>
              {lbl}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3) var(--space-5)',
        marginTop: 'var(--space-4)',
        paddingTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-border)',
      }}>
        {summaries.map((s, idx) => {
          const color = meterColor(idx);
          return (
            <div key={s.meter.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '180px' }}>
              <svg width="22" height="10" aria-hidden="true" style={{ flexShrink: 0 }}>
                <line x1="0" y1="5" x2="22" y2="5" strokeWidth="2.5" strokeLinecap="round"
                  style={{ stroke: color }} />
                <circle cx="11" cy="5" r="3" style={{ fill: color }} />
              </svg>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-1)', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.meter.label}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>
                  {s.meter.supplier_label} · {formatQuantity(s.total, s.meter.unit)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}


function buildLegendedSVG(
  svgEl: SVGSVGElement,
  summaries: MeterYearSummary[],
  year: number,
  supplierLabel: string,
  categoryLabel: string,
  unitLabel: string,
): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const vb = svgEl.viewBox.baseVal;

  const TITLE_H = 36;
  const LEGEND_H = computeLegendH(summaries.length);
  const newH = vb.height + TITLE_H + LEGEND_H;
  // Desplazar viewBox hacia arriba para dar espacio al título del gráfico
  clone.setAttribute('viewBox', `0 ${-TITLE_H} ${vb.width} ${newH}`);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', String(-TITLE_H));
  bg.setAttribute('width', String(vb.width)); bg.setAttribute('height', String(newH));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  // Título centrado sobre el gráfico
  const cx = vb.width / 2;
  const titleMain = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  titleMain.setAttribute('x', String(cx));
  titleMain.setAttribute('y', String(-TITLE_H + 15));
  titleMain.setAttribute('text-anchor', 'middle');
  titleMain.setAttribute('font-size', '12');
  titleMain.setAttribute('font-family', 'monospace, sans-serif');
  titleMain.setAttribute('fill', '#111');
  titleMain.setAttribute('font-weight', 'bold');
  titleMain.textContent = `Tendencia mensual de consumo · ${year}`;
  clone.appendChild(titleMain);

  const titleSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  titleSub.setAttribute('x', String(cx));
  titleSub.setAttribute('y', String(-TITLE_H + 29));
  titleSub.setAttribute('text-anchor', 'middle');
  titleSub.setAttribute('font-size', '9');
  titleSub.setAttribute('font-family', 'monospace, sans-serif');
  titleSub.setAttribute('fill', '#888');
  titleSub.textContent = `${supplierLabel}${categoryLabel ? ` · ${categoryLabel}` : ''}${unitLabel ? ` · ${unitLabel}` : ''}`;
  clone.appendChild(titleSub);

  // Separador antes de la leyenda
  const sep = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  sep.setAttribute('x1', '8'); sep.setAttribute('y1', String(vb.height + 6));
  sep.setAttribute('x2', String(vb.width - 8)); sep.setAttribute('y2', String(vb.height + 6));
  sep.setAttribute('stroke', '#e0e0e0'); sep.setAttribute('stroke-width', '0.5');
  clone.appendChild(sep);

  // Línea de pie
  const footerDate = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  footerDate.setAttribute('x', '8');
  footerDate.setAttribute('y', String(vb.height + 18));
  footerDate.setAttribute('font-size', '8');
  footerDate.setAttribute('font-family', 'monospace, sans-serif');
  footerDate.setAttribute('fill', '#aaa');
  footerDate.textContent = `EarthLink · Generado: ${new Date().toLocaleDateString('es')}`;
  clone.appendChild(footerDate);

  if (summaries.length > 0) {
    const legendY = vb.height + 28;
    summaries.forEach((s, i) => {
      const color = meterColor(i);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '14');
      dot.setAttribute('cy', String(legendY + i * 13));
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', color);
      clone.appendChild(dot);

      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', '22');
      t.setAttribute('y', String(legendY + 4 + i * 13));
      t.setAttribute('font-size', '8');
      t.setAttribute('font-family', 'monospace, sans-serif');
      t.setAttribute('fill', '#555');
      t.textContent = s.meter.label;
      clone.appendChild(t);
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 15_000);
}


function SupplierFilter({
  suppliers,
  selected,
  onChange,
}: {
  suppliers: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const allSelected = selected.size === 0;

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: '4px var(--space-3)',
      borderRadius: 'var(--radius-pill)',
      fontSize: 'var(--text-xs)',
      fontWeight: active ? 600 : 400,
      border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
      background: active ? 'var(--color-accent-soft)' : 'transparent',
      color: active ? 'var(--color-accent)' : 'var(--color-ink-2)',
      cursor: 'pointer',
      transition: 'all 120ms',
      whiteSpace: 'nowrap' as const,
    };
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
      }}>
        Proveedor
      </span>
      <button type="button" onClick={() => onChange(new Set())} style={chipStyle(allSelected)}>
        Todos
      </button>
      {suppliers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => {
            const next = new Set(selected);
            if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
            onChange(next);
          }}
          style={chipStyle(selected.has(s.id))}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}


function CategoryFilter({
  active,
  onChange,
  available,
}: {
  active: ConsumoCategory | null;
  onChange: (c: ConsumoCategory | null) => void;
  available: ConsumoCategory[];
}) {
  function chipStyle(on: boolean): React.CSSProperties {
    return {
      padding: '3px var(--space-2)',
      borderRadius: 'var(--radius-pill)',
      fontSize: '11px',
      fontWeight: on ? 600 : 400,
      border: on ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
      background: on ? 'var(--color-accent-soft)' : 'transparent',
      color: on ? 'var(--color-accent)' : 'var(--color-ink-3)',
      cursor: 'pointer',
      transition: 'all 120ms',
    };
  }

  if (available.length < 2) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onChange(null)} style={chipStyle(active === null)}>
        Todos
      </button>
      {available.map((c) => (
        <button key={c} type="button" onClick={() => onChange(active === c ? null : c)} style={chipStyle(active === c)}>
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}


interface ConsumoPanelProps {
  entries: EntryWithPeriod[];
  suppliers: { id: string; name: string }[];
  toKwh?: Record<string, number>;
  toM3?: Record<string, number>;
  toKg?: Record<string, number>;
}

export function ConsumoPanel({ entries, suppliers, toKwh = {}, toM3 = {}, toKg = {} }: ConsumoPanelProps) {
  const availableYears = useMemo(() => getAvailableYears(entries), [entries]);
  const currentYear = new Date().getFullYear();
  const defaultYear = availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<ConsumoCategory | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toCanonical = useMemo(() => makeToCanonical(toKwh, toM3, toKg), [toKwh, toM3, toKg]);

  const filteredEntries = useMemo(() => {
    if (selectedSuppliers.size === 0) return entries;
    return entries.filter((e) => selectedSuppliers.has(e.supplier_id));
  }, [entries, selectedSuppliers]);

  const allSummaries = useMemo(
    () => aggregateByMonth(filteredEntries, selectedYear),
    [filteredEntries, selectedYear],
  );

  const availableCategories = useMemo(
    () =>
      (Object.keys(CATEGORY_TYPES) as ConsumoCategory[]).filter((c) =>
        allSummaries.some((s) => categorize(s.meter.source_type) === c),
      ),
    [allSummaries],
  );

  // Seleccionar primera categoría disponible para que el gráfico siempre tenga unidades canónicas
  const effectiveCategoryFilter = categoryFilter ?? availableCategories[0] ?? null;

  const chartSummaries = useMemo(() => {
    if (!effectiveCategoryFilter) return allSummaries;
    return aggregateStandardized(filteredEntries, selectedYear, effectiveCategoryFilter, toCanonical);
  }, [filteredEntries, selectedYear, effectiveCategoryFilter, allSummaries, toCanonical]);

  const effectiveMeterId =
    selectedMeterId !== null && allSummaries.some((s) => s.meter.id === selectedMeterId)
      ? selectedMeterId
      : (allSummaries[0]?.meter.id ?? null);

  const selectedSummary = allSummaries.find((s) => s.meter.id === effectiveMeterId) ?? null;

  function handleDownload(format: 'svg' | 'png') {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const supplierLabel =
      selectedSuppliers.size === 0
        ? 'Todos los proveedores'
        : [...selectedSuppliers]
            .map((id) => suppliers.find((s) => s.id === id)?.name ?? id)
            .join(', ');

    const catLabel = effectiveCategoryFilter ? CATEGORY_LABELS[effectiveCategoryFilter] : '';
    const unitLabel = effectiveCategoryFilter ? CANONICAL_UNIT[effectiveCategoryFilter] : '';

    const svgStr = buildLegendedSVG(svgEl, chartSummaries, selectedYear, supplierLabel, catLabel, unitLabel);

    const supplierSlug = selectedSuppliers.size === 0
      ? 'todos'
      : [...selectedSuppliers]
          .map((id) => suppliers.find((s) => s.id === id)?.name ?? id)
          .join('-')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
    const catSlug = effectiveCategoryFilter ?? 'consumo';
    const filename = `earthlink_${catSlug}_${selectedYear}_${supplierSlug}`;

    if (format === 'svg') {
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      triggerDownload(URL.createObjectURL(blob), `${filename}.svg`);
      return;
    }

    // Exportar PNG via canvas del navegador
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const vb = svgEl.viewBox.baseVal;
      const legendH = computeLegendH(chartSummaries.length);
      const TITLE_H_PNG = 36;
      const canvas = document.createElement('canvas');
      canvas.width = vb.width * scale;
      canvas.height = (vb.height + TITLE_H_PNG + legendH) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        if (!b) return;
        triggerDownload(URL.createObjectURL(b), `${filename}.png`);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = url;
  }

  if (entries.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--space-4)', padding: 'var(--space-16) var(--space-8)', textAlign: 'center',
      }}>
        <span style={{
          width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center', color: 'var(--color-ink-3)',
        }}>
          <BarChart2 size={22} />
        </span>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
          Sin registros de actividad. Agrega consumos en la sección Actividad para visualizarlos aquí.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

      {/* Controls: supplier chips + year tabs */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap',
      }}>
        <SupplierFilter
          suppliers={suppliers}
          selected={selectedSuppliers}
          onChange={(s) => { setSelectedSuppliers(s); setSelectedMeterId(null); }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Año</span>
          {availableYears.map((y) => (
            <button
              key={y} type="button"
              onClick={() => { setSelectedYear(y); setSelectedMeterId(null); }}
              style={{
                padding: '4px var(--space-3)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)', fontWeight: y === selectedYear ? 600 : 400,
                fontFamily: 'var(--font-mono)',
                border: y === selectedYear ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: y === selectedYear ? 'var(--color-accent-soft)' : 'transparent',
                color: y === selectedYear ? 'var(--color-accent)' : 'var(--color-ink-2)',
                cursor: 'pointer', transition: 'all 120ms',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Overview section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-ink-1)', margin: 0 }}>
              Tendencia mensual por medidor
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 'var(--space-1) 0 0' }}>
              {selectedYear}
              {selectedSuppliers.size > 0
                ? ` · ${selectedSuppliers.size} proveedor${selectedSuppliers.size !== 1 ? 'es' : ''}`
                : ' · todos los proveedores'}
              {` · ${chartSummaries.length} medidor${chartSummaries.length !== 1 ? 'es' : ''}`}
            </p>
          </div>
          {/* Category filter + download */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <CategoryFilter
              active={effectiveCategoryFilter}
              onChange={setCategoryFilter}
              available={availableCategories}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => handleDownload('svg')}
                title="Descargar SVG"
                style={downloadBtnStyle}
              >
                <Download size={13} />
                SVG
              </button>
              <button
                type="button"
                onClick={() => handleDownload('png')}
                title="Descargar PNG"
                style={downloadBtnStyle}
              >
                <Download size={13} />
                PNG
              </button>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
        }}>
          <OverviewChart
            summaries={chartSummaries}
            year={selectedYear}
            suppliers={suppliers}
            filteredSupplierIds={selectedSuppliers}
            svgRef={svgRef}
          />
        </div>
      </section>

      {/* Meter detail section */}
      <section>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-ink-1)', margin: 0 }}>
            Detalle por medidor
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 'var(--space-1) 0 0' }}>
            {allSummaries.length === 0
              ? 'Sin medidores para la selección actual.'
              : `${allSummaries.length} medidor${allSummaries.length !== 1 ? 'es' : ''} — cada combinación de fuente + tipo + unidad + proveedor.`}
          </p>
        </div>

        {allSummaries.length === 0 ? (
          <div style={{
            padding: 'var(--space-12) var(--space-8)', textAlign: 'center',
            color: 'var(--color-ink-3)', fontSize: 'var(--text-sm)',
            background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}>
            Sin registros para {selectedYear} con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start' }}>
            <MeterList
              summaries={allSummaries}
              effectiveMeterId={effectiveMeterId}
              onSelect={setSelectedMeterId}
            />
            {selectedSummary ? (
              <MeterDetail summary={selectedSummary} year={selectedYear} />
            ) : (
              <div style={{
                flex: 1, display: 'grid', placeItems: 'center',
                minHeight: '300px', color: 'var(--color-ink-3)', fontSize: 'var(--text-sm)',
              }}>
                Selecciona un medidor
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}


const downloadBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px var(--space-3)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  fontSize: '11px', fontFamily: 'var(--font-mono)',
  color: 'var(--color-ink-2)',
  cursor: 'pointer',
  transition: 'border-color 120ms, color 120ms',
};


function MeterList({
  summaries,
  effectiveMeterId,
  onSelect,
}: {
  summaries: MeterYearSummary[];
  effectiveMeterId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: '0 var(--space-3) var(--space-2)',
      }}>
        Medidores
      </div>
      {summaries.map((s, idx) => {
        const isActive = s.meter.id === effectiveMeterId;
        const color = meterColor(idx);
        return (
          <button
            key={s.meter.id} type="button"
            onClick={() => onSelect(s.meter.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: isActive ? 'var(--color-accent-soft)' : 'var(--color-surface-1)',
              cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 120ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 600,
                color: isActive ? 'var(--color-accent)' : 'var(--color-ink-1)',
                lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.meter.label}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: isActive ? 'var(--color-accent)' : 'var(--color-ink-3)', fontFamily: 'var(--font-mono)', paddingLeft: '16px' }}>
              {s.meter.supplier_label}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: isActive ? 'var(--color-accent)' : 'var(--color-ink-2)', fontFamily: 'var(--font-mono)', paddingLeft: '16px' }}>
              {formatQuantity(s.total, s.meter.unit)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MeterDetail({ summary, year }: { summary: MeterYearSummary; year: number }) {
  const dataMonths = Object.keys(summary.monthly).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-ink-1)' }}>
          {summary.meter.label}
        </h3>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)' }}>
          {summary.meter.supplier_label} · {year}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <Kpi label="Total anual" value={formatQuantity(summary.total, summary.meter.unit)} />
        {summary.peak !== null && (
          <Kpi
            label="Mes pico"
            value={`${MONTH_LABELS[summary.peak.month - 1]} — ${formatQuantity(summary.peak.value, summary.meter.unit)}`}
          />
        )}
        <Kpi label="Meses con dato" value={`${dataMonths} / 12`} />
      </div>

      <div style={{
        background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
      }}>
        <MonthlyChart summary={summary} />
      </div>

      <div style={{
        background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <MonthlyTable summary={summary} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: '10px', color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-ink-1)' }}>
        {value}
      </span>
    </div>
  );
}

'use client';

import { useState, useId } from 'react';


export interface ConsumoMensual {
  yearMonth: string; // "YYYY-MM"
  label: string; // "Ene 2026"
  supplierId: string;
  supplierName: string;
  energiaCo2eKg: number;
  aguaRawQty: number; // sum of raw_quantity for water_use
  residuosRawQty: number; // sum of raw_quantity for waste
}

export interface ProveedorResumen {
  id: string;
  name: string;
}

interface ConsumptionChartProps {
  consumo: ConsumoMensual[];
  proveedores: ProveedorResumen[];
}


const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COLOR_ENERGIA = 'var(--color-accent)'; // green
const COLOR_AGUA = 'oklch(55% 0.15 230)'; // blue
const COLOR_RESIDUOS = 'oklch(55% 0.12 60)'; // amber

const SVG_PADDING = { top: 24, right: 20, bottom: 48, left: 62 };
const CHART_HEIGHT = 220;

function formatCo2e(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} tCO₂e`;
  return `${kg.toLocaleString('es', { maximumFractionDigits: 0 })} kg CO₂e`;
}

function formatQty(qty: number, unit: string): string {
  return `${qty.toLocaleString('es', { maximumFractionDigits: 1 })} ${unit}`;
}

/** Evenly-spaced nice tick values for a Y axis given a max value. */
function niceYTicks(maxVal: number, count: number): number[] {
  if (maxVal === 0) return [0];
  const rawStep = maxVal / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  const step = (niceSteps.find((s) => s * mag >= rawStep) ?? 10) * mag;
  const result: number[] = [];
  for (let i = 0; i <= count; i++) result.push(Math.round(step * i * 10) / 10);
  return result;
}

interface SeriesPoint {
  yearMonth: string;
  label: string;
  value: number;
}

interface ChartSeries {
  id: string;
  name: string;
  color: string;
  unit: string;
  points: SeriesPoint[];
}


function SvgLineChart({
  series,
  months,
  clipId,
}: {
  series: ChartSeries[];
  months: string[];
  clipId: string;
}) {
  const width = 600; // viewBox width; scales with container
  const plotW = width - SVG_PADDING.left - SVG_PADDING.right;
  const plotH = CHART_HEIGHT - SVG_PADDING.top - SVG_PADDING.bottom;

  // Calcular el máximo global entre todas las series para eje Y compartido
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const ticks = niceYTicks(maxVal * 1.1, 4);
  const yMax = ticks[ticks.length - 1] ?? 1;

  function xPos(idx: number): number {
    if (months.length <= 1) return SVG_PADDING.left + plotW / 2;
    return SVG_PADDING.left + (idx / (months.length - 1)) * plotW;
  }

  function yPos(value: number): number {
    return SVG_PADDING.top + plotH - (value / yMax) * plotH;
  }

  function buildPolylinePoints(points: SeriesPoint[]): string {
    return points
      .map((p) => {
        const idx = months.indexOf(p.yearMonth);
        if (idx === -1) return null;
        return `${xPos(idx).toFixed(1)},${yPos(p.value).toFixed(1)}`;
      })
      .filter((p): p is string => p !== null)
      .join(' ');
  }

  const hasData = allValues.some((v) => v > 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Gráfico de consumo mensual"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={SVG_PADDING.left}
            y={SVG_PADDING.top}
            width={plotW}
            height={plotH + 1}
          />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {ticks.map((tick) => {
        const y = yPos(tick);
        return (
          <g key={tick}>
            <line
              x1={SVG_PADDING.left}
              y1={y}
              x2={SVG_PADDING.left + plotW}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={0.8}
            />
            <text
              x={SVG_PADDING.left - 8}
              y={y + 4}
              textAnchor="end"
              fill="var(--color-ink-3)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k` : tick}
            </text>
          </g>
        );
      })}

      {/* X axis baseline */}
      <line
        x1={SVG_PADDING.left}
        y1={SVG_PADDING.top + plotH}
        x2={SVG_PADDING.left + plotW}
        y2={SVG_PADDING.top + plotH}
        stroke="var(--color-border-strong)"
        strokeWidth={1}
      />

      {/* X axis labels */}
      {months.map((ym, idx) => {
        const [year, mon] = ym.split('-');
        const label =
          months.length > 8
            ? `${MESES_ES[(parseInt(mon ?? '1', 10) - 1) % 12]?.slice(0, 1) ?? ''}`
            : `${MESES_ES[(parseInt(mon ?? '1', 10) - 1) % 12] ?? ''}`;
        const showYear =
          idx === 0 || (year !== months[idx - 1]?.split('-')[0]);
        return (
          <g key={ym}>
            <text
              x={xPos(idx)}
              y={SVG_PADDING.top + plotH + 14}
              textAnchor="middle"
              fill="var(--color-ink-2)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
            {showYear && (
              <text
                x={xPos(idx)}
                y={SVG_PADDING.top + plotH + 26}
                textAnchor="middle"
                fill="var(--color-ink-3)"
                fontSize={8}
                fontFamily="var(--font-mono)"
              >
                {year}
              </text>
            )}
          </g>
        );
      })}

      {/* Empty state message */}
      {!hasData && (
        <text
          x={SVG_PADDING.left + plotW / 2}
          y={SVG_PADDING.top + plotH / 2}
          textAnchor="middle"
          fill="var(--color-ink-3)"
          fontSize={11}
          fontFamily="var(--font-sans)"
        >
          Sin resultados de emisión calculados
        </text>
      )}

      {/* Series lines */}
      {series.map((s) => {
        const pts = buildPolylinePoints(s.points);
        if (!pts) return null;
        return (
          <g key={s.id} clipPath={`url(#${clipId})`}>
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points.map((p) => {
              const idx = months.indexOf(p.yearMonth);
              if (idx === -1 || p.value === 0) return null;
              return (
                <circle
                  key={p.yearMonth}
                  cx={xPos(idx)}
                  cy={yPos(p.value)}
                  r={3}
                  fill={s.color}
                  stroke="var(--color-surface-1)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}


export function ConsumptionChart({ consumo, proveedores }: ConsumptionChartProps) {
  const [proveedorActivo, setProveedorActivo] = useState<string>('todos');
  const clipId = useId().replace(/:/g, '-') + '-clip';

  // Filtrar datos según proveedor activo
  const datosFiltrados =
    proveedorActivo === 'todos'
      ? consumo
      : consumo.filter((d) => d.supplierId === proveedorActivo);

  // Obtener meses únicos ordenados de los datos filtrados
  const months = [...new Set(datosFiltrados.map((d) => d.yearMonth))].sort();

  // Construir series: agregar por mes y proveedor
  const monthMap = new Map<string, { energia: number; agua: number; residuos: number }>();
  for (const d of datosFiltrados) {
    const prev = monthMap.get(d.yearMonth) ?? { energia: 0, agua: 0, residuos: 0 };
    monthMap.set(d.yearMonth, {
      energia: prev.energia + d.energiaCo2eKg,
      agua: prev.agua + d.aguaRawQty,
      residuos: prev.residuos + d.residuosRawQty,
    });
  }

  const seriesEnergia: ChartSeries = {
    id: 'energia',
    name: 'Energía',
    color: COLOR_ENERGIA,
    unit: 'kg CO₂e',
    points: months.map((ym) => ({
      yearMonth: ym,
      label: datosFiltrados.find((d) => d.yearMonth === ym)?.label ?? ym,
      value: monthMap.get(ym)?.energia ?? 0,
    })),
  };

  const seriesAgua: ChartSeries = {
    id: 'agua',
    name: 'Agua',
    color: COLOR_AGUA,
    unit: 'm³',
    points: months.map((ym) => ({
      yearMonth: ym,
      label: datosFiltrados.find((d) => d.yearMonth === ym)?.label ?? ym,
      value: monthMap.get(ym)?.agua ?? 0,
    })),
  };

  const seriesResiduos: ChartSeries = {
    id: 'residuos',
    name: 'Residuos',
    color: COLOR_RESIDUOS,
    unit: 'ton',
    points: months.map((ym) => ({
      yearMonth: ym,
      label: datosFiltrados.find((d) => d.yearMonth === ym)?.label ?? ym,
      value: monthMap.get(ym)?.residuos ?? 0,
    })),
  };

  // Estadísticas de resumen
  const totalCo2eKg = datosFiltrados.reduce((acc, d) => acc + d.energiaCo2eKg, 0);
  const totalAguaM3 = datosFiltrados.reduce((acc, d) => acc + d.aguaRawQty, 0);
  const totalResiduosTon = datosFiltrados.reduce((acc, d) => acc + d.residuosRawQty, 0);

  // Última entrada: el mes más reciente en los datos filtrados
  const ultimoMes = months.length > 0 ? months[months.length - 1] : null;
  const ultimoLabel = ultimoMes
    ? (datosFiltrados.find((d) => d.yearMonth === ultimoMes)?.label ?? ultimoMes)
    : null;

  const seriesActivas = [seriesEnergia, seriesAgua, seriesResiduos].filter(
    (s) => s.points.some((p) => p.value > 0),
  );

  return (
    <div>
      {/* ── Filtro por proveedor ── */}
      {proveedores.length > 1 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <PillButton
            active={proveedorActivo === 'todos'}
            onClick={() => setProveedorActivo('todos')}
          >
            Todos
          </PillButton>
          {proveedores.map((p) => (
            <PillButton
              key={p.id}
              active={proveedorActivo === p.id}
              onClick={() => setProveedorActivo(p.id)}
            >
              {p.name}
            </PillButton>
          ))}
        </div>
      )}

      {/* ── Resumen estadístico ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="CO₂e total"
          value={formatCo2e(totalCo2eKg)}
          accent={COLOR_ENERGIA}
        />
        <StatCard
          label="Agua registrada"
          value={formatQty(totalAguaM3, 'm³')}
          accent={COLOR_AGUA}
        />
        <StatCard
          label="Residuos registrados"
          value={formatQty(totalResiduosTon, 'ton')}
          accent={COLOR_RESIDUOS}
        />
        {ultimoLabel && (
          <StatCard
            label="Último periodo"
            value={ultimoLabel}
            accent="var(--color-ink-3)"
          />
        )}
      </div>

      {/* ── Gráfico SVG ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: `${CHART_HEIGHT}px`,
        }}
      >
        <SvgLineChart series={seriesActivas} months={months} clipId={clipId} />
      </div>

      {/* ── Leyenda ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {[seriesEnergia, seriesAgua, seriesResiduos].map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span
              style={{
                width: '20px',
                height: '2px',
                background: s.color,
                borderRadius: '1px',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-2)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.name}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ({s.unit})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-accent)' : 'var(--color-ink-2)',
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
        border: active
          ? '1px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-pill)',
        padding: '3px var(--space-3)',
        cursor: 'pointer',
        transition: 'background 150ms, color 150ms, border-color 150ms',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-3)',
          fontFamily: 'var(--font-mono)',
          margin: '0 0 var(--space-1)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wide)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: accent,
          fontFamily: 'var(--font-mono)',
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  );
}

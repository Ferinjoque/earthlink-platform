import type { MeterYearSummary } from '@/lib/meters';
import { MONTH_LABELS } from '@/lib/meters';

interface MonthlyChartProps {
  summary: MeterYearSummary;
}

const CHART_H = 160;
const LABEL_H = 22;
const TOP_PAD = 18;
const YAXIS_W = 44;
const SVG_W = 600;
const SVG_H = TOP_PAD + CHART_H + LABEL_H + 8;
const BAR_AREA_W = SVG_W - YAXIS_W;

function axisLabel(val: number): string {
  if (val === 0) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
}

export function MonthlyChart({ summary }: MonthlyChartProps) {
  const maxVal = Math.max(...[...Object.values(summary.monthly), 1]);

  const gridFracs = [1, 0.5, 0] as const;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Consumo mensual — ${summary.meter.label}`}
      style={{ maxHeight: '200px', display: 'block' }}
    >
      {/* Líneas de cuadrícula + etiquetas Y */}
      {gridFracs.map((frac) => {
        const y = TOP_PAD + CHART_H - frac * CHART_H;
        return (
          <g key={frac}>
            <line
              x1={YAXIS_W}
              y1={y}
              x2={SVG_W}
              y2={y}
              style={{
                stroke: frac === 0 ? 'oklch(60% 0 0 / 30%)' : 'oklch(60% 0 0 / 12%)',
                strokeDasharray: frac === 0 ? undefined : '4 3',
                strokeWidth: 1,
              }}
            />
            <text
              x={YAXIS_W - 5}
              y={y + 4}
              textAnchor="end"
              style={{
                fontSize: '9px',
                fill: 'oklch(50% 0 0)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {axisLabel(maxVal * frac)}
            </text>
          </g>
        );
      })}

      {/* Barras */}
      {Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const val = summary.monthly[m] ?? 0;
        const barW = BAR_AREA_W / 12;
        const gap = barW * 0.28;
        const bx = YAXIS_W + i * barW + gap / 2;
        const bw = barW - gap;
        const bh = val > 0 ? Math.max(3, (val / maxVal) * CHART_H) : 0;
        const by = TOP_PAD + CHART_H - bh;
        const isPeak = summary.peak?.month === m;

        return (
          <g key={m}>
            {bh > 0 && (
              <rect
                x={bx}
                y={by}
                width={bw}
                height={bh}
                rx={3}
                ry={3}
                style={{
                  fill: isPeak
                    ? 'oklch(58% 0.16 155)'
                    : 'oklch(58% 0.16 155 / 28%)',
                  stroke: isPeak
                    ? 'oklch(58% 0.16 155)'
                    : 'oklch(58% 0.16 155 / 55%)',
                  strokeWidth: 1,
                }}
              />
            )}
            <text
              x={bx + bw / 2}
              y={TOP_PAD + CHART_H + LABEL_H}
              textAnchor="middle"
              style={{
                fontSize: '9px',
                fill: isPeak ? 'oklch(44% 0.14 155)' : 'oklch(50% 0 0)',
                fontFamily: 'var(--font-mono)',
                fontWeight: isPeak ? 700 : 400,
              }}
            >
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

'use client';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface MonthYearSelectProps {
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  name?: string;
  hasError?: boolean;
  abbreviated?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function MonthYearSelect({
  value,
  onChange,
  name,
  hasError = false,
  abbreviated = false,
  style,
  className,
}: MonthYearSelectProps) {
  const parts = value.split('-');
  const year = parts[0] ?? String(new Date().getFullYear());
  const month = parts[1] ?? String(new Date().getMonth() + 1).padStart(2, '0');

  const years = [2023, 2024, 2025, 2026];

  function handleMonthChange(m: string) {
    onChange(`${year}-${m}`);
  }

  function handleYearChange(y: string) {
    onChange(`${y}-${month}`);
  }

  const base: React.CSSProperties = {
    padding: '5px 7px',
    background: 'var(--color-surface-0)',
    border: `1px solid ${hasError ? 'var(--color-signal-hi)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-ink-1)',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box' as const,
    appearance: 'none' as const,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 6px center',
    paddingRight: '20px',
    cursor: 'pointer',
  };

  return (
    <div
      style={{ display: 'flex', gap: '4px', ...style }}
      className={className}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <select
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        aria-label="Mes"
        style={{ ...base, flex: '1 1 0', minWidth: abbreviated ? '58px' : '90px' }}
      >
        {MESES_ES.map((mes, i) => {
          const m = String(i + 1).padStart(2, '0');
          return (
            <option key={m} value={m}>
              {abbreviated ? MESES_ABREV[i] : mes}
            </option>
          );
        })}
      </select>
      <select
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        aria-label="Año"
        style={{ ...base, width: '70px', flex: '0 0 auto' }}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface YearSelectorProps {
  availableYears: number[];
  selectedYear: number;
}

export function YearSelector({ availableYears, selectedYear }: YearSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(year: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(year));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (availableYears.length <= 1) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
      }}
    >
      {availableYears.map((year) => (
        <button
          key={year}
          type="button"
          onClick={() => handleChange(year)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            fontWeight: year === selectedYear ? 700 : 400,
            padding: '3px var(--space-3)',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            border: 'none',
            background: year === selectedYear ? 'var(--color-surface-1)' : 'transparent',
            color: year === selectedYear ? 'var(--color-ink-1)' : 'var(--color-ink-3)',
            cursor: year === selectedYear ? 'default' : 'pointer',
            boxShadow: year === selectedYear ? 'var(--shadow-xs)' : 'none',
            transition: 'background 120ms, color 120ms',
          }}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

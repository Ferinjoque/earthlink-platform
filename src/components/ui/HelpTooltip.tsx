'use client';

import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  content: string;
  title?: string;
}

export function HelpTooltip({ content, title }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <style>{`
        .help-btn {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid var(--color-ink-3);
          background: transparent;
          color: var(--color-ink-3);
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: border-color 120ms, color 120ms;
          flex-shrink: 0;
          font-family: var(--font-sans);
        }
        .help-btn:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .help-popover {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 8px);
          transform: translateX(-50%);
          width: 240px;
          background: var(--color-surface-1);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          z-index: 50;
          pointer-events: none;
        }
        .help-popover-arrow {
          position: absolute;
          left: 50%;
          bottom: -5px;
          transform: translateX(-50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: var(--color-surface-1);
          border-right: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
        }
      `}</style>

      <button
        type="button"
        className="help-btn"
        aria-label="Más información"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>

      {open && (
        <div className="help-popover" role="tooltip">
          {title != null && (
            <p
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-ink-1)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {title}
            </p>
          )}
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-2)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {content}
          </p>
          <div className="help-popover-arrow" />
        </div>
      )}
    </div>
  );
}

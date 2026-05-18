'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  ShieldCheck,
  FileText,
  LogOut,
  Leaf,
} from 'lucide-react';
import { signOut } from '@/actions/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Panel', icon: <LayoutDashboard size={18} /> },
  { href: '/suppliers', label: 'Proveedores', icon: <Building2 size={18} /> },
  { href: '/activity', label: 'Actividad', icon: <ClipboardList size={18} /> },
  { href: '/audit', label: 'Auditoría', icon: <ShieldCheck size={18} /> },
  { href: '/reports', label: 'Reportes', icon: <FileText size={18} /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      data-theme="dark"
      style={{
        width: 'var(--sidebar-w)',
        minWidth: 'var(--sidebar-w)',
        height: '100dvh',
        background: 'var(--color-surface-0)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          padding: 'var(--space-5) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span
          style={{
            width: '30px',
            height: '30px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-2) 100%)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            boxShadow: '0 0 0 1px oklch(77% 0.16 155 / 20%), 0 4px 12px oklch(58% 0.16 155 / 30%)',
          }}
        >
          <Leaf size={15} color="white" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: 'var(--color-ink-1)',
              letterSpacing: 'var(--tracking-tight)',
              lineHeight: 1.1,
            }}
          >
            EarthLink
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-ink-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            ESG Auditor
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav
        aria-label="Navegación principal"
        style={{
          flex: 1,
          padding: 'var(--space-3) var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                color: isActive ? 'var(--color-accent)' : 'var(--color-ink-2)',
                background: isActive
                  ? 'oklch(58% 0.16 155 / 14%)'
                  : 'transparent',
                textDecoration: 'none',
                transition: `background var(--duration-fast) var(--ease-out-expo), color var(--duration-fast) var(--ease-out-expo)`,
                position: 'relative',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'oklch(58% 0.16 155 / 7%)';
                  e.currentTarget.style.color = 'var(--color-ink-1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-ink-2)';
                }
              }}
            >
              <span
                style={{
                  opacity: isActive ? 1 : 0.55,
                  transition: 'opacity var(--duration-fast)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div
        style={{
          padding: 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <form action={signOut}>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              transition: `color var(--duration-fast) var(--ease-out-expo), background var(--duration-fast)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-signal-hi)';
              e.currentTarget.style.background = 'oklch(50% 0.16 20 / 8%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-ink-3)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

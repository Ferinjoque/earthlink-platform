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
  {
    href: '/dashboard',
    label: 'Panel',
    icon: <LayoutDashboard size={18} />,
  },
  {
    href: '/suppliers',
    label: 'Proveedores',
    icon: <Building2 size={18} />,
  },
  {
    href: '/activity',
    label: 'Actividad',
    icon: <ClipboardList size={18} />,
  },
  {
    href: '/audit',
    label: 'Auditoría',
    icon: <ShieldCheck size={18} />,
  },
  {
    href: '/reports',
    label: 'Reportes',
    icon: <FileText size={18} />,
  },
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
          padding: 'var(--space-6) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Leaf size={14} color="white" />
        </span>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--color-ink-1)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          EarthLink
        </span>
      </div>

      {/* Nav */}
      <nav
        aria-label="Navegación principal"
        style={{
          flex: 1,
          padding: 'var(--space-4) var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
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
                background: isActive ? 'oklch(58% 0.16 155 / 12%)' : 'transparent',
                textDecoration: 'none',
                transition: `background var(--duration-fast) var(--ease-out-expo), color var(--duration-fast) var(--ease-out-expo)`,
                letterSpacing: 'var(--tracking-normal)',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-3)',
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
              transition: `color var(--duration-fast) var(--ease-out-expo)`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-signal-hi)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-3)')}
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

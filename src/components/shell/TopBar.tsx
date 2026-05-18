'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  Building2,
  ClipboardList,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  X,
  ChevronRight,
} from 'lucide-react';
import { signOut } from '@/actions/auth';
import { useSearchContext } from './SearchContext';

interface TopBarProps {
  title: string;
  email?: string | undefined;
  section?: string | undefined;
}

const NAV_ITEMS = [
  {
    label: 'Panel',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Visión general · KPIs',
  },
  {
    label: 'Proveedores',
    href: '/suppliers',
    icon: Building2,
    description: 'Registro de cadena de suministro',
  },
  {
    label: 'Actividad',
    href: '/activity',
    icon: ClipboardList,
    description: 'Registros de consumo',
  },
  { label: 'Auditoría', href: '/audit', icon: ShieldCheck, description: 'Periodos de reporte' },
  {
    label: 'Reportes',
    href: '/reports',
    icon: FileText,
    description: 'Exportaciones y certificados',
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: Settings,
    description: 'Cuenta y organización',
  },
] as const;

export function TopBar({ title, email, section }: TopBarProps) {
  const { suppliers } = useSearchContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const inicial = email?.charAt(0).toUpperCase() ?? '?';

  function openSearch() {
    setQuery('');
    setHighlightIdx(0);
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen) return;
    function handler(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  // Close user menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Build search results
  const q = query.toLowerCase();
  const filteredPages = q
    ? NAV_ITEMS.filter(
        (p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      )
    : [...NAV_ITEMS];
  const filteredSuppliers = q
    ? suppliers.filter(
        (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
      )
    : [];

  type ResultItem = {
    type: 'page' | 'supplier';
    label: string;
    href: string;
    description: string;
    icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  };
  const results: ResultItem[] = [
    ...filteredPages.map((p) => ({
      type: 'page' as const,
      label: p.label,
      href: p.href,
      description: p.description,
      icon: p.icon,
    })),
    ...filteredSuppliers.map((s) => ({
      type: 'supplier' as const,
      label: s.name,
      href: `/suppliers/${s.id}`,
      description: s.category,
      icon: Building2,
    })),
  ];

  function goTo(href: string) {
    setSearchOpen(false);
    router.push(href);
  }

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = results[highlightIdx];
      if (item) goTo(item.href);
    }
  }

  const showDropdown = searchOpen && (results.length > 0 || (q.length > 0 && results.length === 0));

  return (
    <>
      <style>{`
        .user-menu-item:hover { background: var(--color-surface-2) !important; }
        .user-menu-signout:hover { background: var(--color-signal-hi-bg) !important; color: var(--color-signal-hi) !important; }
        .search-result-btn:hover { background: var(--color-accent-soft) !important; }
      `}</style>

      <header
        style={{
          height: 'var(--topbar-h)',
          minHeight: 'var(--topbar-h)',
          borderBottom: '1px solid var(--color-border)',
          background: 'color-mix(in oklch, var(--color-surface-0) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-raised)',
          overflow: 'visible',
          flexShrink: 0,
        }}
      >
        {/* Título + sección */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--color-ink-1)',
              margin: 0,
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            {title}
          </h1>
          {section && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                letterSpacing: 'var(--tracking-wide)',
              }}
            >
              / {section}
            </span>
          )}
        </div>

        {/* Derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/* Búsqueda inline */}
          <div ref={searchWrapRef} style={{ position: 'relative' }}>
            {searchOpen ? (
              /* Input expandido */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  width: '280px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-accent)',
                  background: 'var(--color-surface-1)',
                  boxShadow: '0 0 0 3px oklch(42% 0.12 155 / 12%)',
                  transition: 'all 180ms',
                }}
              >
                <Search size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightIdx(0);
                  }}
                  onKeyDown={handleSearchKey}
                  placeholder="Buscar páginas, proveedores…"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-1)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-ink-3)',
                    display: 'flex',
                    padding: '2px',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              /* Pill inactivo */
              <button
                type="button"
                onClick={openSearch}
                aria-label="Abrir búsqueda (⌘K)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                  cursor: 'pointer',
                  opacity: 0.8,
                  outline: 'none',
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                <Search size={12} style={{ color: 'var(--color-ink-3)' }} />
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Buscar…
                </span>
                <kbd
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border-strong)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-ink-3)',
                    lineHeight: 1.4,
                  }}
                >
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Dropdown de resultados */}
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '340px',
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                  zIndex: 'var(--z-overlay)',
                }}
              >
                {/* Sin resultados */}
                {q && results.length === 0 && (
                  <p
                    style={{
                      padding: 'var(--space-5)',
                      textAlign: 'center',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-3)',
                      margin: 0,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Sin resultados para &ldquo;{query}&rdquo;
                  </p>
                )}

                {/* Lista de resultados */}
                {results.length > 0 && (
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {!q && (
                      <p
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-ink-3)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          padding: 'var(--space-3) var(--space-4) var(--space-1)',
                          margin: 0,
                        }}
                      >
                        Navegación
                      </p>
                    )}
                    {q && filteredPages.length > 0 && filteredSuppliers.length > 0 && (
                      <p
                        style={{
                          fontSize: '10px',
                          color: 'var(--color-ink-3)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          padding: 'var(--space-3) var(--space-4) var(--space-1)',
                          margin: 0,
                        }}
                      >
                        Páginas
                      </p>
                    )}
                    {results.map((item, i) => {
                      const isSupplierSectionStart =
                        q &&
                        item.type === 'supplier' &&
                        (i === 0 || results[i - 1]?.type === 'page');
                      const Icon = item.icon ?? Building2;
                      const highlighted = i === highlightIdx;
                      return (
                        <div key={item.type + item.href}>
                          {isSupplierSectionStart && (
                            <p
                              style={{
                                fontSize: '10px',
                                color: 'var(--color-ink-3)',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                padding: 'var(--space-3) var(--space-4) var(--space-1)',
                                margin: 0,
                                borderTop: '1px solid var(--color-border)',
                              }}
                            >
                              Proveedores
                            </p>
                          )}
                          <button
                            type="button"
                            className="search-result-btn"
                            onClick={() => goTo(item.href)}
                            onMouseEnter={() => setHighlightIdx(i)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              padding: 'var(--space-2) var(--space-4)',
                              width: '100%',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              background: highlighted ? 'var(--color-accent-soft)' : 'transparent',
                              transition: 'background 80ms',
                            }}
                          >
                            <span
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: 'var(--radius-sm)',
                                background: highlighted
                                  ? 'oklch(42% 0.12 155 / 14%)'
                                  : 'var(--color-surface-2)',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                color: highlighted ? 'var(--color-accent)' : 'var(--color-ink-3)',
                                transition: 'background 80ms, color 80ms',
                              }}
                            >
                              <Icon size={13} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  fontSize: 'var(--text-xs)',
                                  color: highlighted ? 'var(--color-accent)' : 'var(--color-ink-1)',
                                  margin: 0,
                                  fontWeight: 500,
                                  transition: 'color 80ms',
                                }}
                              >
                                {item.label}
                              </p>
                              <p
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--color-ink-3)',
                                  margin: 0,
                                  fontFamily: 'var(--font-mono)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.description}
                              </p>
                            </div>
                            {highlighted && (
                              <ChevronRight
                                size={12}
                                style={{ color: 'var(--color-accent)', flexShrink: 0 }}
                              />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pie con atajos */}
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                  }}
                >
                  {[
                    ['↑↓', 'navegar'],
                    ['⏎', 'abrir'],
                    ['Esc', 'cerrar'],
                  ].map(([key, label]) => (
                    <span
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        color: 'var(--color-ink-3)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <kbd
                        style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: 'var(--color-surface-3)',
                          border: '1px solid var(--color-border-strong)',
                          fontSize: '10px',
                        }}
                      >
                        {key}
                      </kbd>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar + menú */}
          {email && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menú de usuario"
                aria-expanded={menuOpen}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-pill)',
                  background:
                    'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-2) 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 0 0 2px var(--color-surface-0), 0 0 0 3px var(--color-accent-soft)',
                  flexShrink: 0,
                  transition: 'box-shadow 150ms',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow =
                    '0 0 0 2px var(--color-surface-0), 0 0 0 4px var(--color-accent)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow =
                    '0 0 0 2px var(--color-surface-0), 0 0 0 3px var(--color-accent-soft)')
                }
              >
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-bold)',
                    color: 'white',
                    lineHeight: 1,
                  }}
                >
                  {inicial}
                </span>
              </button>

              {/* Dropdown menú */}
              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '220px',
                    zIndex: 'var(--z-overlay)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Email */}
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-ink-3)',
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        margin: '0 0 3px',
                      }}
                    >
                      Cuenta activa
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-ink-1)',
                        margin: 0,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '180px',
                      }}
                    >
                      {email}
                    </p>
                  </div>

                  {/* Configuración */}
                  <Link
                    href="/settings"
                    className="user-menu-item"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-ink-2)',
                      textDecoration: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 120ms',
                    }}
                  >
                    <Settings size={15} style={{ opacity: 0.6 }} />
                    Configuración
                  </Link>

                  {/* Cerrar sesión */}
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="user-menu-signout"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-ink-3)',
                        transition: 'background 120ms, color 120ms',
                      }}
                    >
                      <LogOut size={15} />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}

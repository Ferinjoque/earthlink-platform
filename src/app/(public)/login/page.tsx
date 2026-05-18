'use client';

import { useActionState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Shield, Zap, BarChart3 } from 'lucide-react';
import { signIn } from './actions';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

type State = { error: string } | undefined;

const STATS = [
  { valor: '1–2', etiqueta: 'Alcances GHG', icono: <BarChart3 size={14} /> },
  { valor: 'sha256', etiqueta: 'Audit trail', icono: <Shield size={14} /> },
  { valor: 'FP puro', etiqueta: 'Motor de cálculo', icono: <Zap size={14} /> },
];

const BADGES = ['GHG Protocol', 'ISO 14064', 'Alcance 1 y 2'];

const ease = [0.16, 1, 0.3, 1] as const;

export default function LoginPage() {
  const [state, action, isPending] = useActionState<State, FormData>(signIn, undefined);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: '1fr',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Layout split en tablet+ ── */}
      <style>{`
        @media (min-width: 900px) {
          .login-grid { grid-template-columns: 1fr 1fr !important; }
          .login-hero { display: flex !important; }
          .login-card-col { align-items: center !important; justify-content: center !important; }
        }
        @media (max-width: 899px) {
          .login-hero { display: none !important; }
          .login-card-col {
            align-items: center !important;
            justify-content: center !important;
            min-height: 100dvh !important;
            padding: var(--space-6) !important;
          }
        }
        input[data-login]:focus {
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 3px oklch(58% 0.16 155 / 12%) !important;
        }
        .login-submit:hover:not(:disabled) {
          opacity: 0.88;
          transform: translateY(-1px);
        }
      `}</style>

      <AmbientBackground />

      <div
        className="login-grid"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          minHeight: '100dvh',
        }}
      >
        {/* ── Columna hero ── */}
        <div
          className="login-hero"
          style={{
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 'clamp(var(--space-12), 6vw, var(--space-24))',
            paddingRight: 'var(--space-12)',
          }}
        >
          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-16)',
            }}
          >
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Leaf size={18} color="white" />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--color-ink-1)',
                letterSpacing: 'var(--tracking-tight)',
              }}
            >
              EarthLink
            </span>
          </motion.div>

          {/* Eyebrow */}
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.08 }}
            style={{ marginBottom: 'var(--space-5)' }}
          >
            Auditoría de carbono · Alcances 1 y 2
          </motion.p>

          {/* Headline display */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease, delay: 0.16 }}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-display)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-ink-1)',
              margin: '0 0 var(--space-6)',
              letterSpacing: 'var(--tracking-tightest)',
              lineHeight: 'var(--leading-tight)',
              maxWidth: '14ch',
            }}
          >
            Trazabilidad climática para cada eslabón.
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.26 }}
            style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--color-ink-2)',
              lineHeight: 'var(--leading-relaxed)',
              maxWidth: '40ch',
              margin: '0 0 var(--space-12)',
            }}
          >
            Audita la huella de carbono de tu cadena de suministro con trazabilidad inmutable y
            motor de cálculo verificado.
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.36 }}
            style={{
              display: 'flex',
              gap: 'var(--space-8)',
              marginBottom: 'var(--space-12)',
            }}
          >
            {STATS.map(({ valor, etiqueta, icono }) => (
              <div
                key={etiqueta}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {icono}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xl)',
                      fontWeight: 'var(--fw-bold)',
                      color: 'var(--color-ink-1)',
                      letterSpacing: 'var(--tracking-tight)',
                      lineHeight: 1,
                    }}
                  >
                    {valor}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wide)',
                  }}
                >
                  {etiqueta}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Badges cumplimiento */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.48 }}
            style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            {BADGES.map((badge) => (
              <span
                key={badge}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-accent-soft)',
                  border: '1px solid oklch(58% 0.12 155 / 20%)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--color-accent)',
                  letterSpacing: 'var(--tracking-wide)',
                }}
              >
                {badge}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Columna formulario ── */}
        <div
          className="login-card-col"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-8)',
            background: 'oklch(100% 0 0 / 40%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderLeft: '1px solid oklch(100% 0 0 / 30%)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.32 }}
            style={{ width: '100%', maxWidth: '400px' }}
          >
            {/* Wordmark mobile */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-10)',
              }}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                <Leaf size={16} color="white" />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'var(--text-xl)',
                  fontWeight: 600,
                  color: 'var(--color-ink-1)',
                  letterSpacing: 'var(--tracking-tight)',
                }}
              >
                EarthLink
              </span>
            </div>

            {/* Card */}
            <div
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--color-ink-1)',
                    margin: '0 0 var(--space-1)',
                    letterSpacing: 'var(--tracking-tight)',
                  }}
                >
                  Inicia sesión
                </h2>
                <p
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-ink-2)',
                    margin: 0,
                  }}
                >
                  Auditor ESG de Carbono
                </p>
              </div>

              <form
                action={action}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              >
                {/* Correo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label
                    htmlFor="email"
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--color-ink-2)',
                      letterSpacing: 'var(--tracking-widest)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Correo electrónico
                  </label>
                  <input
                    data-login
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isPending}
                    placeholder="tu@empresa.com"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--color-ink-1)',
                      outline: 'none',
                      transition: `border-color var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)`,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Contraseña */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <label
                    htmlFor="password"
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--fw-semibold)',
                      color: 'var(--color-ink-2)',
                      letterSpacing: 'var(--tracking-widest)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Contraseña
                  </label>
                  <input
                    data-login
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={isPending}
                    placeholder="••••••••"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--color-ink-1)',
                      outline: 'none',
                      transition: `border-color var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)`,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Error */}
                {state?.error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease }}
                    style={{
                      background: 'var(--color-signal-hi-bg)',
                      border: '1px solid var(--color-signal-hi)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-signal-hi)',
                    }}
                  >
                    {state.error}
                  </motion.div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="login-submit"
                  style={{
                    background: isPending ? 'var(--color-accent-dim)' : 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-6)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--fw-semibold)',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    transition: `opacity var(--duration-fast) var(--ease-out-expo), transform var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)`,
                    width: '100%',
                    marginTop: 'var(--space-2)',
                    boxShadow: isPending ? 'none' : 'var(--shadow-glow)',
                    letterSpacing: 'var(--tracking-wide)',
                  }}
                >
                  {isPending ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: 'white',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'ringSpin 0.7s linear infinite',
                        }}
                      />
                      Iniciando sesión…
                    </span>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <p
              style={{
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-6) 0 0',
                fontFamily: 'var(--font-mono)',
              }}
            >
              EarthLink ESG Auditor · Alcances 1 y 2
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

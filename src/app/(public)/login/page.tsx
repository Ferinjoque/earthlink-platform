'use client';

import { useActionState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Shield, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';
import { signIn } from './actions';

type State = { error: string } | undefined;

const ease = [0.16, 1, 0.3, 1] as const;

const PILARES = [
  { icono: <BarChart3 size={14} />, texto: 'GHG Protocol · Alcances 1 y 2' },
  { icono: <Shield size={14} />, texto: 'Trazabilidad inmutable sha256' },
  { icono: <CheckCircle size={14} />, texto: 'Motor de cálculo verificado' },
];

export default function LoginPage() {
  const [state, action, isPending] = useActionState<State, FormData>(signIn, undefined);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: '1fr',
        background: 'oklch(99% 0.006 80)',
      }}
    >
      <style>{`
        @media (min-width: 900px) {
          .login-split { grid-template-columns: 58fr 42fr !important; }
          .login-hero  { display: flex !important; }
          .login-form  { min-height: auto !important; }
          .logo-mobile { display: none !important; }
        }
        @media (max-width: 899px) {
          .login-hero { display: none !important; }
          .login-form { min-height: 100dvh !important; }
        }
        .field-input {
          background: oklch(97% 0.006 80);
          border: 1px solid oklch(88% 0.012 80);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: var(--text-base);
          color: var(--color-ink-1);
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .field-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px oklch(42% 0.12 155 / 10%);
        }
        .submit-btn {
          transition: opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 12px 32px oklch(22% 0.08 155 / 30%) !important;
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      <div className="login-split" style={{ display: 'grid', minHeight: '100dvh' }}>
        {/* ━━━━━ HERO — dark forest ━━━━━ */}
        <div
          className="login-hero"
          style={{
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 'clamp(2.5rem, 5vw, 5rem)',
            paddingTop: 'clamp(2rem, 4vw, 4rem)',
            background:
              'linear-gradient(155deg, oklch(11% 0.055 162) 0%, oklch(15% 0.065 160) 45%, oklch(9% 0.04 168) 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* ── Orbes de profundidad — visibles sobre oscuro ── */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                top: '-20%',
                right: '-12%',
                width: '70%',
                paddingBottom: '70%',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, oklch(62% 0.20 164 / 24%) 0%, transparent 62%)',
                animation: 'orbDrift 26s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '8%',
                left: '-8%',
                width: '50%',
                paddingBottom: '50%',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, oklch(55% 0.17 164 / 18%) 0%, transparent 62%)',
                animation: 'orbDrift 32s ease-in-out infinite reverse',
                animationDelay: '-12s',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '38%',
                right: '18%',
                width: '28%',
                paddingBottom: '28%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, oklch(70% 0.12 85 / 14%) 0%, transparent 65%)',
                animation: 'orbDrift 20s ease-in-out infinite',
                animationDelay: '-6s',
              }}
            />
          </div>

          {/* ── Red de datos / constelación ── */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Líneas */}
            <line
              x1="18%"
              y1="14%"
              x2="36%"
              y2="7%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.7"
              opacity="0.45"
            />
            <line
              x1="36%"
              y1="7%"
              x2="54%"
              y2="20%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.7"
              opacity="0.45"
            />
            <line
              x1="54%"
              y1="20%"
              x2="72%"
              y2="11%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.5"
              opacity="0.35"
            />
            <line
              x1="54%"
              y1="20%"
              x2="46%"
              y2="42%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.6"
              opacity="0.40"
            />
            <line
              x1="18%"
              y1="14%"
              x2="10%"
              y2="34%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.6"
              opacity="0.40"
            />
            <line
              x1="10%"
              y1="34%"
              x2="24%"
              y2="56%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.5"
              opacity="0.35"
            />
            <line
              x1="46%"
              y1="42%"
              x2="58%"
              y2="60%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.5"
              opacity="0.35"
            />
            <line
              x1="58%"
              y1="60%"
              x2="76%"
              y2="52%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.4"
              opacity="0.28"
            />
            <line
              x1="24%"
              y1="56%"
              x2="40%"
              y2="68%"
              stroke="oklch(68% 0.14 164)"
              strokeWidth="0.4"
              opacity="0.28"
            />
            {/* Nodos */}
            <circle cx="18%" cy="14%" r="3.5" fill="oklch(72% 0.16 164)" opacity="0.70" />
            <circle cx="36%" cy="7%" r="2.5" fill="oklch(70% 0.14 164)" opacity="0.60" />
            <circle cx="54%" cy="20%" r="4.5" fill="oklch(75% 0.18 164)" opacity="0.80" />
            <circle cx="72%" cy="11%" r="2" fill="oklch(68% 0.12 164)" opacity="0.50" />
            <circle cx="10%" cy="34%" r="3" fill="oklch(70% 0.14 164)" opacity="0.60" />
            <circle cx="46%" cy="42%" r="3.5" fill="oklch(72% 0.16 164)" opacity="0.65" />
            <circle cx="24%" cy="56%" r="2.5" fill="oklch(68% 0.12 164)" opacity="0.55" />
            <circle cx="58%" cy="60%" r="3" fill="oklch(70% 0.14 164)" opacity="0.60" />
            <circle cx="76%" cy="52%" r="2" fill="oklch(66% 0.12 164)" opacity="0.45" />
            <circle cx="40%" cy="68%" r="2" fill="oklch(66% 0.12 164)" opacity="0.40" />
          </svg>

          {/* ── Anillos concéntricos (esquina superior derecha) ── */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '4%',
              right: '4%',
              width: '48%',
              height: '48%',
              pointerEvents: 'none',
              opacity: 0.07,
            }}
          >
            <circle cx="50%" cy="50%" r="46%" fill="none" stroke="white" strokeWidth="1" />
            <circle cx="50%" cy="50%" r="36%" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="50%" cy="50%" r="26%" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="50%" cy="50%" r="16%" fill="none" stroke="white" strokeWidth="0.5" />
          </svg>

          {/* ── Wordmark (esquina superior) ── */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.05 }}
            style={{
              position: 'absolute',
              top: 'clamp(1.75rem, 3.5vw, 3rem)',
              left: 'clamp(1.75rem, 3.5vw, 3rem)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span
              style={{
                width: '33px',
                height: '33px',
                borderRadius: '8px',
                background: 'oklch(62% 0.20 164)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow:
                  '0 0 0 1px oklch(72% 0.16 164 / 40%), 0 8px 24px oklch(55% 0.18 164 / 45%)',
              }}
            >
              <Leaf size={16} color="oklch(12% 0.05 160)" />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'oklch(94% 0.016 80)',
                letterSpacing: '-0.02em',
              }}
            >
              EarthLink
            </span>
          </motion.div>

          {/* ── Contenido principal ── */}
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '50ch' }}>
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.18 }}
              style={{ color: 'oklch(62% 0.16 164)', marginBottom: 'var(--space-5)' }}
            >
              Auditoría ESG · Alcances 1 y 2
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 0.28 }}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.6rem, 3vw + 1.4rem, 5rem)',
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'oklch(95% 0.012 80)',
                margin: '0 0 var(--space-7)',
                letterSpacing: '-0.038em',
                lineHeight: 1.06,
              }}
            >
              La huella de carbono
              <br />
              <span style={{ color: 'oklch(66% 0.20 164)' }}>contada</span> con
              <br />
              precisión.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease, delay: 0.42 }}
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 1.68,
                color: 'oklch(70% 0.04 165)',
                maxWidth: '38ch',
                margin: '0 0 var(--space-10)',
              }}
            >
              Rastrea, calcula y certifica las emisiones de tu cadena de suministro con trazabilidad
              inmutable y motor verificado GHG Protocol.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease, delay: 0.54 }}
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 var(--space-10)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              {PILARES.map(({ icono, texto }) => (
                <li
                  key={texto}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    color: 'oklch(74% 0.06 165)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'oklch(65% 0.18 164)', flexShrink: 0 }}>{icono}</span>
                  {texto}
                </li>
              ))}
            </motion.ul>

            {/* Badges cumplimiento */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease, delay: 0.64 }}
              style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
            >
              {['GHG Protocol', 'ISO 14064', 'Alcance 1–2'].map((badge) => (
                <span
                  key={badge}
                  style={{
                    padding: '4px 11px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'oklch(62% 0.18 164 / 14%)',
                    border: '1px solid oklch(62% 0.18 164 / 32%)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'oklch(72% 0.14 164)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {badge}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ━━━━━ FORMULARIO — luz limpia ━━━━━ */}
        <div
          className="login-form"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-8)',
            background: 'oklch(99% 0.006 80)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.15 }}
            style={{ width: '100%', maxWidth: '380px' }}
          >
            {/* Wordmark — solo móvil */}
            <div
              className="logo-mobile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-10)',
              }}
            >
              <span
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                <Leaf size={15} color="white" />
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

            {/* Encabezado del formulario */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <h2
                style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--color-ink-1)',
                  margin: '0 0 var(--space-1)',
                  letterSpacing: 'var(--tracking-tight)',
                }}
              >
                Bienvenido
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', margin: 0 }}>
                Inicia sesión en tu cuenta
              </p>
            </div>

            <form
              action={action}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label
                  htmlFor="email"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-medium)',
                    color: 'var(--color-ink-2)',
                    letterSpacing: '0.05em',
                  }}
                >
                  Correo electrónico
                </label>
                <input
                  className="field-input"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isPending}
                  placeholder="tu@empresa.com"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-medium)',
                    color: 'var(--color-ink-2)',
                    letterSpacing: '0.05em',
                  }}
                >
                  Contraseña
                </label>
                <input
                  className="field-input"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  placeholder="••••••••"
                />
              </div>

              {state?.error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
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

              <button
                type="submit"
                disabled={isPending}
                className="submit-btn"
                style={{
                  background: isPending ? 'var(--color-accent-dim)' : 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-6)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 'var(--fw-semibold)',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  width: '100%',
                  marginTop: 'var(--space-2)',
                  boxShadow: isPending ? 'none' : '0 4px 20px oklch(22% 0.08 155 / 22%)',
                  letterSpacing: '0.01em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isPending ? (
                  <>
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
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p
              style={{
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-3)',
                margin: 'var(--space-8) 0 0',
                fontFamily: 'var(--font-mono)',
              }}
            >
              EarthLink ESG · Alcances 1 y 2
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

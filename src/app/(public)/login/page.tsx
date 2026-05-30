'use client';

import { useActionState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, BarChart3, ArrowRight, CheckCircle } from 'lucide-react';
import { signIn } from './actions';

const ParticleField = dynamic(() => import('./ParticleField'), { ssr: false, loading: () => null });

type State = { error: string } | undefined;

const ease = [0.16, 1, 0.3, 1] as const;

const PILARES = [
  { icono: <BarChart3 size={14} />, texto: 'GHG Protocol · Alcances 1 y 2' },
  { icono: <Shield size={14} />, texto: 'Trazabilidad inmutable sha256' },
  { icono: <CheckCircle size={14} />, texto: 'Motor de cálculo verificado' },
];

/* ─── Input oculto para redirección post-login (Suspense necesario para SSR) ─ */
function NextRedirectInput() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

/* ─── Página ───────────────────────────────────────────────────────── */
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
        @keyframes ringSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes formEnter {
          from { transform: translateY(12px); }
          to   { transform: translateY(0); }
        }
        .form-enter {
          animation: formEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
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
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div className="login-split" style={{ display: 'grid', minHeight: '100dvh' }}>
        {/* ━━━━━ HERO ━━━━━ */}
        <div
          className="login-hero"
          style={{
            display: 'none',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 'clamp(2.5rem, 5vw, 5rem)',
            paddingTop: 'clamp(6rem, 10vw, 9rem)',
            background: 'oklch(10% 0.048 162)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <ParticleField />

          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                top: '-30%',
                right: '-20%',
                width: '75%',
                paddingBottom: '75%',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, oklch(48% 0.18 162 / 14%) 0%, transparent 65%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '-10%',
                left: '-15%',
                width: '55%',
                paddingBottom: '55%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, oklch(62% 0.12 75 / 10%) 0%, transparent 65%)',
              }}
            />
          </div>

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
              zIndex: 2,
            }}
          >
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

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '50ch' }}>
            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 0.28 }}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2.8rem, 3.2vw + 1.5rem, 5.4rem)',
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'oklch(95% 0.012 80)',
                margin: '0 0 var(--space-8)',
                letterSpacing: '-0.038em',
                lineHeight: 1.04,
              }}
            >
              La huella de carbono
              <br />
              <span style={{ color: 'oklch(64% 0.22 162)' }}>contada</span> con
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
                color: 'oklch(68% 0.04 165)',
                maxWidth: '38ch',
                margin: '0 0 var(--space-8)',
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
                margin: 0,
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
                    color: 'oklch(72% 0.06 165)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'oklch(62% 0.20 162)', flexShrink: 0 }}>{icono}</span>
                  {texto}
                </li>
              ))}
            </motion.ul>
          </div>
        </div>

        {/* ━━━━━ FORMULARIO ━━━━━ */}
        <main
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
          <div className="form-enter" style={{ width: '100%', maxWidth: '380px' }}>
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
              <Suspense fallback={null}>
                <NextRedirectInput />
              </Suspense>
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
                color: 'var(--color-ink-2)',
                margin: 'var(--space-8) 0 0',
                fontFamily: 'var(--font-mono)',
              }}
            >
              EarthLink ESG · Alcances 1 y 2
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

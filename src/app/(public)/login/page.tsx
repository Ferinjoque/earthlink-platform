'use client';

import { useRef, useEffect, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
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

/* ─── Canvas particle field ────────────────────────────────────────── */
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;
    let tick = 0;

    interface Pt {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
      phase: number;
      bright: boolean;
    }

    let pts: Pt[] = [];
    const LINK = 165;
    const LINK2 = LINK * LINK;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      const n = Math.min(Math.floor((W * H) / 10000), 90);
      pts = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1.4 + Math.random() * 2.6,
        a: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        bright: i % 7 === 0,
      }));
    };

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -12) p.x = W + 12;
        else if (p.x > W + 12) p.x = -12;
        if (p.y < -12) p.y = H + 12;
        else if (p.y > H + 12) p.y = -12;
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const pi = pts[i]!;
          const pj = pts[j]!;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            const t = 1 - d2 / LINK2;
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.strokeStyle = `rgba(55, 195, 130, ${t * 0.38})`;
            ctx.lineWidth = t * 0.85;
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        const pulse = 0.82 + 0.18 * Math.sin(tick * 0.018 + p.phase);
        const alpha = p.a * pulse;

        if (p.r > 2.8 || p.bright) {
          ctx.shadowBlur = p.bright ? 22 : 14;
          ctx.shadowColor = p.bright
            ? 'rgba(80, 230, 160, 0.85)'
            : 'rgba(55, 210, 140, 0.65)';
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.bright
          ? `rgba(120, 240, 180, ${alpha * 1.2})`
          : `rgba(80, 220, 160, ${alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };

    setup();
    draw();

    const onResize = () => setup();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [state, action, isPending] = useActionState<State, FormData>(signIn, undefined);
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '';

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
            justifyContent: 'flex-end',
            padding: 'clamp(2.5rem, 5vw, 5rem)',
            paddingTop: 'clamp(2rem, 4vw, 4rem)',
            background: 'oklch(10% 0.048 162)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <ParticleField />

          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute', top: '-30%', right: '-20%',
                width: '75%', paddingBottom: '75%', borderRadius: '50%',
                background: 'radial-gradient(circle, oklch(48% 0.18 162 / 14%) 0%, transparent 65%)',
              }}
            />
            <div
              style={{
                position: 'absolute', bottom: '-10%', left: '-15%',
                width: '55%', paddingBottom: '55%', borderRadius: '50%',
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
              display: 'flex', alignItems: 'center', gap: '10px',
              zIndex: 2,
            }}
          >
            <span
              style={{
                width: '33px', height: '33px', borderRadius: '8px',
                background: 'oklch(55% 0.22 162)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
                boxShadow: '0 0 0 1px oklch(68% 0.18 162 / 40%), 0 8px 24px oklch(48% 0.20 162 / 50%)',
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

          <div style={{ position: 'relative', zIndex: 2, maxWidth: '50ch' }}>
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.18 }}
              style={{ color: 'oklch(60% 0.16 162)', marginBottom: 'var(--space-5)' }}
            >
              Auditoría ESG · Alcances 1 y 2
            </motion.p>

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
              Rastrea, calcula y certifica las emisiones de tu cadena de suministro con
              trazabilidad inmutable y motor verificado GHG Protocol.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease, delay: 0.54 }}
              style={{
                listStyle: 'none', padding: 0,
                margin: '0 0 var(--space-8)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
              }}
            >
              {PILARES.map(({ icono, texto }) => (
                <li
                  key={texto}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    color: 'oklch(72% 0.06 165)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'oklch(62% 0.20 162)', flexShrink: 0 }}>{icono}</span>
                  {texto}
                </li>
              ))}
            </motion.ul>

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
                    background: 'oklch(55% 0.20 162 / 15%)',
                    border: '1px solid oklch(58% 0.18 162 / 35%)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'oklch(70% 0.14 162)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {badge}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ━━━━━ FORMULARIO ━━━━━ */}
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
            <div
              className="logo-mobile"
              style={{
                display: 'flex', alignItems: 'center',
                gap: 'var(--space-3)', marginBottom: 'var(--space-10)',
              }}
            >
              <span
                style={{
                  width: '30px', height: '30px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent)',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
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
              {nextPath && <input type="hidden" name="next" value={nextPath} />}
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
                        width: '14px', height: '14px',
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

'use client';

import { useRef, useEffect } from 'react';

export default function ParticleField() {
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
          ctx.shadowColor = p.bright ? 'rgba(80, 230, 160, 0.85)' : 'rgba(55, 210, 140, 0.65)';
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
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

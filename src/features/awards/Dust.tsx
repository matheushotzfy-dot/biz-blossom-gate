import { useEffect, useRef } from "react";

interface Mote { x: number; y: number; r: number; vx: number; vy: number; phase: number; freq: number; base: number }

const seed = (w: number, h: number): Mote => ({
  x: Math.random() * w,
  y: Math.random() * h,
  r: 0.6 + Math.random() * 1.7,
  vx: (Math.random() - 0.5) * 0.12,
  vy: -(0.04 + Math.random() * 0.2),
  phase: Math.random() * Math.PI * 2,
  freq: 0.4 + Math.random() * 1.1,
  base: 0.18 + Math.random() * 0.5,
});

/** Poeira na luz do spot. Pausa quando a aba some ou o palco sai da tela. */
export function Dust({ glow, active }: { glow: string; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const [h, s, l] = glow.split(/\s+/).map((v) => parseFloat(v));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, hh = 0, raf = 0, visible = true;
    let motes: Mote[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; hh = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(hh * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(Math.max((w * hh) / 14000, 26), 64));
      motes = Array.from({ length: count }, () => seed(w, hh));
    };
    resize();

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, w, hh);
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.y < -4) { m.y = hh + 4; m.x = Math.random() * w; }
        if (m.x < -4) m.x = w + 4; else if (m.x > w + 4) m.x = -4;
        // Mais visível no feixe central, quase apagada nas bordas.
        const beam = Math.max(0.12, 1 - Math.abs(m.x - w / 2) / (w * 0.5));
        const a = m.base * beam * (0.55 + 0.45 * Math.sin((t / 1000) * m.freq + m.phase));
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        g.addColorStop(0, `hsla(${h}, ${Math.min(s + 10, 100)}%, ${Math.min(l + 34, 92)}%, ${a})`);
        g.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null;
    io?.observe(canvas);

    return () => { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); };
  }, [glow, active]);

  return <canvas ref={ref} aria-hidden className="vw-dust" />;
}

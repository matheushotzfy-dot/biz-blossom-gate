/**
 * Fundo animado da landing: linhas de dados com pulsos de luz, malha em
 * perspectiva e um halo que segue o mouse. Canvas 2D nítido (DPR até 2),
 * pausa fora da aba, 30fps no celular e quadro estático com reduced motion.
 */
import { useEffect, useRef } from "react";

interface Stream {
  base: number; amp: number; freq: number; phase: number; speed: number;
  hue: "a" | "b"; width: number; pulses: number[]; pulseSpeed: number;
}

function makeStreams(count: number): Stream[] {
  return Array.from({ length: count }, (_, i) => ({
    base: 0.08 + (i / count) * 0.84 + (Math.random() - 0.5) * 0.04,
    amp: 18 + Math.random() * 60,
    freq: 0.0012 + Math.random() * 0.0024,
    phase: Math.random() * Math.PI * 2,
    speed: 0.15 + Math.random() * 0.35,
    hue: i % 3 === 0 ? "b" : "a",
    width: 0.6 + Math.random() * 0.9,
    pulses: [Math.random(), Math.random()],
    pulseSpeed: 0.05 + Math.random() * 0.09,
  }));
}

export function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(canvas);
    const A = styles.getPropertyValue("--primary").trim() || "160 84% 39%";
    const B = styles.getPropertyValue("--vx-sky").trim() || "198 93% 60%";
    const color = (h: "a" | "b", alpha: number) => `hsl(${h === "a" ? A : B} / ${alpha})`;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const streams = makeStreams(mobile ? 8 : 16);
    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
    let w = 0, h = 0, raf = 0, last = 0, t = 0, running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const streamY = (s: Stream, x: number) => {
      let y = s.base * h + Math.sin(x * s.freq + t * s.speed + s.phase) * s.amp
        + Math.sin(x * s.freq * 2.3 + t * s.speed * 0.6) * s.amp * 0.25;
      const dx = x - mouse.sx, dy = y - mouse.sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 60000) y += (dy >= 0 ? 1 : -1) * 38 * Math.exp(-d2 / 14000);
      return y;
    };

    const drawGrid = () => {
      const horizon = h * 0.62, vx = w / 2;
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const p = ((i + (t * 0.12) % 1) / 14) ** 2;
        const y = horizon + (h - horizon) * p;
        ctx.strokeStyle = color("a", 0.02 + p * 0.07);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        ctx.strokeStyle = color("a", 0.05);
        ctx.beginPath(); ctx.moveTo(vx + i * 6, horizon); ctx.lineTo(vx + i * (w / 7), h); ctx.stroke();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      mouse.sx += (mouse.x - mouse.sx) * 0.08; mouse.sy += (mouse.y - mouse.sy) * 0.08;
      drawGrid();
      ctx.globalCompositeOperation = "lighter";
      for (const s of streams) {
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, color(s.hue, 0)); grad.addColorStop(0.5, color(s.hue, 0.26)); grad.addColorStop(1, color(s.hue, 0));
        ctx.strokeStyle = grad; ctx.lineWidth = s.width;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 18) { const y = streamY(s, x); x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        for (let k = 0; k < s.pulses.length; k++) {
          if (!reduce) s.pulses[k] = (s.pulses[k] + s.pulseSpeed * 0.016) % 1.2;
          const px = (s.pulses[k] - 0.1) * w, py = streamY(s, px);
          ctx.strokeStyle = color(s.hue, 0.9); ctx.lineWidth = s.width + 0.8;
          ctx.beginPath();
          for (let j = 0; j <= 8; j++) { const x = px - j * 12; const y = streamY(s, x); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
          const g = ctx.createRadialGradient(px, py, 0, px, py, 26);
          g.addColorStop(0, color(s.hue, 0.55)); g.addColorStop(1, color(s.hue, 0));
          ctx.fillStyle = g; ctx.fillRect(px - 26, py - 26, 52, 52);
        }
      }
      if (mouse.sx > -1000) {
        const g = ctx.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, 320);
        g.addColorStop(0, color("a", 0.1)); g.addColorStop(1, color("a", 0));
        ctx.fillStyle = g; ctx.fillRect(mouse.sx - 320, mouse.sy - 320, 640, 640);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      if (mobile && now - last < 33) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      t += dt; draw();
    };

    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") { mouse.x = e.clientX; mouse.y = e.clientY; } };
    const onVis = () => { running = !document.hidden; last = performance.now(); };

    resize();
    window.addEventListener("resize", resize);
    if (reduce) { t = 4; draw(); }
    else {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="vx3-bg" aria-hidden>
      <canvas ref={canvasRef} />
      <div className="vx3-bg-vignette" />
      <div className="vx3-bg-noise" />
    </div>
  );
}

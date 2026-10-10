import { useEffect, useRef } from "react";

/**
 * Mapa de rede ilustrativo: nós da gateway conectados ao "V" central,
 * com pulsos percorrendo as conexões. Pausa fora da aba e fica estático
 * sob prefers-reduced-motion.
 */
interface NodeDef { label: string; x: number; y: number }

const NODES: readonly NodeDef[] = [
  { label: "PIX", x: 0.14, y: 0.25 },
  { label: "CARTÃO", x: 0.16, y: 0.78 },
  { label: "ANTIFRAUDE", x: 0.5, y: 0.1 },
  { label: "ADQUIRENTE", x: 0.86, y: 0.28 },
  { label: "SAQUE", x: 0.84, y: 0.8 },
];
const CENTER = { x: 0.5, y: 0.55 };

function readVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

export function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const host = canvas.parentElement ?? canvas;
    const line = readVar(host, "--auth-aside-line", "215 40% 30%");
    const blue = readVar(host, "--auth-aside-accent", "199 89% 60%");
    const green = readVar(host, "--auth-aside-green", "160 84% 45%");
    const fg = readVar(host, "--auth-aside-muted", "215 25% 72%");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      // malha de pontos
      ctx.fillStyle = `hsl(${line} / .7)`;
      for (let x = 12; x < w; x += 22) for (let y = 12; y < h; y += 22) ctx.fillRect(x, y, 1, 1);
      const c = { x: CENTER.x * w, y: CENTER.y * h };
      NODES.forEach((n, i) => {
        const p = { x: n.x * w, y: n.y * h };
        ctx.strokeStyle = `hsl(${line})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        // pulso
        const k = reduced ? 0.5 : ((t / 1800 + i * 0.21) % 1);
        const inbound = i % 2 === 0;
        const f = inbound ? k : 1 - k;
        const px = p.x + (c.x - p.x) * f, py = p.y + (c.y - p.y) * f;
        const col = i % 2 === 0 ? green : blue;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 10);
        grad.addColorStop(0, `hsl(${col} / .9)`); grad.addColorStop(1, `hsl(${col} / 0)`);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        // nó
        ctx.fillStyle = `hsl(${col})`; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        ctx.strokeStyle = `hsl(${col} / .5)`; ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
        ctx.fillStyle = `hsl(${fg})`; ctx.font = "600 9px 'JetBrains Mono', monospace";
        ctx.textAlign = n.x > 0.6 ? "right" : n.x < 0.4 ? "left" : "center";
        const ox = n.x > 0.6 ? 12 : n.x < 0.4 ? -12 : 0;
        ctx.fillText(n.label, p.x - ox * -1 * (n.x < 0.4 ? -1 : 1) + (n.x < 0.4 ? 0 : 0), p.y + (n.y < 0.5 ? -14 : 22));
      });
      // núcleo
      const pulse = reduced ? 0 : (Math.sin(t / 600) + 1) / 2;
      ctx.strokeStyle = `hsl(${blue} / ${0.25 + pulse * 0.35})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 26 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `hsl(${line} / .9)`; ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `hsl(${green})`; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(c.x - 9, c.y - 7); ctx.lineTo(c.x, c.y + 8); ctx.lineTo(c.x + 9, c.y - 7); ctx.stroke();
    };

    const loop = (t: number) => { if (!running) return; draw(t); raf = requestAnimationFrame(loop); };
    const onVis = () => {
      running = !document.hidden && !reduced;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(loop);
    };
    const ro = new ResizeObserver(() => { resize(); draw(performance.now()); });
    ro.observe(canvas);
    resize(); draw(0);
    if (!reduced) raf = requestAnimationFrame(loop); else running = false;
    document.addEventListener("visibilitychange", onVis);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

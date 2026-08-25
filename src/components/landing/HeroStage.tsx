/**
 * HeroStage — peça central do hero da landing page.
 *
 * Substitui a antiga composição "feed de vendas + print do painel" por uma
 * representação técnica da malha de liquidação: nós conectados, pulsos
 * viajando pelas arestas e um console de autorização em tempo real.
 *
 * É puramente apresentacional — nenhum dado real é consultado aqui. Todo o
 * movimento respeita `prefers-reduced-motion`.
 */
import { memo, useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Activity, Cpu, Fingerprint, Layers, Radio, ShieldCheck } from "lucide-react";

/* --------------------------------------------------------------- conteúdo */

interface LogLine {
  readonly method: string;
  readonly path: string;
  readonly status: string;
  readonly ms: number;
}

const LOG: readonly LogLine[] = [
  { method: "POST", path: "/v1/pix/charges", status: "201", ms: 118 },
  { method: "EVT ", path: "antifraud.score", status: "ok", ms: 34 },
  { method: "EVT ", path: "charge.authorized", status: "ok", ms: 12 },
  { method: "POST", path: "/v1/webhooks/deliver", status: "200", ms: 96 },
  { method: "EVT ", path: "split.settled", status: "ok", ms: 27 },
  { method: "POST", path: "/v1/pix/charges", status: "201", ms: 131 },
  { method: "EVT ", path: "members.access", status: "ok", ms: 41 },
  { method: "POST", path: "/v1/payouts", status: "202", ms: 152 },
];

const NODES = [
  { id: "checkout", label: "Checkout", x: 8, y: 50, icon: Layers },
  { id: "risk", label: "Antifraude", x: 34, y: 18, icon: Fingerprint },
  { id: "core", label: "Core", x: 50, y: 52, icon: Cpu },
  { id: "acq", label: "Liquidação", x: 72, y: 20, icon: Radio },
  { id: "payout", label: "Saldo", x: 92, y: 54, icon: ShieldCheck },
] as const;

const EDGES = [
  ["checkout", "risk"],
  ["risk", "core"],
  ["checkout", "core"],
  ["core", "acq"],
  ["acq", "payout"],
  ["core", "payout"],
] as const;

const byId = (id: string) => NODES.find((n) => n.id === id)!;

/* ------------------------------------------------------------ subcomponentes */

/** Número que conta até o alvo quando entra na viewport. */
function Counter({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!visible || reduce) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      // easeOutExpo — desacelera de forma orgânica no final
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduce, to]);

  return (
    <span ref={ref} className="lp-mono tabular-nums">
      {value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Sparkline de latência com traço desenhando-se e ponta pulsante. */
function Sparkline() {
  const reduce = useReducedMotion();
  const pts = [14, 9, 17, 11, 20, 13, 8, 15, 7, 12, 6, 10];
  const w = 132;
  const h = 34;
  const step = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(h - p).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <circle cx={w} cy={h - pts[pts.length - 1]} r={2.6} fill="hsl(var(--primary))" className="lp-ping" />
    </svg>
  );
}

/* ------------------------------------------------------------------ stage */

export const HeroStage = memo(function HeroStage() {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);

  /* rotação/escala guiadas pelo scroll — o painel "levanta" conforme sobe */
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start 85%", "end 15%"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });
  const rotateX = useTransform(smooth, [0, 0.55], [17, 0]);
  const scale = useTransform(smooth, [0, 0.55], [0.94, 1]);
  const lift = useTransform(smooth, [0, 0.55], [46, 0]);
  const glow = useTransform(smooth, [0, 0.6], [0.25, 0.85]);

  /* paralaxe do cursor — deslocamento sutil, desligado em telas de toque */
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const tiltY = useSpring(useTransform(px, [-1, 1], [-6, 6]), { stiffness: 120, damping: 20 });
  const tiltX = useSpring(useTransform(py, [-1, 1], [4, -4]), { stiffness: 120, damping: 20 });

  /* console rolando */
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setCursor((c) => (c + 1) % LOG.length), 1500);
    return () => window.clearInterval(id);
  }, [reduce]);
  const lines = Array.from({ length: 6 }, (_, i) => LOG[(cursor + i) % LOG.length]);

  return (
    <div
      ref={wrap}
      className="lp-stage-wrap"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <motion.div aria-hidden className="lp-stage-halo" style={reduce ? undefined : { opacity: glow }} />

      <motion.div
        className="lp-stage"
        style={
          reduce
            ? undefined
            : { rotateX, scale, y: lift, rotateY: tiltY, rotateZ: 0, transformPerspective: 1600 }
        }
      >
        {/* --- topo: barra de status técnica --- */}
        <div className="lp-stage-bar">
          <span className="flex items-center gap-2">
            <span className="lp-dot" />
            <span className="lp-mono text-[10.5px] uppercase tracking-[0.16em] text-foreground/70">
              malha de liquidação · sa-east-1
            </span>
          </span>
          <span className="hidden items-center gap-4 sm:flex">
            {[["uptime", "99,99%"], ["fila", "0"], ["versão", "v2.4"]].map(([k, v]) => (
              <span key={k} className="lp-mono text-[10.5px] text-muted-foreground">
                {k} <b className="text-foreground/80">{v}</b>
              </span>
            ))}
          </span>
        </div>

        {/* --- malha animada --- */}
        <div className="lp-mesh">
          <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="lp-mesh-svg" aria-hidden>
            <defs>
              <linearGradient id="lp-edge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {EDGES.map(([a, b], i) => {
              const A = byId(a);
              const B = byId(b);
              const y1 = (A.y / 100) * 70;
              const y2 = (B.y / 100) * 70;
              const d = `M${A.x} ${y1} C ${(A.x + B.x) / 2} ${y1}, ${(A.x + B.x) / 2} ${y2}, ${B.x} ${y2}`;
              return (
                <g key={`${a}-${b}`}>
                  <path d={d} stroke="url(#lp-edge)" strokeWidth={0.35} fill="none" vectorEffect="non-scaling-stroke" />
                  {!reduce && (
                    <circle r={0.75} fill="hsl(var(--primary))">
                      <animateMotion dur={`${2.4 + i * 0.45}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="lp-mesh-nodes">
          {NODES.map(({ id, label, x, y, icon: Icon }, i) => (
            <motion.span
              key={id}
              className="lp-node"
              style={{ left: `${x}%`, top: `${y}%` }}
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="lp-node-dot">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="lp-node-label">{label}</span>
            </motion.span>
          ))}
          </div>
        </div>

        {/* --- painéis inferiores --- */}
        <div className="lp-stage-grid">
          {/* console */}
          <div className="lp-panel">
            <div className="mb-3 flex items-center justify-between">
              <span className="lp-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                stream de autorizações
              </span>
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="grid gap-[5px]">
              {lines.map((l, i) => (
                <motion.div
                  key={`${l.path}-${cursor}-${i}`}
                  className="lp-log"
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1 - i * 0.13, x: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="lp-log-m">{l.method}</span>
                  <span className="lp-log-p">{l.path}</span>
                  <span className="lp-log-s">{l.status}</span>
                  <span className="lp-log-t">{l.ms}ms</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* métricas */}
          <div className="grid gap-3">
            <div className="lp-panel">
              <span className="lp-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                latência de autorização
              </span>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-[34px] font-extrabold leading-none text-foreground">
                  <Counter to={412} />
                  <span className="ml-1 text-[14px] font-bold text-muted-foreground">ms</span>
                </p>
                <Sparkline />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="lp-panel">
                <span className="lp-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">aprovação</span>
                <p className="mt-2 text-[26px] font-extrabold leading-none text-primary">
                  <Counter to={98.7} decimals={1} suffix="%" />
                </p>
              </div>
              <div className="lp-panel">
                <span className="lp-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">liquidação</span>
                <p className="mt-2 text-[26px] font-extrabold leading-none text-foreground">D+0</p>
              </div>
            </div>
          </div>
        </div>

        <div aria-hidden className="lp-scan" />
      </motion.div>
    </div>
  );
});

export default HeroStage;

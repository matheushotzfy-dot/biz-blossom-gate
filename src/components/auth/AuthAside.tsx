/**
 * AuthAside — Painel lateral autoral da tela de acesso.
 * Visual 100% gerado em código (SVG + CSS), sem fotos ou assets de terceiros.
 * @module components/auth/AuthAside
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ShieldCheck, Zap, LineChart } from "lucide-react";

interface Pillar {
  readonly icon: typeof Zap;
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
}

const PILLARS: readonly Pillar[] = [
  {
    icon: Zap,
    kicker: "Liquidação",
    title: "Pix aprovado\nem segundos.",
    body: "Confirmação em tempo real e saldo disponível no mesmo dia, sem janela bancária.",
  },
  {
    icon: ShieldCheck,
    kicker: "Antifraude",
    title: "Cada venda\npassa pelo escudo.",
    body: "Score de risco, device fingerprint e bloqueio automático antes da captura.",
  },
  {
    icon: LineChart,
    kicker: "Operação",
    title: "Sua régua\nde faturamento.",
    body: "Métricas ao vivo, split de coprodução e saques programados em um só painel.",
  },
] as const;

const NODES = [
  { id: "checkout", label: "Checkout", x: 14, y: 22 },
  { id: "risk", label: "Antifraude", x: 50, y: 10 },
  { id: "core", label: "Core", x: 50, y: 50 },
  { id: "psp", label: "Adquirente", x: 86, y: 26 },
  { id: "ledger", label: "Ledger", x: 20, y: 78 },
  { id: "payout", label: "Saldo", x: 82, y: 76 },
] as const;

const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [2, 4], [2, 5], [3, 5], [0, 2],
];

const LOGS = [
  "POST /v1/pix/charges → 201 · 118ms",
  "risk.score=0.03 · approved",
  "webhook.delivered → seller_9f21 · 204",
  "settlement D+0 · R$ 1.480,00",
  "POST /v1/pix/charges → 201 · 96ms",
  "ledger.entry → net R$ 1.406,00",
] as const;

export function AuthAside({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  const [pillar, setPillar] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPillar((p) => (p + 1) % PILLARS.length), 6200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setLogIndex((i) => (i + 1) % LOGS.length), 2100);
    return () => window.clearInterval(id);
  }, [reduced]);

  const visibleLogs = useMemo(
    () => Array.from({ length: 3 }, (_, k) => LOGS[(logIndex + k) % LOGS.length]),
    [logIndex],
  );

  const Active = PILLARS[pillar].icon;

  return (
    <aside className={`relative overflow-hidden bg-[#050705] ${className}`} aria-hidden="true">
      {/* grade técnica */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.14) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(120% 90% at 60% 30%, #000 35%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 60% 30%, #000 35%, transparent 85%)",
        }}
      />
      {/* halo esmeralda */}
      <div className="absolute -right-24 top-[-10%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.20),transparent_62%)]" />
      <div className="absolute -left-32 bottom-[-15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.10),transparent_65%)]" />

      {/* malha de liquidação */}
      <div className="absolute inset-x-0 top-[8%] mx-auto h-[54%] w-[86%]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="aa-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(16,185,129,0.55)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.10)" />
            </linearGradient>
          </defs>
          {EDGES.map(([a, b], i) => {
            const p1 = NODES[a], p2 = NODES[b];
            const d = `M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2} ${(p1.y + p2.y) / 2 - 9} ${p2.x} ${p2.y}`;
            return (
              <g key={`${a}-${b}`}>
                <path d={d} fill="none" stroke="url(#aa-edge)" strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
                {!reduced && (
                  <circle r={0.9} fill="#34d399">
                    <animateMotion dur={`${3.4 + i * 0.45}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            );
          })}
          {NODES.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={1.6} fill="#0b1410" stroke="rgba(16,185,129,0.75)" strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
              <circle cx={n.x} cy={n.y} r={0.55} fill="#34d399" />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0">
          {NODES.map((n) => (
            <span
              key={n.id}
              className="absolute -translate-x-1/2 translate-y-2 whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-white/35"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.label}
            </span>
          ))}
        </div>
      </div>

      {/* console de eventos */}
      <div className="absolute right-10 top-[58%] w-[300px] rounded-[14px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-[2px] xl:right-14">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.26em] text-white/40">stream ao vivo</span>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-300/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ok
          </span>
        </div>
        <div className="space-y-2 font-mono text-[11px] leading-relaxed text-white/55">
          <AnimatePresence initial={false} mode="popLayout">
            {visibleLogs.map((l, i) => (
              <motion.p
                key={`${l}-${logIndex}-${i}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: i === 0 ? 1 : 0.45 - i * 0.12, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="truncate"
              >
                <span className="text-emerald-400/70">›</span> {l}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* pilar editorial */}
      <div className="absolute bottom-24 left-12 right-12 xl:left-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={pillar}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[460px]"
          >
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-emerald-300/75">
              <Active className="h-3.5 w-3.5" /> {PILLARS[pillar].kicker}
            </span>
            <p className="mt-4 whitespace-pre-line text-[30px] font-light leading-[1.12] tracking-[-0.03em] text-white/95 xl:text-[36px]">
              {PILLARS[pillar].title}
            </p>
            <p className="mt-3 max-w-[400px] text-[13.5px] leading-relaxed text-white/45">{PILLARS[pillar].body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex items-center gap-2">
          {PILLARS.map((p, i) => (
            <span key={p.kicker} className="h-[2px] w-10 overflow-hidden rounded-full bg-white/12">
              {i === pillar && (
                <motion.span
                  className="block h-full bg-emerald-400/80"
                  initial={{ width: reduced ? "100%" : 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: reduced ? 0 : 6.2, ease: "linear" }}
                />
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-10 left-12 right-12 flex items-center justify-between border-t border-white/8 pt-5 text-[11px] uppercase tracking-[0.24em] text-white/35 xl:left-14">
        <span>uptime 99,98%</span>
        <span>pix · cartão · boleto</span>
        <span>saques d+0</span>
      </div>
    </aside>
  );
}

export default AuthAside;

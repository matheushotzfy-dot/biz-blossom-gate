import { useEffect, useRef } from "react";
import { Check, Flag, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AwardItem } from "./awards-data";
import { goalFraction, goalPercent, maskedBRL, railFraction, type PieceState } from "./awardMeta";

interface JourneyProps {
  awards: AwardItem[];
  states: PieceState[];
  index: number;
  revenue: number;
  revenueKnown: boolean;
  hidden: boolean;
  unlocked: number;
  onSelect: (index: number) => void;
}

function caption(state: PieceState, nextId: string | undefined, id: string, pct: number): { text: string; strong?: boolean } {
  switch (state.kind) {
    case "ready": return { text: "Pronta para resgatar", strong: true };
    case "active": return { text: "Resgate em andamento", strong: true };
    case "delivered": return { text: "Entregue" };
    case "cancelled": return { text: "Resgate cancelado" };
    default: return { text: nextId === id && pct > 0 ? `${pct}% da meta` : "Selada" };
  }
}

/** A jornada inteira numa linha: um ponto inicial e uma peça por marco, com a linha preenchida até onde você chegou. */
export function Journey({ awards, states, index, revenue, revenueKnown, hidden, unlocked, onSelect }: JourneyProps) {
  const n = awards.length;
  const scroller = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const pill = useRef<HTMLSpanElement>(null);
  const fill = revenueKnown ? railFraction(awards.map((a) => a.value), revenue) : 0;
  const nextId = awards.find((a) => revenue < a.value)?.id;
  const edge = `${(0.5 / (n + 1)) * 100}%`;

  // Mantém a peça escolhida à vista na rolagem horizontal, sem mexer na rolagem da página.
  // Se a etiqueta com o seu faturamento ficaria cortada na borda, desloca o mínimo para ela caber,
  // desde que a peça escolhida continue inteira na tela.
  useEffect(() => {
    const box = scroller.current;
    const el = nodes.current[index];
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const rel = (r: DOMRect) => ({ left: r.left - b.left + box.scrollLeft, right: r.right - b.left + box.scrollLeft });
    const sel = rel(el.getBoundingClientRect());
    const view = box.clientWidth;
    const gap = 16;
    let left = (sel.left + sel.right) / 2 - view / 2;
    const pillEl = pill.current;
    if (pillEl) {
      const pl = rel(pillEl.getBoundingClientRect());
      if (pl.right > left + view - gap) {
        const next = pl.right + gap - view;
        if (sel.left >= next + 8) left = next;
      } else if (pl.left < left + gap) {
        const next = pl.left - gap;
        if (sel.right <= next + view - 8) left = next;
      }
    }
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: Math.max(left, 0), behavior: reduce ? "auto" : "smooth" });
  }, [index, revenueKnown]);

  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="jornada-titulo">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 id="jornada-titulo" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">Sua jornada</h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">Escolha uma peça para vê-la no palco.</p>
        </div>
        <p className="vp-num text-[14.5px] font-semibold text-muted-foreground">{unlocked} de {n} conquistadas</p>
      </div>

      <div ref={scroller} className="scrollbar-none -mx-5 mt-5 overflow-x-auto px-5 pb-2 pt-9 sm:-mx-7 sm:px-7">
        <div className="relative" style={{ minWidth: `${(n + 1) * 132}px` }}>
          {/* Linha de fundo e linha preenchida: vão do centro do ponto inicial ao centro da última peça. */}
          <div aria-hidden className="absolute top-[7px] h-[3px] rounded-full bg-muted" style={{ left: edge, right: edge }}>
            <div className="relative h-full">
              <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${fill * 100}%` }} />
              {revenueKnown && (
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${fill * 100}%` }}>
                  <span ref={pill} className="absolute -top-[34px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-primary-foreground">
                    {maskedBRL(revenue, hidden)}
                  </span>
                  <span className="block h-[17px] w-[17px] rounded-full bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.2)]" />
                </span>
              )}
            </div>
          </div>

          <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n + 1}, minmax(0, 1fr))` }}>
            <li className="flex flex-col items-center px-2 text-center">
              <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-card text-muted-foreground shadow-[inset_0_0_0_2px_hsl(var(--muted-foreground)/0.4)]"><Flag className="h-2.5 w-2.5" aria-hidden /></span>
              <p className="mt-5 text-[14px] font-bold text-foreground">Início</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Sua primeira venda</p>
            </li>
            {awards.map((a, i) => {
              const s = states[i];
              const reached = s.unlocked;
              const cap = caption(s, nextId, a.id, revenueKnown ? goalPercent(a.value, revenue) : 0);
              const lit = revenueKnown && s.kind === "sealed" && !!a.image ? goalFraction(a.value, revenue) : 0;
              return (
                <li key={a.id} className="flex flex-col items-center px-2">
                  <span
                    aria-hidden
                    className={cn("relative z-[1] grid h-[17px] w-[17px] place-items-center rounded-full", reached ? "bg-primary text-primary-foreground" : "bg-card shadow-[inset_0_0_0_2px_hsl(var(--muted-foreground)/0.4)]")}
                  >
                    {reached && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                  </span>
                  <button
                    type="button"
                    ref={(el) => { nodes.current[i] = el; }}
                    onClick={() => onSelect(i)}
                    aria-current={i === index ? "true" : undefined}
                    aria-label={`${a.title}, ${a.label}. ${cap.text}`}
                    className="vw-node mt-3 block w-full text-center"
                    style={{ ["--glow" as string]: a.glow }}
                  >
                    <span className="vw-thumb" data-sealed={s.kind === "sealed"}>
                      {a.image ? <img src={a.image} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className="absolute inset-0 grid place-items-center text-[15px] font-extrabold text-white/80">{a.label}</span>}
                      {lit > 0 && <img src={a.image ?? undefined} alt="" aria-hidden decoding="async" draggable={false} className="vw-lit" style={{ clipPath: `inset(${(1 - lit) * 100}% 0 0 0)` }} />}
                      {s.kind === "sealed" && <span aria-hidden className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white/85"><Lock className="h-3 w-3" /></span>}
                    </span>
                    <span className="mt-2.5 block font-heading text-[15px] font-extrabold tracking-[-0.02em] text-foreground">{a.label}</span>
                    <span className={cn("mt-0.5 block text-[13px] leading-snug", cap.strong ? "font-semibold text-primary" : "text-muted-foreground")}>{cap.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

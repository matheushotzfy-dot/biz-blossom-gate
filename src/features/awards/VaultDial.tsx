import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AWARDS } from "./awards-data";

interface VaultDialProps {
  activeIndex: number;
  revenue: number;
  progress: number;
  onSelect: (index: number) => void;
}

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Roda orbital: cada marco é um nó posicionado em um círculo.
 * O arco interno representa o progresso real do faturamento.
 */
export function VaultDial({ activeIndex, revenue, progress, onSelect }: VaultDialProps) {
  const reduceMotion = useReducedMotion();
  const total = AWARDS.length;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[330px] select-none">
      <div aria-hidden className={cn("absolute inset-6 rounded-full border border-awards-steel/15", !reduceMotion && "venx-orbit-spin")}>
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-awards-accent" />
      </div>

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="hsl(var(--awards-steel) / 0.14)" strokeWidth="1.5" />
        <motion.circle
          cx="50" cy="50" r={RADIUS} fill="none"
          stroke="hsl(var(--awards-accent))" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(progress, 100) / 100) }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute inset-0">
        {AWARDS.map((award, index) => {
          const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
          const unlocked = revenue >= award.value;
          const active = index === activeIndex;
          const Icon = award.icon;
          return (
            <button
              key={award.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={active ? "step" : undefined}
              aria-label={`${award.label} — ${award.title}`}
              style={{ left: `${50 + Math.cos(angle) * RADIUS}%`, top: `${50 + Math.sin(angle) * RADIUS}%` }}
              className={cn(
                "absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-220 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-awards-accent",
                active
                  ? "scale-110 border-awards-accent bg-awards-accent text-awards-obsidian"
                  : unlocked
                    ? "border-awards-accent/45 bg-awards-surface text-awards-accent hover:scale-105"
                    : "border-awards-steel/20 bg-awards-surface text-awards-steel/60 hover:scale-105",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className={cn("absolute -bottom-5 font-mono text-[9px] font-semibold tabular-nums", active ? "text-awards-accent" : "text-awards-steel/70")}>{award.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-awards-steel">Progresso</span>
        <span className="mt-1 font-display text-4xl font-bold tabular-nums text-awards-ink">{Math.round(progress)}%</span>
        <span className="mt-1 flex items-center gap-1 font-mono text-[9px] uppercase text-awards-steel">
          {revenue >= AWARDS[activeIndex].value ? <Check className="h-3 w-3 text-awards-accent" /> : <Lock className="h-3 w-3" />}
          {AWARDS[activeIndex].tier}
        </span>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Gift, Lock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AWARDS, formatMoney } from "./awards-data";

interface ArtifactViewerProps {
  index: number;
  revenue: number;
  claimed: boolean;
  onClaim: () => void;
  onShare: () => void;
}

/** Visor 3D do artefato com paralaxe pelo ponteiro. */
export function ArtifactViewer({ index, revenue, claimed, onClaim, onShare }: ArtifactViewerProps) {
  const reduceMotion = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const award = AWARDS[index];
  const unlocked = revenue >= award.value;
  const missing = Math.max(award.value - revenue, 0);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    setTilt({
      y: ((event.clientX - rect.left) / rect.width - 0.5) * 16,
      x: -((event.clientY - rect.top) / rect.height - 0.5) * 14,
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div
        ref={frame}
        onPointerMove={handleMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="relative mx-auto w-full max-w-[430px] [perspective:1200px]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={award.id}
            initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: "transform 220ms ease-out" }}
          >
            <span aria-hidden className="absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-awards-accent/20 blur-[80px]" />
            <img
              src={award.image}
              alt={`Artefato ${award.title}`}
              width={430}
              height={430}
              loading="lazy"
              className={cn("relative z-10 mx-auto aspect-square w-full object-contain transition-[filter,opacity] duration-300", !unlocked && "opacity-70 grayscale")}
            />
            {!unlocked && (
              <span className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-awards-steel/20 bg-awards-obsidian/90 px-3 py-1.5 font-mono text-[9px] uppercase text-awards-steel">
                <Lock className="h-3 w-3" /> Selado · faltam {formatMoney(missing)}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-awards-accent">Nível {award.roman}</span>
          <span className="h-px flex-1 bg-awards-steel/15" />
          <span className={cn("flex items-center gap-1.5 font-mono text-[9px] uppercase", unlocked ? "text-awards-accent" : "text-awards-steel")}>
            {unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {unlocked ? "Conquistado" : "Bloqueado"}
          </span>
        </div>

        <h2 className="relative mt-4 inline-block overflow-hidden font-display text-3xl font-bold leading-tight text-awards-ink sm:text-4xl">
          {award.title}
          <span aria-hidden className="venx-sheen pointer-events-none absolute inset-0" />
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-awards-steel">{award.description}</p>
        <blockquote className="mt-5 border-l-2 border-awards-accent pl-4 font-display text-base text-awards-ink">“{award.phrase}”</blockquote>

        <ul className="mt-5 flex flex-wrap gap-2">
          {award.rewards.map((reward) => (
            <li key={reward} className="rounded-full border border-awards-steel/20 px-3 py-1 font-mono text-[10px] uppercase text-awards-steel">{reward}</li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={onClaim}
            disabled={!unlocked || claimed}
            className="h-12 flex-1 rounded-full bg-awards-accent font-semibold text-awards-obsidian hover:bg-awards-accent/90 active:scale-[0.98]"
          >
            <Gift />{claimed ? "Resgate registrado" : unlocked ? "Resgatar artefato" : `Meta ${award.label}`}
          </Button>
          <Button variant="outline" onClick={onShare} className="h-12 rounded-full border-awards-steel/25 bg-transparent text-awards-ink hover:bg-awards-accent/10 sm:w-12 sm:px-0" aria-label="Compartilhar marco">
            <Share2 />
          </Button>
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase text-awards-steel/60">Série {award.reference} · edição verificada VENXPAY</p>
      </div>
    </div>
  );
}

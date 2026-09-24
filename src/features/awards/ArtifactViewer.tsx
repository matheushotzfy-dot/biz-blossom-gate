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
    <div className="grid min-h-[430px] items-center gap-2 px-5 py-2 sm:px-8 lg:min-h-[470px] lg:grid-cols-[minmax(420px,1.35fr)_minmax(300px,0.65fr)] lg:gap-8 lg:px-12">
      <div
        ref={frame}
        onPointerMove={handleMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="awards-stage relative mx-auto flex min-h-[310px] w-full max-w-[700px] items-center justify-center [perspective:1400px] sm:min-h-[390px] lg:min-h-[450px]"
      >
        <div aria-hidden className="awards-stage-light absolute inset-x-[8%] bottom-[7%] h-[42%]" />
        <div aria-hidden className="awards-stage-floor absolute bottom-[4%] left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-[50%]" />
        <AnimatePresence mode="wait">
          <motion.div
            key={award.id}
            initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex w-full items-center justify-center"
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: "transform 220ms ease-out" }}
          >
            <img
              src={award.image}
              alt={`Artefato ${award.title}`}
              width={620}
              height={520}
              loading="eager"
              className={cn("relative z-10 mx-auto h-[300px] w-full object-contain sm:h-[390px] lg:h-[445px]", !unlocked && "grayscale opacity-70")}
            />
            {!unlocked && (
              <span className="absolute inset-x-0 bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-md border border-awards-steel/20 bg-awards-surface px-3 py-1.5 text-[9px] font-medium uppercase text-awards-steel">
                <Lock className="h-3 w-3" /> Selado · faltam {formatMoney(missing)}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-awards-steel/15 pb-5 pt-5 lg:border-l lg:border-t-0 lg:pb-0 lg:pl-8 lg:pt-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-awards-accent">Nível {award.roman}</span>
          <span className="h-px flex-1 bg-awards-steel/15" />
          <span className={cn("flex items-center gap-1.5 text-[9px] font-medium uppercase", unlocked ? "text-awards-accent" : "text-awards-steel")}>
            {unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {unlocked ? "Conquistado" : "Bloqueado"}
          </span>
        </div>

        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-awards-steel">{award.tier} · {award.label} em vendas</p>
        <h2 className="relative mt-2 inline-block overflow-hidden font-display text-3xl font-semibold leading-tight text-awards-ink sm:text-4xl">
          {award.title}
          <span aria-hidden className="venx-sheen pointer-events-none absolute inset-0" />
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-awards-steel">{award.description}</p>
        <blockquote className="mt-4 border-l-2 border-awards-accent pl-4 text-sm font-medium text-awards-ink">“{award.phrase}”</blockquote>

        <ul className="mt-5 flex flex-wrap gap-2">
          {award.rewards.map((reward) => (
            <li key={reward} className="rounded-md border border-awards-steel/20 px-3 py-1 text-[10px] font-medium text-awards-steel">{reward}</li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={onClaim}
            disabled={!unlocked || claimed}
            className="h-10 flex-1 rounded-lg bg-awards-accent font-semibold text-awards-accent-foreground hover:bg-awards-accent/90 active:scale-[0.98]"
          >
            <Gift />{claimed ? "Resgate registrado" : unlocked ? "Resgatar artefato" : `Meta ${award.label}`}
          </Button>
          <Button variant="outline" onClick={onShare} className="h-10 rounded-lg border-awards-steel/25 bg-transparent text-awards-ink hover:bg-awards-accent/10 sm:w-10 sm:px-0" aria-label="Compartilhar marco">
            <Share2 />
          </Button>
        </div>
        <p className="mt-3 text-[9px] font-medium uppercase tracking-[0.08em] text-awards-steel/60">{"\n"}</p>
      </div>
    </div>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Gift, Lock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AWARDS, formatMoney } from "./awards-data";

interface AwardsStageProps {
  activeIndex: number;
  revenue: number;
  claimed: boolean;
  onSelect: (index: number) => void;
  onClaim: () => void;
  onShare: () => void;
}

export function AwardsStage({ activeIndex, revenue, claimed, onSelect, onClaim, onShare }: AwardsStageProps) {
  const reduceMotion = useReducedMotion();
  const award = AWARDS[activeIndex];
  const previous = AWARDS[activeIndex - 1];
  const next = AWARDS[activeIndex + 1];
  const unlocked = revenue >= award.value;
  const progress = Math.min((revenue / award.value) * 100, 100);
  const AwardIcon = award.icon;

  return (
    <section className="relative isolate overflow-hidden border border-awards-steel/15 bg-awards-obsidian text-awards-ink lg:min-h-[660px]" onKeyDown={(event) => {
      if (event.key === "ArrowLeft" && previous) onSelect(activeIndex - 1);
      if (event.key === "ArrowRight" && next) onSelect(activeIndex + 1);
    }}>
      <div aria-hidden className="awards-scan-grid absolute inset-0 opacity-70" />
      <header className="relative z-10 flex items-center justify-between border-b border-awards-steel/15 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3"><span className="h-2 w-2 bg-awards-accent" /><span className="font-mono text-[10px] uppercase text-awards-steel">VENXPAY / Artifact Lab</span></div>
        <span className="font-mono text-[10px] text-awards-steel">{String(activeIndex + 1).padStart(2, "0")} / {String(AWARDS.length).padStart(2, "0")}</span>
      </header>

      <div className="relative z-10 grid min-h-[575px] lg:grid-cols-[minmax(0,1.3fr)_minmax(310px,.7fr)]">
        <div className="relative flex min-h-[410px] items-center justify-center overflow-hidden border-b border-awards-steel/15 lg:border-b-0 lg:border-r">
          <AnimatePresence mode="wait">
            <motion.div key={award.id} initial={reduceMotion ? false : { opacity: 0, scale: .88, rotateY: -16 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .9, rotateY: 16 }} transition={{ duration: .36, ease: [0.16, 1, 0.3, 1] }} className="relative flex h-full w-full items-center justify-center p-10 sm:p-16">
              <span aria-hidden className="absolute h-[58%] w-px bg-awards-accent/25" />
              <span aria-hidden className="absolute h-px w-[58%] bg-awards-accent/25" />
              <span aria-hidden className="absolute h-[300px] w-[300px] rounded-full bg-awards-accent/10 blur-[90px]" />
              <img src={award.image} alt={award.title} className={cn("relative z-10 max-h-[430px] w-full max-w-[520px] object-contain transition-[filter,opacity] duration-300", !unlocked && "opacity-80 saturate-50")} />
              <span className="absolute bottom-5 left-5 font-mono text-[9px] uppercase text-awards-steel/60">Object {award.reference} · Verified edition</span>
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-x-4 bottom-6 z-20 flex justify-between">
            <Button variant="outline" size="icon" aria-label="Premiação anterior" onClick={() => previous && onSelect(activeIndex - 1)} disabled={!previous} className="rounded-none border-awards-steel/20 bg-awards-obsidian text-awards-ink hover:bg-awards-accent/10"><ArrowLeft /></Button>
            <Button variant="outline" size="icon" aria-label="Próxima premiação" onClick={() => next && onSelect(activeIndex + 1)} disabled={!next} className="rounded-none border-awards-steel/20 bg-awards-obsidian text-awards-ink hover:bg-awards-accent/10"><ArrowRight /></Button>
          </div>
        </div>


        <AnimatePresence mode="wait">
          <motion.div key={award.id} initial={reduceMotion ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -16 }} transition={{ duration: .3 }} className="flex flex-col justify-between p-6 sm:p-8">
            <div>
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-awards-accent">Nível {award.roman} · {award.tier}</span><span className={cn("inline-flex items-center gap-1.5 font-mono text-[9px] uppercase", unlocked ? "text-awards-accent" : "text-awards-steel")} >{unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{unlocked ? "Conquistado" : "Selado"}</span></div>
              <h1 className="mt-8 font-display text-4xl font-bold leading-[1.02] sm:text-5xl">{award.title}</h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-awards-steel">{award.description}</p>
              <blockquote className="mt-8 border-l border-awards-accent pl-4 font-display text-base font-medium">“{award.phrase}”</blockquote>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">{award.rewards.map((reward) => <span key={reward} className="font-mono text-[10px] uppercase text-awards-steel before:mr-2 before:text-awards-accent before:content-['+']">{reward}</span>)}</div>
            </div>
            <div className="mt-10 border-t border-awards-steel/15 pt-6">
              <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[9px] uppercase text-awards-steel">{unlocked ? "Status do artefato" : "Falta para desbloquear"}</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{unlocked ? "Liberado" : formatMoney(Math.max(award.value - revenue, 0))}</p></div><span className="font-mono text-xs text-awards-accent">{progress.toFixed(0)}%</span></div>
              <progress className="awards-progress mt-4 h-1 w-full" value={progress} max={100} aria-label={`Progresso até ${award.label}`} />
              <div className="mt-6 grid grid-cols-[1fr_auto] gap-2"><Button onClick={onClaim} disabled={!unlocked || claimed} className="h-12 rounded-none bg-awards-accent text-awards-obsidian hover:bg-awards-accent/90"><Gift />{claimed ? "Resgate registrado" : unlocked ? "Solicitar peça" : `Meta ${award.label}`}</Button><Button variant="outline" size="icon" onClick={onShare} aria-label="Compartilhar marco" className="h-12 w-12 rounded-none border-awards-steel/20 text-awards-ink"><Share2 /></Button></div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
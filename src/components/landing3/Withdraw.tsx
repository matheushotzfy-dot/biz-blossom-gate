/** Demonstração em loop de um saque instantâneo via PIX (ilustração). */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowDownToLine, CheckCircle2, Loader2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SectionHead, SpotCard, brl } from "./bits";

type Phase = "idle" | "processing" | "done";
const PHASES: Record<Phase, string> = { idle: "Pronto para sacar", processing: "Enviando via PIX", done: "Recebido na sua conta" };

export function Withdraw() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [phase, setPhase] = useState<Phase>(reduce ? "done" : "idle");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    let start = 0;
    let raf = 0;
    const timers: number[] = [];
    const cycle = () => {
      setPhase("idle"); setElapsed(0);
      timers.push(window.setTimeout(() => {
        setPhase("processing"); start = performance.now();
        const tick = (now: number) => { setElapsed((now - start) / 1000); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }, 1400));
      timers.push(window.setTimeout(() => { cancelAnimationFrame(raf); setElapsed(2.8); setPhase("done"); }, 4200));
      timers.push(window.setTimeout(cycle, 7600));
    };
    cycle();
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [inView, reduce]);

  return (
    <section id="saque" className="vx3-section">
      <div className="vx3-shell vx3-split">
        <SectionHead
          kicker="03 · Saque"
          title={<>Saque <em>instantâneo</em>. Seu dinheiro, na hora.</>}
          text="Vendeu, sacou. O valor sai do seu saldo direto para a sua chave PIX, sem esperar dias para ver o resultado."
        />
        <Reveal>
          <div ref={ref}>
            <SpotCard tilt={8} className="vx3-panel vx3-withdraw">
              <div className="flex items-center justify-between">
                <span className="vx3-mono">Saldo disponível</span>
                <span className="vx3-timer vx3-num"><Timer aria-hidden />{elapsed.toFixed(1)}s</span>
              </div>
              <strong className="vx3-withdraw-value vx3-num">{brl(12480)}</strong>
              <div className="vx3-withdraw-track" aria-hidden>
                <motion.i
                  animate={{ width: phase === "idle" ? "0%" : phase === "processing" ? "72%" : "100%" }}
                  transition={{ duration: phase === "processing" ? 2.6 : 0.4, ease: "easeInOut" }}
                />
              </div>
              <div className={cn("vx3-withdraw-btn", phase === "done" && "is-done")} aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={phase} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {phase === "idle" && <ArrowDownToLine aria-hidden />}
                    {phase === "processing" && <Loader2 className="animate-spin" aria-hidden />}
                    {phase === "done" && <CheckCircle2 aria-hidden />}
                    {PHASES[phase]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <dl className="vx3-withdraw-meta">
                <div><dt>Destino</dt><dd>Chave PIX · CPF</dd></div>
                <div><dt>Método</dt><dd>PIX instantâneo</dd></div>
              </dl>
            </SpotCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

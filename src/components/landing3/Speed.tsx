/** Linha do tempo da venda conduzida pelo scroll (ilustração de velocidade). */
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { Banknote, CreditCard, ShieldCheck, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHead } from "./bits";

interface Step { time: string; title: string; text: string; icon: LucideIcon; }

const STEPS: readonly Step[] = [
  { time: "00:00", title: "Cliente paga", text: "PIX ou cartão em um checkout leve, pensado para converter no celular.", icon: CreditCard },
  { time: "00:02", title: "Gateway aprova", text: "Roteamento entre adquirências exclusivas para buscar a melhor aprovação.", icon: ShieldCheck },
  { time: "00:03", title: "Saldo na conta", text: "A venda aparece no painel com o valor líquido já calculado.", icon: Wallet },
  { time: "00:05", title: "Saque instantâneo", text: "Você solicita e o dinheiro segue via PIX para a sua conta.", icon: Banknote },
];

export function Speed() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const [active, setActive] = useState(reduce ? STEPS.length - 1 : -1);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    setActive(v <= 0.02 ? -1 : Math.min(STEPS.length - 1, Math.floor(v * STEPS.length)));
  });

  return (
    <section id="velocidade" className="vx3-section">
      <div className="vx3-shell">
        <SectionHead
          kicker="01 · Velocidade"
          title={<>Da compra ao saque em <em>segundos</em>.</>}
          text="Cada etapa foi desenhada para tirar atrito do caminho do seu dinheiro."
        />
        <div ref={ref} className="vx3-speed">
          <div className="vx3-speed-rail" aria-hidden>
            <motion.i style={reduce ? { scaleY: 1 } : { scaleY: progress }} />
          </div>
          <ol>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className={cn("vx3-speed-step", i <= active && "is-on")}>
                  <span className="vx3-speed-node"><Icon aria-hidden /></span>
                  <span className="vx3-speed-time vx3-num">{step.time}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="vx3-footnote">Tempos ilustrativos de uma venda típica.</p>
        </div>
      </div>
    </section>
  );
}

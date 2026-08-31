/**
 * OperationScene — o painel em operação, em camadas com parallax.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Banknote, BarChart3, Boxes, Gift, Users, Zap } from "lucide-react";
import { LiveConsole } from "./LiveConsole";
import { Reveal, SectionHead } from "./parts";

const CAPABILITIES = [
  { icon: Zap, title: "Saque no mesmo dia", copy: "Solicite pelo painel e receba via Pix em minutos — inclusive fim de semana e feriado." },
  { icon: Users, title: "Afiliados e coprodução", copy: "Comissões divididas no exato evento de aprovação, sem repasse manual." },
  { icon: BarChart3, title: "Leitura em tempo real", copy: "Faturamento, aprovação, reembolso e chargeback atualizados a cada transação." },
  { icon: Boxes, title: "Área de membros inclusa", copy: "Módulos, aulas e certificados liberados no segundo em que o pagamento entra." },
  { icon: Banknote, title: "Antecipação sob demanda", copy: "Transforme recebíveis de cartão em saldo disponível quando você precisar." },
  { icon: Gift, title: "Premiações por marco", copy: "Placas físicas e reconhecimento a cada nova faixa de faturamento alcançada." },
];

export function OperationScene() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.4 });
  const yBack = useTransform(smooth, [0, 1], [70, -70]);
  const yFront = useTransform(smooth, [0, 1], [-40, 40]);

  return (
    <section id="plataforma" ref={ref} className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0 venx-mesh opacity-30" />
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          kicker="Operação"
          title={<>O painel não mostra o passado. Ele mostra agora.</>}
          copy="Tudo que acontece na sua operação chega ao painel no mesmo instante: venda aprovada, saldo liberado, reembolso solicitado, comissão paga."
          center
        />

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div style={reduce ? undefined : { y: yBack, willChange: "transform" }}>
            <LiveConsole />
          </motion.div>

          <motion.div
            style={reduce ? undefined : { y: yFront, willChange: "transform" }}
            className="grid gap-3 sm:grid-cols-2"
          >
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.title} delay={i * 0.05}>
                <article className="venx-panel group h-full p-5 transition-colors duration-300 hover:border-primary/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                    <cap.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold text-foreground">{cap.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.65] text-muted-foreground">{cap.copy}</p>
                </article>
              </Reveal>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

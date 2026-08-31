/**
 * ConsoleScene — a tela real do gateway em destaque, com legendas que trocam
 * conforme o scroll avança. O painel fica travado (sticky) enquanto as
 * capacidades são apresentadas.
 */
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { GatewayWindow } from "./device/GatewayWindow";

const CAPS = [
  {
    title: "Painel que responde na hora",
    copy: "Faturamento, aprovações, ticket médio e conversão recalculados em tempo real, sem recarregar a página.",
  },
  {
    title: "Financeiro sem caixa preta",
    copy: "Saldo disponível, a liberar, reembolsos e MEDs no mesmo lugar — com extrato por lançamento.",
  },
  {
    title: "Operação inteira em um lugar",
    copy: "Produtos, afiliados, coprodução, área de membros, API e webhooks integrados ao mesmo núcleo.",
  },
];

export function ConsoleScene() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const rotate = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [7, -3]);
  const scale = useTransform(scrollYProgress, [0, 0.4, 1], reduce ? [1, 1, 1] : [0.94, 1, 0.97]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = v < 0.36 ? 0 : v < 0.7 ? 1 : 2;
    setActive((prev) => (prev === next ? prev : next));
  });

  return (
    <section ref={ref} id="painel" className="relative h-[280vh]">
      <div className="sticky top-0 flex min-h-dvh items-center overflow-hidden py-16">
        <div className="pointer-events-none absolute inset-0 venx-vignette opacity-60" />
        <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <span className="venx-kicker">a tela real</span>
            <h2 className="mt-5 text-[32px] font-extrabold text-foreground sm:text-[46px]">
              Nada de mockup.<br />Esse é o painel.
            </h2>
            <div className="mt-9 space-y-1">
              {CAPS.map((cap, i) => (
                <button
                  type="button"
                  key={cap.title}
                  onClick={() => setActive(i)}
                  className={cn(
                    "block w-full border-l pl-5 py-3 text-left transition-colors duration-300",
                    active === i ? "border-primary" : "border-border",
                  )}
                >
                  <h3
                    className={cn(
                      "text-[17px] font-bold transition-colors duration-300",
                      active === i ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {cap.title}
                  </h3>
                  <motion.p
                    animate={{ opacity: active === i ? 1 : 0.35, height: "auto" }}
                    className="mt-1.5 max-w-[44ch] text-[14px] leading-[1.7] text-muted-foreground"
                  >
                    {cap.copy}
                  </motion.p>
                </button>
              ))}
            </div>
          </div>

          <motion.div style={{ rotate, scale }} className="venx-stage">
            <GatewayWindow />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

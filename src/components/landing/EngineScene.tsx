/**
 * EngineScene — cena sticky do motor de pagamento.
 * Enquanto a seção está travada, uma venda percorre checkout → antifraude →
 * autorização → split → liquidação, etapa a etapa, conforme o progresso do scroll.
 */
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { CircuitBoard, Fingerprint, Landmark, ShieldCheck, Split } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHead } from "./parts";

const STAGES = [
  { icon: CircuitBoard, name: "Checkout", detail: "Dados capturados e tokenizados no navegador", latency: "38 ms" },
  { icon: Fingerprint, name: "Identidade", detail: "CPF, dispositivo, IP e velocidade cruzados", latency: "64 ms" },
  { icon: ShieldCheck, name: "Autorização", detail: "Roteamento inteligente entre adquirentes", latency: "212 ms" },
  { icon: Split, name: "Split", detail: "Afiliado e coprodutor creditados no mesmo evento", latency: "9 ms" },
  { icon: Landmark, name: "Liquidação", detail: "Saldo disponível e saque liberado via Pix", latency: "instantâneo" },
] as const;

export function EngineScene() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.35 });
  const fill = useTransform(smooth, [0.05, 0.95], [0, 1]);
  const pulseX = useTransform(smooth, [0.05, 0.95], ["0%", "100%"]);

  useMotionValueEvent(smooth, "change", (v) => {
    const idx = Math.min(STAGES.length - 1, Math.max(0, Math.floor((v - 0.04) * STAGES.length / 0.92)));
    setActive(idx);
  });

  return (
    <section id="motor" ref={ref} className="relative h-[240vh]">
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 venx-mesh opacity-40" />
        <div className="mx-auto w-full max-w-6xl px-5">
          <SectionHead
            kicker="Motor de pagamento"
            title={<>Uma venda atravessa cinco camadas antes de virar saldo</>}
            copy="Cada etapa é executada por um serviço próprio, com timeout, retentativa e trilha de auditoria. Você vê o caminho inteiro — não apenas o resultado."
          />

          {/* trilha */}
          <div className="relative mt-16 hidden md:block">
            <div className="venx-rail">
              <motion.div className="venx-rail-fill" style={{ scaleX: reduce ? 1 : fill }} />
              {!reduce && (
                <motion.span
                  aria-hidden
                  style={{ left: pulseX }}
                  className="absolute -top-[5px] h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-primary shadow-[0_0_22px_6px_hsl(var(--primary)/0.45)]"
                />
              )}
            </div>

            <div className="mt-8 grid grid-cols-5 gap-4">
              {STAGES.map((stage, i) => {
                const on = i <= active;
                return (
                  <div key={stage.name} className="flex flex-col items-start">
                    <span className="venx-node" data-on={on}>
                      <stage.icon className="h-5 w-5" />
                    </span>
                    <p
                      className={cn(
                        "mt-4 text-[14px] font-bold transition-colors duration-500",
                        on ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {stage.name}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-[1.6] text-muted-foreground">{stage.detail}</p>
                    <p
                      className={cn(
                        "num mt-3 text-[11px] transition-colors duration-500",
                        on ? "text-primary" : "text-muted-foreground/50",
                      )}
                    >
                      {stage.latency}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* versão mobile — lista vertical simples, mesma hierarquia */}
          <div className="mt-12 space-y-3 md:hidden">
            {STAGES.map((stage, i) => (
              <div
                key={stage.name}
                className={cn(
                  "venx-panel flex gap-4 p-4 transition-colors duration-500",
                  i <= active ? "border-primary/40" : "",
                )}
              >
                <span className="venx-node h-11 w-11 shrink-0" data-on={i <= active}>
                  <stage.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-foreground">{stage.name}</p>
                  <p className="mt-1 text-[12.5px] leading-[1.6] text-muted-foreground">{stage.detail}</p>
                  <p className="num mt-2 text-[11px] text-primary">{stage.latency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

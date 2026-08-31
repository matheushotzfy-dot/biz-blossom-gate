/**
 * CheckoutDemo — demonstração compacta do checkout. A etapa Pix é concluída
 * uma única vez ao entrar na viewport. Nada aqui toca o checkout real.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, QrCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Dados do cliente", "Pix gerado", "Pagamento confirmado"];

export function CheckoutDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setStage(2);
      return;
    }
    const t1 = window.setTimeout(() => setStage(1), 700);
    const t2 = window.setTimeout(() => setStage(2), 2100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [inView, reduce]);

  return (
    <section id="checkout" className="vx-cv relative py-28 sm:py-36">
      <div className="mx-auto max-w-[1280px] px-5">
        <span className="vx-mono">checkout</span>
        <h2 className="mt-5 max-w-[18ch] text-[38px] font-extrabold text-foreground sm:text-[58px]">
          Do clique ao confirmado em segundos
        </h2>

        <div ref={ref} className="mx-auto mt-14 w-full max-w-[460px]">
          {/* trilha de etapas */}
          <div className="flex items-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s} className="flex-1">
                <div
                  className={cn(
                    "h-[3px] w-full rounded-full transition-colors duration-500",
                    i <= stage ? "bg-primary" : "bg-border",
                  )}
                />
                <p
                  className={cn(
                    "mt-2 text-[10.5px] font-semibold transition-colors duration-500",
                    i <= stage ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s}
                </p>
              </div>
            ))}
          </div>

          <div className="vx-frame mt-6 rounded-[8px] p-6">
            <p className="text-[12px] text-muted-foreground">Mentoria Escala 6 em 7</p>
            <p className="vx-num mt-1 text-[30px] font-extrabold text-foreground">R$ 1.497,00</p>

            <div className="mt-6 space-y-2.5">
              {["Nome completo", "E-mail", "CPF"].map((f, i) => (
                <div
                  key={f}
                  className="flex items-center justify-between border border-border px-3.5 py-3 text-[12.5px]"
                >
                  <span className="text-muted-foreground">{f}</span>
                  <motion.span
                    initial={reduce ? false : { opacity: 0 }}
                    animate={inView ? { opacity: 1 } : undefined}
                    transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
                    className="text-primary"
                  >
                    <Check className="h-4 w-4" />
                  </motion.span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 border border-border p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center border border-border text-primary">
                {stage >= 2 ? <ShieldCheck className="h-6 w-6" /> : <QrCode className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-foreground">
                  {stage >= 2 ? "Pagamento confirmado" : stage >= 1 ? "Pix gerado" : "Gerando cobrança"}
                </p>
                <p className="mt-1 text-[11.5px] leading-[1.6] text-muted-foreground">
                  {stage >= 2
                    ? "Acesso liberado ao cliente e saldo creditado ao produtor."
                    : "Código copia e cola pronto, com expiração controlada."}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Demonstração local e ilustrativa deste checkout.
          </p>
        </div>
      </div>
    </section>
  );
}

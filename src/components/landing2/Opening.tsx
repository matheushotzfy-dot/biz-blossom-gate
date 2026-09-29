/**
 * Opening — abertura em tela cheia: halo esmeralda, grade técnica e título
 * revelado linha a linha. Sem cards, sem métricas de vaidade.
 */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";
import { CutLines, Tag } from "./bits";
import { VenxpayLogo } from "@/components/VenxpayLogo";

export function Opening({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const haloY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[980px] items-center overflow-hidden pb-20 pt-28 lg:min-h-dvh lg:pb-0">
      <motion.div style={{ y: haloY, opacity: fade }} className="pointer-events-none absolute inset-0">
        <div className="vx-aurora vx-aurora-one" />
        <div className="vx-aurora vx-aurora-two" />
        <div className="vx-orbit vx-orbit-one" />
        <div className="vx-orbit vx-orbit-two" />
        <div className="absolute inset-0 vx-grid vx-fade-edges opacity-55" />
        <div className="vx-noise absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
      </motion.div>

      <div className="relative mx-auto grid w-full max-w-[1280px] items-center gap-16 px-5 lg:grid-cols-[1.08fr_.92fr] lg:gap-8">
        <div>
        <Tag>infraestrutura financeira · brasil</Tag>

        <CutLines
          delay={0.1}
          className="mt-7 text-[46px] font-extrabold text-foreground sm:text-[72px] lg:text-[82px] xl:text-[94px]"
          lines={[
            <>O FUTURO DO</>,
            <><span className="vx-electric-text">PAGAMENTO.</span></>,
          ]}
        />

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 max-w-[52ch] text-[16px] leading-[1.75] text-muted-foreground sm:text-[17px]"
        >
          Uma infraestrutura para vender, acompanhar e escalar sua operação financeira com
          clareza, velocidade e segurança em cada movimento.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
          className="mt-11 flex flex-wrap items-center gap-3"
        >
          <button type="button" onClick={onSignup} className="vx-btn">
            Abrir minha conta <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onLogin} className="vx-btn-ghost">
            Já tenho conta
          </button>
        </motion.div>

        <div className="mt-20 flex items-center gap-3 text-muted-foreground">
          <ArrowDown className="h-4 w-4 animate-bounce text-primary" />
          <span className="vx-mono">role para ver o percurso do dinheiro</span>
        </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, x: 35, rotate: -3 }}
          animate={{ opacity: 1, x: 0, rotate: -1.5 }}
          transition={{ duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="vx-product-stage relative mx-auto hidden w-full max-w-[520px] lg:block"
        >
          <div className="vx-product-glow" />
          <div className="vx-dashboard-preview relative overflow-hidden rounded-[24px] border border-border bg-card p-6">
            <div className="flex items-center justify-between border-b border-border pb-5">
              <div className="flex items-center gap-3"><VenxpayLogo size={30} plate={false} /><span className="font-heading text-sm font-bold">VENXPAY</span></div>
              <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-success"><i className="h-1.5 w-1.5 rounded-full bg-success" />Operação online</span>
            </div>
            <div className="py-8">
              <p className="vx-mono">saldo disponível</p>
              <p className="vx-num mt-3 text-[40px] font-bold text-foreground">R$ 42.890,00</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-border bg-background/60 p-4"><TrendingUp className="h-4 w-4 text-primary"/><p className="mt-5 text-[11px] text-muted-foreground">Volume hoje</p><p className="vx-num mt-1 text-sm font-bold">R$ 8.420,90</p></div>
                <div className="rounded-[12px] border border-border bg-background/60 p-4"><ShieldCheck className="h-4 w-4 text-success"/><p className="mt-5 text-[11px] text-muted-foreground">Conversão</p><p className="vx-num mt-1 text-sm font-bold">87,4%</p></div>
              </div>
              <div className="mt-3 space-y-2">
                {["Venda aprovada", "Pagamento confirmado"].map((label, index) => <div key={label} className="flex items-center justify-between rounded-[10px] border border-border px-4 py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success"/>{label}</span><span className="vx-num text-xs text-foreground">{index ? "+ R$ 397,00" : "+ R$ 1.497,00"}</span></div>)}
              </div>
            </div>
          </div>
          <div className="vx-secure-badge"><ShieldCheck className="h-4 w-4"/> TRANSAÇÃO PROTEGIDA</div>
        </motion.div>
      </div>
    </section>
  );
}

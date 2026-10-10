import { motion, useReducedMotion } from "framer-motion";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";
import { NetworkCanvas } from "./aside/NetworkCanvas";
import { EventFeed } from "./aside/EventFeed";
import { LiveClock } from "./aside/LiveClock";
import { MetricCells } from "./aside/MetricCells";

/**
 * Painel "central de operação" ao lado do login/cadastro (desktop).
 * Todo conteúdo é ilustrativo — nenhum dado do banco.
 */
export interface AuthAsideProps {
  className?: string;
}

export function AuthAside({ className }: AuthAsideProps) {
  const reduced = useReducedMotion();
  const fade = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <aside className={cn("auth-aside relative isolate h-full flex-col gap-5 overflow-hidden px-10 py-7 xl:px-14", className)} aria-label="Sobre a VENXPAY">
      <div className="auth-aside-grid pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden="true" />

      <motion.header {...fade(0)} className="auth-aside-border flex items-center justify-between border-b pb-4">
        <span className="flex items-center gap-2.5">
          <VenxpayLogo size={26} plate={false} />
          <span className="font-heading text-[14px] font-bold tracking-wide">VENXPAY</span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] auth-aside-muted">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />}
              <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Operacional
          </span>
          <span className="auth-aside-border border-l pl-3"><LiveClock /></span>
        </span>
      </motion.header>

      <motion.div {...fade(0.1)}>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] auth-aside-accent">// gateway de pagamentos</p>
        <h2 className="mt-2 font-heading text-[28px] font-semibold leading-[1.15] [@media(min-height:820px)]:text-[34px]">
          Pagamentos em velocidade de{" "}
          <span className="relative inline-block">
            rede.
            <span className="auth-aside-underline absolute -bottom-1 left-0 h-[2px] w-full" aria-hidden="true" />
          </span>
        </h2>
      </motion.div>

      <motion.div {...fade(0.2)} className="auth-aside-panel auth-aside-corners relative min-h-[150px] flex-1 overflow-hidden">
        <NetworkCanvas />
        <div className="auth-aside-scan" aria-hidden="true" />
        <span className="absolute left-3 top-2 font-mono text-[9px] uppercase tracking-[0.16em] auth-aside-muted">network · topology</span>
      </motion.div>

      <motion.div {...fade(0.3)}><EventFeed /></motion.div>
      <motion.div {...fade(0.4)}><MetricCells /></motion.div>
    </aside>
  );
}

export default AuthAside;

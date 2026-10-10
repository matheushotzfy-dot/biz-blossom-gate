import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

/**
 * Painel institucional exibido ao lado do login/cadastro (desktop).
 * Sem dados financeiros simulados — apenas claims de marca autorizados.
 */
export interface AuthAsideProps {
  className?: string;
}

interface Pillar {
  icon: LucideIcon;
  title: string;
  text: string;
}

const PILLARS: readonly Pillar[] = [
  { icon: ArrowLeftRight, title: "PIX e cartão", text: "Adquirentes exclusivos com aprovação acima de 75%." },
  { icon: Zap, title: "Saque instantâneo", text: "Seu dinheiro disponível quando você precisar." },
  { icon: ShieldCheck, title: "Antifraude e LGPD", text: "Transações monitoradas e dados protegidos." },
];

const METRICS = [
  { value: "75%+", label: "Aprovação" },
  { value: "Instantâneo", label: "Saque" },
  { value: "24/7", label: "Disponível" },
] as const;

function BrandMark() {
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden="true" className="auth-aside-mark absolute -right-40 top-1/2 h-[560px] w-[560px] opacity-50 -translate-y-1/2">
      <path d="M60 70 L200 340 L340 70" stroke="currentColor" strokeWidth="1.5" />
      <path d="M110 70 L200 245 L290 70" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function AuthAside({ className }: AuthAsideProps) {
  const reduced = useReducedMotion();
  const fade = (delay: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <aside className={cn("auth-aside relative isolate flex h-full flex-col overflow-hidden px-12 py-8 xl:px-16", className)} aria-label="Sobre a VENXPAY">
      <div className="auth-aside-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 -z-10"><BrandMark /></div>

      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <VenxpayLogo size={28} plate={false} />
          <span className="font-heading text-[15px] font-bold tracking-wide">VENXPAY</span>
        </span>
        <span className="flex items-center gap-2 text-[11px] font-medium auth-aside-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Sistema operacional
        </span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-6">
        <motion.p {...fade(0)} className="text-[11px] font-semibold uppercase tracking-[0.18em] auth-aside-accent">
          Gateway de pagamentos
        </motion.p>
        <motion.h2 {...fade(0.08)} className="mt-4 max-w-[460px] font-heading text-[30px] font-semibold leading-[1.15] [@media(min-height:820px)]:text-[38px]">
          A infraestrutura de pagamentos para quem vende online.
        </motion.h2>

        <ul className="mt-7 max-w-[440px] [@media(min-height:820px)]:mt-10">
          {PILLARS.map((p, i) => (
            <motion.li key={p.title} {...fade(0.16 + i * 0.07)} className="auth-aside-border flex gap-4 border-t py-3.5 last:border-b [@media(min-height:820px)]:py-5">
              <p.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 auth-aside-accent" strokeWidth={1.6} />
              <div>
                <p className="text-[14px] font-semibold">{p.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed auth-aside-muted">{p.text}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.dl {...fade(0.4)} className="auth-aside-border grid grid-cols-3 border-t pt-6">
        {METRICS.map((m) => (
          <div key={m.label}>
            <dt className="text-[11px] auth-aside-muted">{m.label}</dt>
            <dd className="mt-1 font-heading text-[18px] font-semibold">{m.value}</dd>
          </div>
        ))}
      </motion.dl>
    </aside>
  );
}

export default AuthAside;

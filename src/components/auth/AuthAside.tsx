import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Check, QrCode, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { VenxpayLogo } from "@/components/VenxpayLogo";

/**
 * Painel institucional do login/cadastro (desktop).
 * Verde Vemprapay + mockup do app em formato de celular.
 * Os valores do mockup são ilustrativos (marcados como exemplo) — nunca dados reais.
 */
export interface AuthAsideProps {
  className?: string;
}

const MOVES = [
  { label: "Pix recebido", meta: "Curso completo · agora", value: "+ R$ 197,00", in: true },
  { label: "Cartão aprovado", meta: "Mentoria · 2 min", value: "+ R$ 497,00", in: true },
  { label: "Saque via Pix", meta: "Chave cadastrada", value: "− R$ 1.200,00", in: false },
] as const;

export function AuthAside({ className }: AuthAsideProps) {
  const reduced = useReducedMotion() ?? false;
  const rise = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <aside className={cn("vp-auth-aside relative isolate flex h-full flex-col overflow-hidden px-10 py-9", className)} aria-label="Vemprapay">
      <span aria-hidden className="vp-auth-ring vp-auth-ring-a" />
      <span aria-hidden className="vp-auth-ring vp-auth-ring-b" />

      <motion.div {...rise(0.05)} className="flex items-center gap-2.5">
        <span className="vp-auth-logo-tile"><VenxpayLogo size={30} plate={false} /></span>
        <span className="font-heading text-[19px] font-extrabold tracking-[-0.035em]">vemprapay</span>
      </motion.div>

      <div className="relative mt-8 flex min-h-0 flex-1 items-center justify-center">
        <motion.div {...rise(0.2)} className="vp-phone">
          <div className="vp-phone-notch" aria-hidden />
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Olá, Ana</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-foreground">Exemplo</span>
          </div>
          <div className="mt-3 rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-[11px] font-medium opacity-80">Saldo disponível</p>
            <p className="mt-1 font-heading text-[24px] font-extrabold tracking-[-0.03em] tabular-nums">R$ 12.480,90</p>
            <p className="mt-0.5 text-[10px] opacity-75">A liberar: R$ 3.215,00</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[{ i: QrCode, l: "Pix" }, { i: ArrowUpRight, l: "Sacar" }, { i: Zap, l: "Vendas" }].map(({ i: I, l }) => (
              <div key={l} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2">
                <I className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold text-foreground">{l}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 px-1 text-[11px] font-bold text-foreground">Movimentações</p>
          <ul className="mt-1.5 divide-y divide-border">
            {MOVES.map((m) => (
              <li key={m.label} className="flex items-center gap-2.5 py-2">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", m.in ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}>
                  {m.in ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-foreground">{m.label}</span>
                  <span className="block truncate text-[9.5px] text-muted-foreground">{m.meta}</span>
                </span>
                <span className={cn("text-[11px] font-bold tabular-nums", m.in ? "text-primary" : "text-foreground")}>{m.value}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...rise(0.55)} className="vp-auth-toast" role="presentation">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span>
            <span className="block text-[12px] font-bold text-foreground">Pix aprovado</span>
            <span className="block text-[10.5px] text-muted-foreground">Entra no seu saldo</span>
          </span>
        </motion.div>
      </div>

      <motion.div {...rise(0.4)} className="relative mt-8 max-w-[440px]">
        <h2 className="font-heading text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Receba, acompanhe e saque. Tudo em um só lugar.</h2>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold opacity-90">
          <li className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Pix, cartão e boleto</li>
          <li className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Saque por Pix com a sua senha</li>
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Verificação de identidade</li>
        </ul>
      </motion.div>
    </aside>
  );
}

export default AuthAside;

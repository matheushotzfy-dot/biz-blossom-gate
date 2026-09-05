/**
 * AuthAside — photographic proof-of-product panel for authentication.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Check, ShieldCheck, Wifi } from "lucide-react";
import authHeroPerson from "@/assets/auth-hero-person.jpg";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

interface AuthAsideProps {
  className?: string;
}

const APPROVALS = [
  { name: "Nova venda aprovada", amount: "R$ 197,00", delay: 0.35 },
  { name: "Saldo liberado", amount: "R$ 184,19", delay: 0.7 },
] as const;

export function AuthAside({ className }: AuthAsideProps) {
  const reducedMotion = useReducedMotion();

  return (
    <aside className={cn("relative isolate overflow-hidden bg-background", className)} aria-label="Operação VENXPAY em tempo real">
      <motion.img
        src={authHeroPerson}
        alt="Seller acompanhando suas vendas pelo celular"
        className="absolute inset-0 h-full w-full object-cover object-center"
        initial={{ scale: 1.03 }}
        animate={{ scale: reducedMotion ? 1.03 : 1.08 }}
        transition={{ duration: 18, ease: "linear", repeat: reducedMotion ? 0 : Infinity, repeatType: "mirror" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/45 via-transparent to-transparent" />

      <div className="absolute left-10 top-10 flex items-center gap-2.5 rounded-full border border-foreground/15 bg-background/75 px-3.5 py-2 backdrop-blur-md xl:left-14 xl:top-12">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">Operação ao vivo</span>
      </div>

      <div className="absolute right-8 top-[17%] w-[290px] space-y-3 xl:right-12 xl:w-[320px]">
        {APPROVALS.map((approval, index) => (
          <motion.div
            key={approval.name}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: index === 0 ? 0 : -22 }}
            transition={{ duration: 0.65, delay: approval.delay, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-2xl border border-foreground/15 bg-background/80 p-3.5 backdrop-blur-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-muted-foreground">{approval.name}</span>
              <span className="mt-0.5 block font-heading text-[16px] font-semibold tabular-nums text-foreground">{approval.amount}</span>
            </span>
            <span className="text-[10px] font-medium text-primary">agora</span>
          </motion.div>
        ))}
      </div>

      <div className="absolute inset-x-10 bottom-10 xl:inset-x-14 xl:bottom-12">
        <div className="max-w-[520px]">
          <div className="mb-5 flex items-center gap-3">
            <VenxpayLogo size={34} plate={false} />
            <span className="font-heading text-[15px] font-semibold text-foreground">VENXPAY</span>
          </div>
          <h2 className="max-w-[500px] font-heading text-[34px] font-semibold leading-[1.08] text-foreground xl:text-[42px]">
            Venda aprovada. Saldo em movimento.
          </h2>
          <p className="mt-4 max-w-[450px] text-[14px] leading-relaxed text-foreground/65">
            Acompanhe pagamentos, proteja sua operação e receba com clareza desde a primeira venda.
          </p>
          <div className="mt-7 flex items-center gap-5 border-t border-foreground/15 pt-5 text-[11px] font-medium text-foreground/60">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Antifraude ativo</span>
            <span className="inline-flex items-center gap-1.5"><Wifi className="h-4 w-4 text-primary" /> Atualização em tempo real</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default AuthAside;
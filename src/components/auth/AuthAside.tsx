import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

interface AuthAsideProps {
  className?: string;
}

export function AuthAside({ className }: AuthAsideProps) {
  const reducedMotion = useReducedMotion();

  return (
    <aside className={cn("auth-network relative isolate overflow-hidden", className)} aria-label="Ecossistema VENXPAY">
      <div className="auth-aurora auth-aurora-one" aria-hidden="true" />
      <div className="auth-aurora auth-aurora-two" aria-hidden="true" />
      <div className="auth-network-grid absolute inset-0" aria-hidden="true" />
      <div className="absolute right-8 top-8 flex items-center gap-2 text-[10px] font-bold uppercase text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Sistema operacional</div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-[560px] px-10">
          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 24, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: -1 }} transition={{ duration: .8 }} className="auth-preview relative overflow-hidden rounded-[24px] border border-border bg-card p-7">
            <div className="flex items-center justify-between border-b border-border pb-6"><VenxpayLogo size={34} withWordmark plate={false}/><span className="flex items-center gap-2 text-[9px] font-bold uppercase text-success"><i className="h-1.5 w-1.5 rounded-full bg-success"/> AO VIVO</span></div>
            <div className="py-9"><p className="text-[10px] font-bold uppercase text-muted-foreground">Saldo disponível</p><p className="mt-2 font-mono text-[38px] font-bold text-foreground">R$ 42.890,00</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl border border-border bg-background/70 p-4"><TrendingUp className="h-4 w-4 text-primary"/><p className="mt-5 text-[10px] text-muted-foreground">Volume hoje</p><p className="mt-1 font-mono text-sm font-bold">R$ 8.420,90</p></div><div className="rounded-xl border border-border bg-background/70 p-4"><ShieldCheck className="h-4 w-4 text-success"/><p className="mt-5 text-[10px] text-muted-foreground">Conversão</p><p className="mt-1 font-mono text-sm font-bold">87,4%</p></div></div></div>
            <div className="space-y-2">{["Venda aprovada", "Pagamento confirmado"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-border px-4 py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success"/>{item}</span><ArrowUpRight className="h-4 w-4 text-primary"/></div>)}</div>
          </motion.div>
          <div className="auth-secure-float"><ShieldCheck className="h-4 w-4"/> AMBIENTE PROTEGIDO</div>
        </div>
      </div>

      <div className="absolute bottom-8 left-8 text-[11px] text-muted-foreground">Infraestrutura financeira que acompanha seu crescimento.</div>
    </aside>
  );
}

export default AuthAside;
import { motion, useReducedMotion } from "framer-motion";
import { Check, Fingerprint, GitBranch, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  { icon: QrCode, label: "Checkout", detail: "PIX gerado", time: "000 ms" },
  { icon: Fingerprint, label: "Antifraude", detail: "Risco 0,02", time: "084 ms" },
  { icon: ShieldCheck, label: "Aprovação", detail: "Confirmado", time: "412 ms" },
  { icon: GitBranch, label: "Split", detail: "3 recebedores", time: "418 ms" },
  { icon: Wallet, label: "Liquidação", detail: "Disponível D+0", time: "420 ms" },
];

export function PaymentEngine({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("engine-shell relative overflow-hidden border border-border", compact ? "p-4 sm:p-5" : "p-5 sm:p-7")}>
      <div className="engine-grid pointer-events-none absolute inset-0" />
      <div className="relative flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="engine-status-dot" />
          <div>
            <p className="font-mono text-[10px] uppercase text-primary">Payment engine / live</p>
            <p className="mt-1 font-heading text-sm font-semibold text-foreground">Orquestração em 420 ms</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10px] text-muted-foreground sm:flex">
          <span>BR-SAO-01</span><span className="text-border">/</span><span>99.999% ONLINE</span>
        </div>
      </div>

      <div className="relative mt-7 grid gap-3 lg:grid-cols-5">
        <div className="engine-beam absolute left-[8%] right-[8%] top-[26px] hidden h-px lg:block" />
        {stages.map(({ icon: Icon, label, detail, time }, index) => (
          <motion.div
            key={label}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ delay: index * 0.1, duration: 0.55 }}
            className="engine-stage relative flex items-center gap-3 border border-border bg-card p-3 lg:block lg:border-0 lg:bg-transparent lg:p-0"
          >
            <span className="engine-node relative z-10 flex h-11 w-11 shrink-0 items-center justify-center border border-primary/30 bg-background text-primary lg:mx-auto">
              <Icon className="h-4 w-4" />
              {index === 2 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>}
            </span>
            <div className="lg:mt-4 lg:text-center">
              <p className="font-heading text-xs font-semibold text-foreground">{label}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
              <p className="mt-2 font-mono text-[9px] text-primary">{time}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {!compact && (
        <div className="relative mt-7 grid gap-px border border-border bg-border sm:grid-cols-3">
          {[
            ["VALOR APROVADO", "R$ 1.497,00"],
            ["TAXA DE APROVAÇÃO", "98,73%"],
            ["LATÊNCIA P95", "420 ms"],
          ].map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-3">
              <p className="font-mono text-[8px] text-muted-foreground">{label}</p>
              <p className="mt-1 font-heading text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
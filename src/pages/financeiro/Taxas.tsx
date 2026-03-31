import { useFees } from "@/hooks/useQueryData";
import { Percent, Zap, Shield, Info, CreditCard, ArrowDownToLine, DollarSign } from "lucide-react";
import { PageShell, Panel, GlowPanel, PageTitle, GlassKpi } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TONE_MAP: Record<string, { accent: string; bg: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  "Taxa de Transação": { accent: "bg-primary", bg: "bg-primary/10", color: "text-primary", icon: CreditCard },
  "Taxa de Saque": { accent: "bg-warning", bg: "bg-warning/10", color: "text-warning", icon: ArrowDownToLine },
  "Taxa Fixa": { accent: "bg-info", bg: "bg-info/10", color: "text-info", icon: DollarSign },
};

function getTone(name: string) {
  return TONE_MAP[name] || { accent: "bg-primary", bg: "bg-primary/10", color: "text-primary", icon: Zap };
}

export default function Taxas() {
  const { data: fees = [] } = useFees();

  const percentFees = fees.filter(f => f.fee_type === "percentage");
  const fixedFees = fees.filter(f => f.fee_type === "fixed");

  return (
    <PageShell>
      <PageTitle icon={<Percent className="h-6 w-6" />} title="Taxas e Tarifas" subtitle="Taxas aplicadas às suas transações e operações" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi
          label="Taxas Ativas"
          value={String(fees.length)}
          sub="Configuradas na plataforma"
          icon={Zap}
          tone="primary"
          delay={0}
        />
        <GlassKpi
          label="Percentuais"
          value={String(percentFees.length)}
          sub="Sobre valor bruto"
          icon={Percent}
          tone="info"
          delay={1}
        />
        <GlassKpi
          label="Valores Fixos"
          value={String(fixedFees.length)}
          sub="Por operação"
          icon={DollarSign}
          tone="warning"
          delay={2}
        />
        <GlassKpi
          label="Segurança"
          value="SSL"
          sub="Transações protegidas"
          icon={Shield}
          tone="success"
          delay={3}
        />
      </div>

      {/* Fee Cards */}
      {fees.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fees.map((fee, i) => {
            const tone = getTone(fee.name);
            const IconComp = tone.icon;
            return (
              <motion.div
                key={fee.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <Panel className="relative overflow-hidden">
                  <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", tone.accent)} />
                  <div className="pl-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center ring-1 ring-border/20", tone.bg)}>
                          <IconComp className={cn("h-5 w-5", tone.color)} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-display font-bold text-foreground tracking-[-0.02em]">{fee.name}</h3>
                          <span className={cn(
                            "inline-block mt-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            fee.fee_type === "percentage"
                              ? "text-info bg-info/10"
                              : "text-warning bg-warning/10"
                          )}>
                            {fee.fee_type === "percentage" ? "Percentual" : "Valor Fixo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[32px] font-display font-black text-foreground tracking-[-0.04em] tabular-nums leading-none">
                      {fee.fee_type === "percentage" ? `${fee.value}%` : `R$ ${Number(fee.value).toFixed(2)}`}
                    </p>

                    {fee.description && (
                      <p className="text-[12px] text-muted-foreground/60 mt-3 leading-relaxed line-clamp-2">{fee.description}</p>
                    )}
                  </div>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Panel>
          <div className="text-center py-16">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-center mb-4">
              <Percent className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <p className="text-[15px] font-display font-bold text-foreground/60">Nenhuma taxa configurada</p>
            <p className="text-[12px] text-muted-foreground/40 mt-1">As taxas serão exibidas quando configuradas pelo administrador</p>
          </div>
        </Panel>
      )}

      {/* How it works */}
      <GlowPanel>
        <div className="flex items-center gap-3.5 mb-5">
          <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center">
            <Info className="h-4.5 w-4.5 text-info" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Como as taxas funcionam</h3>
            <p className="text-[11px] text-muted-foreground/60">Entenda como os valores são calculados</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: "Taxas percentuais", desc: "Calculadas sobre o valor bruto de cada transação aprovada.", accent: "bg-info" },
            { label: "Taxas fixas", desc: "Cobradas por operação realizada (ex: saque, transferência).", accent: "bg-warning" },
            { label: "Cálculo do líquido", desc: "Valor bruto − taxas percentuais − taxas fixas = valor líquido creditado.", accent: "bg-primary" },
            { label: "Transparência total", desc: "Todas as taxas são exibidas antes da confirmação de cada operação.", accent: "bg-success" },
          ].map((item) => (
            <div key={item.label} className="relative flex items-start gap-3 p-3.5 rounded-xl bg-muted/10 border border-border/30 overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
              <div className="pl-1.5">
                <p className="text-[13px] font-bold text-foreground/80">{item.label}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </GlowPanel>
    </PageShell>
  );
}

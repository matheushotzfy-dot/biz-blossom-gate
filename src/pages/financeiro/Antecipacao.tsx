import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import {
  Banknote, TrendingUp, Clock, DollarSign,
  AlertTriangle, CheckCircle2, Calculator, Shield,
  Zap, ArrowUpRight, Timer, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PageShell, PageTitle, GlassKpi, Panel, GlowPanel } from "@/components/PageShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Antecipacao() {
  const { user } = useAuth();
  const { data: transactions } = useTransactions();
  const [antecipationDays, setAntecipationDays] = useState(15);

  const stats = useMemo(() => {
    if (!transactions) return { retainedTotal: 0, eligibleCount: 0, eligible: [] };
    const now = new Date();
    const retained = transactions.filter(t =>
      t.status === "completed" && !t.is_simulated && t.retained_amount > 0 &&
      !t.retention_released && t.retained_until && new Date(t.retained_until) > now
    );
    return {
      retainedTotal: retained.reduce((a, t) => a + t.retained_amount, 0),
      eligibleCount: retained.length,
      eligible: retained,
    };
  }, [transactions]);

  const antecipationFeeRate = 0.025;
  const antecipationCalc = useMemo(() => {
    const now = new Date();
    let totalOriginal = 0;
    let totalFee = 0;
    stats.eligible.forEach(tx => {
      if (!tx.retained_until) return;
      const daysRemaining = Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysRemaining <= antecipationDays) {
        const fee = tx.retained_amount * antecipationFeeRate * (daysRemaining / 15);
        totalOriginal += tx.retained_amount;
        totalFee += fee;
      }
    });
    return {
      totalOriginal,
      totalFee,
      totalNet: totalOriginal - totalFee,
      count: stats.eligible.filter(tx => {
        if (!tx.retained_until) return false;
        const daysRemaining = Math.ceil((new Date(tx.retained_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysRemaining <= antecipationDays;
      }).length,
    };
  }, [stats.eligible, antecipationDays]);

  const feePercent = antecipationCalc.totalOriginal > 0
    ? ((antecipationCalc.totalFee / antecipationCalc.totalOriginal) * 100).toFixed(2)
    : "0.00";

  return (
    <PageShell>
      <PageTitle
        icon={<Banknote className="h-6 w-6" />}
        title="Antecipação de Recebíveis"
        subtitle="Antecipe valores retidos e receba mais rápido"
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi icon={Clock} label="Retido Total" value={fmt(stats.retainedTotal)} sub={`${stats.eligibleCount} transações`} tone="warning" delay={0} />
        <GlassKpi icon={TrendingUp} label="Elegíveis" value={String(antecipationCalc.count)} sub={`Até ${antecipationDays} dias`} tone="info" delay={1} />
        <GlassKpi icon={DollarSign} label="Disponível" value={fmt(antecipationCalc.totalOriginal)} sub="Para antecipar" tone="primary" delay={2} />
        <GlassKpi icon={Calculator} label="Valor Líquido" value={fmt(antecipationCalc.totalNet)} sub={`Taxa: ${feePercent}%`} tone="success" delay={3} />
      </div>

      {/* ─── Simulator ─── */}
      <GlowPanel glow="primary">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Simulador de Antecipação</h3>
            <p className="text-[11px] text-muted-foreground/60">Ajuste o período e veja quanto você recebe</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Slider side */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-muted-foreground/60 font-medium">Período de antecipação</span>
                <span className="text-sm font-display font-black text-primary tabular-nums">{antecipationDays} dias</span>
              </div>
              <Slider
                value={[antecipationDays]}
                onValueChange={([v]) => setAntecipationDays(v)}
                min={5} max={90} step={5}
              />
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/40 font-mono">
                <span>5d</span>
                <span>30d</span>
                <span>60d</span>
                <span>90d</span>
              </div>
            </div>

            {/* Visual progress */}
            <div className="p-4 rounded-xl bg-muted/10 border border-border/20 space-y-3">
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-info" />
                <span className="text-[11px] text-muted-foreground/60">Transações no período</span>
              </div>
              <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.eligibleCount > 0 ? Math.min((antecipationCalc.count / stats.eligibleCount) * 100, 100) : 0}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                {antecipationCalc.count} de {stats.eligibleCount} transações retidas
              </p>
            </div>
          </div>

          {/* Results side */}
          <div className="space-y-2.5">
            {[
              { label: "Transações elegíveis", value: String(antecipationCalc.count), accent: "bg-info", color: "text-foreground" },
              { label: "Valor bruto", value: fmt(antecipationCalc.totalOriginal), accent: "bg-primary", color: "text-foreground" },
              { label: `Taxa de antecipação (2.5%/15d)`, value: `- ${fmt(antecipationCalc.totalFee)}`, accent: "bg-warning", color: "text-warning" },
            ].map((row) => (
              <div key={row.label} className="relative flex items-center justify-between p-3.5 rounded-xl bg-muted/10 border border-border/20 overflow-hidden">
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", row.accent)} />
                <span className="text-[12px] text-muted-foreground/60 pl-2">{row.label}</span>
                <span className={cn("text-sm font-display font-bold tabular-nums", row.color)}>{row.value}</span>
              </div>
            ))}
            <div className="relative flex items-center justify-between p-4 rounded-xl bg-success/5 border border-success/20 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
              <span className="text-sm font-bold text-success pl-2">Você recebe</span>
              <span className="text-xl font-display font-black text-success tabular-nums tracking-tight">{fmt(antecipationCalc.totalNet)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-5 border-t border-border/20">
          <Button
            disabled={antecipationCalc.count === 0}
            onClick={() => toast.info("Funcionalidade de antecipação será ativada em breve junto à adquirente.")}
            className="gap-2 rounded-xl font-bold h-11 px-6 shadow-lg shadow-primary/20"
          >
            <Banknote className="h-4 w-4" /> Solicitar Antecipação
          </Button>
          <span className="text-[11px] text-muted-foreground/50">
            {antecipationCalc.count === 0 ? "Nenhuma transação elegível no período" : `${antecipationCalc.count} transações elegíveis · ${fmt(antecipationCalc.totalNet)} líquido`}
          </span>
        </div>
      </GlowPanel>

      {/* ─── Retained Transactions Preview ─── */}
      {stats.eligible.length > 0 && (
        <Panel>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-foreground">Transações Retidas</h3>
              <p className="text-[11px] text-muted-foreground/50">{stats.eligibleCount} transações · {fmt(stats.retainedTotal)} retido</p>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {stats.eligible.slice(0, 20).map((tx, i) => {
              const daysLeft = tx.retained_until ? Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
              const isEligible = daysLeft <= antecipationDays;
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={cn(
                    "relative flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200",
                    isEligible ? "bg-primary/[0.03] border-primary/15" : "bg-muted/5 border-border/15"
                  )}
                >
                  <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", isEligible ? "bg-primary" : "bg-muted-foreground/20")} />
                  <div className="flex items-center gap-3 pl-1 min-w-0">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", isEligible ? "bg-primary/10" : "bg-muted/20")}>
                      <DollarSign className={cn("h-3.5 w-3.5", isEligible ? "text-primary" : "text-muted-foreground/40")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-foreground tabular-nums">{fmt(tx.retained_amount)}</p>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">{daysLeft}d restantes</p>
                    </div>
                  </div>
                  {isEligible && (
                    <span className="text-[9px] font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md border border-primary/10 shrink-0">Elegível</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ─── How it works ─── */}
      <GlowPanel glow="info">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-info" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Como funciona</h3>
            <p className="text-[11px] text-muted-foreground/60">Entenda o processo de antecipação</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Clock, title: "Valores Retidos", desc: "Transações aprovadas possuem um período de retenção para segurança. Você pode antecipar esses valores.", accent: "bg-warning" },
            { icon: Percent, title: "Taxa Pro-rata", desc: "A taxa de antecipação é de 2,5% a cada 15 dias restantes, calculada proporcionalmente.", accent: "bg-info" },
            { icon: CheckCircle2, title: "Crédito Imediato", desc: "Após a aprovação, o valor líquido é creditado em seu saldo disponível para saque.", accent: "bg-success" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="relative p-4 rounded-xl border border-border/20 bg-muted/10 overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
              <div className="pl-1.5">
                <div className="h-9 w-9 rounded-xl bg-muted/20 flex items-center justify-center mb-3">
                  <item.icon className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <h4 className="text-[13px] font-bold text-foreground/80 mb-1">{item.title}</h4>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </GlowPanel>
    </PageShell>
  );
}

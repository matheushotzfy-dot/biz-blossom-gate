import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import {
  Banknote, TrendingUp, Clock, Calendar, DollarSign,
  AlertTriangle, CheckCircle2, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PageShell, PageTitle, GlassKpi, Panel } from "@/components/PageShell";
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
      t.status === "completed" &&
      !t.is_simulated &&
      t.retained_amount > 0 &&
      !t.retention_released &&
      t.retained_until && new Date(t.retained_until) > now
    );

    return {
      retainedTotal: retained.reduce((a, t) => a + t.retained_amount, 0),
      eligibleCount: retained.length,
      eligible: retained,
    };
  }, [transactions]);

  // Antecipation fee: 2.5% per 15 days remaining (pro-rata)
  const antecipationFeeRate = 0.025; // 2.5% base per 15 days
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

  return (
    <PageShell>
      <PageTitle
        icon={<Banknote className="h-6 w-6" />}
        title="Antecipação de Recebíveis"
        subtitle="Antecipe valores retidos e receba mais rápido"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mt-6">
        <GlassKpi icon={Clock} label="Retido Total" value={fmt(stats.retainedTotal)} />
        <GlassKpi icon={TrendingUp} label="Transações Retidas" value={String(stats.eligibleCount)} />
        <GlassKpi icon={DollarSign} label="Disponível p/ Antecipar" value={fmt(antecipationCalc.totalOriginal)} />
        <GlassKpi icon={Calculator} label="Valor Líquido" value={fmt(antecipationCalc.totalNet)} tone="success" />
      </div>

      {/* Simulator */}
      <Panel className="mb-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Simulador de Antecipação
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Antecipar transações com vencimento em até {antecipationDays} dias
            </Label>
            <Slider
              value={[antecipationDays]}
              onValueChange={([v]) => setAntecipationDays(v)}
              min={5}
              max={90}
              step={5}
              className="mb-4"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5 dias</span>
              <span>90 dias</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
              <span className="text-xs text-muted-foreground">Transações elegíveis</span>
              <span className="text-sm font-bold text-foreground">{antecipationCalc.count}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
              <span className="text-xs text-muted-foreground">Valor bruto</span>
              <span className="text-sm font-bold text-foreground">{fmt(antecipationCalc.totalOriginal)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-warning/5 border border-warning/20">
              <span className="text-xs text-warning">Taxa de antecipação (2.5%/15d)</span>
              <span className="text-sm font-bold text-warning">- {fmt(antecipationCalc.totalFee)}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-success/5 border border-success/20">
              <span className="text-sm font-bold text-success">Você recebe</span>
              <span className="text-lg font-black text-success">{fmt(antecipationCalc.totalNet)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            disabled={antecipationCalc.count === 0}
            onClick={() => toast.info("Funcionalidade de antecipação será ativada em breve junto à adquirente.")}
            className="gradient-primary text-primary-foreground font-bold gap-2"
          >
            <Banknote className="h-4 w-4" /> Solicitar Antecipação
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {antecipationCalc.count === 0 ? "Nenhuma transação elegível no período" : `${antecipationCalc.count} transações elegíveis`}
          </span>
        </div>
      </Panel>

      {/* Info */}
      <Panel>
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Como funciona
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Clock, title: "Valores Retidos", desc: "Transações aprovadas possuem um período de retenção para segurança. Você pode antecipar esses valores." },
            { icon: Calculator, title: "Taxa Pro-rata", desc: "A taxa de antecipação é de 2,5% a cada 15 dias restantes, calculada proporcionalmente." },
            { icon: CheckCircle2, title: "Crédito Imediato", desc: "Após a aprovação, o valor líquido é creditado em seu saldo disponível para saque." },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl border border-border/20 bg-card/50">
              <item.icon className="h-5 w-5 text-primary mb-2" />
              <h4 className="text-xs font-bold text-foreground mb-1">{item.title}</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}

import { useState, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Tx = Tables<"transactions">;
type EligibleTx = Tx & { daysLeft: number; inWindow: boolean; fee: number; net: number };
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import {
  Banknote, Clock, Calculator, Shield,
  CheckCircle2, Percent, ArrowRight, Info, Wallet, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Antecipacao() {
  const { user } = useAuth();
  const { data: transactions } = useTransactions();
  const [antecipationDays, setAntecipationDays] = useState(15);

  const stats = useMemo(() => {
    if (!transactions || !user) return { retainedTotal: 0, eligibleCount: 0, eligible: [] as Tx[] };
    const now = new Date();
    const retained = transactions.filter(t =>
      t.user_id === user.id &&
      t.status === "completed" && !t.is_simulated && t.retained_amount > 0 &&
      !t.retention_released && t.retained_until && new Date(t.retained_until) > now
    );
    return {
      retainedTotal: retained.reduce((a, t) => a + t.retained_amount, 0),
      eligibleCount: retained.length,
      eligible: retained,
    };
  }, [transactions, user?.id]);

  const antecipationFeeRate = 0.025;
  const antecipationCalc = useMemo(() => {
    const now = new Date();
    let totalOriginal = 0;
    let totalFee = 0;
    let count = 0;
    stats.eligible.forEach((tx) => {
      if (!tx.retained_until) return;
      const daysRemaining = Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysRemaining <= antecipationDays) {
        // Cap multiplier at 1 — fee never exceeds the base 2.5%
        const multiplier = Math.min(daysRemaining / 15, 1);
        const fee = tx.retained_amount * antecipationFeeRate * multiplier;
        totalOriginal += tx.retained_amount;
        totalFee += fee;
        count += 1;
      }
    });
    return { totalOriginal, totalFee, totalNet: totalOriginal - totalFee, count };
  }, [stats.eligible, antecipationDays]);

  const feePercent = antecipationCalc.totalOriginal > 0
    ? (antecipationCalc.totalFee / antecipationCalc.totalOriginal) * 100
    : 0;

  const enrichedEligible = useMemo(() => {
    const now = Date.now();
    return stats.eligible.map<EligibleTx>((tx) => {
      const daysLeft = tx.retained_until
        ? Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - now) / 86400000))
        : 0;
      const inWindow = daysLeft <= antecipationDays;
      const fee = inWindow ? tx.retained_amount * antecipationFeeRate * (daysLeft / 15) : 0;
      return { ...tx, daysLeft, inWindow, fee, net: tx.retained_amount - fee };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [stats.eligible, antecipationDays]);

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 space-y-6">
      <FinanceiroHero
        title="Antecipação de Recebíveis"
        subtitle="Simule e antecipe valores retidos com taxa proporcional. Quanto menor o tempo, menor a taxa."
        status={{
          tone: stats.eligibleCount > 0 ? "info" : "neutral",
          label: `${stats.eligibleCount} ${stats.eligibleCount === 1 ? "transação retida" : "transações retidas"}`,
          pulse: stats.eligibleCount > 0,
        }}
        actions={
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/60 px-3 h-11 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            <Percent className="h-3.5 w-3.5 text-info" /> 2,5% / 15 dias
          </div>
        }
      />

      {/* KPI Grid */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Saldo retido"
          value={fmt(stats.retainedTotal)}
          sub={`${stats.eligibleCount} ${stats.eligibleCount === 1 ? "transação" : "transações"}`}
          icon={Wallet}
          tone="warning"
        />
        <FinanceiroKpi
          label={`No período (${antecipationDays}d)`}
          value={fmt(antecipationCalc.totalOriginal)}
          sub={`${antecipationCalc.count} elegíveis para antecipação`}
          icon={TrendingUp}
          tone="info"
        />
        <FinanceiroKpi
          label="Taxa total"
          value={`− ${fmt(antecipationCalc.totalFee)}`}
          sub={`${feePercent.toFixed(2)}% efetivo`}
          icon={Percent}
          tone="warning"
        />
        <FinanceiroKpi
          label="Você recebe"
          value={fmt(antecipationCalc.totalNet)}
          sub="Crédito imediato no saldo"
          icon={Banknote}
          tone="success"
        />
      </FinanceiroKpiGrid>

      {/* SIMULATOR */}
      <section className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-2">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">
              Simulador de antecipação
            </h2>
          </div>
          <span className="text-[11px] text-muted-foreground/70 font-mono tabular-nums">
            Taxa base: 2,5% / 15 dias (pro-rata)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-px bg-border/40">
          {/* Slider */}
          <div className="lg:col-span-3 bg-card p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Período de antecipação
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={90}
                    step={5}
                    value={antecipationDays}
                    onChange={(e) => {
                      const v = Math.max(5, Math.min(90, Number(e.target.value) || 5));
                      setAntecipationDays(v);
                    }}
                    className="h-8 w-20 text-sm font-mono font-black text-right tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground/70 font-medium">dias</span>
                </div>
              </div>
              <Slider
                value={[antecipationDays]}
                onValueChange={([v]) => setAntecipationDays(v)}
                min={5}
                max={90}
                step={5}
              />
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                <span>5d</span><span>30d</span><span>60d</span><span>90d</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/70 mr-1">
                Atalhos
              </span>
              {[7, 15, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setAntecipationDays(d)}
                  className={cn(
                    "h-7 px-2.5 text-[11px] font-bold rounded-md border transition-all duration-200",
                    antecipationDays === d
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground/80 font-medium">Cobertura do período</span>
                <span className="text-[12px] font-mono font-black text-foreground tabular-nums">
                  {antecipationCalc.count} / {stats.eligibleCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${stats.eligibleCount > 0 ? Math.min((antecipationCalc.count / stats.eligibleCount) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-2 font-medium">
                Transações com vencimento até {antecipationDays} dias serão antecipadas.
              </p>
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-2 bg-card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-4">
              Resumo da operação
            </p>

            <dl className="space-y-2.5 text-[12px]">
              <Row label="Transações" value={String(antecipationCalc.count)} />
              <Row label="Valor bruto retido" value={fmt(antecipationCalc.totalOriginal)} />
              <Row label={`Taxa (${feePercent.toFixed(2)}%)`} value={`− ${fmt(antecipationCalc.totalFee)}`} negative />
            </dl>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-success">Líquido a receber</span>
                <span className="text-[22px] font-display font-black text-success tabular-nums tracking-tight">
                  {fmt(antecipationCalc.totalNet)}
                </span>
              </div>

              <Button
                disabled={antecipationCalc.count === 0}
                onClick={() => toast.info("Funcionalidade de antecipação será ativada em breve junto à adquirente.")}
                className="w-full gap-2 rounded-xl font-display font-black uppercase tracking-[0.12em] text-[12px] h-11"
              >
                <Banknote className="h-4 w-4" /> Solicitar antecipação
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <p className="text-[10px] text-muted-foreground/70 mt-2 text-center flex items-center justify-center gap-1 font-medium">
                <Info className="h-3 w-3" />
                Crédito em até 1 dia útil após aprovação
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ELIGIBLE TABLE */}
      {enrichedEligible.length > 0 && (
        <section className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-3">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">
                Transações retidas
              </h2>
              <span className="text-[10px] font-black tabular-nums text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                {stats.eligibleCount}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/70 font-mono tabular-nums">
              Total retido: <span className="text-foreground font-black">{fmt(stats.retainedTotal)}</span>
            </span>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-secondary/40 z-10">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-[100px] text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground">Vencimento</TableHead>
                  <TableHead className="w-[140px] text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground">Valor retido</TableHead>
                  <TableHead className="text-right text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground">Taxa</TableHead>
                  <TableHead className="text-right text-[10px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedEligible.slice(0, 50).map((tx) => (
                  <TableRow key={tx.id} className="border-border/30 hover:bg-secondary/30 transition-colors">
                    <TableCell className="font-mono text-[12px] font-bold text-foreground tabular-nums">{tx.daysLeft}d</TableCell>
                    <TableCell>
                      {tx.inWindow ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-[0.12em] bg-primary/10 text-primary border border-primary/20">
                          <CheckCircle2 className="h-3 w-3" /> Elegível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-[0.12em] bg-muted/10 text-muted-foreground border border-border/40">
                          Fora
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-black text-foreground text-[13px] tabular-nums">{fmt(tx.retained_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-warning text-[12px] tabular-nums">{tx.inWindow ? `− ${fmt(tx.fee)}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono font-black text-success text-[13px] tabular-nums">{tx.inWindow ? fmt(tx.net) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/50">
          <div className="h-7 w-7 rounded-md bg-success/10 text-success flex items-center justify-center">
            <Shield className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Como funciona</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border/40">
          {[
            { icon: Clock, title: "Retenção", desc: "Transações aprovadas têm período de retenção definido pela adquirente.", tone: "info" as const },
            { icon: Percent, title: "Taxa pro-rata", desc: "2,5% a cada 15 dias restantes — quanto menor o tempo, menor a taxa.", tone: "warning" as const },
            { icon: CheckCircle2, title: "Crédito", desc: "Valor líquido creditado no saldo disponível em até 1 dia útil.", tone: "success" as const },
          ].map((item) => {
            const tone = { info: "bg-info/10 text-info", warning: "bg-warning/10 text-warning", success: "bg-success/10 text-success" }[item.tone];
            return (
              <div key={item.title} className="bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", tone)}>
                    <item.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </div>
                  <h3 className="text-[12px] font-display font-black text-foreground uppercase tracking-[0.12em]">{item.title}</h3>
                </div>
                <p className="text-[12px] text-muted-foreground/80 leading-relaxed font-medium">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground/80">{label}</dt>
      <dd className={cn("font-mono font-black tabular-nums", negative ? "text-warning" : "text-foreground")}>{value}</dd>
    </div>
  );
}

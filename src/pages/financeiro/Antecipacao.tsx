import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import {
  Banknote, Clock, Calculator, Shield,
  CheckCircle2, Percent, ArrowRight, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Antecipacao() {
  const { user } = useAuth();
  const { data: transactions } = useTransactions();
  const [antecipationDays, setAntecipationDays] = useState(15);

  const stats = useMemo(() => {
    if (!transactions) return { retainedTotal: 0, eligibleCount: 0, eligible: [] as any[] };
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
    let count = 0;
    stats.eligible.forEach((tx: any) => {
      if (!tx.retained_until) return;
      const daysRemaining = Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysRemaining <= antecipationDays) {
        const fee = tx.retained_amount * antecipationFeeRate * (daysRemaining / 15);
        totalOriginal += tx.retained_amount;
        totalFee += fee;
        count += 1;
      }
    });
    return {
      totalOriginal,
      totalFee,
      totalNet: totalOriginal - totalFee,
      count,
    };
  }, [stats.eligible, antecipationDays]);

  const feePercent = antecipationCalc.totalOriginal > 0
    ? (antecipationCalc.totalFee / antecipationCalc.totalOriginal) * 100
    : 0;

  const enrichedEligible = useMemo(() => {
    const now = Date.now();
    return stats.eligible.map((tx: any) => {
      const daysLeft = tx.retained_until
        ? Math.max(0, Math.ceil((new Date(tx.retained_until).getTime() - now) / 86400000))
        : 0;
      const inWindow = daysLeft <= antecipationDays;
      const fee = inWindow ? tx.retained_amount * antecipationFeeRate * (daysLeft / 15) : 0;
      return { ...tx, daysLeft, inWindow, fee, net: tx.retained_amount - fee };
    }).sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [stats.eligible, antecipationDays]);

  return (
    <PageShell>
      <PageTitle
        icon={<Banknote className="h-6 w-6" />}
        title="Antecipação de Recebíveis"
        subtitle="Simule e antecipe valores retidos com taxa proporcional"
      />

      {/* ─── SUMMARY LEDGER ─── */}
      <Panel>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/30">
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Saldo retido
            </p>
            <p className="text-2xl font-display font-black text-foreground font-numbers tracking-tight">
              {fmt(stats.retainedTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {stats.eligibleCount} transações
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              No período ({antecipationDays}d)
            </p>
            <p className="text-2xl font-display font-black text-foreground font-numbers tracking-tight">
              {fmt(antecipationCalc.totalOriginal)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {antecipationCalc.count} elegíveis
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Taxa total
            </p>
            <p className="text-2xl font-display font-black text-warning font-numbers tracking-tight">
              −{fmt(antecipationCalc.totalFee)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {feePercent.toFixed(2)}% efetivo
            </p>
          </div>
          <div className="p-5 bg-success/[0.03]">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-success/70 mb-2">
              Você recebe
            </p>
            <p className="text-2xl font-display font-black text-success font-numbers tracking-tight">
              {fmt(antecipationCalc.totalNet)}
            </p>
            <p className="text-[11px] text-success/60 mt-1">
              Crédito imediato no saldo
            </p>
          </div>
        </div>
      </Panel>

      {/* ─── SIMULATOR ─── */}
      <Panel>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-4 w-4 text-muted-foreground/70" />
            <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">
              Simulador de antecipação
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground/50 font-numbers">
            Taxa base: 2,5% / 15 dias (pro-rata)
          </span>
        </div>

        <div className="grid lg:grid-cols-5 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border/20">
          {/* Slider — operational control */}
          <div className="p-5 lg:col-span-3 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted-foreground/70">
                  Período de antecipação
                </Label>
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
                    className="h-8 w-20 text-sm font-numbers font-bold text-right"
                  />
                  <span className="text-xs text-muted-foreground/60">dias</span>
                </div>
              </div>
              <Slider
                value={[antecipationDays]}
                onValueChange={([v]) => setAntecipationDays(v)}
                min={5}
                max={90}
                step={5}
              />
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/40 font-numbers">
                <span>5d</span><span>30d</span><span>60d</span><span>90d</span>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 mr-1">
                Atalhos:
              </span>
              {[7, 15, 30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setAntecipationDays(d)}
                  className={cn(
                    "h-7 px-2.5 text-xs font-semibold rounded-md border transition-all",
                    antecipationDays === d
                      ? "border-primary/40 bg-primary/[0.08] text-primary"
                      : "border-border/30 text-muted-foreground/70 hover:border-border/60 hover:bg-muted/20"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Coverage indicator */}
            <div className="rounded-lg border border-border/25 bg-muted/[0.04] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground/70 font-medium">
                  Cobertura do período
                </span>
                <span className="text-xs font-numbers font-bold text-foreground">
                  {antecipationCalc.count} / {stats.eligibleCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${stats.eligibleCount > 0 ? Math.min((antecipationCalc.count / stats.eligibleCount) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-2">
                Transações com vencimento até {antecipationDays} dias serão antecipadas.
              </p>
            </div>
          </div>

          {/* Result — financial breakdown */}
          <div className="p-5 lg:col-span-2 bg-muted/[0.02]">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-4">
              Resumo da operação
            </p>

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground/70 text-xs">Transações</dt>
                <dd className="font-numbers font-bold text-foreground">
                  {antecipationCalc.count}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground/70 text-xs">Valor bruto retido</dt>
                <dd className="font-numbers font-bold text-foreground">
                  {fmt(antecipationCalc.totalOriginal)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-muted-foreground/70 text-xs">
                  Taxa ({feePercent.toFixed(2)}%)
                </dt>
                <dd className="font-numbers font-bold text-warning">
                  −{fmt(antecipationCalc.totalFee)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs uppercase tracking-wider font-bold text-success/80">
                  Líquido a receber
                </span>
                <span className="text-xl font-display font-black text-success font-numbers tracking-tight">
                  {fmt(antecipationCalc.totalNet)}
                </span>
              </div>

              <Button
                disabled={antecipationCalc.count === 0}
                onClick={() => toast.info("Funcionalidade de antecipação será ativada em breve junto à adquirente.")}
                className="w-full gap-2 rounded-lg font-bold h-10 shadow-md shadow-primary/15"
              >
                <Banknote className="h-4 w-4" /> Solicitar antecipação
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <p className="text-[10px] text-muted-foreground/50 mt-2 text-center flex items-center justify-center gap-1">
                <Info className="h-3 w-3" />
                Crédito em até 1 dia útil após aprovação
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* ─── ELIGIBLE TRANSACTIONS TABLE ─── */}
      {enrichedEligible.length > 0 && (
        <Panel>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/20">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground/70" />
              <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">
                Transações retidas
              </h3>
              <span className="text-[11px] text-muted-foreground/50 font-numbers ml-1">
                · {stats.eligibleCount} retidas · {fmt(stats.retainedTotal)}
              </span>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10">
                <TableRow className="border-border/20 hover:bg-transparent">
                  <TableHead className="w-[100px]">Vencimento</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="text-right">Valor retido</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedEligible.slice(0, 50).map((tx: any) => (
                  <TableRow key={tx.id} className="border-border/15">
                    <TableCell className="font-numbers text-xs text-muted-foreground/80">
                      {tx.daysLeft}d
                    </TableCell>
                    <TableCell>
                      {tx.inWindow ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                          <CheckCircle2 className="h-3 w-3" /> Elegível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted/20 text-muted-foreground/60">
                          Fora do período
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-numbers font-bold text-foreground text-sm">
                      {fmt(tx.retained_amount)}
                    </TableCell>
                    <TableCell className="text-right font-numbers text-warning text-sm">
                      {tx.inWindow ? `−${fmt(tx.fee)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-numbers font-bold text-success text-sm">
                      {tx.inWindow ? fmt(tx.net) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {/* ─── HOW IT WORKS — minimal info ─── */}
      <Panel>
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-border/20">
          <Shield className="h-4 w-4 text-muted-foreground/70" />
          <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">
            Como funciona
          </h3>
        </div>
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
          {[
            { icon: Clock, title: "Retenção", desc: "Transações aprovadas têm período de retenção definido pela adquirente." },
            { icon: Percent, title: "Taxa pro-rata", desc: "2,5% a cada 15 dias restantes — quanto menor o tempo, menor a taxa." },
            { icon: CheckCircle2, title: "Crédito", desc: "Valor líquido creditado no saldo disponível em até 1 dia útil." },
          ].map((item) => (
            <div key={item.title} className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {item.title}
                </h4>
              </div>
              <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

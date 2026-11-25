import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDownToLine, BadgePercent, CheckCircle2, Clock, Coins, Landmark, Loader2, MinusCircle,
  PlusCircle, Receipt, RefreshCw, Scale, ShieldAlert, ShoppingBag, Snowflake, Tag, TrendingUp, Undo2, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, premiumTable } from "@/pages/admin/tabs/AdminPremium";
import { cn } from "@/lib/utils";
import { brl, rpcErrorMessage } from "./types";
import { SellerSelect } from "./SellerSelect";
import { FinancialCharts } from "./FinancialCharts";

interface MethodRow { method: string; count: number; gross: number; fee: number; fee_percent: number; fee_fixed: number; acquirer_fee: number }
interface Metrics {
  totals: { count: number; all_count: number; conversion: number; gross: number; platform_fee: number; fee_percent: number; fee_fixed: number; acquirer_fee: number; seller_net: number; discounts: number; platform_profit: number };
  methods: MethodRow[];
  daily: { day: string; gross: number; fee: number; profit: number; count: number }[];
  outflows: { refunds: number; chargebacks: number; dispute_holds: number; dispute_releases: number; adjust_credit: number; adjust_debit: number; med_lost: number; med_open: number; dispute_fees: number };
  withdrawals: { paid_count: number; paid_amount: number; fee: number; pending_count: number; pending_amount: number; rejected_count: number };
}

const METHOD_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão", credit_card: "Cartão", boleto: "Boleto", outro: "Outro" };
const PRESETS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
];
/** O banco recusa períodos maiores que isso. */
export const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

/** Data civil de São Paulo (yyyy-mm-dd). Usar UTC faz "hoje" virar "amanhã" depois das 21h. */
export const brDay = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Valida o período e devolve o intervalo em ISO para as funções do banco. */
export function resolveRange(from: string, to: string): { error: string | null; s: string; e: string } {
  if (!from || !to) return { error: "Escolha a data inicial e a final.", s: "", e: "" };
  const s = new Date(`${from}T00:00:00-03:00`);
  const end = new Date(`${to}T00:00:00-03:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(end.getTime())) return { error: "Data inválida.", s: "", e: "" };
  if (end < s) return { error: "A data final precisa ser igual ou depois da inicial.", s: "", e: "" };
  const e = new Date(end.getTime() + DAY_MS);
  if (e.getTime() - s.getTime() > MAX_RANGE_DAYS * DAY_MS) return { error: `O período máximo é de ${MAX_RANGE_DAYS} dias.`, s: "", e: "" };
  return { error: null, s: s.toISOString(), e: e.toISOString() };
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h3 className="font-display text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>
        {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
      </div>
      <PremiumMetricGrid cols={4}>{children}</PremiumMetricGrid>
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando métricas">
      {[0, 1, 2].map((g) => (
        <div key={g} className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-[12px] border border-border/60 bg-muted/30" />)}
        </div>
      ))}
    </div>
  );
}

/** Platform money metrics by period, seller and acquirer. Values come from one server function. */
export function FinancialMetricsPanel({ profiles, allowSellerFilter = true }: { profiles?: Tables<"profiles">[]; allowSellerFilter?: boolean }) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(() => brDay(new Date(Date.now() - 29 * DAY_MS)));
  const [to, setTo] = useState(() => brDay(new Date()));
  const [seller, setSeller] = useState("");
  const [acquirer, setAcquirer] = useState("all");

  const pickPreset = (value: string) => {
    setPreset(value);
    if (value === "custom") return;
    setFrom(brDay(new Date(Date.now() - (Number(value) - 1) * DAY_MS)));
    setTo(brDay(new Date()));
  };

  const acqs = useQuery({
    queryKey: ["acq-basic"], staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_acquirers_basic");
      if (error) throw error;
      return data ?? [];
    },
  });

  const range = useMemo(() => resolveRange(from, to), [from, to]);

  const q = useQuery({
    queryKey: ["fin-metrics", range.s, range.e, seller, acquirer], staleTime: 30_000, enabled: !range.error,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_metrics", { _from: range.s, _to: range.e, _seller: seller || undefined, _acquirer: acquirer === "all" ? undefined : acquirer });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as Metrics;
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["fin-series"] });
    void q.refetch();
  };

  const m = q.data;
  const empty = !!m && m.totals.all_count === 0 && m.methods.length === 0;
  const withSeller = allowSellerFilter && !!profiles;

  return (
    <div className="space-y-6">
      <PremiumPanel
        title="Filtros"
        action={
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={q.isFetching} className="h-8 gap-1.5 text-[12px]">
            {q.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
          </Button>
        }
      >
        <div className="space-y-4">
          <PremiumSegmented value={preset} options={PRESETS} onChange={pickPreset} />
          <div className={cn("grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3", withSeller ? "lg:grid-cols-[repeat(4,minmax(0,1fr))]" : "lg:grid-cols-[repeat(3,minmax(0,1fr))]")}>
            <div className="space-y-1"><Label htmlFor="fm-from" className="text-[12px] font-medium text-muted-foreground">De</Label>
              <Input id="fm-from" type="date" value={from} max={to || undefined} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></div>
            <div className="space-y-1"><Label htmlFor="fm-to" className="text-[12px] font-medium text-muted-foreground">Até</Label>
              <Input id="fm-to" type="date" value={to} min={from || undefined} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></div>
            {withSeller && (
              <div className="col-span-2 space-y-1 lg:col-span-1"><Label className="text-[12px] font-medium text-muted-foreground">Seller</Label>
                <SellerSelect profiles={profiles ?? []} value={seller} onChange={setSeller} allowAll /></div>
            )}
            <div className="col-span-2 space-y-1 lg:col-span-1"><Label className="text-[12px] font-medium text-muted-foreground">Adquirente</Label>
              <Select value={acquirer} onValueChange={setAcquirer}>
                <SelectTrigger aria-label="Adquirente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(acqs.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {acqs.isError && <p className="text-[11px] text-muted-foreground">Não foi possível carregar a lista de adquirentes; o filtro "Todas" continua valendo.</p>}
            </div>
          </div>
          {range.error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{range.error}</p>}
        </div>
      </PremiumPanel>

      {!range.error && <FinancialCharts from={range.s} to={range.e} seller={seller} acquirer={acquirer === "all" ? undefined : acquirer} />}

      {range.error ? null
      : q.isLoading ? <SkeletonGrid />
      : q.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-destructive">Não foi possível carregar as métricas.</p>
          <p className="max-w-md text-[12px] text-muted-foreground">{(q.error as Error).message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>Tentar de novo</Button>
        </div>
      )
      : m && (
        empty ? <PremiumPanel><PremiumEmpty icon={Receipt} title="Nenhuma venda neste período" subtitle="Troque o período ou os filtros para ver os números." /></PremiumPanel> : (
        <>
          <Group title="Entradas" hint="Vendas aprovadas no período, incluindo as que depois foram reembolsadas ou contestadas (elas aparecem em Saídas).">
            <PremiumMetric icon={Wallet} label="Total que passou" value={brl(m.totals.gross)} sub="vendas aprovadas" tone="primary" />
            <PremiumMetric icon={ShoppingBag} label="Vendas aprovadas" value={String(m.totals.count)} sub={`de ${m.totals.all_count} tentativas`} />
            <PremiumMetric icon={CheckCircle2} label="Conversão" value={`${m.totals.conversion.toLocaleString("pt-BR")}%`} sub="das tentativas" tone="success" />
            <PremiumMetric icon={Coins} label="Líquido dos sellers" value={brl(m.totals.seller_net)} sub="depois das taxas" />
          </Group>
          <Group title="Taxas e lucro da plataforma">
            <PremiumMetric icon={BadgePercent} label="Taxas cobradas" value={brl(m.totals.platform_fee)} sub="percentual + fixa" />
            <PremiumMetric icon={BadgePercent} label="Taxa percentual" value={brl(m.totals.fee_percent)} />
            <PremiumMetric icon={Receipt} label="Taxa fixa" value={brl(m.totals.fee_fixed)} />
            <PremiumMetric icon={ArrowDownToLine} label="Taxas de saque" value={brl(m.withdrawals.fee)} sub="saques pagos" />
            <PremiumMetric icon={Landmark} label="Custo das adquirentes" value={brl(m.totals.acquirer_fee)} tone="destructive" />
            <PremiumMetric icon={Scale} label="Taxas de disputa" value={brl(m.outflows.dispute_fees)} />
            <PremiumMetric icon={TrendingUp} label="Lucro da plataforma" value={brl(m.totals.platform_profit)} sub="depois dos custos" tone="success" />
            <PremiumMetric icon={Tag} label="Descontos de cupom" value={brl(m.totals.discounts)} />
          </Group>
          <Group title="Saídas e saques">
            <PremiumMetric icon={Undo2} label="Reembolsos" value={brl(m.outflows.refunds)} tone="destructive" />
            <PremiumMetric icon={AlertTriangle} label="Chargebacks" value={brl(m.outflows.chargebacks)} tone="destructive" />
            <PremiumMetric icon={ShieldAlert} label="MED perdido" value={brl(m.outflows.med_lost)} tone="destructive" />
            <PremiumMetric icon={Snowflake} label="MED em aberto" value={brl(m.outflows.med_open)} sub="valor congelado agora" tone="warning" />
            <PremiumMetric icon={ArrowDownToLine} label="Saques pagos" value={brl(m.withdrawals.paid_amount)} sub={`${m.withdrawals.paid_count} ${m.withdrawals.paid_count === 1 ? "saque" : "saques"}`} />
            <PremiumMetric icon={Clock} label="Saques pendentes" value={brl(m.withdrawals.pending_amount)} sub={`${m.withdrawals.pending_count} ${m.withdrawals.pending_count === 1 ? "saque" : "saques"}`} tone="warning" />
            <PremiumMetric icon={PlusCircle} label="Ajustes de crédito" value={brl(m.outflows.adjust_credit)} />
            <PremiumMetric icon={MinusCircle} label="Ajustes de débito" value={brl(m.outflows.adjust_debit)} />
          </Group>

          <PremiumPanel title="Por forma de pagamento" className="[&>div]:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className={premiumTable.headRow}><tr>{["Método", "Vendas", "Volume", "Taxa total", "Taxa %", "Taxa fixa", "Custo adquirente", "Lucro"].map((h, i) => <th key={h} className={cn(premiumTable.th, i > 0 && "text-right")}>{h}</th>)}</tr></thead>
                <tbody>
                  {m.methods.length === 0 ? <tr><td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">Sem vendas aprovadas no período</td></tr>
                  : m.methods.map((r) => (
                    <tr key={r.method} className={cn(premiumTable.row, "tabular-nums")}>
                      <td className={cn(premiumTable.td, "font-semibold")}>{METHOD_LABEL[r.method] ?? r.method}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{r.count}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(r.gross)}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(r.fee)}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(r.fee_percent)}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(r.fee_fixed)}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(r.acquirer_fee)}</td>
                      <td className={cn(premiumTable.td, "text-right font-semibold")}>{brl(r.fee - r.acquirer_fee)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </PremiumPanel>

          <PremiumPanel title="Dia a dia" className="[&>div]:p-0">
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[480px] text-left text-[12.5px]">
                <thead className={premiumTable.headRow}><tr>{["Dia", "Vendas", "Volume", "Taxas", "Lucro"].map((h, i) => <th key={h} className={cn(premiumTable.th, i > 0 && "text-right")}>{h}</th>)}</tr></thead>
                <tbody>
                  {m.daily.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sem vendas aprovadas no período</td></tr>
                  : m.daily.map((d) => (
                    <tr key={d.day} className={cn(premiumTable.row, "tabular-nums")}>
                      <td className={premiumTable.td}>{d.day.split("-").reverse().join("/")}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{d.count}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(d.gross)}</td>
                      <td className={cn(premiumTable.td, "text-right")}>{brl(d.fee)}</td>
                      <td className={cn(premiumTable.td, "text-right font-semibold")}>{brl(d.profit)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </PremiumPanel>
        </>
        )
      )}
    </div>
  );
}

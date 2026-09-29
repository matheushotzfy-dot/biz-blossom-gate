import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
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
const PRESETS = [{ v: "1", l: "Hoje" }, { v: "7", l: "7 dias" }, { v: "30", l: "30 dias" }, { v: "90", l: "90 dias" }, { v: "custom", l: "Personalizado" }];
const day = (d: Date) => d.toISOString().slice(0, 10);

function Tile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-base font-semibold tabular-nums ${tone === "neg" ? "text-destructive" : tone === "pos" ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-xs font-semibold">{title}</h3><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div></section>;
}

/** Platform money metrics by period, seller and acquirer. Values come from one server function. */
export function FinancialMetricsPanel({ profiles, allowSellerFilter = true }: { profiles?: Tables<"profiles">[]; allowSellerFilter?: boolean }) {
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(day(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(day(new Date()));
  const [seller, setSeller] = useState("");
  const [acquirer, setAcquirer] = useState("all");

  useEffect(() => {
    if (preset === "custom") return;
    setFrom(day(new Date(Date.now() - (Number(preset) - 1) * 86400000))); setTo(day(new Date()));
  }, [preset]);

  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => {
    const { data } = await supabase.rpc("list_acquirers_basic"); return data ?? [];
  } });

  const range = useMemo(() => {
    const s = new Date(`${from}T00:00:00-03:00`); const e = new Date(`${to}T00:00:00-03:00`); e.setDate(e.getDate() + 1);
    return { s: s.toISOString(), e: e.toISOString() };
  }, [from, to]);

  const q = useQuery({
    queryKey: ["fin-metrics", range, seller, acquirer], staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_financial_metrics", { _from: range.s, _to: range.e, _seller: seller || undefined, _acquirer: acquirer === "all" ? undefined : acquirer });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as Metrics;
    },
  });

  const m = q.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="space-y-1"><Label>Período</Label>
          <Select value={preset} onValueChange={setPreset}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="fm-from">De</Label><Input id="fm-from" type="date" value={from} max={to} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></div>
        <div className="space-y-1"><Label htmlFor="fm-to">Até</Label><Input id="fm-to" type="date" value={to} min={from} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></div>
        {allowSellerFilter && profiles && <div className="space-y-1"><Label>Seller</Label><SellerSelect profiles={profiles} value={seller} onChange={setSeller} allowAll /></div>}
        <div className="space-y-1"><Label>Adquirente</Label>
          <Select value={acquirer} onValueChange={setAcquirer}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{(acqs.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <FinancialCharts from={range.s} to={range.e} seller={seller} acquirer={acquirer === "all" ? undefined : acquirer} />

      {q.isLoading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      : q.error ? <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{(q.error as Error).message}</p>
      : m && (
        <>
          <Group title="Entradas">
            <Tile label="Total que passou (aprovado)" value={brl(m.totals.gross)} />
            <Tile label="Vendas aprovadas" value={`${m.totals.count} de ${m.totals.all_count}`} />
            <Tile label="Conversão" value={`${m.totals.conversion}%`} />
            <Tile label="Líquido dos sellers" value={brl(m.totals.seller_net)} />
          </Group>
          <Group title="Suas taxas e lucro">
            <Tile label="Taxas cobradas" value={brl(m.totals.platform_fee)} />
            <Tile label="Taxa %" value={brl(m.totals.fee_percent)} />
            <Tile label="Taxa fixa" value={brl(m.totals.fee_fixed)} />
            <Tile label="Taxas de saque" value={brl(m.withdrawals.fee)} />
            <Tile label="Custo das adquirentes" value={brl(m.totals.acquirer_fee)} tone="neg" />
            <Tile label="Taxas de disputa" value={brl(m.outflows.dispute_fees)} />
            <Tile label="Lucro da plataforma" value={brl(m.totals.platform_profit)} tone="pos" />
            <Tile label="Descontos de cupom" value={brl(m.totals.discounts)} />
          </Group>
          <Group title="Saídas">
            <Tile label="Reembolsos" value={brl(m.outflows.refunds)} tone="neg" />
            <Tile label="Chargebacks" value={brl(m.outflows.chargebacks)} tone="neg" />
            <Tile label="MED perdido" value={brl(m.outflows.med_lost)} tone="neg" />
            <Tile label="MED em aberto (congelado)" value={brl(m.outflows.med_open)} />
            <Tile label="Saques pagos" value={`${brl(m.withdrawals.paid_amount)} · ${m.withdrawals.paid_count}`} />
            <Tile label="Saques pendentes" value={`${brl(m.withdrawals.pending_amount)} · ${m.withdrawals.pending_count}`} />
            <Tile label="Ajustes crédito" value={brl(m.outflows.adjust_credit)} />
            <Tile label="Ajustes débito" value={brl(m.outflows.adjust_debit)} />
          </Group>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Por forma de pagamento</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-muted-foreground"><tr>{["Método", "Vendas", "Volume", "Taxa total", "Taxa %", "Taxa fixa", "Custo adquirente", "Lucro"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {m.methods.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sem vendas no período</td></tr>
                  : m.methods.map((r) => (
                    <tr key={r.method} className="border-t border-border font-mono tabular-nums">
                      <td className="px-3 py-2 font-sans font-semibold">{METHOD_LABEL[r.method] ?? r.method}</td><td className="px-3 py-2">{r.count}</td>
                      <td className="px-3 py-2">{brl(r.gross)}</td><td className="px-3 py-2">{brl(r.fee)}</td><td className="px-3 py-2">{brl(r.fee_percent)}</td>
                      <td className="px-3 py-2">{brl(r.fee_fixed)}</td><td className="px-3 py-2">{brl(r.acquirer_fee)}</td><td className="px-3 py-2">{brl(r.fee - r.acquirer_fee)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Dia a dia</h3>
            <div className="max-h-72 overflow-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left text-muted-foreground"><tr>{["Dia", "Vendas", "Volume", "Taxas", "Lucro"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>
                  {m.daily.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem vendas no período</td></tr>
                  : m.daily.map((d) => (
                    <tr key={d.day} className="border-t border-border font-mono tabular-nums">
                      <td className="px-3 py-2">{d.day.split("-").reverse().join("/")}</td><td className="px-3 py-2">{d.count}</td>
                      <td className="px-3 py-2">{brl(d.gross)}</td><td className="px-3 py-2">{brl(d.fee)}</td><td className="px-3 py-2">{brl(d.profit)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

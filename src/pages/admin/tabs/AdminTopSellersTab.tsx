import { Fragment, useEffect, useMemo, useState } from "react";
import { Crown, Medal, TrendingUp, DollarSign, Percent, Receipt, Clock, CreditCard, Smartphone, FileText, Download, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, premiumTable } from "./AdminPremium";
import { cn } from "@/lib/utils";

interface Props { profiles: Tables<"profiles">[]; transactions: Tables<"transactions">[]; fmtCurrency: (v: number) => string; }
type Period = "today" | "week" | "month" | "all";
const PERIOD_DAYS: Record<Period, number | null> = { today: 1, week: 7, month: 30, all: null };

interface SellerRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  seller_type: string | null;
  profile_created_at: string | null;
  tx_approved: number;
  tx_count: number;
  gross: number;
  net: number;
  fees: number;
  refunded: number;
  chargeback: number;
  last_sale_at: string | null;
  by_method: Record<string, { count: number; gross: number }>;
  peak_hour: number;
  peak_count: number;
}

interface Payload {
  totals: { gross: number; net: number; fees: number; tx: number };
  sellers: SellerRow[];
}

export default function AdminTopSellersTab({ fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Payload>({ totals: { gross: 0, net: 0, fees: 0, tx: 0 }, sellers: [] });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const days = PERIOD_DAYS[period];
    supabase
      .rpc("get_admin_top_sellers", { _period_days: days as any })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { console.error(error); setData({ totals: { gross: 0, net: 0, fees: 0, tx: 0 }, sellers: [] }); }
        else {
          const p = (data as any) ?? {};
          const sellers: SellerRow[] = (p.sellers ?? []).map((s: any) => ({
            ...s,
            gross: Number(s.gross) || 0, net: Number(s.net) || 0, fees: Number(s.fees) || 0,
            refunded: Number(s.refunded) || 0, chargeback: Number(s.chargeback) || 0,
            tx_approved: Number(s.tx_approved) || 0, tx_count: Number(s.tx_count) || 0,
            peak_hour: Number(s.peak_hour) || 0, peak_count: Number(s.peak_count) || 0,
            by_method: s.by_method || {},
          }));
          const totals = {
            gross: Number(p.totals?.gross) || 0,
            net: Number(p.totals?.net) || 0,
            fees: Number(p.totals?.fees) || 0,
            tx: Number(p.totals?.tx) || 0,
          };
          setData({ totals, sellers });
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [period]);

  const ranked = data.sellers;
  const totals = data.totals;
  const ticketAvg = useMemo(() => (totals.tx > 0 ? totals.gross / totals.tx : 0), [totals]);

  const rankIcon = (i: number) =>
    i === 0 ? <Crown className="h-4 w-4 text-warning" /> :
    i === 1 ? <Medal className="h-4 w-4 text-muted-foreground" /> :
    i === 2 ? <Medal className="h-4 w-4 text-primary" /> :
    <span className="font-mono text-[11px] font-black text-muted-foreground">#{i + 1}</span>;

  const typeBadge = (t: string | null) => t === "black" ? "BLACK" : t === "white" ? "WHITE" : "—";
  const methodIcon = (m: string) =>
    m === "credit_card" ? <CreditCard className="h-3 w-3" /> :
    m === "pix" ? <Smartphone className="h-3 w-3" /> :
    <FileText className="h-3 w-3" />;
  const methodLabel = (m: string) =>
    m === "credit_card" ? "Cartão" : m === "pix" ? "PIX" : m === "boleto" ? "Boleto" : m;

  const ticketOf = (s: SellerRow) => s.tx_approved > 0 ? s.gross / s.tx_approved : 0;
  const approvalRate = (s: SellerRow) => s.tx_count > 0 ? (s.tx_approved / s.tx_count) * 100 : 0;

  const exportCSV = () => {
    const rows = [
      ["#", "Seller", "Email", "Documento", "Tipo", "Vendas", "Bruto", "Líquido", "Taxas", "Ticket Médio", "Reembolsos", "Chargebacks", "Pico Hora", "Última Venda"],
      ...ranked.map((r, i) => [
        i + 1, r.full_name || "Sem nome", r.email || "", r.document_number || "", r.seller_type || "",
        r.tx_approved, r.gross.toFixed(2), r.net.toFixed(2), r.fees.toFixed(2),
        ticketOf(r).toFixed(2), r.refunded.toFixed(2), r.chargeback.toFixed(2),
        `${r.peak_hour}h`, r.last_sale_at ? new Date(r.last_sale_at).toLocaleString("pt-BR") : "",
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `top-sellers-${period}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Ranking Comercial"
        title="Top Sellers"
        subtitle="Leaderboard financeiro detalhado: TPV, ticket médio, métodos, horário de pico e consistência."
        status={{ tone: "warning", label: "Performance", pulse: true }}
        actions={
          <div className="flex items-center gap-2">
            <PremiumSegmented<Period> value={period} onChange={setPeriod} options={[
              { value: "today", label: "Hoje" }, { value: "week", label: "7d" },
              { value: "month", label: "30d" }, { value: "all", label: "Tudo" }
            ]} />
            <button onClick={exportCSV} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground transition-all duration-200 hover:border-primary hover:text-primary active:scale-[0.98]">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        }
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={DollarSign} label="TPV Bruto" value={fmtCurrency(totals.gross)} sub={`${totals.tx} vendas aprovadas`} tone="success" />
        <PremiumMetric icon={TrendingUp} label="Receita Líquida" value={fmtCurrency(totals.net)} sub="depois das taxas" tone="info" />
        <PremiumMetric icon={Percent} label="Taxas Geradas" value={fmtCurrency(totals.fees)} sub={`take rate ${totals.gross > 0 ? ((totals.fees / totals.gross) * 100).toFixed(2) : "0.00"}%`} tone="primary" />
        <PremiumMetric icon={Receipt} label="Ticket Médio" value={fmtCurrency(ticketAvg)} sub={`${ranked.length} sellers ativos`} tone="neutral" />
      </PremiumMetricGrid>

      {/* Pódio Top 3 — clean, solid borders, sem halos/blur */}
      {ranked.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ranked.slice(0, 3).map((s, i) => {
            const share = totals.gross > 0 ? (s.gross / totals.gross) * 100 : 0;
            const accent = i === 0 ? "warning" : i === 1 ? "muted-foreground" : "primary";
            const accentText = i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-primary";
            const accentBorderHover = i === 0 ? "hover:border-warning" : i === 1 ? "hover:border-muted-foreground" : "hover:border-primary";
            return (
              <button
                key={s.user_id}
                onClick={() => setExpanded(expanded === s.user_id ? null : s.user_id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border bg-card p-5 text-left transition-all duration-200",
                  "hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  accentBorderHover
                )}
              >
                <span className={cn("absolute inset-x-0 top-0 h-[2px]", `bg-${accent}`)} />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-muted/30 text-base font-black text-foreground transition-colors duration-200 group-hover:border-current", accentText)}>
                      {(s.full_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{s.full_name || "Sem nome"}</p>
                      <p className="truncate text-[10px] font-bold text-muted-foreground">{s.email || "—"}</p>
                    </div>
                  </div>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card", accentText)}>
                    {rankIcon(i)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Bruto</p>
                    <p className={cn("mt-0.5 font-display text-lg font-black tabular-nums", accentText)}>{fmtCurrency(s.gross)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Vendas</p>
                    <p className="mt-0.5 font-display text-lg font-black tabular-nums text-foreground">{s.tx_approved}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Líquido</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-info">{fmtCurrency(s.net)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ticket</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{fmtCurrency(ticketOf(s))}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>Share TPV</span><span className={accentText}>{share.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all duration-700", `bg-${accent}`)} style={{ width: `${Math.max(share, 2)}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <PremiumPanel title={`Ranking Completo (${ranked.length})`} eyebrow="Clique na linha para ver detalhamento" icon={TrendingUp}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs font-bold">Carregando rankings…</span>
          </div>
        ) : (
        <div className={premiumTable.wrapper}>
          <table className={premiumTable.table}>
            <thead>
              <tr className={premiumTable.headRow}>
                {["#", "Seller", "Tipo", "Vendas", "Bruto", "Líquido", "Taxas", "Ticket", "Pico", "Share", ""].map(h => (
                  <th key={h} className={premiumTable.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => {
                const isOpen = expanded === s.user_id;
                const share = totals.gross > 0 ? (s.gross / totals.gross) * 100 : 0;
                return (
                  <Fragment key={s.user_id}>
                    <tr className={cn(premiumTable.row, "cursor-pointer transition-colors duration-150 hover:bg-muted/40")} onClick={() => setExpanded(isOpen ? null : s.user_id)}>
                      <td className={premiumTable.td}>{rankIcon(i)}</td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30 text-xs font-black text-foreground">{(s.full_name || "?")[0]?.toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-foreground">{s.full_name || "Sem nome"}</p>
                            <p className="truncate text-[10px] font-bold text-muted-foreground">{s.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={premiumTable.td}><span className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[9px] font-black text-muted-foreground">{typeBadge(s.seller_type)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-foreground tabular-nums">{s.tx_approved}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-primary tabular-nums">{fmtCurrency(s.gross)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-info tabular-nums">{fmtCurrency(s.net)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-success tabular-nums">{fmtCurrency(s.fees)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-bold text-foreground tabular-nums">{fmtCurrency(ticketOf(s))}</span></td>
                      <td className={premiumTable.td}><span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Clock className="h-3 w-3" />{s.peak_hour}h</span></td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(share, 1)}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] font-black text-muted-foreground tabular-nums">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className={premiumTable.td}>{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${s.user_id}-d`} className="bg-muted/20">
                        <td colSpan={11} className="p-5">
                          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div className="rounded-lg border border-border bg-card p-4">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contato</p>
                              <div className="space-y-1 text-xs">
                                <p className="text-foreground/80">{s.email || "—"}</p>
                                <p className="text-foreground/80">{s.phone || "—"}</p>
                                <p className="text-muted-foreground">Doc: {s.document_number || "—"}</p>
                                <p className="text-muted-foreground">Desde: {s.profile_created_at ? new Date(s.profile_created_at).toLocaleDateString("pt-BR") : "—"}</p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-card p-4">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Métodos de Pagamento</p>
                              <div className="space-y-1.5">
                                {Object.entries(s.by_method).sort((a, b) => Number(b[1].gross) - Number(a[1].gross)).map(([m, v]) => (
                                  <div key={m} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1.5 font-bold text-foreground">{methodIcon(m)}{methodLabel(m)}</span>
                                    <span className="text-muted-foreground tabular-nums">{Number(v.count)} · {fmtCurrency(Number(v.gross))}</span>
                                  </div>
                                ))}
                                {Object.keys(s.by_method).length === 0 && <p className="text-[11px] text-muted-foreground">Sem dados</p>}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border bg-card p-4">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ajustes & Risco</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Reembolsos</span><span className="font-bold text-warning tabular-nums">{fmtCurrency(s.refunded)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Chargebacks</span><span className="font-bold text-destructive tabular-nums">{fmtCurrency(s.chargeback)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Total tentativas</span><span className="font-bold text-foreground tabular-nums">{s.tx_count}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Taxa aprovação</span><span className="font-bold text-foreground tabular-nums">{approvalRate(s).toFixed(1)}%</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Última venda</span><span className="font-bold text-foreground">{s.last_sale_at ? new Date(s.last_sale_at).toLocaleString("pt-BR") : "—"}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {ranked.length === 0 && (
                <tr><td colSpan={11} className="py-16 text-center text-xs font-bold text-muted-foreground">Nenhuma venda no período selecionado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </PremiumPanel>
    </div>
  );
}

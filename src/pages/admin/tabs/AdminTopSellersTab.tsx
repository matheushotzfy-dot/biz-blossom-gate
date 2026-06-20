import { Fragment, useMemo, useState } from "react";
import { Trophy, Crown, Medal, TrendingUp, Users, DollarSign, Percent, BarChart3, Calendar, Receipt, Clock, CreditCard, Smartphone, FileText, Download, ChevronDown, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, premiumTable } from "./AdminPremium";
import { cn } from "@/lib/utils";

interface Props { profiles: Tables<"profiles">[]; transactions: Tables<"transactions">[]; fmtCurrency: (v: number) => string; }
type Period = "today" | "week" | "month" | "all";

interface SellerRow {
  userId: string; name: string; email: string; phone: string | null; document: string | null;
  sellerType: string | null; createdAt: string;
  gross: number; net: number; fees: number; refunded: number; chargeback: number;
  txCount: number; txApproved: number; ticketAvg: number;
  byMethod: Record<string, { count: number; gross: number }>;
  peakHour: number; peakHourCount: number;
  lastSaleAt: string | null;
}

export default function AdminTopSellersTab({ profiles, transactions, fmtCurrency }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { ranked, totals } = useMemo(() => {
    const now = new Date();
    const inRange = (d: Date) => {
      if (period === "today") return d.toDateString() === now.toDateString();
      if (period === "week") return d >= new Date(now.getTime() - 7 * 864e5);
      if (period === "month") return d >= new Date(now.getTime() - 30 * 864e5);
      return true;
    };

    const map = new Map<string, SellerRow>();
    const init = (uid: string): SellerRow => {
      const p = profiles.find(x => x.user_id === uid);
      return {
        userId: uid,
        name: p?.full_name || "Sem nome",
        email: p?.email || "",
        phone: p?.phone ?? null,
        document: (p as any)?.document_number ?? null,
        sellerType: (p as any)?.seller_type ?? null,
        createdAt: p?.created_at || "",
        gross: 0, net: 0, fees: 0, refunded: 0, chargeback: 0,
        txCount: 0, txApproved: 0, ticketAvg: 0,
        byMethod: {}, peakHour: 0, peakHourCount: 0, lastSaleAt: null,
      };
    };

    const hoursPerSeller = new Map<string, number[]>();

    transactions.forEach(t => {
      const d = new Date(t.created_at);
      if (!inRange(d)) return;
      const row = map.get(t.user_id) || init(t.user_id);
      row.txCount += 1;
      const status = String(t.status);
      const amt = Number(t.amount) || 0;
      const net = Number(t.net_amount) || 0;
      const fee = Number(t.fee_amount) || 0;
      if (status === "completed" || status === "approved") {
        row.txApproved += 1;
        row.gross += amt; row.net += net; row.fees += fee;
        const method = t.payment_method || "outro";
        row.byMethod[method] = row.byMethod[method] || { count: 0, gross: 0 };
        row.byMethod[method].count += 1;
        row.byMethod[method].gross += amt;
        if (!row.lastSaleAt || d > new Date(row.lastSaleAt)) row.lastSaleAt = t.created_at;
        const hrs = hoursPerSeller.get(t.user_id) || new Array(24).fill(0);
        hrs[d.getHours()] += 1;
        hoursPerSeller.set(t.user_id, hrs);
      } else if (status === "refunded") {
        row.refunded += amt;
      } else if (status === "chargeback") {
        row.chargeback += amt;
      }
      map.set(t.user_id, row);
    });

    map.forEach(row => {
      row.ticketAvg = row.txApproved > 0 ? row.gross / row.txApproved : 0;
      const hrs = hoursPerSeller.get(row.userId);
      if (hrs) {
        let max = 0, hour = 0;
        hrs.forEach((c, i) => { if (c > max) { max = c; hour = i; } });
        row.peakHour = hour; row.peakHourCount = max;
      }
    });

    const ranked = Array.from(map.values()).filter(r => r.txApproved > 0).sort((a, b) => b.gross - a.gross);
    const totals = {
      gross: ranked.reduce((a, r) => a + r.gross, 0),
      net: ranked.reduce((a, r) => a + r.net, 0),
      fees: ranked.reduce((a, r) => a + r.fees, 0),
      tx: ranked.reduce((a, r) => a + r.txApproved, 0),
    };
    return { ranked, totals };
  }, [profiles, transactions, period]);

  const ticketAvg = totals.tx > 0 ? totals.gross / totals.tx : 0;

  const rankIcon = (i: number) =>
    i === 0 ? <Crown className="h-5 w-5 text-warning" /> :
    i === 1 ? <Medal className="h-5 w-5 text-muted-foreground" /> :
    i === 2 ? <Medal className="h-5 w-5 text-primary" /> :
    <span className="font-mono text-[11px] font-black text-muted-foreground">#{i + 1}</span>;

  const typeBadge = (t: string | null) => t === "black" ? "BLACK" : t === "white" ? "WHITE" : "—";

  const methodIcon = (m: string) =>
    m === "credit_card" ? <CreditCard className="h-3 w-3" /> :
    m === "pix" ? <Smartphone className="h-3 w-3" /> :
    <FileText className="h-3 w-3" />;
  const methodLabel = (m: string) =>
    m === "credit_card" ? "Cartão" : m === "pix" ? "PIX" : m === "boleto" ? "Boleto" : m;

  const exportCSV = () => {
    const rows = [
      ["#", "Seller", "Email", "Documento", "Tipo", "Vendas", "Bruto", "Líquido", "Taxas", "Ticket Médio", "Reembolsos", "Chargebacks", "Pico Hora", "Última Venda"],
      ...ranked.map((r, i) => [
        i + 1, r.name, r.email, r.document || "", r.sellerType || "",
        r.txApproved, r.gross.toFixed(2), r.net.toFixed(2), r.fees.toFixed(2),
        r.ticketAvg.toFixed(2), r.refunded.toFixed(2), r.chargeback.toFixed(2),
        `${r.peakHour}h`, r.lastSaleAt ? new Date(r.lastSaleAt).toLocaleString("pt-BR") : "",
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
            <button onClick={exportCSV} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground hover:border-primary/40">
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

      {ranked.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
          {/* Re-ordena visualmente: 2º, 1º, 3º para criar o efeito de pódio */}
          {[1, 0, 2].map((rankIdx) => {
            const s = ranked[rankIdx];
            if (!s) return <div key={`empty-${rankIdx}`} className="hidden md:block" />;
            const i = rankIdx;
            const share = totals.gross > 0 ? (s.gross / totals.gross) * 100 : 0;
            const isFirst = i === 0;
            const heightCls = isFirst ? "md:min-h-[360px]" : i === 1 ? "md:min-h-[300px]" : "md:min-h-[280px]";
            const accent = isFirst ? "warning" : i === 1 ? "muted" : "primary";
            return (
              <button
                key={s.userId}
                onClick={() => setExpanded(expanded === s.userId ? null : s.userId)}
                className={cn(
                  "group relative overflow-hidden rounded-[28px] border bg-card p-6 text-left transition-all duration-500",
                  "hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  heightCls,
                  isFirst
                    ? "border-warning/40 shadow-[0_0_0_1px_hsl(var(--warning)/0.15)_inset] md:scale-[1.04]"
                    : "border-border/60 hover:border-primary/40"
                )}
              >
                {/* Halo background */}
                <div
                  className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-80"
                  style={{
                    background:
                      accent === "warning"
                        ? "radial-gradient(circle, hsl(var(--warning)/0.35), transparent 70%)"
                        : accent === "primary"
                        ? "radial-gradient(circle, hsl(var(--primary)/0.25), transparent 70%)"
                        : "radial-gradient(circle, hsl(var(--muted-foreground)/0.18), transparent 70%)",
                  }}
                />
                {/* Top accent bar */}
                <span className={cn(
                  "absolute inset-x-0 top-0 h-[3px]",
                  isFirst ? "bg-gradient-to-r from-transparent via-warning to-transparent" :
                  i === 1 ? "bg-gradient-to-r from-transparent via-muted-foreground/60 to-transparent" :
                  "bg-gradient-to-r from-transparent via-primary to-transparent"
                )} />

                {/* Rank chip flutuante */}
                <div className={cn(
                  "absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl border-2 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6",
                  isFirst ? "border-warning/50 bg-warning/15" :
                  i === 1 ? "border-border bg-muted/40" :
                  "border-primary/30 bg-primary/10"
                )}>
                  {rankIcon(i)}
                </div>

                <div className="relative flex flex-col items-center pt-4 text-center">
                  <div className={cn(
                    "flex shrink-0 items-center justify-center rounded-full border-2 font-black transition-all duration-500 group-hover:scale-110",
                    isFirst ? "h-24 w-24 border-warning/40 bg-warning/10 text-warning text-3xl" :
                    "h-20 w-20 border-border/60 bg-muted/30 text-foreground text-2xl"
                  )}>
                    {s.name[0]?.toUpperCase() || "?"}
                  </div>
                  {isFirst && (
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-warning">
                      <Crown className="h-3 w-3" /> Top Performer
                    </div>
                  )}
                  <p className={cn("mt-3 truncate max-w-full font-black text-foreground", isFirst ? "text-base" : "text-sm")}>{s.name}</p>
                  <p className="truncate max-w-full text-[10px] font-bold text-muted-foreground">{s.email}</p>
                </div>

                <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-border/40 pt-4 text-center">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Bruto</p>
                    <p className={cn("mt-1 font-display font-black tabular-nums", isFirst ? "text-xl text-warning" : "text-base text-primary")}>{fmtCurrency(s.gross)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Vendas</p>
                    <p className={cn("mt-1 font-display font-black tabular-nums text-foreground", isFirst ? "text-xl" : "text-base")}>{s.txApproved}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Líquido</p>
                    <p className="mt-1 text-sm font-bold text-info tabular-nums">{fmtCurrency(s.net)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ticket</p>
                    <p className="mt-1 text-sm font-bold text-foreground tabular-nums">{fmtCurrency(s.ticketAvg)}</p>
                  </div>
                </div>

                <div className="relative mt-4">
                  <div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>Share TPV</span><span className={isFirst ? "text-warning" : "text-foreground"}>{share.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isFirst ? "bg-gradient-to-r from-warning via-warning to-warning/60" :
                        i === 1 ? "bg-gradient-to-r from-muted-foreground to-muted-foreground/50" :
                        "bg-gradient-to-r from-primary to-primary/60"
                      )}
                      style={{ width: `${Math.max(share, 3)}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <PremiumPanel title={`Ranking Completo (${ranked.length})`} eyebrow="Clique na linha para ver detalhamento" icon={TrendingUp}>
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
                const isOpen = expanded === s.userId;
                return (
                  <Fragment key={s.userId}>
                    <tr className={cn(premiumTable.row, "cursor-pointer")} onClick={() => setExpanded(isOpen ? null : s.userId)}>
                      <td className={premiumTable.td}>{rankIcon(i)}</td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{s.name[0]?.toUpperCase() || "?"}</div>
                          <div>
                            <p className="text-xs font-black text-foreground">{s.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={premiumTable.td}><span className="rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[9px] font-black text-muted-foreground">{typeBadge(s.sellerType)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-foreground tabular-nums">{s.txApproved}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-primary tabular-nums">{fmtCurrency(s.gross)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-info tabular-nums">{fmtCurrency(s.net)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-success tabular-nums">{fmtCurrency(s.fees)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-bold text-foreground tabular-nums">{fmtCurrency(s.ticketAvg)}</span></td>
                      <td className={premiumTable.td}><span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Clock className="h-3 w-3" />{s.peakHour}h</span></td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted/50">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${totals.gross > 0 ? Math.max((s.gross / totals.gross) * 100, 1) : 0}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] font-black text-muted-foreground">{totals.gross > 0 ? ((s.gross / totals.gross) * 100).toFixed(1) : "0.0"}%</span>
                        </div>
                      </td>
                      <td className={premiumTable.td}>{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${s.userId}-d`} className="bg-muted/10">
                        <td colSpan={11} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Contato</p>
                              <div className="space-y-1 text-xs">
                                <p className="text-foreground/80">{s.email || "—"}</p>
                                <p className="text-foreground/80">{s.phone || "—"}</p>
                                <p className="text-muted-foreground">Doc: {s.document || "—"}</p>
                                <p className="text-muted-foreground">Desde: {s.createdAt ? new Date(s.createdAt).toLocaleDateString("pt-BR") : "—"}</p>
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Métodos de Pagamento</p>
                              <div className="space-y-1.5">
                                {Object.entries(s.byMethod).sort((a, b) => b[1].gross - a[1].gross).map(([m, v]) => (
                                  <div key={m} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="inline-flex items-center gap-1.5 font-bold text-foreground">{methodIcon(m)}{methodLabel(m)}</span>
                                    <span className="text-muted-foreground tabular-nums">{v.count} · {fmtCurrency(v.gross)}</span>
                                  </div>
                                ))}
                                {Object.keys(s.byMethod).length === 0 && <p className="text-[11px] text-muted-foreground">Sem dados</p>}
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ajustes & Risco</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Reembolsos</span><span className="font-bold text-warning tabular-nums">{fmtCurrency(s.refunded)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Chargebacks</span><span className="font-bold text-destructive tabular-nums">{fmtCurrency(s.chargeback)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Total tentativas</span><span className="font-bold text-foreground tabular-nums">{s.txCount}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Taxa aprovação</span><span className="font-bold text-foreground tabular-nums">{s.txCount > 0 ? ((s.txApproved / s.txCount) * 100).toFixed(1) : "0.0"}%</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Última venda</span><span className="font-bold text-foreground">{s.lastSaleAt ? new Date(s.lastSaleAt).toLocaleString("pt-BR") : "—"}</span></div>
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
      </PremiumPanel>
    </div>
  );
}

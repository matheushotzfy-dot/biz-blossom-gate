import { Fragment, useEffect, useMemo, useState } from "react";
import { UserX, Search, Mail, AlertTriangle, Calendar, Copy, Download, MessageCircle, ChevronRight, ChevronDown, DollarSign, Percent, Loader2, Phone, Clock, ArrowUpDown } from "lucide-react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, premiumTable } from "./AdminPremium";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

interface SellerRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  seller_type: string | null;
  profile_created_at: string;
  admin_notes: string | null;
  last_login_at: string | null;
  last_tx_at: string | null;
  last_activity: string;
  days_since: number;
  tx_count: number;
  tx_approved: number;
  gross: number;
  net: number;
  fees: number;
  refunded: number;
  chargeback: number;
}

interface Payload {
  totals: { count: number; gross: number; fees: number; avg_days: number; critical: number };
  sellers: SellerRow[];
}

type SortKey = "days" | "gross" | "fees" | "tx";

const THRESHOLDS = [2, 5, 7, 14, 30, 60];

export default function AdminInactiveSellersTab({ fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [days, setDays] = useState(7);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Payload>({ totals: { count: 0, gross: 0, fees: 0, avg_days: 0, critical: 0 }, sellers: [] });

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.rpc("get_admin_inactive_sellers", { _days_threshold: days })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { console.error(error); setData({ totals: { count: 0, gross: 0, fees: 0, avg_days: 0, critical: 0 }, sellers: [] }); }
        else {
          const p = (data as unknown as Partial<Payload>) ?? {};
          const sellers: SellerRow[] = (p.sellers ?? []).map((s) => ({
            ...s,
            gross: Number(s.gross) || 0, net: Number(s.net) || 0, fees: Number(s.fees) || 0,
            refunded: Number(s.refunded) || 0, chargeback: Number(s.chargeback) || 0,
            tx_count: Number(s.tx_count) || 0, tx_approved: Number(s.tx_approved) || 0,
            days_since: Number(s.days_since) || 0,
          }));
          setData({
            totals: {
              count: Number(p.totals?.count) || 0,
              gross: Number(p.totals?.gross) || 0,
              fees: Number(p.totals?.fees) || 0,
              avg_days: Number(p.totals?.avg_days) || 0,
              critical: Number(p.totals?.critical) || 0,
            },
            sellers,
          });
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [days]);

  const filtered = useMemo(() => {
    let rows = data.sellers;
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.phone || "").toLowerCase().includes(s) ||
        (r.document_number || "").toLowerCase().includes(s)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      switch (sort) {
        case "gross": return b.gross - a.gross;
        case "fees": return b.fees - a.fees;
        case "tx": return b.tx_approved - a.tx_approved;
        default: return b.days_since - a.days_since;
      }
    });
    return sorted;
  }, [data.sellers, search, sort]);

  const ticketOf = (r: SellerRow) => r.tx_approved > 0 ? r.gross / r.tx_approved : 0;

  const fmtWhats = (p: string | null) => {
    if (!p) return null;
    const d = p.replace(/\D/g, "");
    if (d.length < 10) return null;
    return d.startsWith("55") ? d : `55${d}`;
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const exportCSV = () => {
    const out = [
      ["Nome", "Email", "Telefone", "Documento", "Tipo", "Última atividade", "Dias inativo", "Vendas", "Bruto", "Líquido", "Taxas pagas", "Reembolsos", "Chargebacks", "Observações"],
      ...filtered.map(r => [
        r.full_name || "", r.email || "", r.phone || "", r.document_number || "", r.seller_type || "",
        new Date(r.last_activity).toLocaleString("pt-BR"), r.days_since,
        r.tx_approved, r.gross.toFixed(2), r.net.toFixed(2), r.fees.toFixed(2),
        r.refunded.toFixed(2), r.chargeback.toFixed(2), (r.admin_notes || "").replace(/\n/g, " ")
      ])
    ];
    const csv = out.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `inativos-${days}d-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeBadge = (t: string | null) =>
    t === "black" ? <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-foreground">Black</span> :
    t === "white" ? <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">White</span> :
    <span className="rounded border border-border bg-muted/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-muted-foreground">—</span>;

  const riskLevel = (d: number) =>
    d >= 60 ? { label: "Churn", text: "text-destructive", dot: "bg-destructive" } :
    d >= 30 ? { label: "Crítico", text: "text-destructive", dot: "bg-destructive/80" } :
    d >= 14 ? { label: "Alerta", text: "text-warning", dot: "bg-warning" } :
    { label: "Recente", text: "text-success", dot: "bg-success" };

  const totals = data.totals;
  const buckets = useMemo(() => {
    const all = data.sellers;
    const b = [
      { label: "Recente", range: `${days}-13d`, count: all.filter(r => r.days_since >= days && r.days_since < 14).length, bg: "bg-success", text: "text-success" },
      { label: "Alerta", range: "14-29d", count: all.filter(r => r.days_since >= 14 && r.days_since < 30).length, bg: "bg-warning", text: "text-warning" },
      { label: "Crítico", range: "30-59d", count: all.filter(r => r.days_since >= 30 && r.days_since < 60).length, bg: "bg-destructive/80", text: "text-destructive" },
      { label: "Churn", range: "60d+", count: all.filter(r => r.days_since >= 60).length, bg: "bg-destructive", text: "text-destructive" },
    ];
    return b;
  }, [data.sellers, days]);
  const bucketsTotal = buckets.reduce((a, b) => a + b.count, 0) || 1;

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSort(k)}
      className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-black uppercase tracking-wider transition-colors",
        sort === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40")}>
      <ArrowUpDown className="h-3 w-3" /> {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Retenção · Sellers em Risco"
        title="Sellers Inativos"
        subtitle="Pipeline de churn por janela de inatividade. Aja antes do seller virar perda."
        status={{ tone: totals.critical > 0 ? "destructive" : "warning", label: `${totals.count} inativos`, pulse: totals.critical > 0 }}
        actions={
          <button onClick={exportCSV} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground transition-all duration-200 hover:border-primary hover:text-primary active:scale-[0.98]">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        }
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={UserX} label="Sellers Inativos" value={String(totals.count)} sub={`${days}+ dias sem atividade`} tone="warning" />
        <PremiumMetric icon={DollarSign} label="GMV Histórico" value={fmtCurrency(totals.gross)} sub="acumulado destes sellers" tone="primary" />
        <PremiumMetric icon={Percent} label="Taxas Pagas" value={fmtCurrency(totals.fees)} sub="receita já gerada" tone="success" />
        <PremiumMetric icon={AlertTriangle} label="Críticos (30d+)" value={String(totals.critical)} sub={`média ${totals.avg_days}d sem atividade`} tone={totals.critical > 0 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      {/* Distribuição de risco — limpa, bordas sólidas */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Distribuição de Risco</p>
            <p className="font-display text-base font-black uppercase tracking-tight text-foreground">Pipeline de Churn</p>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{data.sellers.length} sellers</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full border border-border bg-muted">
          {buckets.map(b => b.count > 0 && (
            <div key={b.label} className={cn("h-full transition-all duration-700", b.bg)} style={{ width: `${(b.count / bucketsTotal) * 100}%` }} title={`${b.label}: ${b.count}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {buckets.map(b => (
            <div key={b.label} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors duration-200 hover:border-primary/40">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", b.bg)} />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{b.label} · {b.range}</p>
                <div className="flex items-baseline justify-between">
                  <p className={cn("font-display text-base font-black tabular-nums", b.text)}>{b.count}</p>
                  <p className="text-[9px] font-bold text-muted-foreground tabular-nums">{((b.count / bucketsTotal) * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar: busca + threshold + sort */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input placeholder="Buscar por nome, email, telefone, doc..." value={search} onChange={e => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            <span className="px-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">Inativo</span>
            {THRESHOLDS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={cn("h-7 rounded-md px-2.5 text-[10px] font-black transition-all duration-150",
                  days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                {d}d+
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ordenar</span>
          <SortBtn k="days" label="Dias" />
          <SortBtn k="gross" label="GMV" />
          <SortBtn k="fees" label="Taxas" />
          <SortBtn k="tx" label="Vendas" />
        </div>
      </div>

      <PremiumPanel title={`Inativos há ${days}+ dias (${filtered.length})`} eyebrow="Clique numa linha para detalhar contato, faturamento e observações" icon={UserX}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs font-bold">Carregando sellers inativos…</span>
          </div>
        ) : (
        <div className={premiumTable.wrapper}>
          <table className={premiumTable.table}>
            <thead>
              <tr className={premiumTable.headRow}>
                {["Seller", "Risco", "Tipo", "Última atividade", "Dias", "Vendas", "GMV", "Taxas", "Contato", ""].map(h => (
                  <th key={h} className={premiumTable.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isOpen = expanded === r.id;
                const wa = fmtWhats(r.phone);
                const risk = riskLevel(r.days_since);
                return (
                  <Fragment key={r.id}>
                    <tr className={cn(premiumTable.row, "cursor-pointer transition-colors duration-150 hover:bg-muted/40")} onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30 text-xs font-black text-foreground">{(r.full_name || "?")[0]?.toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-foreground">{r.full_name || "Sem nome"}</p>
                            <p className="truncate text-[10px] font-bold text-muted-foreground">{r.email || r.document_number || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={cn("inline-flex items-center gap-1.5 rounded border border-border bg-card px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", risk.text)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", risk.dot)} />
                          {risk.label}
                        </span>
                      </td>
                      <td className={premiumTable.td}>{typeBadge(r.seller_type)}</td>
                      <td className={premiumTable.td}>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                          <Calendar className="h-3 w-3" />{new Date(r.last_activity).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={cn("inline-flex items-center gap-1 text-xs font-black tabular-nums", risk.text)}>
                          <Clock className="h-3 w-3" />{r.days_since}d
                        </span>
                      </td>
                      <td className={premiumTable.td}><span className="text-xs font-bold text-foreground tabular-nums">{r.tx_approved}<span className="text-muted-foreground">/{r.tx_count}</span></span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-primary tabular-nums">{fmtCurrency(r.gross)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-success tabular-nums">{fmtCurrency(r.fees)}</span></td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {r.email && (
                            <a href={`mailto:${r.email}`} title={r.email} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {wa && (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" title={r.phone || ""} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-success hover:text-success">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {r.email && (
                            <button onClick={() => copy(r.email!, "Email")} title="Copiar email" className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={premiumTable.td}>{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-d`} className="bg-muted/20">
                        <td colSpan={10} className="p-5">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-lg border border-border bg-card p-4">
                              <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Identificação</p>
                              <dl className="space-y-2 text-xs">
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Nome</dt><dd className="text-right font-bold text-foreground">{r.full_name || "—"}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Email</dt><dd className="break-all text-right font-bold text-foreground">{r.email || "—"}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Telefone</dt><dd className="text-right font-bold text-foreground">{r.phone || "—"}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Documento</dt><dd className="text-right font-bold text-foreground">{r.document_number || "—"}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Cadastro</dt><dd className="text-right font-bold text-foreground">{new Date(r.profile_created_at).toLocaleDateString("pt-BR")}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Último login</dt><dd className="text-right font-bold text-foreground">{r.last_login_at ? new Date(r.last_login_at).toLocaleDateString("pt-BR") : "—"}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Última venda</dt><dd className="text-right font-bold text-foreground">{r.last_tx_at ? new Date(r.last_tx_at).toLocaleDateString("pt-BR") : "—"}</dd></div>
                              </dl>
                            </div>
                            <div className="rounded-lg border border-border bg-card p-4">
                              <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Resumo Financeiro</p>
                              <dl className="space-y-2 text-xs">
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">GMV bruto</dt><dd className="text-right font-black text-primary tabular-nums">{fmtCurrency(r.gross)}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Receita líquida</dt><dd className="text-right font-black text-info tabular-nums">{fmtCurrency(r.net)}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Taxas pagas</dt><dd className="text-right font-black text-success tabular-nums">{fmtCurrency(r.fees)}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Ticket médio</dt><dd className="text-right font-bold text-foreground tabular-nums">{fmtCurrency(ticketOf(r))}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reembolsos</dt><dd className="text-right font-bold text-warning tabular-nums">{fmtCurrency(r.refunded)}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Chargebacks</dt><dd className="text-right font-bold text-destructive tabular-nums">{fmtCurrency(r.chargeback)}</dd></div>
                                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vendas (aprov./total)</dt><dd className="text-right font-bold text-foreground tabular-nums">{r.tx_approved}/{r.tx_count}</dd></div>
                              </dl>
                            </div>
                            <div className="flex flex-col rounded-lg border border-border bg-card p-4">
                              <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Observações & Ações</p>
                              <div className="min-h-[80px] flex-1 rounded-md border border-border bg-muted/20 p-3 text-xs whitespace-pre-wrap text-foreground/80">
                                {r.admin_notes ? r.admin_notes : <span className="italic text-muted-foreground">Sem observações registradas. Edite no perfil do seller.</span>}
                              </div>
                              <div className="mt-3 grid grid-cols-1 gap-2">
                                {wa && (
                                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá ${(r.full_name || "").split(" ")[0]}, sentimos sua falta na plataforma!`)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-success bg-success/10 px-3 py-2 text-xs font-black text-success transition-colors hover:bg-success hover:text-success-foreground">
                                    <MessageCircle className="h-3.5 w-3.5" /> Reativar via WhatsApp
                                  </a>
                                )}
                                {r.email && (
                                  <a href={`mailto:${r.email}?subject=${encodeURIComponent("Sentimos sua falta!")}`}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground transition-colors hover:border-primary hover:text-primary">
                                    <Mail className="h-3.5 w-3.5" /> Enviar email
                                  </a>
                                )}
                                {r.phone && (
                                  <button onClick={() => copy(r.phone!, "Telefone")}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-black text-foreground transition-colors hover:border-primary hover:text-primary">
                                    <Phone className="h-3.5 w-3.5" /> Copiar telefone
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="py-16 text-center text-xs font-bold text-muted-foreground">
                  {data.sellers.length === 0 ? "Todos os sellers estão ativos no período" : "Nenhum seller encontrado para a busca"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </PremiumPanel>
    </div>
  );
}

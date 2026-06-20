import { Fragment, useMemo, useState } from "react";
import { UserX, Search, Mail, AlertTriangle, Calendar, TrendingDown, Phone, Copy, Download, MessageCircle, FileText, ChevronRight, ChevronDown, DollarSign, Percent, Receipt } from "lucide-react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, premiumTable } from "./AdminPremium";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

interface Row {
  id: string; userId: string; name: string; email: string; phone: string | null;
  document: string | null; sellerType: string | null; createdAt: string; notes: string | null;
  lastActivity: Date; daysSince: number;
  txCount: number; txApproved: number; gross: number; net: number; fees: number;
  refunded: number; chargeback: number; ticketAvg: number;
}

export default function AdminInactiveSellersTab({ profiles, transactions, fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [daysThreshold, setDaysThreshold] = useState(7);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysThreshold * 864e5);
    const out: Row[] = profiles.map(p => {
      const txs = transactions.filter(t => t.user_id === p.user_id);
      const approved = txs.filter(t => t.status === "completed" || t.status === "approved");
      const gross = approved.reduce((a, t) => a + Number(t.amount || 0), 0);
      const net = approved.reduce((a, t) => a + Number(t.net_amount || 0), 0);
      const fees = approved.reduce((a, t) => a + Number(t.fee_amount || 0), 0);
      const refunded = txs.filter(t => t.status === "refunded").reduce((a, t) => a + Number(t.amount || 0), 0);
      const chargeback = txs.filter(t => t.status === "chargeback").reduce((a, t) => a + Number(t.amount || 0), 0);
      const lastTx = txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const lastLogin = p.last_login_at ? new Date(p.last_login_at) : null;
      const lastActivity = lastLogin || (lastTx ? new Date(lastTx.created_at) : new Date(p.created_at));
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / 864e5);
      return {
        id: p.id, userId: p.user_id, name: p.full_name || "Sem nome", email: p.email || "",
        phone: p.phone, document: (p as any).document_number ?? null, sellerType: (p as any).seller_type ?? null,
        createdAt: p.created_at, notes: (p as any).admin_notes ?? null,
        lastActivity, daysSince,
        txCount: txs.length, txApproved: approved.length, gross, net, fees, refunded, chargeback,
        ticketAvg: approved.length > 0 ? gross / approved.length : 0,
      };
    });
    return out.filter(r => r.lastActivity < cutoff).sort((a, b) => b.daysSince - a.daysSince);
  }, [profiles, transactions, daysThreshold]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || (r.phone || "").toLowerCase().includes(s) || (r.document || "").toLowerCase().includes(s));
  }, [rows, search]);

  const totals = {
    count: rows.length,
    gross: rows.reduce((a, r) => a + r.gross, 0),
    fees: rows.reduce((a, r) => a + r.fees, 0),
    avgDays: rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.daysSince, 0) / rows.length) : 0,
    critical: rows.filter(r => r.daysSince >= 30).length,
  };

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
    const data = [
      ["Nome", "Email", "Telefone", "Documento", "Tipo", "Última atividade", "Dias inativo", "Vendas", "Bruto", "Líquido", "Taxas pagas", "Reembolsos", "Chargebacks", "Observações"],
      ...rows.map(r => [
        r.name, r.email, r.phone || "", r.document || "", r.sellerType || "",
        r.lastActivity.toLocaleString("pt-BR"), r.daysSince,
        r.txApproved, r.gross.toFixed(2), r.net.toFixed(2), r.fees.toFixed(2),
        r.refunded.toFixed(2), r.chargeback.toFixed(2), (r.notes || "").replace(/\n/g, " ")
      ])
    ];
    const csv = data.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `inativos-${daysThreshold}d-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const typeBadge = (t: string | null) =>
    t === "black" ? <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] font-black uppercase text-foreground">Black</span> :
    t === "white" ? <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">White</span> :
    <span className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">—</span>;

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Retenção · Sellers em Risco"
        title="Sellers Inativos"
        subtitle="Identifique vendedores em churn iminente e dispare campanhas de remarketing."
        status={{ tone: totals.critical > 0 ? "destructive" : "warning", label: `${totals.count} inativos`, pulse: totals.critical > 0 }}
        actions={
          <button onClick={exportCSV} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground hover:border-primary/40">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        }
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={UserX} label="Sellers Inativos" value={String(totals.count)} sub={`+${daysThreshold} dias sem atividade`} tone="warning" />
        <PremiumMetric icon={DollarSign} label="Faturamento Histórico" value={fmtCurrency(totals.gross)} sub="acumulado destes sellers" tone="primary" />
        <PremiumMetric icon={Percent} label="Taxas Pagas" value={fmtCurrency(totals.fees)} sub="receita gerada para a plataforma" tone="success" />
        <PremiumMetric icon={AlertTriangle} label="Críticos (30d+)" value={String(totals.critical)} sub={`média ${totals.avgDays}d sem atividade`} tone={totals.critical > 0 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input placeholder="Buscar por nome, email, telefone, doc..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div className="flex gap-0.5 bg-muted/30 border border-border rounded-lg p-0.5">
          {[2, 5, 7, 14, 30, 60].map(d => (
            <button key={d} onClick={() => setDaysThreshold(d)}
              className={cn("relative px-2.5 py-1 rounded text-[10px] font-bold transition-all duration-200",
                daysThreshold === d
                  ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              {d}d+
            </button>
          ))}
        </div>
      </div>

      <PremiumPanel title={`Inativos há ${daysThreshold}+ dias (${filtered.length})`} eyebrow="Clique na linha para ver tudo: contato, faturamento, taxas e observações" icon={UserX}>
        <div className={premiumTable.wrapper}>
          <table className={premiumTable.table}>
            <thead>
              <tr className={premiumTable.headRow}>
                {["Seller", "Tipo", "Última atividade", "Dias", "Vendas", "Faturamento", "Taxas pagas", "Contato", ""].map(h => (
                  <th key={h} className={premiumTable.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isOpen = expanded === r.id;
                const wa = fmtWhats(r.phone);
                return (
                  <Fragment key={r.id}>
                    <tr className={cn(premiumTable.row, "cursor-pointer", r.daysSince >= 30 && "bg-destructive/[0.03]")} onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 text-xs font-black text-foreground">{r.name[0]?.toUpperCase() || "?"}</div>
                          <div>
                            <p className="text-xs font-black text-foreground">{r.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{r.document || "Sem documento"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={premiumTable.td}>{typeBadge(r.sellerType)}</td>
                      <td className={premiumTable.td}>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <Calendar className="h-3 w-3" />{r.lastActivity.toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-black tabular-nums",
                          r.daysSince >= 30 ? "text-destructive" : r.daysSince >= 14 ? "text-warning" : "text-foreground")}>
                          {r.daysSince >= 30 && <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" /></span>}
                          {r.daysSince}d
                        </span>
                      </td>
                      <td className={premiumTable.td}><span className="text-xs font-bold text-foreground tabular-nums">{r.txApproved}/{r.txCount}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-primary tabular-nums">{fmtCurrency(r.gross)}</span></td>
                      <td className={premiumTable.td}><span className="text-xs font-black text-success tabular-nums">{fmtCurrency(r.fees)}</span></td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {r.email && (
                            <a href={`mailto:${r.email}`} title={r.email} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {wa && (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" title={r.phone || ""} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:border-success/40 hover:text-success">
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {r.email && (
                            <button onClick={() => copy(r.email, "Email")} title="Copiar email" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:border-primary/40 hover:text-primary">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={premiumTable.td}>{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.id}-d`} className="bg-muted/10">
                        <td colSpan={9} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Identificação</p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Nome</span><span className="font-bold text-foreground text-right">{r.name}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Email</span><span className="font-bold text-foreground text-right break-all">{r.email || "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Telefone</span><span className="font-bold text-foreground text-right">{r.phone || "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Documento</span><span className="font-bold text-foreground text-right">{r.document || "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Cadastro</span><span className="font-bold text-foreground text-right">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Resumo Financeiro</p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Faturamento bruto</span><span className="font-black text-primary tabular-nums">{fmtCurrency(r.gross)}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Receita líquida</span><span className="font-black text-info tabular-nums">{fmtCurrency(r.net)}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Taxas pagas</span><span className="font-black text-success tabular-nums">{fmtCurrency(r.fees)}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Ticket médio</span><span className="font-bold text-foreground tabular-nums"><Receipt className="inline h-3 w-3 mr-1" />{fmtCurrency(r.ticketAvg)}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Reembolsos</span><span className="font-bold text-warning tabular-nums">{fmtCurrency(r.refunded)}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Chargebacks</span><span className="font-bold text-destructive tabular-nums">{fmtCurrency(r.chargeback)}</span></div>
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Observações Admin</p>
                              <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground/80 min-h-[80px] whitespace-pre-wrap">
                                {r.notes ? r.notes : <span className="text-muted-foreground italic">Sem observações registradas. Edite no perfil do seller.</span>}
                              </div>
                              {wa && (
                                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá ${r.name.split(" ")[0]}, sentimos sua falta na plataforma!`)}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-black text-success hover:bg-success/20">
                                  <MessageCircle className="h-3.5 w-3.5" /> Reativar via WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center text-xs font-bold text-muted-foreground">
                  {rows.length === 0 ? "🎉 Todos os sellers estão ativos!" : "Nenhum seller encontrado para a busca"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumPanel>
    </div>
  );
}

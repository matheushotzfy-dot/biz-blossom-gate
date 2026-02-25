import { useState, useMemo } from "react";
import { UserX, Search, Clock, Mail, AlertTriangle, Users, Calendar, TrendingDown, Phone } from "lucide-react";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

export default function AdminInactiveSellersTab({ profiles, transactions, fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [daysThreshold, setDaysThreshold] = useState(2);

  const now = new Date();
  const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  const inactiveSellers = useMemo(() => {
    return profiles
      .map(p => {
        const lastLogin = p.last_login_at ? new Date(p.last_login_at) : null;
        const lastTx = transactions
          .filter(t => t.user_id === p.user_id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const lastActivity = lastLogin || (lastTx ? new Date(lastTx.created_at) : new Date(p.created_at));
        const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        const txs = transactions.filter(t => t.user_id === p.user_id);
        const completed = txs.filter(t => t.status === "completed" || t.status === "approved");
        const totalRevenue = completed.reduce((a, t) => a + Number(t.net_amount), 0);

        return {
          ...p,
          lastActivity,
          daysSince,
          txCount: txs.length,
          completedCount: completed.length,
          totalRevenue,
          isInactive: lastActivity < thresholdDate,
        };
      })
      .filter(p => p.isInactive)
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [profiles, transactions, daysThreshold]);

  const filtered = inactiveSellers.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.full_name?.toLowerCase().includes(s)) || (p.email?.toLowerCase().includes(s)) || (p.phone?.toLowerCase().includes(s));
  });

  const totalLostRevenue = inactiveSellers.reduce((a, p) => a + p.totalRevenue, 0);
  const avgDaysInactive = inactiveSellers.length > 0
    ? Math.round(inactiveSellers.reduce((a, p) => a + p.daysSince, 0) / inactiveSellers.length)
    : 0;
  const weekPlus = inactiveSellers.filter(p => p.daysSince >= 7).length;
  const monthPlus = inactiveSellers.filter(p => p.daysSince >= 30).length;

  const formatWhatsApp = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return null;
    return digits.startsWith("55") ? digits : `55${digits}`;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<UserX className="h-4 w-4" />} label="Sellers Inativos" value={String(inactiveSellers.length)} sub={`+${daysThreshold} dias sem atividade`} alert={inactiveSellers.length > 0} />
        <AdminKpi icon={<TrendingDown className="h-4 w-4" />} label="Receita Acumulada" value={fmtCurrency(totalLostRevenue)} sub="Desses sellers" />
        <AdminKpi icon={<Calendar className="h-4 w-4" />} label="Média Inatividade" value={`${avgDaysInactive} dias`} sub="Por seller" />
        <AdminKpi icon={<AlertTriangle className="h-4 w-4" />} label="Críticos" value={`${weekPlus} (7d) / ${monthPlus} (30d)`} sub="Inativos severos" alert={monthPlus > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar seller..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <div className="flex gap-0.5 bg-muted/30 border border-border rounded-lg p-0.5">
          {[2, 5, 7, 14, 30].map(d => (
            <button key={d} onClick={() => setDaysThreshold(d)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${daysThreshold === d ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {d}d+
            </button>
          ))}
        </div>
      </div>

      <AdminPanel>
        <PanelTitle color="red" icon={<UserX className="h-4 w-4" />}>
          Sellers Inativos há {daysThreshold}+ dias ({filtered.length})
        </PanelTitle>
        <p className="text-[10px] text-muted-foreground mt-1 mb-3">Ideal para remarketing: enviar email, WhatsApp ou notificação</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Vendedor", "Tipo", "Última Atividade", "Dias", "Vendas", "Receita", "Contato"].map(h => (
                <th key={h} className="text-left p-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const whatsapp = formatWhatsApp(p.phone);
                return (
                  <tr key={p.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${p.daysSince >= 30 ? "bg-destructive/[0.03]" : ""}`}>
                    <td className="p-2.5">
                      <p className="text-xs font-bold text-foreground">{p.full_name || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground">{p.document_number || "—"}</p>
                    </td>
                    <td className="p-2.5">
                      <SellerTypeBadge type={p.seller_type} />
                    </td>
                    <td className="p-2.5 text-[11px] text-muted-foreground">
                      {p.lastActivity.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-2.5">
                      <span className={`text-xs font-bold ${p.daysSince >= 30 ? "text-destructive" : p.daysSince >= 7 ? "text-warning" : "text-foreground"}`}>
                        {p.daysSince}d
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-foreground/70">{p.completedCount}/{p.txCount}</td>
                    <td className="p-2.5 text-xs font-bold text-primary">{fmtCurrency(p.totalRevenue)}</td>
                    <td className="p-2.5">
                      <div className="flex flex-col gap-1">
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {p.email}
                          </a>
                        )}
                        {whatsapp ? (
                          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </a>
                        ) : p.phone ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground text-xs">
                  {inactiveSellers.length === 0 ? "Todos os sellers estão ativos! 🎉" : "Nenhum seller encontrado"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

function SellerTypeBadge({ type }: { type: string | null }) {
  if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">B</span>;
  if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">W</span>;
  return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">?</span>;
}

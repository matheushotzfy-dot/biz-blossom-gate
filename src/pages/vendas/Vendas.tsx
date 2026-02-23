import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user?.id]);

  const approved = transactions.filter((t) => t.status === "completed");
  const totalSales = approved.reduce((a, t) => a + Number(t.amount), 0);
  const avgTicket = approved.length > 0 ? totalSales / approved.length : 0;

  return (
    <PageShell>
      <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Vendas" subtitle="Visão geral das suas vendas" />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <MetricMini icon={<DollarSign className="h-4 w-4 md:h-5 md:w-5" />} label="Total" value={`R$ ${totalSales.toFixed(2)}`} sub={`${approved.length} vendas`} cls="text-primary bg-primary/10" />
        <MetricMini icon={<TrendingUp className="h-4 w-4 md:h-5 md:w-5" />} label="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} cls="text-blue-500 bg-blue-500/10" />
        <MetricMini icon={<CreditCard className="h-4 w-4 md:h-5 md:w-5" />} label="Conversão" value={`${transactions.length > 0 ? ((approved.length / transactions.length) * 100).toFixed(0) : 0}%`} cls="text-purple-500 bg-purple-500/10" />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Cliente", "E-mail", "Valor", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma venda encontrada</td></tr>
                ) : transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{tx.id.slice(0, 8)}</td>
                    <td className="p-3.5 text-foreground font-medium text-[13px]">{tx.customer_name || "—"}</td>
                    <td className="p-3.5 text-muted-foreground text-[13px]">{tx.customer_email || "—"}</td>
                    <td className="p-3.5 font-bold text-foreground text-[13px]">R$ {Number(tx.amount).toFixed(2)}</td>
                    <td className="p-3.5 capitalize text-muted-foreground text-[13px]">{tx.payment_method}</td>
                    <td className="p-3.5"><StatusBadge status={tx.status} /></td>
                    <td className="p-3.5 text-muted-foreground text-[13px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {transactions.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-4">Nenhuma venda encontrada</p></Panel>
        ) : transactions.map((tx) => (
          <Panel key={tx.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground font-semibold text-sm">{tx.customer_name || "Cliente"}</span>
              <StatusBadge status={tx.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-bold text-base">R$ {Number(tx.amount).toFixed(2)}</span>
              <span className="text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-muted-foreground text-[11px] capitalize">{tx.payment_method || "—"}</span>
              <span className="text-muted-foreground text-[11px]">•</span>
              <span className="text-muted-foreground text-[11px] font-mono">{tx.id.slice(0, 8)}</span>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

function MetricMini({ icon, label, value, sub, cls }: { icon: React.ReactNode; label: string; value: string; sub?: string; cls: string }) {
  return (
    <Panel>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <p className="text-[9px] md:text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`h-6 w-6 md:h-8 md:w-8 rounded-lg md:rounded-xl flex items-center justify-center ${cls}`}>{icon}</div>
      </div>
      <p className="text-base md:text-[22px] font-extrabold text-foreground truncate">{value}</p>
      {sub && <p className="text-[10px] md:text-[11px] mt-1 text-primary">{sub}</p>}
    </Panel>
  );
}

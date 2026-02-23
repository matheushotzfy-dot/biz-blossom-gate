import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, Panel, PageTitle, DataTable } from "@/components/PageShell";
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricMini icon={<DollarSign className="h-5 w-5" />} label="Total Vendido" value={`R$ ${totalSales.toFixed(2)}`} sub={`${approved.length} vendas`} cls="text-primary bg-primary/10" />
        <MetricMini icon={<TrendingUp className="h-5 w-5" />} label="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} cls="text-info bg-info/10" />
        <MetricMini icon={<CreditCard className="h-5 w-5" />} label="Conversão" value={`${transactions.length > 0 ? ((approved.length / transactions.length) * 100).toFixed(0) : 0}%`} cls="text-purple-500 bg-purple-500/10" />
      </div>

      <DataTable headers={["ID", "Cliente", "E-mail", "Valor", "Método", "Status", "Data"]}>
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
      </DataTable>
    </PageShell>
  );
}

function MetricMini({ icon, label, value, sub, cls }: { icon: React.ReactNode; label: string; value: string; sub?: string; cls: string }) {
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${cls}`}>{icon}</div>
      </div>
      <p className="text-[22px] font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-[11px] mt-1 text-primary">{sub}</p>}
    </Panel>
  );
}

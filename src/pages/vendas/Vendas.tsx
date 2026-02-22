import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { DollarSign, TrendingUp, CreditCard } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user]);

  const approved = transactions.filter((t) => t.status === "approved");
  const totalSales = approved.reduce((a, t) => a + Number(t.amount), 0);
  const avgTicket = approved.length > 0 ? totalSales / approved.length : 0;

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" /> Vendas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das suas vendas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Vendido" value={`R$ ${totalSales.toFixed(2)}`} icon={DollarSign} change={`${approved.length} vendas`} changeType="positive" />
        <StatCard title="Ticket Médio" value={`R$ ${avgTicket.toFixed(2)}`} icon={TrendingUp} />
        <StatCard title="Conversão" value={`${transactions.length > 0 ? ((approved.length / transactions.length) * 100).toFixed(0) : 0}%`} icon={CreditCard} />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <div className="p-5 border-b border-border"><h3 className="text-sm font-semibold">Todas as Vendas</h3></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">ID</th>
              <th className="text-left p-4 font-medium">Cliente</th>
              <th className="text-left p-4 font-medium">E-mail</th>
              <th className="text-left p-4 font-medium">Valor</th>
              <th className="text-left p-4 font-medium">Método</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma venda encontrada</td></tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                  <td className="p-4">{tx.customer_name || "—"}</td>
                  <td className="p-4 text-muted-foreground">{tx.customer_email || "—"}</td>
                  <td className="p-4 font-semibold">R$ {Number(tx.amount).toFixed(2)}</td>
                  <td className="p-4 capitalize">{tx.payment_method}</td>
                  <td className="p-4"><StatusBadge status={tx.status} /></td>
                  <td className="p-4 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

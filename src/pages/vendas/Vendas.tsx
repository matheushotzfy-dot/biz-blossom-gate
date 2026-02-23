import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user?.id]);

  const approved = transactions.filter((t) => t.status === "approved");
  const totalSales = approved.reduce((a, t) => a + Number(t.amount), 0);
  const avgTicket = approved.length > 0 ? totalSales / approved.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 text-foreground font-display">
          <ShoppingCart className="h-6 w-6 text-primary" /> Vendas
        </h1>
        <p className="text-foreground/40 text-sm mt-1">Visão geral das suas vendas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-hover rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Total Vendido</p>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground font-display">R$ {totalSales.toFixed(2)}</p>
          <p className="text-xs text-primary mt-1 font-semibold">{approved.length} vendas</p>
        </div>
        <div className="glass-card-hover rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Ticket Médio</p>
            <div className="h-9 w-9 rounded-xl bg-info/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground font-display">R$ {avgTicket.toFixed(2)}</p>
        </div>
        <div className="glass-card-hover rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Conversão</p>
            <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-foreground font-display">{transactions.length > 0 ? ((approved.length / transactions.length) * 100).toFixed(0) : 0}%</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-x-auto">
        <div className="p-5 border-b border-white/[0.04]">
          <h3 className="text-sm font-bold text-foreground">Todas as Vendas</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04] text-foreground/40">
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">ID</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Cliente</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">E-mail</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Valor</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Método</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-foreground/30">Nenhuma venda encontrada</td></tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-mono text-xs text-foreground/50">{tx.id.slice(0, 8)}</td>
                  <td className="p-4 text-foreground font-medium">{tx.customer_name || "—"}</td>
                  <td className="p-4 text-foreground/50">{tx.customer_email || "—"}</td>
                  <td className="p-4 font-bold text-foreground">R$ {Number(tx.amount).toFixed(2)}</td>
                  <td className="p-4 capitalize text-foreground/70">{tx.payment_method}</td>
                  <td className="p-4"><StatusBadge status={tx.status} /></td>
                  <td className="p-4 text-foreground/40">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

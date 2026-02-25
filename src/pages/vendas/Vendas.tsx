import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user?.id]);

  const approved = transactions.filter((t) => t.status === "completed");
  const totalSales = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const avgTicket = approved.length > 0 ? totalSales / approved.length : 0;

  const filtered = search
    ? transactions.filter((t) => t.customer_name?.toLowerCase().includes(search.toLowerCase()) || t.customer_email?.toLowerCase().includes(search.toLowerCase()))
    : transactions;

  return (
    <PageShell>
      <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Vendas" subtitle="Gerencie todas as suas transações" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Vendido</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          </div>
          <p className="text-xl font-extrabold text-foreground">R$ {totalSales.toFixed(2)}</p>
          <p className="text-[11px] text-primary font-semibold mt-0.5">{approved.length} vendas</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ticket Médio</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-info/10"><TrendingUp className="h-4 w-4 text-info" /></div>
          </div>
          <p className="text-xl font-extrabold text-foreground">R$ {avgTicket.toFixed(2)}</p>
        </Panel>
        <Panel className="hidden lg:block">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conversão</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-success/10"><CreditCard className="h-4 w-4 text-success" /></div>
          </div>
          <p className="text-xl font-extrabold text-foreground">{transactions.length > 0 ? ((approved.length / transactions.length) * 100).toFixed(0) : 0}%</p>
        </Panel>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente ou e-mail..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      <div className="hidden md:block">
        <Panel className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Cliente", "E-mail", "WhatsApp", "Valor", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-sm">Nenhuma venda encontrada</td></tr>
                ) : filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{tx.id.slice(0, 8)}</td>
                    <td className="p-3.5 text-foreground font-semibold text-[13px]">{tx.customer_name || "—"}</td>
                    <td className="p-3.5 text-muted-foreground text-[13px]">{tx.customer_email || "—"}</td>
                    <td className="p-3.5 text-muted-foreground text-[13px]">{tx.customer_phone || "—"}</td>
                    <td className="p-3.5 font-bold text-foreground">R$ {Number(tx.net_amount).toFixed(2)}</td>
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

      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-6">Nenhuma venda</p></Panel>
        ) : filtered.map((tx) => (
          <Panel key={tx.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-foreground font-semibold text-sm">{tx.customer_name || "Cliente"}</span>
              <StatusBadge status={tx.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-bold text-lg">R$ {Number(tx.net_amount).toFixed(2)}</span>
              <span className="text-muted-foreground text-[11px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

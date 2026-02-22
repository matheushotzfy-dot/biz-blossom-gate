import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Users, DollarSign, Package, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

export default function Admin() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [txRes, pRes, prodRes, wRes] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*"),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (pRes.data) setProfiles(pRes.data);
      if (prodRes.data) setProducts(prodRes.data);
      if (wRes.data) setWithdrawals(wRes.data);
    };
    load();
  }, [user]);

  const totalRevenue = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalFees = transactions.reduce((acc, t) => acc + Number(t.fee_amount), 0);

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral de todo o sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Usuários" value={String(profiles.length)} icon={Users} />
        <StatCard title="Produtos" value={String(products.length)} icon={Package} />
        <StatCard title="Volume Total" value={`R$ ${totalRevenue.toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Total Taxas" value={`R$ ${totalFees.toFixed(2)}`} icon={TrendingUp} changeType="positive" change="Receita da plataforma" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border"><h3 className="text-sm font-semibold">Últimas Transações</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">ID</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50">
                    <td className="p-3 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                    <td className="p-3 font-semibold">R$ {Number(tx.amount).toFixed(2)}</td>
                    <td className="p-3"><StatusBadge status={tx.status} /></td>
                  </tr>
                ))}
                {transactions.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border"><h3 className="text-sm font-semibold">Últimos Saques</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">ID</th>
                  <th className="text-left p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/50">
                    <td className="p-3 font-mono text-xs">{w.id.slice(0, 8)}</td>
                    <td className="p-3 font-semibold">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-3"><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border"><h3 className="text-sm font-semibold">Usuários Registrados</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-4 font-medium">Nome</th>
                <th className="text-left p-4 font-medium">E-mail</th>
                <th className="text-left p-4 font-medium">Documento</th>
                <th className="text-left p-4 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4">{p.full_name || "—"}</td>
                  <td className="p-4 text-muted-foreground">{p.email || "—"}</td>
                  <td className="p-4 font-mono text-xs">{p.document_number || "—"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem usuários</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

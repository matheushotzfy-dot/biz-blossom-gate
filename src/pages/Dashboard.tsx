import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  ArrowDownToLine,
  CreditCard,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

const mockChartData = [
  { name: "Jan", vendas: 4200, receita: 3800 },
  { name: "Fev", vendas: 5100, receita: 4600 },
  { name: "Mar", vendas: 6800, receita: 6200 },
  { name: "Abr", vendas: 5900, receita: 5300 },
  { name: "Mai", vendas: 7200, receita: 6500 },
  { name: "Jun", vendas: 8100, receita: 7400 },
  { name: "Jul", vendas: 7500, receita: 6800 },
];

const mockBarData = [
  { name: "PIX", value: 62 },
  { name: "Cartão", value: 25 },
  { name: "Boleto", value: 13 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      const [txRes, profileRes] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (profileRes.data) setProfile(profileRes.data);
    };
    loadData();
  }, [user]);

  const totalRevenue = transactions.reduce((acc, t) => t.status === "approved" ? acc + Number(t.amount) : acc, 0);
  const totalNet = transactions.reduce((acc, t) => t.status === "approved" ? acc + Number(t.net_amount) : acc, 0);

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {profile?.full_name || "Usuário"} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          change="+12.5% este mês"
          changeType="positive"
        />
        <StatCard
          title="Receita Líquida"
          value={`R$ ${totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          change="+8.2% este mês"
          changeType="positive"
        />
        <StatCard
          title="Total de Vendas"
          value={String(transactions.length)}
          icon={ShoppingCart}
          change="+5 hoje"
          changeType="positive"
        />
        <StatCard
          title="Saques Pendentes"
          value="R$ 0,00"
          icon={ArrowDownToLine}
          change="Nenhum pendente"
          changeType="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Vendas e Receita</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 15%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 25%, 9%)",
                  border: "1px solid hsl(220, 20%, 15%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="vendas" stroke="hsl(152, 60%, 42%)" fillOpacity={1} fill="url(#colorVendas)" strokeWidth={2} />
              <Area type="monotone" dataKey="receita" stroke="hsl(200, 70%, 50%)" fillOpacity={0.1} fill="hsl(200, 70%, 50%)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Métodos de Pagamento</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mockBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 15%)" />
              <XAxis type="number" stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="hsl(220, 10%, 50%)" fontSize={12} width={60} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 25%, 9%)",
                  border: "1px solid hsl(220, 20%, 15%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="hsl(152, 60%, 42%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Últimas Transações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-4 font-medium">ID</th>
                <th className="text-left p-4 font-medium">Cliente</th>
                <th className="text-left p-4 font-medium">Valor</th>
                <th className="text-left p-4 font-medium">Método</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhuma transação encontrada
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-mono text-xs">{tx.id.slice(0, 8)}...</td>
                    <td className="p-4">{tx.customer_name || "—"}</td>
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
    </div>
  );
}

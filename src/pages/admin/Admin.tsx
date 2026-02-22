import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Shield,
  Users,
  Package,
  DollarSign,
  ArrowDownToLine,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function Admin() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);

  const load = async () => {
    if (!user) return;
    const [txRes, pRes, prodRes, wRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
  };

  useEffect(() => { load(); }, [user]);

  const approved = transactions.filter((t) => t.status === "approved");
  const totalRevenue = approved.reduce((a, t) => a + Number(t.amount), 0);
  const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending");
  const pendingAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);

  const statusCounts = transactions.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152, 60%, 45%)", "hsl(35, 90%, 55%)", "hsl(0, 72%, 51%)", "hsl(200, 70%, 50%)", "hsl(280, 65%, 55%)"];

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = transactions.filter((t) => new Date(t.created_at).toDateString() === d.toDateString() && t.status === "approved");
    return { name: dayStr, receita: dayTx.reduce((a, t) => a + Number(t.amount), 0), taxas: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0) };
  });

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    const update: any = { status: action };
    if (action === "approved") update.processed_at = new Date().toISOString();
    const { error } = await supabase.from("withdrawals").update(update).eq("id", id);
    if (error) { toast.error("Erro ao processar"); return; }
    toast.success(action === "approved" ? "Saque aprovado!" : "Saque recusado");
    load();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status } as any).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : status === "blocked" ? "bloqueada" : "atualizada"}!`);
    load();
  };

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Painel Admin
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Controle total da operação</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Usuários" value={String(profiles.length)} icon={Users} change="total registrados" changeType="neutral" />
        <StatCard title="Produtos" value={String(products.length)} icon={Package} change="cadastrados" changeType="neutral" />
        <StatCard title="Receita Total" value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} change={`R$ ${totalFees.toFixed(2)} em taxas`} changeType="positive" />
        <StatCard title="Saques Pendentes" value={`R$ ${pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={ArrowDownToLine} change={`${pendingWd.length} solicitações`} changeType={pendingWd.length > 0 ? "negative" : "neutral"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <span className="w-1 h-4 bg-primary rounded-full" /> Receita vs Taxas (7 dias)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 15%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={11} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 25%, 9%)", border: "1px solid hsl(220, 20%, 15%)", borderRadius: "8px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="receita" stroke="hsl(152, 60%, 45%)" fill="url(#adminGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="taxas" stroke="hsl(35, 90%, 55%)" fillOpacity={0.1} fill="hsl(35, 90%, 55%)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <span className="w-1 h-4 bg-primary rounded-full" /> Status Transações
          </h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(220, 25%, 9%)", border: "1px solid hsl(220, 20%, 15%)", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize text-muted-foreground">{d.name}</span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">Sem dados</div>
          )}
        </div>
      </div>

      {/* Pending Withdrawals with Actions */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Saques Pendentes
          </h3>
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">{pendingWd.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Taxa</th>
                <th className="text-left p-3 font-medium">Líquido</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-left p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.slice(0, 10).map((w) => (
                <tr key={w.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono text-xs">{w.id.slice(0, 8)}</td>
                  <td className="p-3 text-xs font-semibold">R$ {Number(w.amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-warning">R$ {Number(w.fee_amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-primary">R$ {Number(w.net_amount).toFixed(2)}</td>
                  <td className="p-3"><StatusBadge status={w.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    {w.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-primary gap-1" onClick={() => handleWithdrawalAction(w.id, "approved")}>
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1" onClick={() => handleWithdrawalAction(w.id, "rejected")}>
                          <XCircle className="h-3 w-3" /> Recusar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">Sem saques</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Usuários
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-left p-3 font-medium">Documento</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Cadastro</th>
                <th className="text-left p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <div>
                      <p className="text-xs font-semibold">{p.full_name || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground">{p.email}</p>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs">{p.document_number || "—"}</td>
                  <td className="p-3">
                    <StatusBadge status={(p as any).account_status || "pending_review"} />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {(p as any).account_status !== "approved" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-primary gap-1" onClick={() => handleUserStatus(p.user_id, "approved")}>
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                      )}
                      {(p as any).account_status !== "blocked" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1" onClick={() => handleUserStatus(p.user_id, "blocked")}>
                          <XCircle className="h-3 w-3" /> Bloquear
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">Sem usuários</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

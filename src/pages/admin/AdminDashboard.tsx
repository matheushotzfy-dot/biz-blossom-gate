import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Users, Package, DollarSign, ArrowDownToLine, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Activity, Eye, Settings,
  BarChart3, Wallet, Globe, Zap, LogOut,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        if (!data) { navigate("/admin-matheus"); return; }
        setIsAdmin(true);
        setLoading(false);
        loadData();
      });
  }, [user]);

  const loadData = async () => {
    const [txRes, pRes, prodRes, wRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
  };

  if (loading) return <div className="min-h-screen bg-[hsl(220,25%,4%)] flex items-center justify-center"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const approved = transactions.filter((t) => t.status === "approved");
  const totalRevenue = approved.reduce((a, t) => a + Number(t.amount), 0);
  const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending");
  const pendingAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);

  const statusCounts = transactions.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)"];

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = transactions.filter((t) => new Date(t.created_at).toDateString() === d.toDateString() && t.status === "approved");
    return { name: dayStr, receita: dayTx.reduce((a, t) => a + Number(t.amount), 0), taxas: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0) };
  });

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (action === "approved") {
      // Use PodPay cash-out via edge function
      toast.info("Processando saque via PIX...");
      const { data, error } = await supabase.functions.invoke("podpay-cashout", {
        body: { withdrawalId: id },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Erro ao processar saque");
        return;
      }
      toast.success("Saque aprovado e enviado via PIX!");
    } else {
      const { error } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id);
      if (error) { toast.error("Erro ao recusar"); return; }
      toast.success("Saque recusado");
    }
    loadData();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-matheus");
  };

  return (
    <div className="min-h-screen bg-[hsl(220,25%,4%)] text-white">
      {/* Top bar */}
      <header className="h-16 border-b border-[hsl(220,20%,10%)] flex items-center justify-between px-6 bg-[hsl(220,25%,5%)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold">Admin Master</h1>
            <p className="text-[10px] text-zinc-500">Controle total da operação</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin-matheus/usuarios" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <Users className="h-3.5 w-3.5" /> Usuários
          </Link>
          <Link to="/admin-matheus/configuracoes" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <Settings className="h-3.5 w-3.5" /> Config
          </Link>
          <button onClick={handleLogout} className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/5 transition-colors ml-2">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStat icon={<Users className="h-5 w-5" />} label="Usuários" value={String(profiles.length)} color="from-blue-500/15 to-blue-500/5" iconColor="text-blue-400" />
          <AdminStat icon={<Package className="h-5 w-5" />} label="Produtos" value={String(products.length)} color="from-violet-500/15 to-violet-500/5" iconColor="text-violet-400" />
          <AdminStat icon={<DollarSign className="h-5 w-5" />} label="Receita Total" value={`R$ ${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub={`R$ ${totalFees.toFixed(2)} em taxas`} color="from-emerald-500/15 to-emerald-500/5" iconColor="text-emerald-400" />
          <AdminStat icon={<ArrowDownToLine className="h-5 w-5" />} label="Saques Pendentes" value={`R$ ${pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} sub={`${pendingWd.length} solicitações`} color="from-amber-500/15 to-amber-500/5" iconColor="text-amber-400" alert={pendingWd.length > 0} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,10%)] p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full" /> Receita vs Taxas (7 dias)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="adGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152,60%,45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152,60%,45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,20%,10%)" />
                <XAxis dataKey="name" stroke="hsl(220,10%,35%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(220,10%,35%)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220,25%,6%)", border: "1px solid hsl(220,20%,12%)", borderRadius: "12px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="receita" stroke="hsl(152,60%,45%)" fill="url(#adGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="taxas" stroke="hsl(35,90%,55%)" fillOpacity={0.08} fill="hsl(35,90%,55%)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,10%)] p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" /> Status Transações
            </h3>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "hsl(220,25%,6%)", border: "1px solid hsl(220,20%,12%)", borderRadius: "12px", fontSize: "12px" }} /></PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">{pieData.map((d, i) => (<div key={d.name} className="flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="capitalize text-zinc-400">{d.name}</span><span className="font-bold">{d.value}</span></div>))}</div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-sm text-zinc-500">Sem dados</div>
            )}
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,10%)]">
          <div className="p-5 border-b border-[hsl(220,20%,10%)] flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Saques Pendentes
            </h3>
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full font-bold">{pendingWd.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(220,20%,10%)] text-zinc-500 text-xs">
                <th className="text-left p-4 font-medium">ID</th><th className="text-left p-4 font-medium">Valor</th><th className="text-left p-4 font-medium">Taxa</th><th className="text-left p-4 font-medium">Líquido</th><th className="text-left p-4 font-medium">Status</th><th className="text-left p-4 font-medium">Data</th><th className="text-left p-4 font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {withdrawals.slice(0, 10).map((w) => (
                  <tr key={w.id} className="border-b border-[hsl(220,20%,8%)] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono text-xs text-zinc-400">{w.id.slice(0, 8)}</td>
                    <td className="p-4 text-xs font-bold">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-4 text-xs text-amber-400">R$ {Number(w.fee_amount).toFixed(2)}</td>
                    <td className="p-4 text-xs text-emerald-400">R$ {Number(w.net_amount).toFixed(2)}</td>
                    <td className="p-4"><StatusBadge status={w.status} /></td>
                    <td className="p-4 text-xs text-zinc-500">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-4">
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-0 gap-1.5" onClick={() => handleWithdrawalAction(w.id, "approved")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button size="sm" className="h-8 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0 gap-1.5" onClick={() => handleWithdrawalAction(w.id, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" /> Recusar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-zinc-500 text-xs">Nenhum saque registrado</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users */}
        <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,10%)]">
          <div className="p-5 border-b border-[hsl(220,20%,10%)]">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="w-1 h-5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
              <Users className="h-4 w-4 text-blue-400" /> Usuários Registrados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[hsl(220,20%,10%)] text-zinc-500 text-xs">
                <th className="text-left p-4 font-medium">Usuário</th><th className="text-left p-4 font-medium">Documento</th><th className="text-left p-4 font-medium">Status</th><th className="text-left p-4 font-medium">Cadastro</th><th className="text-left p-4 font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-[hsl(220,20%,8%)] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(p.full_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{p.full_name || "Sem nome"}</p>
                          <p className="text-[10px] text-zinc-500">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-zinc-400">{p.document_number || "—"}</td>
                    <td className="p-4"><StatusBadge status={p.account_status || "pending_review"} /></td>
                    <td className="p-4 text-xs text-zinc-500">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {p.account_status !== "approved" && (
                          <Button size="sm" className="h-8 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-0 gap-1.5" onClick={() => handleUserStatus(p.user_id, "approved")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                        )}
                        {p.account_status !== "blocked" && (
                          <Button size="sm" className="h-8 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border-0 gap-1.5" onClick={() => handleUserStatus(p.user_id, "blocked")}>
                            <XCircle className="h-3.5 w-3.5" /> Bloquear
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-500 text-xs">Sem usuários</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminStat({ icon, label, value, sub, color, iconColor, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string; iconColor: string; alert?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,10%)] p-5 ${alert ? "border-amber-500/30" : ""}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
          <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${iconColor}`}>{icon}</div>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Users, Package, DollarSign, ArrowDownToLine, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Activity, Settings,
  BarChart3, Wallet, Zap, LogOut, Landmark, PiggyBank,
  Globe, Eye, ChevronRight, Sparkles, Server, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/StatusBadge";
import { logAdminAction } from "@/lib/auditLog";

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
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
  };

  if (loading) return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-pulse">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-red-500 to-rose-500 rounded-full animate-[shimmer_1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );

  const approved = transactions.filter((t) => t.status === "approved" || t.status === "completed");
  const totalVolume = approved.reduce((a, t) => a + Number(t.amount), 0);
  const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const pendingWd = withdrawals.filter((w) => w.status === "pending");
  const pendingAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);

  const clientMap = new Map<string, { userId: string; volume: number; fees: number; net: number; txCount: number; name: string; email: string }>();
  approved.forEach((t) => {
    const existing = clientMap.get(t.user_id) || { userId: t.user_id, volume: 0, fees: 0, net: 0, txCount: 0, name: "", email: "" };
    existing.volume += Number(t.amount);
    existing.fees += Number(t.fee_amount);
    existing.net += Number(t.net_amount);
    existing.txCount += 1;
    clientMap.set(t.user_id, existing);
  });
  clientMap.forEach((client, userId) => {
    const profile = profiles.find((p) => p.user_id === userId);
    if (profile) {
      client.name = profile.full_name || "Sem nome";
      client.email = profile.email || "";
    }
  });
  const clientBreakdown = Array.from(clientMap.values()).sort((a, b) => b.volume - a.volume);

  const statusCounts = transactions.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)"];

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter((t) => new Date(t.created_at).toDateString() === d.toDateString());
    return {
      name: dayStr,
      volume: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      lucro: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
    };
  });

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (action === "approved") {
      toast.info("Processando saque via PIX...");
      const { data, error } = await supabase.functions.invoke("podpay-cashout", { body: { withdrawalId: id } });
      if (error || !data?.success) { toast.error(data?.error || error?.message || "Erro ao processar saque"); return; }
      toast.success("Saque aprovado e enviado via PIX!");
      await logAdminAction("approve_withdrawal", "withdrawal", id, { method: "podpay_pix" });
    } else {
      const { error } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id);
      if (error) { toast.error("Erro ao recusar"); return; }
      toast.success("Saque recusado");
      await logAdminAction("reject_withdrawal", "withdrawal", id);
    }
    loadData();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-matheus");
  };

  const fmtCurrency = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const todayStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] text-white">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] bg-red-500/[0.02] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-amber-500/[0.015] rounded-full blur-[100px]" />
      </div>

      {/* ===== TOP NAVIGATION ===== */}
      <header className="h-16 border-b border-white/[0.04] flex items-center justify-between px-6 bg-[hsl(228,20%,4%)]/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.25)]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">Admin Master</h1>
            <p className="text-[10px] text-white/30 capitalize">{todayStr}</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {[
            { to: "/admin-matheus/auditoria", icon: Activity, label: "Auditoria" },
            { to: "/admin-matheus/configuracoes", icon: Settings, label: "Config" },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="text-[11px] text-white/40 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all duration-300">
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="text-[11px] text-white/30 hover:text-red-400 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-500/[0.06] transition-all duration-300 ml-1">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </nav>
      </header>

      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">

        {/* ===== LIVE STATUS BAR ===== */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-full px-3.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Sistema Online</span>
            </div>
            <span className="text-[10px] text-white/20">{transactions.length} transações • {profiles.length} vendedores</span>
          </div>
          <button onClick={loadData} className="text-[10px] text-white/30 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
            <Zap className="h-3 w-3" /> Atualizar
          </button>
        </div>

        {/* ===== GATEWAY KPI CARDS ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <AdminKpi
            icon={<DollarSign className="h-5 w-5" />}
            label="Volume Total (GMV)"
            value={fmtCurrency(totalVolume)}
            sub={`${approved.length} transações`}
            gradient="from-emerald-500 to-emerald-600"
            glowColor="rgba(52,211,153,0.15)"
          />
          <AdminKpi
            icon={<PiggyBank className="h-5 w-5" />}
            label="Lucro Gateway"
            value={fmtCurrency(totalFees)}
            sub="Taxas cobradas"
            gradient="from-amber-500 to-orange-600"
            glowColor="rgba(245,158,11,0.15)"
            highlight
          />
          <AdminKpi
            icon={<Landmark className="h-5 w-5" />}
            label="Distribuído"
            value={fmtCurrency(totalNet)}
            sub="Líquido sellers"
            gradient="from-blue-500 to-indigo-600"
            glowColor="rgba(59,130,246,0.15)"
          />
          <AdminKpi
            icon={<Users className="h-5 w-5" />}
            label="Vendedores"
            value={String(profiles.length)}
            sub={`${clientBreakdown.length} ativos`}
            gradient="from-violet-500 to-purple-600"
            glowColor="rgba(139,92,246,0.15)"
          />
          <AdminKpi
            icon={<ArrowDownToLine className="h-5 w-5" />}
            label="Saques Pendentes"
            value={fmtCurrency(pendingAmount)}
            sub={`${pendingWd.length} solicitações`}
            gradient="from-red-500 to-rose-600"
            glowColor="rgba(239,68,68,0.15)"
            alert={pendingWd.length > 0}
          />
        </div>

        {/* ===== CHARTS ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Area Chart */}
          <div className="lg:col-span-8">
            <AdminPanel>
              <div className="flex items-center justify-between mb-5">
                <PanelTitle color="emerald">Volume vs Lucro Gateway (7 dias)</PanelTitle>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" /> Volume</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" /> Lucro</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="adVolGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152,60%,45%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(152,60%,45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="adLucroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(35,90%,55%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(35,90%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,15%,10%)" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(228,20%,6%)",
                      border: "1px solid hsl(228,15%,12%)",
                      borderRadius: "14px",
                      fontSize: "11px",
                      boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
                      color: "white",
                    }}
                    formatter={(value: number, name: string) => [fmtCurrency(value), name === "volume" ? "Volume" : "Lucro"]}
                    labelStyle={{ color: "hsl(0,0%,45%)" }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="hsl(152,60%,45%)" fill="url(#adVolGrad)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="lucro" stroke="hsl(35,90%,55%)" fill="url(#adLucroGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </AdminPanel>
          </div>

          {/* Pie Chart */}
          <div className="lg:col-span-4">
            <AdminPanel>
              <PanelTitle color="blue">Status das Transações</PanelTitle>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3} strokeWidth={0}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(228,20%,6%)", border: "1px solid hsl(228,15%,12%)", borderRadius: "12px", fontSize: "11px", color: "white" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize text-white/40">{d.name}</span>
                        <span className="font-bold text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-white/20">Sem dados</div>
              )}
            </AdminPanel>
          </div>
        </div>

        {/* ===== PER-CLIENT BREAKDOWN ===== */}
        <AdminPanel>
          <div className="flex items-center justify-between mb-1">
            <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Volume por Vendedor</PanelTitle>
            <span className="text-[10px] text-white/20">{clientBreakdown.length} vendedores com vendas</span>
          </div>
          <p className="text-[10px] text-white/25 mb-4">Breakdown de faturamento, taxas e líquido por cliente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Vendedor", "Transações", "Volume (GMV)", "Taxa Cobrada", "Líquido"].map((h, i) => (
                    <th key={h} className={`${i >= 2 ? "text-right" : "text-left"} p-3.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientBreakdown.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-white/20 text-xs">Nenhuma venda registrada</td></tr>
                ) : (
                  clientBreakdown.map((c, idx) => (
                    <tr key={c.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center text-xs font-bold text-emerald-400 group-hover:shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-shadow">
                              {(c.name || "?").charAt(0).toUpperCase()}
                            </div>
                            {idx === 0 && <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center"><Sparkles className="h-2.5 w-2.5 text-white" /></div>}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{c.name || "Sem nome"}</p>
                            <p className="text-[10px] text-white/30">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="text-xs font-bold text-white bg-white/[0.04] px-2.5 py-1 rounded-lg">{c.txCount}</span>
                      </td>
                      <td className="p-3.5 text-xs font-extrabold text-right text-white">{fmtCurrency(c.volume)}</td>
                      <td className="p-3.5 text-xs font-bold text-right text-amber-400">{fmtCurrency(c.fees)}</td>
                      <td className="p-3.5 text-xs font-bold text-right text-emerald-400">{fmtCurrency(c.net)}</td>
                    </tr>
                  ))
                )}
                {clientBreakdown.length > 0 && (
                  <tr className="bg-white/[0.02]">
                    <td className="p-3.5 text-[10px] font-extrabold text-white/60 uppercase tracking-wider" colSpan={2}>Total Geral</td>
                    <td className="p-3.5 text-xs font-extrabold text-right text-white">{fmtCurrency(totalVolume)}</td>
                    <td className="p-3.5 text-xs font-extrabold text-right text-amber-400">{fmtCurrency(totalFees)}</td>
                    <td className="p-3.5 text-xs font-extrabold text-right text-emerald-400">{fmtCurrency(totalNet)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        {/* ===== PENDING WITHDRAWALS ===== */}
        <AdminPanel>
          <div className="flex items-center justify-between mb-4">
            <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Saques Pendentes</PanelTitle>
            {pendingWd.length > 0 && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full font-extrabold border border-amber-500/20 animate-pulse">
                {pendingWd.length} pendente{pendingWd.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data", "Ações"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.slice(0, 10).map((w) => (
                  <tr key={w.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-white/30">{w.id.slice(0, 8)}</td>
                    <td className="p-3.5 text-xs font-extrabold text-white">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-3.5 text-xs text-amber-400 font-bold">R$ {Number(w.fee_amount).toFixed(2)}</td>
                    <td className="p-3.5 text-xs text-emerald-400 font-bold">R$ {Number(w.net_amount).toFixed(2)}</td>
                    <td className="p-3.5"><StatusBadge status={w.status} /></td>
                    <td className="p-3.5 text-[11px] text-white/30">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3.5">
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 gap-1.5 rounded-xl shadow-none" onClick={() => handleWithdrawalAction(w.id, "approved")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button size="sm" className="h-8 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 gap-1.5 rounded-xl shadow-none" onClick={() => handleWithdrawalAction(w.id, "rejected")}>
                            <XCircle className="h-3.5 w-3.5" /> Recusar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-white/20 text-xs">Nenhum saque registrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        {/* ===== USERS TABLE ===== */}
        <AdminPanel>
          <div className="flex items-center justify-between mb-4">
            <PanelTitle color="blue" icon={<Users className="h-4 w-4" />}>Usuários Registrados</PanelTitle>
            <span className="text-[10px] text-white/20">{profiles.length} cadastros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Usuário", "Documento", "Status", "Cadastro", "Ações"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-xs font-bold text-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-shadow">
                          {(p.full_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{p.full_name || "Sem nome"}</p>
                          <p className="text-[10px] text-white/30">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-white/30">{p.document_number || "—"}</td>
                    <td className="p-3.5"><StatusBadge status={p.account_status || "pending_review"} /></td>
                    <td className="p-3.5 text-[11px] text-white/30">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3.5">
                      <div className="flex gap-2">
                        {p.account_status !== "approved" && (
                          <Button size="sm" className="h-8 text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 gap-1.5 rounded-xl shadow-none" onClick={() => handleUserStatus(p.user_id, "approved")}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                        )}
                        {p.account_status !== "blocked" && (
                          <Button size="sm" className="h-8 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 gap-1.5 rounded-xl shadow-none" onClick={() => handleUserStatus(p.user_id, "blocked")}>
                            <XCircle className="h-3.5 w-3.5" /> Bloquear
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-white/20 text-xs">Sem usuários</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function AdminPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border border-white/[0.04] p-6 hover:border-white/[0.06] transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}

function PanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-600",
    blue: "from-blue-400 to-blue-600",
    red: "from-red-400 to-red-600",
    violet: "from-violet-400 to-violet-600",
  };
  return (
    <h3 className="text-sm font-bold flex items-center gap-2.5 text-white">
      <span className={`w-1 h-5 bg-gradient-to-b ${colorMap[color] || colorMap.emerald} rounded-full`} />
      {icon}
      {children}
    </h3>
  );
}

function AdminKpi({ icon, label, value, sub, gradient, glowColor, alert, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; glowColor: string; alert?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border p-5 group transition-all duration-500 hover:translate-y-[-2px] ${
      alert ? "border-red-500/20 hover:border-red-500/30" : "border-white/[0.04] hover:border-white/[0.08]"
    }`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(circle, ${glowColor}, transparent)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">{label}</span>
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500`} style={{ boxShadow: `0 8px 25px ${glowColor}` }}>
            {icon}
          </div>
        </div>
        <p className={`text-xl font-extrabold tracking-tight ${highlight ? "text-amber-400" : "text-white"}`}>{value}</p>
        {sub && <p className="text-[10px] text-white/25 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

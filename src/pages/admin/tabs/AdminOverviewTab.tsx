import { useState } from "react";
import {
  DollarSign, PiggyBank, Landmark, Users, ArrowDownToLine,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Sparkles, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  onUserStatus: (userId: string, status: string) => void;
  fmtCurrency: (v: number) => string;
}

export default function AdminOverviewTab({ transactions, profiles, products, withdrawals, onWithdrawalAction, onUserStatus, fmtCurrency }: Props) {
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
    if (profile) { client.name = profile.full_name || "Sem nome"; client.email = profile.email || ""; }
  });
  const clientBreakdown = Array.from(clientMap.values()).sort((a, b) => b.volume - a.volume);

  const statusCounts = transactions.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)"];

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter((t) => new Date(t.created_at).toDateString() === d.toDateString());
    return { name: dayStr, volume: dayTx.reduce((a, t) => a + Number(t.amount), 0), lucro: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0) };
  });

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<DollarSign className="h-5 w-5" />} label="Volume Total (GMV)" value={fmtCurrency(totalVolume)} sub={`${approved.length} transações`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<PiggyBank className="h-5 w-5" />} label="Lucro Gateway" value={fmtCurrency(totalFees)} sub="Taxas cobradas" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" highlight />
        <AdminKpi icon={<Landmark className="h-5 w-5" />} label="Distribuído" value={fmtCurrency(totalNet)} sub="Líquido sellers" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Users className="h-5 w-5" />} label="Vendedores" value={String(profiles.length)} sub={`${clientBreakdown.length} ativos`} gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Saques Pendentes" value={fmtCurrency(pendingAmount)} sub={`${pendingWd.length} solicitações`} gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" alert={pendingWd.length > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8">
          <AdminPanel>
            <div className="flex items-center justify-between mb-5">
              <PanelTitle color="emerald">Volume vs Lucro (7 dias)</PanelTitle>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" /> Volume</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" /> Lucro</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="adVolGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(152,60%,45%)" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(152,60%,45%)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="adLucroGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(35,90%,55%)" stopOpacity={0.2} /><stop offset="100%" stopColor="hsl(35,90%,55%)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,15%,10%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(228,10%,25%)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(228,20%,6%)", border: "1px solid hsl(228,15%,12%)", borderRadius: "14px", fontSize: "11px", boxShadow: "0 25px 70px rgba(0,0,0,0.7)", color: "white" }} formatter={(value: number, name: string) => [fmtCurrency(value), name === "volume" ? "Volume" : "Lucro"]} labelStyle={{ color: "hsl(0,0%,45%)" }} />
                <Area type="monotone" dataKey="volume" stroke="hsl(152,60%,45%)" fill="url(#adVolGrad)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="lucro" stroke="hsl(35,90%,55%)" fill="url(#adLucroGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </AdminPanel>
        </div>
        <div className="lg:col-span-4">
          <AdminPanel>
            <PanelTitle color="blue">Status Transações</PanelTitle>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3} strokeWidth={0}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: "hsl(228,20%,6%)", border: "1px solid hsl(228,15%,12%)", borderRadius: "12px", fontSize: "11px", color: "white" }} /></PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
                  {pieData.map((d, i) => (<div key={d.name} className="flex items-center gap-1.5 text-[10px]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="capitalize text-white/40">{d.name}</span><span className="font-bold text-white">{d.value}</span></div>))}
                </div>
              </>
            ) : (<div className="flex items-center justify-center h-[200px] text-sm text-white/20">Sem dados</div>)}
          </AdminPanel>
        </div>
      </div>

      {/* Per-client */}
      <AdminPanel>
        <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Volume por Vendedor</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["Vendedor", "Tx", "Volume", "Taxa", "Líquido"].map((h, i) => (<th key={h} className={`${i >= 2 ? "text-right" : "text-left"} p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider`}>{h}</th>))}</tr></thead>
            <tbody>
              {clientBreakdown.map((c, idx) => (
                <tr key={c.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center text-xs font-bold text-emerald-400">{(c.name||"?")[0].toUpperCase()}{idx===0&&<Sparkles className="h-2 w-2 absolute" />}</div><div><p className="text-xs font-bold text-white">{c.name}</p><p className="text-[10px] text-white/30">{c.email}</p></div></div></td>
                  <td className="p-3"><span className="text-xs font-bold bg-white/[0.04] px-2 py-1 rounded-lg">{c.txCount}</span></td>
                  <td className="p-3 text-xs font-extrabold text-right">{fmtCurrency(c.volume)}</td>
                  <td className="p-3 text-xs font-bold text-right text-amber-400">{fmtCurrency(c.fees)}</td>
                  <td className="p-3 text-xs font-bold text-right text-emerald-400">{fmtCurrency(c.net)}</td>
                </tr>
              ))}
              {clientBreakdown.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-white/20 text-xs">Sem vendas</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* Pending Withdrawals */}
      <AdminPanel>
        <div className="flex items-center justify-between mb-4">
          <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Saques Pendentes</PanelTitle>
          {pendingWd.length > 0 && <span className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full font-extrabold border border-amber-500/20 animate-pulse">{pendingWd.length}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["ID","Valor","Taxa","Líquido","Status","Data","Ações"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {withdrawals.slice(0, 10).map((w) => (
                <tr key={w.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-mono text-[11px] text-white/30">{w.id.slice(0,8)}</td>
                  <td className="p-3 text-xs font-extrabold">R$ {Number(w.amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-amber-400">R$ {Number(w.fee_amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-emerald-400">R$ {Number(w.net_amount).toFixed(2)}</td>
                  <td className="p-3"><StatusBadge status={w.status} /></td>
                  <td className="p-3 text-[11px] text-white/30">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}><CheckCircle2 className="h-3 w-3" /> Aprovar</Button>
                        <Button size="sm" className="h-7 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "rejected")}><XCircle className="h-3 w-3" /> Recusar</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-white/20 text-xs">Sem saques</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

// Shared sub-components
export function AdminPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border border-white/[0.04] p-6 hover:border-white/[0.06] transition-colors duration-500">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}

export function PanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = { emerald: "from-emerald-400 to-emerald-600", amber: "from-amber-400 to-amber-600", blue: "from-blue-400 to-blue-600", red: "from-red-400 to-red-600", violet: "from-violet-400 to-violet-600" };
  return (<h3 className="text-sm font-bold flex items-center gap-2.5 text-white"><span className={`w-1 h-5 bg-gradient-to-b ${colorMap[color] || colorMap.emerald} rounded-full`} />{icon}{children}</h3>);
}

export function AdminKpi({ icon, label, value, sub, gradient, glowColor, alert, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; glowColor: string; alert?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-[hsl(228,18%,6%)] rounded-2xl border p-5 group transition-all duration-500 hover:translate-y-[-2px] ${alert ? "border-red-500/20 hover:border-red-500/30" : "border-white/[0.04] hover:border-white/[0.08]"}`}>
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: `radial-gradient(circle, ${glowColor}, transparent)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">{label}</span>
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500`} style={{ boxShadow: `0 8px 25px ${glowColor}` }}>{icon}</div>
        </div>
        <p className={`text-xl font-extrabold tracking-tight ${highlight ? "text-amber-400" : "text-white"}`}>{value}</p>
        {sub && <p className="text-[10px] text-white/25 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

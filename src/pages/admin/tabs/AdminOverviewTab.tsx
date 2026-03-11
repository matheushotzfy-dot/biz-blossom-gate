import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, PiggyBank, Landmark, Users, ArrowDownToLine,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Zap,
  Shield, Globe, CreditCard, Package, BarChart3, Activity, Percent,
  ShieldAlert, RotateCcw, Clock, Smartphone, FileText, Lock,
  TrendingDown, Eye, Radio,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface Dispute { id: string; type: string; status: string; seller_user_id: string; amount: number; created_at: string; }

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  onUserStatus: (userId: string, status: string) => void;
  fmtCurrency: (v: number) => string;
  isEmployee?: boolean;
}

export default function AdminOverviewTab({ transactions, profiles, products, withdrawals, onWithdrawalAction, onUserStatus, fmtCurrency, isEmployee = false }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [realtimeTx, setRealtimeTx] = useState<Tables<"transactions">[]>([]);
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    supabase.from("disputes").select("id,type,status,seller_user_id,amount,created_at").then(({ data }) => { if (data) setDisputes(data as Dispute[]); });
  }, []);

  // Realtime feed
  useEffect(() => {
    setRealtimeTx(transactions.slice(0, 25));

    const channel = supabase
      .channel("admin-god-mode-tx")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => [payload.new as Tables<"transactions">, ...prev].slice(0, 25));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => prev.map(t => t.id === (payload.new as any).id ? payload.new as Tables<"transactions"> : t));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [transactions]);

  // ═══ KPIs ═══
  const allTx = transactions;
  const approved = useMemo(() => allTx.filter(t => t.status === "approved" || t.status === "completed"), [allTx]);
  
  const today = new Date();
  const todayStr = today.toDateString();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const todayTx = useMemo(() => approved.filter(t => new Date(t.created_at).toDateString() === todayStr), [approved, todayStr]);
  const monthTx = useMemo(() => approved.filter(t => new Date(t.created_at) >= thisMonthStart), [approved, thisMonthStart]);

  const tpvToday = todayTx.reduce((a, t) => a + Number(t.amount), 0);
  const tpvMonth = monthTx.reduce((a, t) => a + Number(t.amount), 0);
  const totalVolume = approved.reduce((a, t) => a + Number(t.amount), 0);
  
  // Take Rate = platform fees (lucro real da gateway)
  const takeRateToday = todayTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRateMonth = monthTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRateTotal = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const takeRatePct = totalVolume > 0 ? ((takeRateTotal / totalVolume) * 100).toFixed(2) : "0.00";

  // Withdrawal volume
  const totalWithdrawn = withdrawals.filter(w => w.status === "approved").reduce((a, w) => a + Number(w.amount), 0);
  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingWdAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);

  // Saldo retido (retained balance across all sellers)
  const totalRetained = approved.filter(t => !t.retention_released && Number(t.retained_amount) > 0)
    .reduce((a, t) => a + Number(t.retained_amount), 0);

  // Net balance on platform (earned - withdrawn)
  const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const platformBalance = totalNet - totalWithdrawn;

  // ═══ Approval rates by method ═══
  const methodApproval = useMemo(() => {
    const methods: Record<string, { total: number; approved: number }> = {};
    allTx.forEach(t => {
      const m = t.payment_method || "other";
      if (!methods[m]) methods[m] = { total: 0, approved: 0 };
      methods[m].total++;
      if (t.status === "approved" || t.status === "completed") methods[m].approved++;
    });
    return Object.entries(methods).map(([method, stats]) => ({
      method: method === "pix" ? "PIX" : method === "credit_card" ? "Cartão" : method === "boleto" ? "Boleto" : method,
      total: stats.total,
      approved: stats.approved,
      rate: stats.total > 0 ? ((stats.approved / stats.total) * 100) : 0,
    }));
  }, [allTx]);

  // ═══ Chargeback rate ═══
  const chargebackTx = allTx.filter(t => t.status === "chargeback");
  const chargebackRate = approved.length > 0 ? ((chargebackTx.length / approved.length) * 100) : 0;
  const chargebackAlert = chargebackRate > 1;

  // ═══ Hourly sales chart (today) ═══
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, volume: 0, count: 0 }));
    const todayAll = allTx.filter(t => new Date(t.created_at).toDateString() === todayStr);
    todayAll.forEach(t => {
      const h = new Date(t.created_at).getHours();
      if (t.status === "approved" || t.status === "completed") {
        hours[h].volume += Number(t.amount);
      }
      hours[h].count++;
    });
    return hours;
  }, [allTx, todayStr]);

  // ═══ 7d / 30d chart ═══
  const days = chartPeriod === "7d" ? 7 : 30;
  const chartData = useMemo(() => Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    return {
      name: dayStr,
      tpv: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      takeRate: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
      vendas: dayTx.length,
    };
  }), [approved, days]);

  // ═══ Status distribution ═══
  const statusCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    allTx.forEach(t => { acc[t.status] = (acc[t.status] || 0) + 1; });
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [allTx]);
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)", "hsl(45,90%,55%)"];

  // ═══ Seller segments ═══
  const blackSellers = new Set(profiles.filter(p => p.seller_type === "black").map(p => p.user_id));
  const whiteSellers = new Set(profiles.filter(p => p.seller_type === "white").map(p => p.user_id));

  const conversionRate = allTx.length > 0 ? ((approved.length / allTx.length) * 100).toFixed(1) : "0.0";
  const ticketMedio = approved.length > 0 ? totalVolume / approved.length : 0;

  // ═══ Dispute stats ═══
  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "in_review").length;
  const medpixCount = disputes.filter(d => d.type === "medpix").length;

  const statusColorMap: Record<string, string> = {
    completed: "text-primary", approved: "text-primary", pending: "text-warning",
    failed: "text-destructive", expired: "text-muted-foreground", refunded: "text-info",
    chargeback: "text-destructive",
  };
  const statusLabelMap: Record<string, string> = {
    completed: "Pago", approved: "Pago", pending: "Pendente",
    failed: "Recusado", expired: "Expirado", refunded: "Estornado", chargeback: "Chargeback",
  };

  if (isEmployee) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminKpi icon={<Users className="h-4 w-4" />} label="Sellers" value={String(profiles.length)} sub="Total cadastrados" />
          <AdminKpi icon={<Package className="h-4 w-4" />} label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} />
          <AdminKpi icon={<CreditCard className="h-4 w-4" />} label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} />
          <AdminKpi icon={<Percent className="h-4 w-4" />} label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══ ROW 1: Primary KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <AdminKpi
          icon={<DollarSign className="h-4 w-4" />}
          label="TPV Hoje"
          value={fmtCurrency(tpvToday)}
          sub={`${todayTx.length} vendas`}
        />
        <AdminKpi
          icon={<BarChart3 className="h-4 w-4" />}
          label="TPV Mensal"
          value={fmtCurrency(tpvMonth)}
          sub={`${monthTx.length} vendas`}
        />
        <AdminKpi
          icon={<PiggyBank className="h-4 w-4" />}
          label="Take Rate (Lucro)"
          value={fmtCurrency(takeRateMonth)}
          sub={`${takeRatePct}% do volume`}
          highlight
        />
        <AdminKpi
          icon={<ArrowDownToLine className="h-4 w-4" />}
          label="Volume Sacado"
          value={fmtCurrency(totalWithdrawn)}
          sub={`${pendingWd.length} pendentes: ${fmtCurrency(pendingWdAmount)}`}
          alert={pendingWd.length > 5}
        />
        <AdminKpi
          icon={<Lock className="h-4 w-4" />}
          label="Saldo Retido"
          value={fmtCurrency(totalRetained)}
          sub="Rolling reserve ativo"
        />
        <AdminKpi
          icon={<Landmark className="h-4 w-4" />}
          label="Saldo Plataforma"
          value={fmtCurrency(platformBalance)}
          sub={`Líquido - Sacado`}
          highlight
        />
      </div>

      {/* ═══ ROW 2: Alerts ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminPanel className={cn(chargebackAlert && "border-destructive/40 bg-destructive/[0.03]")}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" /> Chargeback Rate
            </span>
            {chargebackAlert && <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full animate-pulse">ALERTA</span>}
          </div>
          <p className={cn("text-2xl font-black", chargebackAlert ? "text-destructive" : "text-foreground")}>{chargebackRate.toFixed(2)}%</p>
          <p className="text-[10px] text-muted-foreground">{chargebackTx.length} chargebacks / {approved.length} aprovadas</p>
        </AdminPanel>

        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><Zap className="h-3 w-3" /> Conversão</span>
          <p className="text-2xl font-black text-primary mt-1">{conversionRate}%</p>
          <p className="text-[10px] text-muted-foreground">{approved.length}/{allTx.length}</p>
        </AdminPanel>

        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Ticket Médio</span>
          <p className="text-2xl font-black text-foreground mt-1">{fmtCurrency(ticketMedio)}</p>
        </AdminPanel>

        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Disputas</span>
          <p className="text-2xl font-black text-warning mt-1">{openDisputes}</p>
          <p className="text-[10px] text-muted-foreground">{medpixCount} MedPix total</p>
        </AdminPanel>

        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><Users className="h-3 w-3" /> Sellers</span>
          <p className="text-2xl font-black text-foreground mt-1">{profiles.length}</p>
          <p className="text-[10px] text-muted-foreground">{blackSellers.size}B / {whiteSellers.size}W</p>
        </AdminPanel>
      </div>

      {/* ═══ ROW 3: Charts + Realtime Feed ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        {/* Volume chart */}
        <div className="xl:col-span-2">
          <AdminPanel>
            <div className="flex items-center justify-between mb-4">
              <PanelTitle color="emerald">Volume & Take Rate</PanelTitle>
              <div className="flex gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
                {(["7d", "30d"] as const).map(f => (
                  <button key={f} onClick={() => setChartPeriod(f)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${chartPeriod === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tpvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [fmtCurrency(value), ""]} />
                <Area type="monotone" dataKey="tpv" stroke="hsl(var(--primary))" fill="url(#tpvGrad)" strokeWidth={2} dot={false} name="TPV" />
                <Area type="monotone" dataKey="takeRate" stroke="hsl(var(--warning))" fillOpacity={0} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Take Rate" />
              </AreaChart>
            </ResponsiveContainer>
          </AdminPanel>
        </div>

        {/* Approval rate by method */}
        <AdminPanel>
          <PanelTitle color="blue" icon={<CreditCard className="h-4 w-4" />}>Aprovação por Método</PanelTitle>
          <div className="space-y-3 mt-4">
            {methodApproval.sort((a, b) => b.total - a.total).map(m => (
              <div key={m.method}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-foreground">{m.method}</span>
                  <span className={cn("font-bold", m.rate >= 80 ? "text-primary" : m.rate >= 50 ? "text-warning" : "text-destructive")}>
                    {m.rate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", m.rate >= 80 ? "bg-primary" : m.rate >= 50 ? "bg-warning" : "bg-destructive")}
                    style={{ width: `${m.rate}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{m.approved}/{m.total} aprovadas</p>
              </div>
            ))}
          </div>
        </AdminPanel>

        {/* Realtime Feed */}
        <AdminPanel className="max-h-[400px] overflow-hidden flex flex-col">
          <PanelTitle color="red" icon={<Radio className="h-4 w-4 text-destructive animate-pulse" />}>Feed em Tempo Real</PanelTitle>
          <div className="flex-1 overflow-y-auto mt-3 space-y-1.5 pr-1">
            {realtimeTx.map(t => (
              <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/30 transition-all">
                <div className={cn("h-2 w-2 rounded-full shrink-0",
                  t.status === "completed" || t.status === "approved" ? "bg-primary" :
                  t.status === "pending" ? "bg-warning animate-pulse" :
                  "bg-destructive"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground truncate">{fmtCurrency(Number(t.amount))}</span>
                    <span className={cn("text-[9px] font-bold uppercase", statusColorMap[t.status] || "text-muted-foreground")}>
                      {statusLabelMap[t.status] || t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-muted-foreground truncate">{t.customer_name || "Anônimo"}</span>
                    <span className="text-[9px] text-muted-foreground">•</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{t.payment_method || "—"}</span>
                    <span className="text-[9px] text-muted-foreground">•</span>
                    <span className="text-[9px] text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </div>
            ))}
            {realtimeTx.length === 0 && (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Aguardando transações...</div>
            )}
          </div>
        </AdminPanel>
      </div>

      {/* ═══ ROW 4: Hourly + Status Pie ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <AdminPanel>
            <PanelTitle color="violet" icon={<Clock className="h-4 w-4" />}>Volume por Hora (Hoje)</PanelTitle>
            <ResponsiveContainer width="100%" height={200} className="mt-4">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }} formatter={(value: number, name: string) => [name === "volume" ? fmtCurrency(value) : value, name === "volume" ? "Volume" : "Qtd"]} />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Volume" />
              </BarChart>
            </ResponsiveContainer>
          </AdminPanel>
        </div>

        <AdminPanel>
          <PanelTitle color="amber">Status Transações</PanelTitle>
          {statusCounts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {statusCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                {statusCounts.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1 text-[9px]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize text-muted-foreground">{statusLabelMap[d.name] || d.name}</span>
                    <span className="font-bold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">Sem dados</div>}
        </AdminPanel>
      </div>

      {/* ═══ ROW 5: Pending Withdrawals ═══ */}
      {pendingWd.length > 0 && (
        <AdminPanel>
          <div className="flex items-center justify-between mb-3">
            <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Saques Pendentes ({pendingWd.length})</PanelTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{["Vendedor", "Valor", "Taxa", "Líquido", "Data", "Ações"].map(h => (
                <th key={h} className="text-left p-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}</tr></thead>
              <tbody>
                {pendingWd.slice(0, 10).map(w => {
                  const sp = profiles.find(p => p.user_id === w.user_id);
                  return (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-2.5">
                        <p className="text-xs font-medium text-foreground">{sp?.full_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{sp?.email || ""}</p>
                      </td>
                      <td className="p-2.5 text-xs font-bold text-foreground">{fmtCurrency(Number(w.amount))}</td>
                      <td className="p-2.5 text-xs text-warning">{fmtCurrency(Number(w.fee_amount))}</td>
                      <td className="p-2.5 text-xs text-primary">{fmtCurrency(Number(w.net_amount))}</td>
                      <td className="p-2.5 text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="p-2.5">
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-1 rounded-lg shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}><CheckCircle2 className="h-3 w-3" /> Aprovar</Button>
                          <Button size="sm" className="h-7 text-[10px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-lg shadow-none" onClick={() => onWithdrawalAction(w.id, "rejected")}><XCircle className="h-3 w-3" /> Recusar</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* ═══ ROW 6: Quick Stats ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Take Rate Hoje</span>
          <p className="text-lg font-black text-warning mt-1">{fmtCurrency(takeRateToday)}</p>
          <p className="text-[10px] text-muted-foreground">{todayTx.length} vendas</p>
        </AdminPanel>
        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Produtos Ativos</span>
          <p className="text-lg font-black text-foreground mt-1">{products.filter(p => p.status === "active").length}</p>
          <p className="text-[10px] text-muted-foreground">de {products.length} total</p>
        </AdminPanel>
        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Retido Total</span>
          <p className="text-lg font-black text-foreground mt-1">{fmtCurrency(totalRetained)}</p>
          <p className="text-[10px] text-muted-foreground">Rolling Reserve</p>
        </AdminPanel>
        <AdminPanel>
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Chargebacks</span>
          <p className={cn("text-lg font-black mt-1", chargebackAlert ? "text-destructive" : "text-foreground")}>{chargebackTx.length}</p>
          <p className="text-[10px] text-muted-foreground">{chargebackRate.toFixed(2)}% rate</p>
        </AdminPanel>
      </div>
    </div>
  );
}

// ═══ Shared sub-components ═══

export function AdminPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, color, icon }: { children: React.ReactNode; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = { emerald: "bg-primary", amber: "bg-warning", blue: "bg-info", red: "bg-destructive", violet: "bg-accent", zinc: "bg-muted-foreground", cyan: "bg-info" };
  return (
    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
      <span className={`w-1 h-4 ${colorMap[color] || colorMap.emerald} rounded-full`} />
      {icon}
      {children}
    </h3>
  );
}

export function AdminKpi({ icon, label, value, sub, alert, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean;
  gradient?: string; glowColor?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", alert ? "border-destructive/30" : "border-border")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      </div>
      <p className={cn("text-xl font-extrabold", highlight ? "text-warning" : "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

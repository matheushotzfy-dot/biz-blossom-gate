import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, PiggyBank, Landmark, Users, ArrowDownToLine,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Zap,
  Shield, Globe, CreditCard, Package, BarChart3, Activity, Percent,
  ShieldAlert, RotateCcw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";

interface Acquirer { id: string; name: string; slug: string; type: string; is_active: boolean; }
interface Dispute { id: string; type: string; status: string; seller_user_id: string; amount: number; }

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
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [chartFilter, setChartFilter] = useState<"total" | "black" | "white">("total");

  useEffect(() => {
    supabase.from("acquirers").select("*").then(({ data }) => { if (data) setAcquirers(data as Acquirer[]); });
    supabase.from("disputes").select("id,type,status,seller_user_id,amount").then(({ data }) => { if (data) setDisputes(data as Dispute[]); });
  }, []);

  const allTx = transactions;
  const approved = allTx.filter(t => t.status === "approved" || t.status === "completed");
  const totalVolume = approved.reduce((a, t) => a + Number(t.amount), 0);
  const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
  const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingAmount = pendingWd.reduce((a, w) => a + Number(w.amount), 0);
  const conversionRate = allTx.length > 0 ? ((approved.length / allTx.length) * 100).toFixed(1) : "0.0";
  const approvedWd = withdrawals.filter(w => w.status === "approved");
  const totalWithdrawn = approvedWd.reduce((a, w) => a + Number(w.amount), 0);

  const blackSellers = new Set(profiles.filter(p => p.seller_type === "black").map(p => p.user_id));
  const whiteSellers = new Set(profiles.filter(p => p.seller_type === "white").map(p => p.user_id));
  const unsetSellers = new Set(profiles.filter(p => p.seller_type == null).map(p => p.user_id));

  const blackTx = approved.filter(t => blackSellers.has(t.user_id));
  const whiteTx = approved.filter(t => whiteSellers.has(t.user_id));
  const unsetTx = approved.filter(t => unsetSellers.has(t.user_id));

  const blackVolume = blackTx.reduce((a, t) => a + Number(t.amount), 0);
  const whiteVolume = whiteTx.reduce((a, t) => a + Number(t.amount), 0);
  const blackFees = blackTx.reduce((a, t) => a + Number(t.fee_amount), 0);
  const whiteFees = whiteTx.reduce((a, t) => a + Number(t.fee_amount), 0);

  const allBlackTx = allTx.filter(t => blackSellers.has(t.user_id));
  const allWhiteTx = allTx.filter(t => whiteSellers.has(t.user_id));
  const blackConversion = allBlackTx.length > 0 ? ((blackTx.length / allBlackTx.length) * 100).toFixed(1) : "0.0";
  const whiteConversion = allWhiteTx.length > 0 ? ((whiteTx.length / allWhiteTx.length) * 100).toFixed(1) : "0.0";

  const medpixCount = disputes.filter(d => d.type === "medpix").length;
  const premedCount = disputes.filter(d => d.type === "pre_med_pix").length;
  const refundCount = disputes.filter(d => d.type === "refund").length;
  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "in_review").length;

  const statusCounts = allTx.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["hsl(152,60%,45%)", "hsl(35,90%,55%)", "hsl(0,72%,51%)", "hsl(200,70%,50%)", "hsl(280,65%,55%)"];

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayTx = approved.filter(t => new Date(t.created_at).toDateString() === d.toDateString());
    const dayBlack = dayTx.filter(t => blackSellers.has(t.user_id));
    const dayWhite = dayTx.filter(t => whiteSellers.has(t.user_id));
    return {
      name: dayStr,
      volume: dayTx.reduce((a, t) => a + Number(t.amount), 0),
      lucro: dayTx.reduce((a, t) => a + Number(t.fee_amount), 0),
      black: dayBlack.reduce((a, t) => a + Number(t.amount), 0),
      white: dayWhite.reduce((a, t) => a + Number(t.amount), 0),
    };
  });

  const methodStats = approved.reduce((acc, t) => {
    const m = t.payment_method || "other";
    if (!acc[m]) acc[m] = { volume: 0, count: 0 };
    acc[m].volume += Number(t.amount);
    acc[m].count += 1;
    return acc;
  }, {} as Record<string, { volume: number; count: number }>);

  const today = new Date();
  const todayTx = approved.filter(t => new Date(t.created_at).toDateString() === today.toDateString());
  const todayVolume = todayTx.reduce((a, t) => a + Number(t.amount), 0);
  const todayFees = todayTx.reduce((a, t) => a + Number(t.fee_amount), 0);

  const chartMainKey = chartFilter === "black" ? "black" : chartFilter === "white" ? "white" : "volume";
  const chartMainColor = chartFilter === "black" ? "hsl(0,0%,55%)" : chartFilter === "white" ? "hsl(210,20%,75%)" : "hsl(var(--primary))";

  // Seller ranking
  const clientMap = new Map<string, { userId: string; volume: number; fees: number; net: number; txCount: number; name: string; email: string; type: string | null }>();
  approved.forEach(t => {
    const existing = clientMap.get(t.user_id) || { userId: t.user_id, volume: 0, fees: 0, net: 0, txCount: 0, name: "", email: "", type: null };
    existing.volume += Number(t.amount); existing.fees += Number(t.fee_amount); existing.net += Number(t.net_amount); existing.txCount += 1;
    clientMap.set(t.user_id, existing);
  });
  clientMap.forEach((client, userId) => {
    const profile = profiles.find(p => p.user_id === userId);
    if (profile) { client.name = profile.full_name || "Sem nome"; client.email = profile.email || ""; client.type = profile.seller_type; }
  });
  const clientBreakdown = Array.from(clientMap.values()).sort((a, b) => b.volume - a.volume);

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">B</span>;
    if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">W</span>;
    return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">?</span>;
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {!isEmployee && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminKpi icon={<DollarSign className="h-4 w-4" />} label="Volume Total" value={fmtCurrency(totalVolume)} sub={`${approved.length} vendas`} />
          <AdminKpi icon={<PiggyBank className="h-4 w-4" />} label="Lucro Gateway" value={fmtCurrency(totalFees)} sub="Taxas cobradas" highlight />
          <AdminKpi icon={<ArrowDownToLine className="h-4 w-4" />} label="Saques Pendentes" value={fmtCurrency(pendingAmount)} sub={`${pendingWd.length} solicitações`} alert={pendingWd.length > 0} />
          <AdminKpi icon={<Zap className="h-4 w-4" />} label="Hoje" value={fmtCurrency(todayVolume)} sub={`Lucro: ${fmtCurrency(todayFees)}`} />
        </div>
      )}
      {isEmployee && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminKpi icon={<Users className="h-4 w-4" />} label="Sellers" value={String(profiles.length)} sub="Total cadastrados" />
          <AdminKpi icon={<Package className="h-4 w-4" />} label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} />
          <AdminKpi icon={<CreditCard className="h-4 w-4" />} label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} />
          <AdminKpi icon={<Percent className="h-4 w-4" />} label="Conversão" value={`${conversionRate}%`} sub={`${approved.length}/${allTx.length}`} />
        </div>
      )}

      {/* Segments */}
      {!isEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <AdminPanel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><Shield className="h-3 w-3" /> Black</span>
              <span className="text-[10px] text-muted-foreground">{blackSellers.size} sellers</span>
            </div>
            <p className="text-lg font-black text-foreground">{fmtCurrency(blackVolume)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Lucro: <span className="text-warning font-bold">{fmtCurrency(blackFees)}</span> • Conv: {blackConversion}%</p>
          </AdminPanel>
          <AdminPanel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><Globe className="h-3 w-3" /> White</span>
              <span className="text-[10px] text-muted-foreground">{whiteSellers.size} sellers</span>
            </div>
            <p className="text-lg font-black text-foreground">{fmtCurrency(whiteVolume)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Lucro: <span className="text-warning font-bold">{fmtCurrency(whiteFees)}</span> • Conv: {whiteConversion}%</p>
          </AdminPanel>
          <AdminPanel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5"><Landmark className="h-3 w-3" /> Sacado</span>
            </div>
            <p className="text-lg font-black text-foreground">{fmtCurrency(totalWithdrawn)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Distribuído: {fmtCurrency(totalNet)}</p>
          </AdminPanel>
          <AdminPanel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-destructive flex items-center gap-1.5"><ShieldAlert className="h-3 w-3" /> Disputas</span>
              <span className="text-[10px] text-muted-foreground">{openDisputes} abertas</span>
            </div>
            <div className="flex gap-4 mt-1">
              <div><p className="text-lg font-black text-warning">{medpixCount}</p><p className="text-[9px] text-muted-foreground">MedPix</p></div>
              <div><p className="text-lg font-black text-foreground">{premedCount}</p><p className="text-[9px] text-muted-foreground">Pre-Med</p></div>
              <div><p className="text-lg font-black text-destructive">{refundCount}</p><p className="text-[9px] text-muted-foreground">Reembolso</p></div>
            </div>
          </AdminPanel>
        </div>
      )}

      {/* Chart + Pie */}
      {!isEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <AdminPanel>
              <div className="flex items-center justify-between mb-4">
                <PanelTitle color="emerald">Volume 7 dias</PanelTitle>
                <div className="flex gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
                  {(["total", "black", "white"] as const).map(f => (
                    <button key={f} onClick={() => setChartFilter(f)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${chartFilter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      {f === "total" ? "Total" : f === "black" ? "Black" : "White"}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartMainColor} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={chartMainColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [fmtCurrency(value), ""]} />
                  <Area type="monotone" dataKey={chartMainKey} stroke={chartMainColor} fill="url(#chartGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="lucro" stroke="hsl(var(--warning))" fillOpacity={0} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </AdminPanel>
          </div>

          <div className="space-y-3">
            <AdminPanel>
              <PanelTitle color="blue">Status Transações</PanelTitle>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3} strokeWidth={0}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                    {pieData.map((d, i) => (<div key={d.name} className="flex items-center gap-1 text-[9px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="capitalize text-muted-foreground">{d.name}</span><span className="font-bold text-foreground">{d.value}</span></div>))}
                  </div>
                </>
              ) : (<div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">Sem dados</div>)}
            </AdminPanel>
            <AdminPanel>
              <PanelTitle color="violet">Pagamentos</PanelTitle>
              <div className="space-y-2 mt-2">
                {Object.entries(methodStats).sort((a, b) => b[1].volume - a[1].volume).map(([method, stats]) => {
                  const pct = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
                  const labels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto", other: "Outro" };
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground">{labels[method] || method}</span>
                        <span className="text-foreground/70 font-bold">{pct.toFixed(1)}% • {stats.count}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminPanel>
          </div>
        </div>
      )}

      {/* Pending Withdrawals */}
      {!isEmployee && pendingWd.length > 0 && (
        <AdminPanel>
          <div className="flex items-center justify-between mb-3">
            <PanelTitle color="amber" icon={<AlertTriangle className="h-4 w-4" />}>Saques Pendentes ({pendingWd.length})</PanelTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">{["Vendedor", "Tipo", "Valor", "Taxa", "Líquido", "Data", "Ações"].map(h => (
                <th key={h} className="text-left p-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}</tr></thead>
              <tbody>
                {pendingWd.slice(0, 10).map(w => {
                  const sp = profiles.find(p => p.user_id === w.user_id);
                  return (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 text-xs font-medium text-foreground">{sp?.full_name || "—"}</td>
                      <td className="p-2.5"><SellerTypeBadge type={sp?.seller_type || null} /></td>
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

      {/* Seller Ranking */}
      {!isEmployee && clientBreakdown.length > 0 && (
        <AdminPanel>
          <PanelTitle color="emerald" icon={<TrendingUp className="h-4 w-4" />}>Top Vendedores</PanelTitle>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["#", "Vendedor", "Tipo", "Vendas", "Volume", "Taxa", "Líquido"].map((h, i) => (
                  <th key={h} className={`${i >= 3 ? "text-right" : "text-left"} p-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {clientBreakdown.slice(0, 10).map((c, idx) => (
                  <tr key={c.userId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 text-xs text-muted-foreground font-bold">{idx + 1}</td>
                    <td className="p-2.5">
                      <p className="text-xs font-bold text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="p-2.5"><SellerTypeBadge type={c.type} /></td>
                    <td className="p-2.5 text-right text-xs font-bold text-foreground">{c.txCount}</td>
                    <td className="p-2.5 text-xs font-bold text-right text-foreground">{fmtCurrency(c.volume)}</td>
                    <td className="p-2.5 text-xs font-bold text-right text-warning">{fmtCurrency(c.fees)}</td>
                    <td className="p-2.5 text-xs font-bold text-right text-primary">{fmtCurrency(c.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* Quick stats */}
      {!isEmployee && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminPanel>
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Produtos</span>
            <p className="text-lg font-black text-foreground mt-1">{products.length}</p>
            <p className="text-[10px] text-muted-foreground">{products.filter(p => p.status === "active").length} ativos</p>
          </AdminPanel>
          <AdminPanel>
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Conversão</span>
            <p className="text-lg font-black text-primary mt-1">{conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground">{approved.length}/{allTx.length} tx</p>
          </AdminPanel>
          <AdminPanel>
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Ticket Médio</span>
            <p className="text-lg font-black text-foreground mt-1">{fmtCurrency(approved.length > 0 ? totalVolume / approved.length : 0)}</p>
          </AdminPanel>
          <AdminPanel>
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Sellers</span>
            <p className="text-lg font-black text-foreground mt-1">{profiles.length}</p>
            <p className="text-[10px] text-muted-foreground">{blackSellers.size}B / {whiteSellers.size}W / {unsetSellers.size}?</p>
          </AdminPanel>
        </div>
      )}
    </div>
  );
}

// ═══ Shared sub-components ═══

export function AdminPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className || ""}`}>
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
    <div className={`rounded-xl border bg-card p-4 ${alert ? "border-destructive/30" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      </div>
      <p className={`text-xl font-extrabold ${highlight ? "text-warning" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

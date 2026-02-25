import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, TrendingUp, Wallet, ShoppingCart, Activity,
  BarChart3, ChevronDown, CalendarDays, ArrowUpRight, ArrowDownRight, FileText,
  AlertCircle, RefreshCw, Eye, Zap, Receipt, Target, Clock,
  Package, Users, CreditCard, Rocket, GraduationCap, Layers,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PERIOD_OPTIONS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
];

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function toBrasiliaDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function brasiliaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

export default function Dashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]);
  const [products, setProducts] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([txRes, wdRes, prodRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (wdRes.data) setWithdrawals(wdRes.data);
      if (prodRes.count != null) setProducts(prodRes.count);
    });
  }, [user?.id]);

  const filteredTx = useMemo(() => {
    const today = brasiliaToday();
    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr);
    }
    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    }
    const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days); start.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod]);

  const approved = filteredTx.filter((t) => t.status === "completed");
  const revenue = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const ticket = approved.length > 0 ? revenue / approved.length : 0;
  const conv = filteredTx.length > 0 ? ((approved.length / filteredTx.length) * 100).toFixed(1) : "0.0";
  const cbs = filteredTx.filter((t) => t.status === "chargeback").length;
  const refs = filteredTx.filter((t) => t.status === "refunded").length;
  const cbRate = filteredTx.length > 0 ? ((cbs / filteredTx.length) * 100).toFixed(2) : "0";

  const chartData = useMemo(() => {
    const days = Math.min(Math.max(selectedPeriod.days || 1, 1), 30);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(brasiliaToday()); d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      const cmp = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const val = transactions.filter((t) => toBrasiliaDate(t.created_at) === cmp && t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0);
      return { name: label, vendas: val };
    });
  }, [transactions, selectedPeriod.days]);

  const activity = [...transactions.slice(0, 5), ...withdrawals.slice(0, 3)]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-0.5">Bem-vindo de volta 👋</p>
          <h1 className="text-2xl font-display font-extrabold tracking-tight text-foreground">Painel do Infoprodutor</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border bg-card text-foreground hover:border-primary/30 transition-all">
              <CalendarDays className="h-4 w-4 text-primary" />
              {selectedPeriod.label}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-lg p-1 min-w-[130px]">
            {PERIOD_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => setSelectedPeriod(opt)} className={`rounded-md text-sm cursor-pointer ${selectedPeriod.label === opt.label ? "text-primary font-semibold bg-primary/5" : ""}`}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Receita Líquida" value={fmt(revenue)} sub={`${approved.length} vendas aprovadas`} accent="primary" />
        <KpiCard icon={<Target className="h-5 w-5" />} label="Ticket Médio" value={fmt(ticket)} sub={approved.length > 0 ? `${approved.length} transações` : "Sem dados"} accent="info" />
        <KpiCard icon={<ShoppingCart className="h-5 w-5" />} label="Conversão" value={`${conv}%`} sub={`${filteredTx.length} checkouts gerados`} accent="success" />
        <KpiCard icon={<Wallet className="h-5 w-5" />} label="Saldo Disponível" value={fmt(revenue)} sub="Solicitar saque →" accent="primary" link="/financeiro/saques" />
      </div>

      {/* Chart + Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-display font-bold text-foreground">Vendas do Período</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedPeriod.label} — {approved.length} vendas</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-display font-extrabold text-foreground">{fmt(revenue)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground) / 0.1)" fontSize={10} tickLine={false} axisLine={false} dy={8} />
              <YAxis stroke="hsl(var(--muted-foreground) / 0.1)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={50} />
              <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "8px", fontSize: "12px", color: "var(--tooltip-text)", padding: "8px 12px" }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Vendas"]} cursor={{ stroke: "hsl(var(--primary) / 0.1)", strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right side: Overview + Métricas */}
        <div className="space-y-4">
          {/* Meu negócio */}
          <div className="rounded-xl p-4 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
            <h3 className="text-xs font-display font-bold text-foreground mb-3 uppercase tracking-wider">Meu Negócio</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span className="text-xs">Produtos ativos</span>
                </div>
                <span className="text-sm font-bold text-foreground">{products}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-xs">Total de clientes</span>
                </div>
                <span className="text-sm font-bold text-foreground">{new Set(transactions.map(t => t.customer_email)).size}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Chargebacks</span>
                </div>
                <span className="text-sm font-bold text-foreground">{cbs} ({cbRate}%)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="text-xs">Reembolsos</span>
                </div>
                <span className="text-sm font-bold text-foreground">{refs}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-xl p-4 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
            <h3 className="text-xs font-display font-bold text-foreground mb-3 uppercase tracking-wider">Status</h3>
            {[
              { l: "Gateway", v: "Online", c: "success" },
              { l: "Webhooks", v: "Ativo", c: "success" },
              { l: "Checkout", v: "Online", c: "success" },
            ].map((s) => (
              <div key={s.l} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground">{s.l}</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-[11px] font-semibold text-foreground">{s.v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick access + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick access — mais focado em infoprodutos */}
        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <h3 className="text-sm font-display font-bold text-foreground mb-3">Ações Rápidas</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Criar Produto", href: "/vendas/produtos", icon: Package, desc: "Novo infoproduto" },
              { label: "Área de Membros", href: "/membros", icon: GraduationCap, desc: "Gerenciar cursos" },
              { label: "Ver Vendas", href: "/vendas", icon: BarChart3, desc: "Relatório de vendas" },
              { label: "Meu Checkout", href: "/vendas/checkout", icon: CreditCard, desc: "Links de pagamento" },
              { label: "Solicitar Saque", href: "/financeiro/saques", icon: Wallet, desc: "Transferir saldo" },
              { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers, desc: "Módulos e aulas" },
            ].map((a) => (
              <Link key={a.href} to={a.href} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-primary/[0.03] hover:border-primary/15 transition-all group">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/8 group-hover:bg-primary/12 transition-colors">
                  <a.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-foreground block">{a.label}</span>
                  <span className="text-[10px] text-muted-foreground">{a.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-xl p-5 bg-card border border-border" style={{ boxShadow: "var(--card-shadow)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-display font-bold text-foreground">Atividade Recente</h3>
            <Link to="/financeiro/extrato" className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1">
              Ver tudo <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-0.5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground/25">
                <Eye className="h-8 w-8 mb-2" />
                <p className="text-xs">Nenhuma atividade ainda</p>
                <p className="text-[10px] mt-1">Suas vendas aparecerão aqui</p>
              </div>
            ) : activity.map((item) => {
              const isTx = "payment_method" in item;
              const stMap: Record<string, { c: string; l: string }> = {
                completed: { c: "hsl(var(--success))", l: "Aprovado" },
                pending: { c: "hsl(var(--warning))", l: "Pendente" },
                failed: { c: "hsl(var(--destructive))", l: "Falhou" },
                refunded: { c: "hsl(var(--info))", l: "Reembolso" },
                chargeback: { c: "hsl(var(--destructive))", l: "CB" },
              };
              const st = stMap[item.status] || { c: "hsl(var(--muted-foreground))", l: item.status };
              const diff = Date.now() - new Date(item.created_at).getTime();
              const mins = Math.floor(diff / 60000);
              const timeStr = mins < 1 ? "agora" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
              return (
                <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${st.c} 10%, transparent)` }}>
                    {isTx ? <DollarSign className="h-3.5 w-3.5" style={{ color: st.c }} /> : <ArrowDownRight className="h-3.5 w-3.5" style={{ color: st.c }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground">{fmt(Number(item.amount))}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: st.c, background: `color-mix(in srgb, ${st.c} 8%, transparent)` }}>{st.l}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{isTx ? `Venda • ${(item as any).payment_method || "PIX"}` : "Saque"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent, link }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string; link?: string }) {
  const content = (
    <div className="rounded-xl p-4 bg-card border border-border hover:border-primary/15 transition-all group" style={{ boxShadow: "var(--card-shadow)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-${accent}/10`}>
          <span className={`text-${accent}`}>{icon}</span>
        </div>
      </div>
      <p className="text-xl lg:text-2xl font-display font-extrabold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
  if (link) return <Link to={link}>{content}</Link>;
  return content;
}

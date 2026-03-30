import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
  PieChart as PieChartIcon, Plus, Trash2, TrendingDown, TrendingUp, DollarSign,
  CalendarDays, Wallet, Target, BarChart3, Activity, Percent, Zap, ArrowUpRight,
  ArrowDownRight, Layers, Filter, ChevronDown, Receipt, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, Panel as SharedPanel, GlassKpi } from "@/components/PageShell";
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { value: "anuncios", label: "Anúncios", color: "hsl(var(--destructive))", icon: Target },
  { value: "ferramentas", label: "Ferramentas", color: "hsl(var(--info))", icon: Layers },
  { value: "equipe", label: "Equipe", color: "hsl(var(--primary))", icon: Activity },
  { value: "infra", label: "Infraestrutura", color: "hsl(var(--warning))", icon: Zap },
  { value: "conteudo", label: "Conteúdo", color: "hsl(var(--success))", icon: BarChart3 },
  { value: "outros", label: "Outros", color: "hsl(var(--muted-foreground))", icon: Filter },
];

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return fmt(v);
};

type Expense = {
  id: string; user_id: string; category: string; description: string | null;
  amount: number; expense_date: string; created_at: string;
};

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <SharedPanel className={className}>{children}</SharedPanel>;
}

function PanelHeader({ title, icon: Icon, action }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-primary/8 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* ── Custom Recharts Tooltip ────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-2xl px-3.5 py-2.5 shadow-2xl shadow-background/20">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[11px] text-muted-foreground">{p.name}:</span>
          <span className="text-xs font-bold text-foreground font-numbers">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-2xl px-3.5 py-2.5 shadow-2xl shadow-background/20">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.payload?.color || d.color }} />
        <span className="text-xs font-semibold text-foreground">{d.name}</span>
      </div>
      <p className="text-xs font-bold text-foreground font-numbers mt-1">{fmt(d.value)}</p>
    </div>
  );
}

/* ── Gauge Component ──────────────────────────────────────────────── */
function Gauge({ value, max, label, sub, color }: { value: number; max: number; label: string; sub: string; color: string }) {
  const pct = Math.min(Math.abs(value), max) / max;
  const dashLen = pct * 264;
  return (
    <div className="text-center">
      <div className="relative w-[88px] h-[88px] mx-auto mb-2.5">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="5" opacity={0.2} />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${dashLen} 264`}
            className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-display font-black text-foreground tracking-tight">
            {typeof value === "number" && !isNaN(value) ? (label === "ROAS" ? `${value.toFixed(1)}x` : `${value.toFixed(0)}%`) : "—"}
          </span>
        </div>
      </div>
      <p className="text-xs font-display font-bold text-foreground tracking-[-0.02em]">{label}</p>
      <p className="text-[10px] text-muted-foreground/60">{sub}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
export default function ControleGastos() {
  const { user } = useAuth();
  const { data: expensesData = [] } = useExpenses();
  const expenses = expensesData as Expense[];
  const { data: txData = [] } = useTransactions();
  const invalidateAll = useInvalidateAll();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    category: "anuncios",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
  });
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [historyView, setHistoryView] = useState<"all" | "gastos">("all");

  // ─── Filtered data ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = filterCat === "all" || e.category === filterCat;
      const matchMonth = e.expense_date.startsWith(filterMonth);
      return matchCat && matchMonth;
    });
  }, [expenses, filterCat, filterMonth]);

  // ─── Revenue metrics ──────────────────────────────────────────
  const monthTx = useMemo(() => txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth)), [txData, filterMonth]);
  const monthRevenue = useMemo(() => monthTx.reduce((a, t) => a + Number(t.net_amount), 0), [monthTx]);
  const monthSales = monthTx.length;

  const totalExpenses = filtered.reduce((a, e) => a + Number(e.amount), 0);
  const adSpend = filtered.filter(e => e.category === "anuncios").reduce((a, e) => a + Number(e.amount), 0);
  const lucro = monthRevenue - totalExpenses;
  const margin = monthRevenue > 0 ? ((lucro / monthRevenue) * 100) : 0;
  const roi = totalExpenses > 0 ? ((lucro / totalExpenses) * 100) : 0;
  const roas = adSpend > 0 ? (monthRevenue / adSpend) : 0;
  const costPerSale = monthSales > 0 ? totalExpenses / monthSales : 0;
  const avgTicket = monthSales > 0 ? monthRevenue / monthSales : 0;

  // ─── By category ───────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return CATEGORIES.filter((c) => map[c.value]).map((c) => ({
      name: c.label, value: map[c.value], color: c.color,
      pct: totalExpenses > 0 ? ((map[c.value] / totalExpenses) * 100).toFixed(1) : "0",
    }));
  }, [filtered, totalExpenses]);

  // ─── Daily spend vs revenue ────────────────────────────────────
  const dailyData = useMemo(() => {
    const spendMap: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};
    filtered.forEach(e => { spendMap[e.expense_date] = (spendMap[e.expense_date] || 0) + Number(e.amount); });
    monthTx.forEach(t => {
      const d = t.created_at.split("T")[0];
      revenueMap[d] = (revenueMap[d] || 0) + Number(t.net_amount);
    });
    const allDays = new Set([...Object.keys(spendMap), ...Object.keys(revenueMap)]);
    return Array.from(allDays).sort().map(day => ({
      day: day.slice(8),
      gastos: spendMap[day] || 0,
      receita: revenueMap[day] || 0,
      lucro: (revenueMap[day] || 0) - (spendMap[day] || 0),
    }));
  }, [filtered, monthTx]);

  // ─── Weekly spend ──────────────────────────────────────────────
  const weeklySpend = useMemo(() => {
    const weeks: Record<string, { gastos: number; receita: number }> = {};
    filtered.forEach(e => {
      const d = new Date(e.expense_date + "T12:00:00");
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { gastos: 0, receita: 0 };
      weeks[key].gastos += Number(e.amount);
    });
    monthTx.forEach(t => {
      const d = new Date(t.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = { gastos: 0, receita: 0 };
      weeks[key].receita += Number(t.net_amount);
    });
    return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([week, data]) => ({
      semana: new Date(week + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...data,
    }));
  }, [filtered, monthTx]);

  // ─── CRUD ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("expenses").insert({
      user_id: user.id, category: form.category, description: form.description || null,
      amount, expense_date: form.expense_date,
    } as any);
    if (error) { toast.error("Erro ao registrar gasto"); return; }
    toast.success("Gasto registrado!");
    setDialogOpen(false);
    setForm({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
    invalidateAll(["expenses"]);
  }, [user, form, invalidateAll]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao remover gasto"); return; }
    toast.success("Gasto removido");
    invalidateAll(["expenses"]);
  }, [user, invalidateAll]);

  const getCatInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];

  const roiColor = roi >= 100 ? "hsl(var(--success))" : roi >= 0 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const roasColor = roas >= 3 ? "hsl(var(--success))" : roas >= 1 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const marginColor = margin >= 30 ? "hsl(var(--success))" : margin >= 0 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  const monthLabel = (() => {
    const [y, m] = filterMonth.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  return (
    <PageShell>
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle
          icon={<PieChartIcon className="h-6 w-6" />}
          title="Controle Financeiro"
          subtitle="Gastos, receita, ROI e análise completa"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2 rounded-xl text-sm font-bold h-10 px-5 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Registrar Gasto
          </Button>
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-xl border border-border/30 rounded-xl px-3 py-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-7 text-sm w-[140px] border-0 bg-transparent p-0 focus-visible:ring-0 font-medium"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 w-[160px] text-sm rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground/40 font-medium capitalize hidden sm:inline">{monthLabel}</span>
      </div>

      {/* ═══ KPIs Row 1 ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi
          label="Receita Líquida"
          value={fmt(monthRevenue)}
          sub={`${monthSales} vendas aprovadas`}
          icon={DollarSign}
          tone="primary"
          delay={0}
        />
        <GlassKpi
          label="Total Gastos"
          value={fmt(totalExpenses)}
          sub={`${filtered.length} registros`}
          icon={TrendingDown}
          tone="destructive"
          delay={1}
        />
        <GlassKpi
          label="Lucro Líquido"
          value={fmt(lucro)}
          sub={lucro >= 0 ? "Positivo" : "Negativo"}
          icon={lucro >= 0 ? TrendingUp : TrendingDown}
          tone={lucro >= 0 ? "success" : "destructive"}
          delay={2}
        />
        <GlassKpi
          label="Margem"
          value={`${margin.toFixed(1)}%`}
          sub={margin >= 30 ? "Saudável" : margin >= 0 ? "Moderada" : "Crítica"}
          icon={Percent}
          tone={margin >= 30 ? "success" : margin >= 0 ? "warning" : "destructive"}
          delay={3}
        />
      </div>

      {/* ═══ KPIs Row 2: ROI / ROAS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi
          label="ROI"
          value={`${roi.toFixed(1)}%`}
          sub={roi > 0 ? `${fmt(Math.abs(lucro))} retorno` : "Sem retorno"}
          icon={roi >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={roi >= 100 ? "success" : roi >= 0 ? "warning" : "destructive"}
          delay={0}
        />
        <GlassKpi
          label="ROAS"
          value={roas > 0 ? `${roas.toFixed(2)}x` : "—"}
          sub={adSpend > 0 ? `${fmt(adSpend)} em ads` : "Sem gastos ads"}
          icon={Target}
          tone={roas >= 3 ? "success" : roas >= 1 ? "warning" : "destructive"}
          delay={1}
        />
        <GlassKpi
          label="Custo por Venda"
          value={monthSales > 0 ? fmt(costPerSale) : "—"}
          sub={`${monthSales} vendas no mês`}
          icon={Wallet}
          tone="info"
          delay={2}
        />
        <GlassKpi
          label="Ticket Médio Líq."
          value={monthSales > 0 ? fmt(avgTicket) : "—"}
          sub="Por transação aprovada"
          icon={BarChart3}
          tone="info"
          delay={3}
        />
      </div>

      {/* ═══ Charts Row 1: Daily + Weekly ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily */}
        <Panel>
          <PanelHeader title="Receita vs Gastos Diários" icon={Activity} />
          <div className="px-5 pb-5">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="receita" stroke="hsl(var(--success))" fill="url(#gradReceita)" strokeWidth={2} name="Receita" dot={false} activeDot={{ r: 4, stroke: "hsl(var(--success))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
                  <Area type="monotone" dataKey="gastos" stroke="hsl(var(--destructive))" fill="url(#gradGastos)" strokeWidth={2} name="Gastos" dot={false} activeDot={{ r: 4, stroke: "hsl(var(--destructive))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground/30">Sem dados no período</p>
              </div>
            )}
          </div>
        </Panel>

        {/* Weekly */}
        <Panel>
          <PanelHeader title="Comparativo Semanal" icon={CalendarDays} />
          <div className="px-5 pb-5">
            {weeklySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklySpend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />
                  <XAxis dataKey="semana" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="receita" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} name="Receita" maxBarSize={32} opacity={0.85} />
                  <Bar dataKey="gastos" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} name="Gastos" maxBarSize={32} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground/30">Sem dados no período</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ═══ Charts Row 2: Pie + Performance Gauges ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <Panel>
          <PanelHeader title="Distribuição de Gastos" icon={PieChartIcon} />
          <div className="px-5 pb-5">
            {byCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={82}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="space-y-2.5 mt-3">
                  {byCategory.map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-xs font-medium text-foreground/70 flex-1">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground/50 font-numbers">{c.pct}%</span>
                      <span className="text-xs font-bold text-foreground font-numbers w-24 text-right">{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <EmptyState icon={<PieChartIcon className="h-6 w-6" />} title="Sem gastos" subtitle="Registre seu primeiro gasto" />
              </div>
            )}
          </div>
        </Panel>

        {/* Performance Gauges */}
        <Panel className="lg:col-span-2">
          <PanelHeader title="Performance de Retorno" icon={Target} />
          <div className="p-5 pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Gauge value={roi} max={300} label="ROI" sub="Retorno s/ investimento" color={roiColor} />
              <Gauge value={roas} max={10} label="ROAS" sub="Retorno s/ ads" color={roasColor} />
              <Gauge value={Math.max(margin, 0)} max={100} label="Margem" sub="Margem de lucro" color={marginColor} />

              {/* Summary cards */}
              <div className="flex flex-col justify-center gap-2.5">
                <div className="rounded-xl bg-success/[0.06] border border-success/10 p-3">
                  <p className="text-[9px] text-success/60 uppercase tracking-wider font-bold mb-0.5">Receita</p>
                  <p className="text-sm font-display font-black text-success font-numbers tracking-tight">{fmt(monthRevenue)}</p>
                </div>
                <div className="rounded-xl bg-destructive/[0.06] border border-destructive/10 p-3">
                  <p className="text-[9px] text-destructive/60 uppercase tracking-wider font-bold mb-0.5">Investido</p>
                  <p className="text-sm font-display font-black text-destructive font-numbers tracking-tight">{fmt(totalExpenses)}</p>
                </div>
                <div className={cn("rounded-xl border p-3", lucro >= 0 ? "bg-primary/[0.06] border-primary/10" : "bg-destructive/[0.06] border-destructive/10")}>
                  <p className={cn("text-[9px] uppercase tracking-wider font-bold mb-0.5", lucro >= 0 ? "text-primary/60" : "text-destructive/60")}>Lucro</p>
                  <p className={cn("text-sm font-display font-black font-numbers tracking-tight", lucro >= 0 ? "text-primary" : "text-destructive")}>{fmt(lucro)}</p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══ Category Bars ═══ */}
      {byCategory.length > 0 && (
        <Panel>
          <PanelHeader title="Gastos por Categoria" icon={BarChart3} />
          <div className="px-5 pb-5">
            <div className="space-y-3">
              {byCategory.sort((a, b) => b.value - a.value).map((c) => {
                const pct = totalExpenses > 0 ? (c.value / totalExpenses) * 100 : 0;
                return (
                  <div key={c.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        <span className="text-xs font-semibold text-foreground">{c.name}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground/50 font-numbers">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-bold text-foreground font-numbers">{fmt(c.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: c.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      )}

      {/* ═══ History ═══ */}
      <Panel>
        <PanelHeader
          title={`Histórico de Gastos`}
          icon={Receipt}
          action={
            <span className="text-[11px] text-muted-foreground/50 font-numbers font-medium">
              {filtered.length} registros · {fmt(totalExpenses)}
            </span>
          }
        />
        <div className="px-5 pb-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Nenhum gasto registrado"
              subtitle="Clique em 'Registrar Gasto' para começar"
            />
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
              {filtered
                .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
                .map((exp, i) => {
                  const cat = getCatInfo(exp.category);
                  const CatIcon = cat.icon || Filter;
                  return (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-muted/20 border border-transparent hover:border-border/15 transition-all duration-200 group"
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `color-mix(in srgb, ${cat.color} 10%, transparent)` }}
                      >
                        <CatIcon className="h-4 w-4" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {exp.description || cat.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50">
                          {cat.label} · {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="text-sm font-display font-black text-destructive font-numbers tracking-tight">
                        -{fmt(Number(exp.amount))}
                      </span>
                      <Button
                        variant="ghost" size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/30 hover:text-destructive hover:bg-destructive/5 h-8 w-8 rounded-lg shrink-0"
                        onClick={() => handleDelete(exp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </div>
      </Panel>

      {/* ═══ Dialog: Registrar Gasto ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-black tracking-[-0.02em]">Registrar Gasto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {/* Category picker */}
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">Categoria</Label>
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: c.value }))}
                    className={cn(
                      "flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border transition-all duration-200 text-center active:scale-[0.97]",
                      form.category === c.value
                        ? "border-primary/30 bg-primary/[0.06] shadow-sm shadow-primary/5"
                        : "border-border/20 hover:border-border/40 hover:bg-muted/10"
                    )}
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}
                    >
                      <c.icon className="h-4 w-4" style={{ color: c.color }} />
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold",
                      form.category === c.value ? "text-primary" : "text-muted-foreground/60"
                    )}>
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Facebook Ads - Campanha X"
                className="mt-2 rounded-xl h-11"
              />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  placeholder="0,00"
                  className="mt-2 rounded-xl h-11 text-lg font-display font-bold"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">Data</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                  className="mt-2 rounded-xl h-11"
                />
              </div>
            </div>

            <Button type="submit" className="w-full font-bold h-11 rounded-xl shadow-lg shadow-primary/20">
              <Minus className="h-4 w-4 mr-2" />
              Registrar Gasto
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

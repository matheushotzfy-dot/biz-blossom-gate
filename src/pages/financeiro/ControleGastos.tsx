import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
  PieChart as PieChartIcon, Plus, Trash2, TrendingDown, TrendingUp, DollarSign,
  CalendarDays, Wallet, Target, BarChart3, Activity, Percent, Zap, ArrowUpRight,
  ArrowDownRight, Layers, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const CATEGORIES = [
  { value: "anuncios", label: "Anúncios", color: "hsl(0 72% 51%)", icon: Target },
  { value: "ferramentas", label: "Ferramentas", color: "hsl(210 75% 50%)", icon: Layers },
  { value: "equipe", label: "Equipe", color: "hsl(280 65% 55%)", icon: Activity },
  { value: "infra", label: "Infraestrutura", color: "hsl(38 95% 50%)", icon: Zap },
  { value: "conteudo", label: "Conteúdo", color: "hsl(152 68% 46%)", icon: BarChart3 },
  { value: "outros", label: "Outros", color: "hsl(220 10% 50%)", icon: Filter },
];

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return fmt(v);
};

type Expense = {
  id: string; user_id: string; category: string; description: string | null;
  amount: number; expense_date: string; created_at: string;
};

// ─── Panel component ──────────────────────────────────────────────
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card/60 dark:bg-card/40 backdrop-blur-xl border border-border/40 dark:border-border/20 shadow-sm", className)}>
      {children}
    </div>
  );
}

function PanelHeader({ title, icon: Icon, action }: { title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {action}
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, tone = "primary", delay = 0 }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; tone?: string; delay?: number;
}) {
  const toneMap: Record<string, { bg: string; text: string; glow: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", glow: "shadow-primary/5" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive", glow: "shadow-destructive/5" },
    success: { bg: "bg-emerald-500/10", text: "text-emerald-500", glow: "shadow-emerald-500/5" },
    warning: { bg: "bg-amber-500/10", text: "text-amber-500", glow: "shadow-amber-500/5" },
    info: { bg: "bg-blue-500/10", text: "text-blue-500", glow: "shadow-blue-500/5" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-500", glow: "shadow-violet-500/5" },
  };
  const t = toneMap[tone] || toneMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn("rounded-2xl bg-card/60 dark:bg-card/40 backdrop-blur-xl border border-border/40 dark:border-border/20 p-5 shadow-sm", t.glow)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.bg)}>
          <Icon className={cn("h-4 w-4", t.text)} />
        </div>
      </div>
      <p className="text-2xl md:text-[28px] font-black text-foreground leading-none tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-2 font-medium">{sub}</p>}
    </motion.div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────
const chartTooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

// ═══════════════════════════════════════════════════════════════════
export default function ControleGastos() {
  const { user } = useAuth();
  const { data: expensesData = [] } = useExpenses();
  const expenses = expensesData as Expense[];
  const { data: txData = [] } = useTransactions();
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ─── Filtered data ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = filterCat === "all" || e.category === filterCat;
      const matchMonth = e.expense_date.startsWith(filterMonth);
      return matchCat && matchMonth;
    });
  }, [expenses, filterCat, filterMonth]);

  // ─── Revenue in selected month ─────────────────────────────────
  const monthRevenue = useMemo(() => {
    return txData
      .filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth))
      .reduce((a, t) => a + Number(t.net_amount), 0);
  }, [txData, filterMonth]);

  const totalRevenue = useMemo(() => txData.filter(t => t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0), [txData]);
  const totalExpenses = filtered.reduce((a, e) => a + Number(e.amount), 0);
  const adSpend = filtered.filter(e => e.category === "anuncios").reduce((a, e) => a + Number(e.amount), 0);
  const lucro = monthRevenue - totalExpenses;
  const margin = monthRevenue > 0 ? ((lucro / monthRevenue) * 100) : 0;
  const roi = totalExpenses > 0 ? ((lucro / totalExpenses) * 100) : 0;
  const roas = adSpend > 0 ? (monthRevenue / adSpend) : 0;

  // ─── By category ───────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return CATEGORIES.filter((c) => map[c.value]).map((c) => ({ name: c.label, value: map[c.value], color: c.color, pct: totalExpenses > 0 ? ((map[c.value] / totalExpenses) * 100).toFixed(1) : "0" }));
  }, [filtered, totalExpenses]);

  // ─── Daily spend (last 30 days or current month) ───────────────
  const dailySpend = useMemo(() => {
    const map: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};
    filtered.forEach(e => { map[e.expense_date] = (map[e.expense_date] || 0) + Number(e.amount); });
    txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth)).forEach(t => {
      const d = t.created_at.split("T")[0];
      revenueMap[d] = (revenueMap[d] || 0) + Number(t.net_amount);
    });
    const allDays = new Set([...Object.keys(map), ...Object.keys(revenueMap)]);
    return Array.from(allDays).sort().map(day => ({
      day: day.slice(8),
      gastos: map[day] || 0,
      receita: revenueMap[day] || 0,
    }));
  }, [filtered, txData, filterMonth]);

  // ─── Weekly spend ──────────────────────────────────────────────
  const weeklySpend = useMemo(() => {
    const weeks: Record<string, number> = {};
    filtered.forEach(e => {
      const d = new Date(e.expense_date + "T12:00:00");
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      weeks[key] = (weeks[key] || 0) + Number(e.amount);
    });
    return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([week, total]) => ({
      semana: `${new Date(week + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
      total,
    }));
  }, [filtered]);

  // ─── Category bar chart ────────────────────────────────────────
  const categoryBars = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return CATEGORIES.filter(c => map[c.value]).map(c => ({ name: c.label, value: map[c.value], fill: c.color }));
  }, [filtered]);

  // ─── CRUD ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
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
    setOpen(false);
    setForm({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
    invalidateAll(["expenses"]);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao remover gasto"); return; }
    toast.success("Gasto removido");
    invalidateAll(["expenses"]);
  };

  const getCatInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<PieChartIcon className="h-6 w-6" />} title="Controle de Gastos" subtitle="Métricas de retorno, análise por categoria e controle financeiro" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold h-10 px-5">
              <Plus className="h-4 w-4" /> Novo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl">
            <DialogHeader><DialogTitle className="text-lg font-bold">Registrar Gasto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Categoria</Label>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all text-center",
                        form.category === c.value
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/40 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>
                        <c.icon className="h-3.5 w-3.5" style={{ color: c.color }} />
                      </div>
                      <span className={cn("text-[10px] font-semibold", form.category === c.value ? "text-primary" : "text-muted-foreground")}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Facebook Ads - Campanha X" className="mt-1.5 rounded-xl h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="mt-1.5 rounded-xl h-11 text-lg font-bold" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Data</Label>
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold h-11 rounded-xl">Registrar Gasto</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-9 text-sm w-[160px] rounded-xl border-border/40" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 w-[150px] text-sm rounded-xl border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ═══ KPIs Row 1: Financial ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Gastos" value={fmt(totalExpenses)} sub={`${filtered.length} registros no período`} icon={TrendingDown} tone="destructive" delay={0} />
        <MetricCard label="Receita do Mês" value={fmt(monthRevenue)} sub="Transações aprovadas" icon={DollarSign} tone="primary" delay={0.05} />
        <MetricCard label="Lucro Líquido" value={fmt(lucro)} sub={lucro >= 0 ? "Saldo positivo" : "Saldo negativo"} icon={lucro >= 0 ? TrendingUp : TrendingDown} tone={lucro >= 0 ? "success" : "destructive"} delay={0.1} />
        <MetricCard label="Margem" value={`${margin.toFixed(1)}%`} sub={margin >= 30 ? "Saudável" : margin >= 0 ? "Moderada" : "Crítica"} icon={Percent} tone={margin >= 30 ? "success" : margin >= 0 ? "warning" : "destructive"} delay={0.15} />
      </div>

      {/* ═══ KPIs Row 2: ROI / ROAS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="ROI"
          value={`${roi.toFixed(1)}%`}
          sub={roi > 0 ? `${fmt(Math.abs(lucro))} de retorno` : "Investimento sem retorno"}
          icon={roi >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={roi >= 100 ? "success" : roi >= 0 ? "warning" : "destructive"}
          delay={0}
        />
        <MetricCard
          label="ROAS"
          value={roas > 0 ? `${roas.toFixed(2)}x` : "—"}
          sub={adSpend > 0 ? `${fmt(adSpend)} em anúncios` : "Sem gastos com ads"}
          icon={Target}
          tone={roas >= 3 ? "success" : roas >= 1 ? "warning" : "destructive"}
          delay={0.05}
        />
        <MetricCard
          label="Custo por Venda"
          value={(() => {
            const salesCount = txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth)).length;
            return salesCount > 0 ? fmt(totalExpenses / salesCount) : "—";
          })()}
          sub={`${txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth)).length} vendas no mês`}
          icon={Wallet}
          tone="info"
          delay={0.1}
        />
        <MetricCard
          label="Ticket Médio Líq."
          value={(() => {
            const completed = txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth));
            return completed.length > 0 ? fmt(completed.reduce((a, t) => a + Number(t.net_amount), 0) / completed.length) : "—";
          })()}
          sub="Por transação aprovada"
          icon={BarChart3}
          tone="violet"
          delay={0.15}
        />
      </div>

      {/* ═══ Charts Row: Daily + Weekly ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily Spend vs Revenue */}
        <Panel>
          <PanelHeader title="Gastos vs Receita Diários" icon={Activity} />
          <div className="px-5 pb-5">
            {dailySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailySpend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152 55% 40%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(152 55% 40%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="receita" stroke="hsl(152 55% 40%)" fill="url(#gradReceita)" strokeWidth={2} name="Receita" />
                  <Area type="monotone" dataKey="gastos" stroke="hsl(0 72% 51%)" fill="url(#gradGastos)" strokeWidth={2} name="Gastos" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground/30 text-sm">Sem dados no período</div>
            )}
          </div>
        </Panel>

        {/* Weekly Spend */}
        <Panel>
          <PanelHeader title="Gastos Semanais" icon={CalendarDays} />
          <div className="px-5 pb-5">
            {weeklySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklySpend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="semana" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Gastos" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground/30 text-sm">Sem dados no período</div>
            )}
          </div>
        </Panel>
      </div>

      {/* ═══ Charts Row: Category Pie + Category Bars ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Donut Chart */}
        <Panel>
          <PanelHeader title="Distribuição" icon={PieChartIcon} />
          <div className="px-5 pb-5">
            {byCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RePieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={2} stroke="hsl(var(--background))">
                      {byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={chartTooltipStyle} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {byCategory.map((c) => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-xs font-medium text-foreground/70">{c.name}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{c.pct}%</span>
                        <span className="text-xs font-bold text-foreground tabular-nums">{fmt(c.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={<PieChartIcon className="h-6 w-6" />} title="Sem gastos" subtitle="Registre seu primeiro gasto" />
            )}
          </div>
        </Panel>

        {/* Category Bars */}
        <Panel className="lg:col-span-2">
          <PanelHeader title="Gastos por Categoria" icon={BarChart3} />
          <div className="px-5 pb-5">
            {categoryBars.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryBars} layout="vertical" margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Valor" maxBarSize={28}>
                    {categoryBars.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground/30 text-sm">Sem dados</div>
            )}
          </div>
        </Panel>
      </div>

      {/* ═══ ROI Performance Card ═══ */}
      <Panel>
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Performance de Retorno</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* ROI Gauge */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity={0.3} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={roi >= 100 ? "hsl(152 55% 40%)" : roi >= 0 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.min(Math.abs(roi), 300) / 300 * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-foreground">{roi.toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-xs font-bold text-foreground">ROI</p>
              <p className="text-[10px] text-muted-foreground">Retorno sobre investimento</p>
            </div>
            {/* ROAS Gauge */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity={0.3} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={roas >= 3 ? "hsl(152 55% 40%)" : roas >= 1 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.min(roas, 10) / 10 * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-foreground">{roas.toFixed(1)}x</span>
                </div>
              </div>
              <p className="text-xs font-bold text-foreground">ROAS</p>
              <p className="text-[10px] text-muted-foreground">Retorno sobre ads</p>
            </div>
            {/* Margin Gauge */}
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity={0.3} />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={margin >= 30 ? "hsl(152 55% 40%)" : margin >= 0 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.min(Math.max(margin, 0), 100) / 100 * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-foreground">{margin.toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-xs font-bold text-foreground">Margem</p>
              <p className="text-[10px] text-muted-foreground">Margem de lucro</p>
            </div>
            {/* Summary */}
            <div className="flex flex-col justify-center gap-3">
              <div className="rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Investido</p>
                <p className="text-base font-black text-destructive tabular-nums">{fmt(totalExpenses)}</p>
              </div>
              <div className="rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Retornado</p>
                <p className="text-base font-black text-primary tabular-nums">{fmt(monthRevenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ═══ History ═══ */}
      <Panel>
        <PanelHeader
          title={`Histórico (${filtered.length})`}
          icon={CalendarDays}
          action={<span className="text-[11px] text-muted-foreground font-medium">{fmt(totalExpenses)} total</span>}
        />
        <div className="px-5 pb-5">
          <div className="space-y-1 max-h-[450px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhum gasto encontrado" subtitle="Ajuste os filtros ou registre um gasto" />
            ) : filtered.map((exp, i) => {
              const cat = getCatInfo(exp.category);
              const CatIcon = cat.icon || Filter;
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-muted/30 dark:hover:bg-muted/10 border border-transparent hover:border-border/20 transition-all group"
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${cat.color} 12%, transparent)` }}>
                    <CatIcon className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{exp.description || cat.label}</p>
                    <p className="text-[11px] text-muted-foreground">{cat.label} · {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-sm font-black text-destructive tabular-nums">-{fmt(Number(exp.amount))}</span>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/40 hover:text-destructive hover:bg-destructive/5 h-8 w-8 rounded-lg shrink-0" onClick={() => handleDelete(exp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}

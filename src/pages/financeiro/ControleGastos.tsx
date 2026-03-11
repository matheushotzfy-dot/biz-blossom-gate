import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import { PieChart, Plus, Trash2, TrendingDown, TrendingUp, DollarSign, CalendarDays, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "anuncios", label: "Anúncios", color: "hsl(0 72% 51%)" },
  { value: "ferramentas", label: "Ferramentas", color: "hsl(210 75% 50%)" },
  { value: "equipe", label: "Equipe", color: "hsl(280 65% 55%)" },
  { value: "infra", label: "Infraestrutura", color: "hsl(38 95% 50%)" },
  { value: "conteudo", label: "Conteúdo", color: "hsl(152 68% 46%)" },
  { value: "outros", label: "Outros", color: "hsl(220 10% 50%)" },
];

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Expense = {
  id: string; user_id: string; category: string; description: string | null;
  amount: number; expense_date: string; created_at: string;
};

/* ─── KPI ─── */
function GastoKpi({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string;
}) {
  return (
    <div className="panel-enterprise p-5 group">
      <div className="flex items-center justify-between mb-3">
        <span className="kicker">{label}</span>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border border-border/30", bg)}>
          <Icon className={cn("h-[18px] w-[18px]", color)} />
        </div>
      </div>
      <p className="text-[22px] md:text-2xl font-display font-black text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

export default function ControleGastos() {
  const { user } = useAuth();
  const { data: expensesData = [] } = useExpenses();
  const expenses = expensesData as Expense[];
  const { data: txData = [] } = useTransactions();
  const revenue = useMemo(() => txData.filter(t => t.status === "completed").reduce((a, t) => a + Number(t.net_amount), 0), [txData]);
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = filterCat === "all" || e.category === filterCat;
      const matchMonth = e.expense_date.startsWith(filterMonth);
      return matchCat && matchMonth;
    });
  }, [expenses, filterCat, filterMonth]);

  const totalExpenses = filtered.reduce((a, e) => a + Number(e.amount), 0);
  const lucro = revenue - totalExpenses;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return CATEGORIES.filter((c) => map[c.value]).map((c) => ({ name: c.label, value: map[c.value], color: c.color }));
  }, [filtered]);

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
    await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Gasto removido");
    invalidateAll(["expenses"]);
  };

  const getCatInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<PieChart className="h-6 w-6" />} title="Controle de Gastos" subtitle="Organize suas finanças e maximize seu lucro" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold gradient-primary text-primary-foreground h-11 px-6 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all">
              <Plus className="h-4 w-4" /> Novo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent rounded-2xl pointer-events-none" />
            <DialogHeader><DialogTitle className="font-display text-lg relative">Registrar Gasto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 relative">
              <div>
                <Label className="kicker">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="kicker">Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Facebook Ads - Campanha X" className="mt-1.5 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="kicker">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="kicker">Data</Label>
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-11 rounded-xl shadow-lg shadow-primary/15">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GastoKpi label="Total Gastos" value={fmt(totalExpenses)} sub={`${filtered.length} registros`} icon={TrendingDown} color="text-destructive" bg="bg-destructive/10" />
        <GastoKpi label="Receita Total" value={fmt(revenue)} icon={DollarSign} color="text-primary" bg="bg-primary/10" />
        <GastoKpi label="Lucro Líquido" value={fmt(lucro)} sub={lucro >= 0 ? "positivo" : "negativo"} icon={lucro >= 0 ? TrendingUp : TrendingDown} color={lucro >= 0 ? "text-success" : "text-destructive"} bg={lucro >= 0 ? "bg-success/10" : "bg-destructive/10"} />
        <GastoKpi label="Margem" value={revenue > 0 ? `${((lucro / revenue) * 100).toFixed(1)}%` : "—"} icon={Wallet} color="text-info" bg="bg-info/10" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-10 text-sm w-[160px] rounded-xl border-border/40" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-10 w-[150px] text-sm rounded-xl border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Chart + History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="panel-enterprise p-5 lg:col-span-1">
          <h3 className="text-[15px] font-display font-bold text-foreground mb-4">Por Categoria</h3>
          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RePieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={2} stroke="hsl(var(--background))">
                    {byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 mt-4">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-foreground/80 font-medium text-[13px]">{c.name}</span>
                    </span>
                    <span className="font-display font-bold text-foreground text-[13px]">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={<PieChart className="h-6 w-6" />} title="Sem gastos" subtitle="Registre seu primeiro gasto" />
          )}
        </div>

        {/* History */}
        <div className="panel-enterprise p-5 lg:col-span-2">
          <h3 className="text-[15px] font-display font-bold text-foreground mb-4">Histórico</h3>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nenhum gasto encontrado" subtitle="Ajuste os filtros ou registre um gasto" />
            ) : filtered.map((exp, i) => {
              const cat = getCatInfo(exp.category);
              return (
                <div key={exp.id} className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-primary/[0.02] border border-transparent hover:border-border/20 transition-all group animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-border/20" style={{ background: `color-mix(in srgb, ${cat.color} 10%, transparent)` }}>
                    <span className="h-3 w-3 rounded-full" style={{ background: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{exp.description || cat.label}</p>
                    <p className="text-[11px] text-muted-foreground/50">{cat.label} • {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-[14px] font-display font-bold text-destructive">-{fmt(Number(exp.amount))}</span>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/40 hover:text-destructive hover:bg-destructive/5 h-8 w-8 rounded-lg shrink-0" onClick={() => handleDelete(exp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
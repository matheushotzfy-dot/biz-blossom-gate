import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Plus, Trash2, TrendingDown, TrendingUp, DollarSign, CalendarDays, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  id: string;
  user_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
};

export default function ControleGastos() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const loadData = async () => {
    if (!user?.id) return;
    const [expRes, txRes] = await Promise.all([
      supabase.from("expenses").select("*").eq("user_id", user.id).order("expense_date", { ascending: false }),
      supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
    ]);
    if (expRes.data) setExpenses(expRes.data as Expense[]);
    if (txRes.data) setRevenue(txRes.data.reduce((a, t) => a + Number(t.net_amount), 0));
  };

  useEffect(() => { loadData(); }, [user?.id]);

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
      user_id: user.id,
      category: form.category,
      description: form.description || null,
      amount,
      expense_date: form.expense_date,
    } as any);
    if (error) { toast.error("Erro ao registrar gasto"); return; }
    toast.success("Gasto registrado!");
    setOpen(false);
    setForm({ category: "anuncios", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0] });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Gasto removido");
    loadData();
  };

  const getCatInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<PieChart className="h-6 w-6" />} title="Controle de Gastos" subtitle="Organize suas finanças e maximize seu lucro" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Novo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-lg font-bold">Registrar Gasto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                <Label className="text-sm">Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Facebook Ads - Campanha X" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div>
                  <Label className="text-sm">Data</Label>
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<TrendingDown className="h-5 w-5" />} label="Total Gastos" value={fmt(totalExpenses)} color="destructive" />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Receita Total" value={fmt(revenue)} color="primary" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Lucro Líquido" value={fmt(lucro)} color={lucro >= 0 ? "primary" : "destructive"} />
        <KpiCard icon={<CalendarDays className="h-5 w-5" />} label="Registros" value={String(filtered.length)} color="info" />
      </div>

      {/* Filters + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Panel className="lg:col-span-1">
          <h3 className="text-[15px] font-bold text-foreground mb-4">Por Categoria</h3>
          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <RePieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={2} stroke="hsl(var(--background))">
                    {byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "12px", fontSize: "12px", color: "var(--tooltip-text)" }} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                      <span className="text-foreground font-medium">{c.name}</span>
                    </span>
                    <span className="font-bold text-foreground">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum gasto registrado</p>
          )}
        </Panel>

        {/* Table */}
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-[15px] font-bold text-foreground">Histórico</h3>
            <div className="flex items-center gap-2">
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-9 text-sm w-[160px]" />
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum gasto encontrado</p>
            ) : filtered.map((exp) => {
              const cat = getCatInfo(exp.category);
              return (
                <div key={exp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors group">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)` }}>
                    <span className="h-3 w-3 rounded-full" style={{ background: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{exp.description || cat.label}</p>
                    <p className="text-[11px] text-muted-foreground">{cat.label} • {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">-{fmt(Number(exp.amount))}</span>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDelete(exp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "hsl(var(--primary))",
    destructive: "hsl(var(--destructive))",
    info: "hsl(var(--info))",
    warning: "hsl(var(--warning))",
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <Panel>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c }}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-black text-foreground tracking-tight">{value}</p>
    </Panel>
  );
}

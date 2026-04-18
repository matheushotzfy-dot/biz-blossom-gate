import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenses, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, Trash2, TrendingDown, TrendingUp, CalendarDays,
  Target, BarChart3, Activity, Zap, Layers, Filter, Receipt,
  Wallet, ArrowDownUp, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, Panel as SharedPanel } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const CATEGORIES = [
  { value: "anuncios", label: "Anúncios", color: "hsl(var(--destructive))", icon: Target },
  { value: "ferramentas", label: "Ferramentas", color: "hsl(var(--info))", icon: Layers },
  { value: "equipe", label: "Equipe", color: "hsl(var(--primary))", icon: Activity },
  { value: "infra", label: "Infraestrutura", color: "hsl(var(--warning))", icon: Zap },
  { value: "conteudo", label: "Conteúdo", color: "hsl(var(--success))", icon: BarChart3 },
  { value: "outros", label: "Outros", color: "hsl(var(--muted-foreground))", icon: Filter },
];

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Expense = {
  id: string; user_id: string; category: string; description: string | null;
  amount: number; expense_date: string; created_at: string;
};

type SortKey = "date" | "amount";

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
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ─── Filtered ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = filterCat === "all" || e.category === filterCat;
      const matchMonth = e.expense_date.startsWith(filterMonth);
      const matchSearch = !search ||
        (e.description || "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchMonth && matchSearch;
    });
  }, [expenses, filterCat, filterMonth, search]);

  // ─── Metrics ───────────────────────────────────────────────────
  const monthTx = useMemo(
    () => txData.filter(t => t.status === "completed" && t.created_at.startsWith(filterMonth)),
    [txData, filterMonth]
  );
  const monthRevenue = monthTx.reduce((a, t) => a + Number(t.net_amount), 0);
  const totalExpenses = filtered.reduce((a, e) => a + Number(e.amount), 0);
  const lucro = monthRevenue - totalExpenses;
  const margin = monthRevenue > 0 ? ((lucro / monthRevenue) * 100) : 0;
  const avgDaily = useMemo(() => {
    const days = new Set(filtered.map(e => e.expense_date)).size || 1;
    return totalExpenses / days;
  }, [filtered, totalExpenses]);

  // ─── By category (always show all categories for structure) ────
  const byCategory = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.forEach((e) => {
      if (!map[e.category]) map[e.category] = { total: 0, count: 0 };
      map[e.category].total += Number(e.amount);
      map[e.category].count += 1;
    });
    return CATEGORIES.map((c) => {
      const entry = map[c.value] || { total: 0, count: 0 };
      return {
        ...c,
        total: entry.total,
        count: entry.count,
        pct: totalExpenses > 0 ? (entry.total / totalExpenses) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filtered, totalExpenses]);

  // ─── Sorted list ───────────────────────────────────────────────
  const sortedList = useMemo(() => {
    const list = [...filtered];
    if (sortKey === "amount") list.sort((a, b) => Number(b.amount) - Number(a.amount));
    else list.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    return list;
  }, [filtered, sortKey]);

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

  const monthLabel = (() => {
    const [y, m] = filterMonth.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  const lucroTone = lucro >= 0 ? "text-success" : "text-destructive";
  const marginTone = margin >= 30 ? "text-success" : margin >= 0 ? "text-warning" : "text-destructive";

  return (
    <PageShell>
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle
          icon={<Wallet className="h-6 w-6" />}
          title="Controle de Gastos"
          subtitle="Operação financeira mensal — categorias, lucro e histórico"
        />
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2 rounded-xl text-sm font-bold h-10 px-5 shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> Registrar Gasto
        </Button>
      </div>

      {/* ═══ Filter bar ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-card/60 border border-border/30 rounded-xl px-3 h-9">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-7 text-sm w-[140px] border-0 bg-transparent p-0 focus-visible:ring-0 font-medium"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 w-[170px] text-sm rounded-xl">
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
        <span className="text-[11px] text-muted-foreground/40 font-medium capitalize hidden sm:inline ml-1">
          {monthLabel}
        </span>
      </div>

      {/* ═══ TOTALS LEDGER ═══ */}
      <SharedPanel>
        <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border/30">
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Receita do mês
            </p>
            <p className="text-2xl font-display font-black text-foreground font-numbers tracking-tight">
              {fmt(monthRevenue)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {monthTx.length} vendas líquidas
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Total de gastos
            </p>
            <p className="text-2xl font-display font-black text-destructive font-numbers tracking-tight">
              −{fmt(totalExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {filtered.length} lançamentos
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Lucro líquido
            </p>
            <p className={cn("text-2xl font-display font-black font-numbers tracking-tight", lucroTone)}>
              {lucro >= 0 ? "" : "−"}{fmt(Math.abs(lucro))}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1 flex items-center gap-1">
              {lucro >= 0
                ? <><TrendingUp className="h-3 w-3 text-success" /> Resultado positivo</>
                : <><TrendingDown className="h-3 w-3 text-destructive" /> Resultado negativo</>}
            </p>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Margem
            </p>
            <p className={cn("text-2xl font-display font-black font-numbers tracking-tight", marginTone)}>
              {margin.toFixed(1)}%
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {margin >= 30 ? "Saudável" : margin >= 0 ? "Moderada" : "Crítica"}
            </p>
          </div>
          <div className="p-5 col-span-2 lg:col-span-1">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-2">
              Média por dia
            </p>
            <p className="text-2xl font-display font-black text-foreground font-numbers tracking-tight">
              {fmt(avgDaily)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              em dias com lançamento
            </p>
          </div>
        </div>
      </SharedPanel>

      {/* ═══ CATEGORY BREAKDOWN ═══ */}
      <SharedPanel>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-4 w-4 text-muted-foreground/70" />
            <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">
              Gastos por categoria
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground/50 font-numbers">
            {byCategory.filter(c => c.total > 0).length} categorias ativas
          </span>
        </div>

        {totalExpenses === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="Sem gastos no período"
              subtitle="Os gastos categorizados aparecem aqui"
            />
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {byCategory.map((c) => {
              const Icon = c.icon;
              const isEmpty = c.total === 0;
              return (
                <div
                  key={c.value}
                  className={cn(
                    "grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors",
                    isEmpty ? "opacity-40" : "hover:bg-muted/10"
                  )}
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${c.color} 10%, transparent)` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: c.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground/50">
                        {c.count} {c.count === 1 ? "lançamento" : "lançamentos"}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-5">
                    <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: c.color }}
                      />
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-[11px] text-muted-foreground/60 font-numbers font-medium">
                      {c.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-display font-bold text-foreground font-numbers tracking-tight">
                      {fmt(c.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SharedPanel>

      {/* ═══ TRANSACTIONS TABLE ═══ */}
      <SharedPanel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-4 w-4 text-muted-foreground/70" />
            <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">
              Histórico de lançamentos
            </h3>
            <span className="text-[11px] text-muted-foreground/50 font-numbers ml-1">
              · {filtered.length} registros · {fmt(totalExpenses)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descrição..."
                className="h-8 pl-8 w-[200px] text-xs rounded-lg"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortKey(sortKey === "date" ? "amount" : "date")}
              className="h-8 px-2.5 text-xs gap-1.5 rounded-lg"
            >
              <ArrowDownUp className="h-3 w-3" />
              {sortKey === "date" ? "Data" : "Valor"}
            </Button>
          </div>
        </div>

        {sortedList.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Nenhum gasto registrado"
              subtitle="Clique em 'Registrar Gasto' para começar"
            />
          </div>
        ) : (
          <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10">
                <TableRow className="border-border/20 hover:bg-transparent">
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[160px]">Categoria</TableHead>
                  <TableHead className="text-right w-[140px]">Valor</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedList.map((exp) => {
                  const cat = getCatInfo(exp.category);
                  const CatIcon = cat.icon || Filter;
                  return (
                    <TableRow key={exp.id} className="border-border/15 group">
                      <TableCell className="font-numbers text-xs text-muted-foreground/80">
                        {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[320px]">
                          {exp.description || <span className="text-muted-foreground/50 italic">Sem descrição</span>}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-[11px] font-semibold"
                          style={{
                            background: `color-mix(in srgb, ${cat.color} 8%, transparent)`,
                            color: cat.color,
                          }}
                        >
                          <CatIcon className="h-3 w-3" />
                          {cat.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-display font-bold text-destructive font-numbers tracking-tight">
                          −{fmt(Number(exp.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/40 hover:text-destructive hover:bg-destructive/5 h-7 w-7 rounded-md"
                          onClick={() => handleDelete(exp.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SharedPanel>

      {/* ═══ Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-black tracking-[-0.02em]">Registrar Gasto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
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

            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex: Facebook Ads - Campanha X"
                className="mt-2 rounded-xl h-11"
              />
            </div>

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
              <Plus className="h-4 w-4 mr-2" />
              Registrar Gasto
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

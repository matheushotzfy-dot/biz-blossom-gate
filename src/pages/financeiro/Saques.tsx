import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, TrendingUp, Shield, Zap,
  Eye, EyeOff, Search, Banknote, Percent,
  Activity, Layers, Target, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

/* ─────────────────────── Helpers ─────────────────────── */
const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};
const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return fmt(v);
};
const HIDE = "•••";

const PERIODS: { label: string; days: number }[] = [
  { label: "Hoje", days: 0 },
  { label: "7D", days: 7 },
  { label: "15D", days: 15 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "Tudo", days: 9999 },
];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
  approved: { label: "Aprovado", fg: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pending: { label: "Pendente", fg: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*                              MAIN PAGE                                */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function Saques() {
  const { user } = useAuth();
  const { data: withdrawals = [], refetch: refetchWithdrawals } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const invalidateAll = useInvalidateAll();
  const [selectedPixKeyId, setSelectedPixKeyId] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [approvedPopup, setApprovedPopup] = useState<Tables<"withdrawals"> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);

  const toggleHidden = useCallback(() => {
    setHidden(p => { const n = !p; try { localStorage.setItem("privacy_mode", String(n)); } catch {} return n; });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => refetchWithdrawals(), 30000);
    return () => clearInterval(interval);
  }, [user?.id, refetchWithdrawals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pixKeys.length === 0) { toast.error("Cadastre uma chave PIX em Dados Bancários"); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    if (numAmount <= 5) { toast.error("Valor mínimo deve ser maior que a taxa de R$ 5,00"); return; }
    const selected = pixKeys.find(k => k.id === selectedPixKeyId) || pixKeys[0];
    await supabase.from("profiles").update({ pix_key: selected.key_value, pix_key_type: selected.key_type }).eq("user_id", user.id);
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("Saldo insuficiente")) toast.error(msg);
      else if (msg.includes("Máximo de 3")) toast.error("Você já tem 3 saques pendentes");
      else if (msg.includes("congelado")) toast.error("Saldo congelado pelo administrador");
      else toast.error("Erro ao solicitar saque");
      return;
    }
    toast.success("Saque solicitado com sucesso!");
    setOpen(false); setAmount(""); setSelectedPixKeyId(""); invalidateAll(["withdrawals"]);
  };

  /* ─── Computed metrics ─── */
  const metrics = useMemo(() => {
    const now = new Date();
    const cutoff = selectedPeriod.days === 9999 ? new Date(0) : selectedPeriod.days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)) : subDays(now, selectedPeriod.days);
    const prevCutoff = selectedPeriod.days === 9999 ? new Date(0) : selectedPeriod.days === 0 ? subDays(cutoff, 1) : subDays(cutoff, selectedPeriod.days);

    const current = withdrawals.filter(w => new Date(w.created_at) >= cutoff);
    const previous = selectedPeriod.days === 9999 ? [] : withdrawals.filter(w => { const d = new Date(w.created_at); return d >= prevCutoff && d < cutoff; });

    const approved = current.filter(w => w.status === "approved");
    const pending = current.filter(w => w.status === "pending");
    const rejected = current.filter(w => w.status === "rejected");
    const prevApproved = previous.filter(w => w.status === "approved");

    const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);
    const totalRequested = current.reduce((a, w) => a + Number(w.amount), 0);
    const totalFees = current.reduce((a, w) => a + Number(w.fee_amount), 0);
    const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
    const prevTotalApproved = prevApproved.reduce((a, w) => a + Number(w.net_amount), 0);
    const avgAmount = approved.length > 0 ? totalApproved / approved.length : 0;
    const prevAvg = prevApproved.length > 0 ? prevTotalApproved / prevApproved.length : 0;
    const approvalRate = current.length > 0 ? (approved.length / current.length) * 100 : 0;

    // Chart
    const days = Math.min(selectedPeriod.days === 9999 ? 30 : Math.max(selectedPeriod.days, 1), 30);
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = format(subDays(now, days - 1 - i), "dd/MM");
      dailyMap.set(d, 0);
    }
    approved.forEach(w => {
      const d = format(new Date(w.created_at), "dd/MM");
      if (dailyMap.has(d)) dailyMap.set(d, (dailyMap.get(d) || 0) + Number(w.net_amount));
    });
    const chartData = Array.from(dailyMap.entries()).map(([label, value]) => ({ label, value }));

    return {
      current, previous, approved, pending, rejected,
      totalApproved, totalRequested, totalFees, totalPending,
      prevTotalApproved, avgAmount, prevAvg, approvalRate, chartData,
    };
  }, [withdrawals, selectedPeriod]);

  /* ─── Filtered list ─── */
  const filtered = useMemo(() => {
    let list = metrics.current;
    if (statusFilter !== "all") list = list.filter(w => w.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w => w.id.toLowerCase().includes(q) || fmt(Number(w.amount)).includes(q));
    }
    return list;
  }, [metrics.current, statusFilter, search]);

  const statusTabs = useMemo(() => [
    { label: "Todos", value: "all" as StatusFilter, count: metrics.current.length },
    { label: "Aprovados", value: "approved" as StatusFilter, count: metrics.approved.length },
    { label: "Pendentes", value: "pending" as StatusFilter, count: metrics.pending.length },
    { label: "Recusados", value: "rejected" as StatusFilter, count: metrics.rejected.length },
  ], [metrics]);

  const m = metrics;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6 pb-24">

      {/* ════════ HEADER ════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Saques PIX</h1>
            <p className="text-xs text-muted-foreground">Gerencie suas retiradas</p>
          </div>
          {m.pending.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-amber-500 opacity-40" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              {m.pending.length} pendente{m.pending.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleHidden} className={cn("h-9 w-9 rounded-xl border transition-all", hidden ? "bg-primary/10 border-primary/20 text-primary" : "bg-card border-border/40 text-muted-foreground hover:text-foreground")}>
            {hidden ? <EyeOff className="mx-auto h-4 w-4" /> : <Eye className="mx-auto h-4 w-4" />}
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all">
                <Plus className="h-3.5 w-3.5" /> Novo Saque
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl border border-border/40 bg-card p-0 overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-border/30">
                <DialogHeader>
                  <DialogTitle className="font-black text-lg flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                      <ArrowDownToLine className="h-4 w-4 text-primary" />
                    </div>
                    Solicitar Saque
                  </DialogTitle>
                </DialogHeader>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div className="rounded-xl border border-border/30 bg-muted/5 p-4">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Valor do saque (R$)</Label>
                  <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-2 h-14 text-xl font-black rounded-xl border-border/20" />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-muted-foreground">Taxa fixa de saque</p>
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">- R$ 5,00</p>
                  </div>
                  {amount && parseFloat(amount) > 5 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/15 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[11px] text-muted-foreground">Você receberá</span>
                        </div>
                        <span className="text-lg font-black text-primary">{fmt(parseFloat(amount) - 5)}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div className="rounded-xl border border-border/30 bg-muted/5 p-4">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
                  {pixKeys.length > 0 ? (
                    <div className="mt-2.5 space-y-1.5">
                      {pixKeys.map((pk) => {
                        const isSelected = (selectedPixKeyId || pixKeys[0]?.id) === pk.id;
                        return (
                          <button key={pk.id} type="button" onClick={() => setSelectedPixKeyId(pk.id)} className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                            isSelected ? "border-primary/25 bg-primary/5" : "border-border/20 hover:border-border/40"
                          )}>
                            <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0", isSelected ? "bg-primary/10 border-primary/15" : "bg-muted/10 border-border/20")}>
                              <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[10px] font-bold", isSelected ? "text-primary" : "text-muted-foreground")}>{pixKeyTypeLabels[pk.key_type]}</p>
                              <p className="font-mono text-[12px] font-semibold truncate text-foreground">{pk.key_value}</p>
                            </div>
                            <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border/40")}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2.5 p-3 rounded-xl border border-destructive/15 bg-destructive/5">
                      <p className="text-[11px] text-destructive font-bold flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários</p>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={pixKeys.length === 0} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <ArrowDownToLine className="h-4 w-4" /> Solicitar Saque
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ════════ PERIOD SELECTOR ════════ */}
      <div className="flex gap-1 bg-muted/30 border border-border/40 rounded-xl p-1 w-fit">
        {PERIODS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setSelectedPeriod(opt)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
              selectedPeriod.label === opt.label
                ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ════════ HERO VALUE + KPIs ════════ */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Sacado</p>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-foreground leading-none">
            {hidden ? "R$ •••••" : fmt(m.totalApproved)}
          </span>
          {!hidden && m.prevTotalApproved > 0 && (
            <DeltaBadge cur={m.totalApproved} prev={m.prevTotalApproved} />
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Aprovados", value: m.approved.length, sub: hidden ? HIDE : fmtCompact(m.totalApproved), icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Pendentes", value: m.pending.length, sub: hidden ? HIDE : fmtCompact(m.totalPending), icon: Clock, color: "text-amber-600 dark:text-amber-400" },
            { label: "Ticket Médio", value: null, sub: hidden ? HIDE : fmt(m.avgAmount), icon: Receipt, color: "text-primary" },
            { label: "Taxa Aprovação", value: null, sub: hidden ? HIDE : `${m.approvalRate.toFixed(1)}%`, icon: Target, color: m.approvalRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/30 bg-muted/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              </div>
              {item.value !== null && (
                <p className={cn("text-2xl font-black tabular-nums", item.color)}>{item.value}</p>
              )}
              <p className={cn("text-sm font-bold tabular-nums", item.value !== null ? "text-muted-foreground mt-0.5" : `${item.color} text-xl`)}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════ CHART ════════ */}
      {m.chartData.length >= 2 && !hidden && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Evolução de Saques</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="saques-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <ReTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, padding: "10px 14px" }}
                formatter={(v: number) => [fmt(v), "Aprovado"]}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saques-grad)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ════════ TRANSACTIONS ════════ */}
      <div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold">Histórico de Saques</h2>
          </div>
          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou valor…"
              className="h-9 w-full rounded-xl border border-border/40 bg-card/60 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                )}
              >
                {tab.label}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md min-w-[20px] text-center tabular-nums", isActive ? "bg-primary/10" : "bg-muted/20")}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  {["ID", "Valor Bruto", "Taxa", "Valor Líquido", "Status", "Data"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground font-semibold">Nenhum saque encontrado</p>
                      <p className="text-[10px] text-muted-foreground/60">Solicite seu primeiro saque</p>
                    </div>
                  </td></tr>
                ) : filtered.map((w) => {
                  const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={w.id} className="border-b border-border/20 hover:bg-muted/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">{w.id.slice(0, 8)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-black text-foreground tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-xs tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-primary text-sm tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border", st.fg, st.bg, st.border)}>
                          {w.status === "pending" && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute h-full w-full rounded-full bg-amber-500 opacity-60" />
                              <span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" />
                            </span>
                          )}
                          {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                          <span className="text-[9px] text-muted-foreground/60 tabular-nums">{new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
              <p className="text-[10px] font-bold text-muted-foreground">{filtered.length} saque{filtered.length !== 1 ? "s" : ""}</p>
              <p className="text-[10px] font-bold text-primary tabular-nums">{hidden ? HIDE : fmt(filtered.reduce((a, w) => a + Number(w.net_amount), 0))} líquido total</p>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Wallet className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground font-semibold">Nenhum saque</p>
            </div>
          ) : filtered.map((w) => {
            const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
            return (
              <div key={w.id} className="rounded-xl border border-border/30 bg-card/60 p-4 hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-lg font-black text-foreground tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</p>
                    <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{w.id.slice(0, 12)}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border", st.fg, st.bg, st.border)}>
                    {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-amber-500 opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" /></span>}
                    {st.label}
                  </span>
                </div>
                <div className="flex items-end justify-between pt-2.5 border-t border-border/20">
                  <div className="flex items-center gap-5">
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Taxa</p>
                      <p className="text-amber-600 dark:text-amber-400 font-bold text-[11px] mt-0.5 tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-bold">Líquido</p>
                      <p className="text-primary font-black text-[13px] mt-0.5 tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[10px] tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security footer */}
      <div className="rounded-xl border border-border/30 bg-card/60 p-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Saques processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
        </p>
      </div>

      {/* Approved Popup */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl border border-primary/20 bg-card shadow-2xl overflow-hidden">
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
              <div className="p-8 text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center"><PartyPopper className="h-8 w-8 text-primary" /></div>
                <h2 className="text-xl font-black text-foreground mb-2">Saque Aprovado!</h2>
                <p className="text-muted-foreground text-sm mb-6">Seu saque de <span className="text-primary font-black">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!</p>
                <button onClick={() => setApprovedPopup(null)} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                  <Rocket className="h-4 w-4" /> Entendido!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Delta Badge ─── */
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">novo</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/15" : "text-destructive bg-destructive/10 border-destructive/15")}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

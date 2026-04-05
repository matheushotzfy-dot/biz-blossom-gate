import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, TrendingUp, Shield, Zap,
  ChevronDown, Hash, Eye, EyeOff, Search, Download, CalendarDays,
  ArrowUpRight, ArrowDownRight, Sparkles, Banknote, Percent,
  Activity, MoreHorizontal, Layers, Target, Crown, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─────────────────────── Helpers ─────────────────────── */
const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};
type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };
const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return fmt(v);
};
const HIDE = "•••";

const PERIODS = [
  { label: "7D", days: 7 },
  { label: "15D", days: 15 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "Tudo", days: 9999 },
] as const;

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
  approved: { label: "Aprovado", fg: "text-success", dot: "bg-success", bg: "bg-success/8", border: "border-success/15" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/8", border: "border-warning/15" },
  rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8", border: "border-destructive/15" },
};

/* ─── Animated Number ─── */
function AnimatedNumber({ value, formatter = fmt, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{formatter(display)}</>;
}

/* ─── Micro Components ─── */
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-[9px] font-display font-bold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10"><Sparkles className="h-2.5 w-2.5" />novo</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("inline-flex items-center gap-0.5 text-[9px] font-display font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}
    >
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </motion.span>
  );
}

function Sparkline({ data, color = "primary" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80; const h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const id = `spark-w-${color}-${data.length}`;
  return (
    <svg width={w} height={h} className="shrink-0 opacity-60" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.3} />
          <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlowCard({ children, className, glowColor = "primary", delay = 0, animated = false }: { children: React.ReactNode; className?: string; glowColor?: string; delay?: number; animated?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("relative group rounded-2xl glass-panel overflow-hidden card-premium", animated && "animated-border", className)}
    >
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
      <div className={cn("absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000 blur-[40px] pointer-events-none", `bg-${glowColor}/6`)} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <div className={cn("absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700", `bg-gradient-to-r from-transparent via-${glowColor}/20 to-transparent`)} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function KpiTile({ label, value, icon: Icon, delta, sparkData, hidden, color = "primary", delay = 0, formatter = fmt }: {
  label: string; value: number; icon: any; delta?: { cur: number; prev: number }; sparkData?: number[]; hidden: boolean; color?: string; delay?: number; formatter?: (v: number) => string;
}) {
  return (
    <GlowCard glowColor={color} delay={delay} animated className="p-5 shimmer card-premium">
      <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg", `bg-${color}/10 border-${color}/12 text-${color} group-hover:bg-${color}/15`)}>
          <Icon className="h-5 w-5" />
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
      </div>
      <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">
          {hidden ? HIDE : <AnimatedNumber value={value} formatter={formatter} />}
        </span>
        {delta && !hidden && <DeltaBadge cur={delta.cur} prev={delta.prev} />}
      </div>
    </GlowCard>
  );
}

/* ─── Withdrawal Chart ─── */
function WithdrawalChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) {
    return (
      <div className="h-[240px] flex flex-col items-center justify-center gap-3">
        {hidden ? <EyeOff className="h-8 w-8 text-muted-foreground/6" /> : <Activity className="h-8 w-8 text-muted-foreground/6" />}
        <span className="text-[11px] text-muted-foreground/15 font-display">{hidden ? "Valores ocultos" : "Dados insuficientes"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="w-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="w-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.04} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border)/0.15)", borderRadius: 16, fontSize: 11, padding: "14px 18px", boxShadow: "0 16px 48px rgba(0,0,0,0.2)", fontFamily: "'Plus Jakarta Sans', sans-serif", backdropFilter: "blur(12px)" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 3" fill="none" opacity={0.1} dot={false} />
        <Area type="monotone" dataKey="value" stroke="url(#w-stroke)" strokeWidth={2.5} fill="url(#w-gradient)" dot={false} activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

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
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[2]);

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
    const cutoff = selectedPeriod.days === 9999 ? new Date(0) : subDays(now, selectedPeriod.days);
    const prevCutoff = selectedPeriod.days === 9999 ? new Date(0) : subDays(cutoff, selectedPeriod.days);

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
    const prevTotalRequested = previous.reduce((a, w) => a + Number(w.amount), 0);
    const avgAmount = approved.length > 0 ? totalApproved / approved.length : 0;
    const prevAvg = prevApproved.length > 0 ? prevTotalApproved / prevApproved.length : 0;
    const approvalRate = current.length > 0 ? (approved.length / current.length) * 100 : 0;

    // Daily chart data
    const days = Math.min(selectedPeriod.days === 9999 ? 30 : selectedPeriod.days, 30);
    const dailyMap = new Map<string, number>();
    const prevDailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = format(subDays(now, days - 1 - i), "dd/MM");
      dailyMap.set(d, 0);
      prevDailyMap.set(d, 0);
    }
    approved.forEach(w => {
      const d = format(new Date(w.created_at), "dd/MM");
      if (dailyMap.has(d)) dailyMap.set(d, (dailyMap.get(d) || 0) + Number(w.net_amount));
    });
    prevApproved.forEach(w => {
      const dOrig = new Date(w.created_at);
      const shifted = new Date(dOrig.getTime() + selectedPeriod.days * 86400000);
      const d = format(shifted, "dd/MM");
      if (prevDailyMap.has(d)) prevDailyMap.set(d, (prevDailyMap.get(d) || 0) + Number(w.net_amount));
    });
    const chartData = Array.from(dailyMap.entries()).map(([label, value]) => ({
      label, value, previous: prevDailyMap.get(label) || 0,
    }));

    // Sparklines
    const dailyApprovedArr = Array.from(dailyMap.values());
    const dailyCountArr: number[] = [];
    for (let i = 0; i < days; i++) {
      const d = format(subDays(now, days - 1 - i), "yyyy-MM-dd");
      dailyCountArr.push(approved.filter(w => w.created_at.startsWith(d)).length);
    }

    return {
      current, previous, approved, pending, rejected,
      totalApproved, totalRequested, totalFees, totalPending,
      prevTotalApproved, prevTotalRequested, avgAmount, prevAvg, approvalRate,
      chartData, dailyApprovedArr, dailyCountArr,
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
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO — WITHDRAWAL COMMAND CENTER                                */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-14 rounded-3xl p-6 sm:p-8 lg:p-10 mesh-gradient-hero noise-overlay scan-line"
      >
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-info/6 rounded-full blur-[160px]" />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
          <motion.div animate={{ opacity: [0.4, 0.65, 0.4] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-20 left-[10%] right-[10%] h-[200px] bg-primary/6 rounded-full blur-[120px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          {/* Top controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-14">
            <div className="flex items-center gap-3">
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="inline-flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
                  <Wallet className="h-4.5 w-4.5 text-primary" />
                </div>
                <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80 block leading-tight">Saques PIX</span>
              </motion.div>
              {m.pending.length > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-warning/15 bg-warning/5 px-3 py-1.5 shadow-[0_0_16px_rgba(234,179,8,0.12)] backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-full w-full rounded-full bg-warning pulse-ring" />
                    <span className="absolute h-full w-full animate-ping rounded-full bg-warning opacity-30" />
                    <span className="relative h-2 w-2 rounded-full bg-warning shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                  </span>
                  <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-warning">{m.pending.length} Pendente{m.pending.length > 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center rounded-full glass-panel p-0.5">
                {PERIODS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedPeriod(opt)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[10px] font-heading transition-all duration-400 active:scale-[0.97]",
                      selectedPeriod.label === opt.label
                        ? "bg-primary text-primary-foreground shadow-[0_2px_16px_rgba(16,185,129,0.3)] glow-primary"
                        : "text-muted-foreground/35 hover:text-foreground/70"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="w-px h-5 bg-border/8 mx-1 hidden sm:block" />
              <button onClick={toggleHidden} className={cn("h-8 w-8 rounded-full transition-all active:scale-[0.97] border border-transparent hover:border-border/10", hidden ? "text-primary bg-primary/8 glow-primary" : "text-muted-foreground/25 hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
                {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
              </button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button className={cn(
                    "h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5",
                    "gradient-primary text-primary-foreground shadow-lg shadow-primary/20",
                    "hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300"
                  )}>
                    <Plus className="h-3.5 w-3.5" /> Novo Saque
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                  <div className="px-6 pt-6 pb-4 border-b border-border/15">
                    <DialogHeader>
                      <DialogTitle className="font-display font-black text-lg tracking-[-0.03em] flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                          <ArrowDownToLine className="h-4 w-4 text-primary" />
                        </div>
                        Solicitar Saque
                      </DialogTitle>
                    </DialogHeader>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                      <div className="pl-1.5">
                        <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Valor do saque (R$)</Label>
                        <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-2 h-14 text-xl font-display font-black rounded-xl bg-muted/5 border-border/15 focus:ring-2 focus:ring-primary/10" />
                        <div className="flex items-center justify-between mt-2.5">
                          <p className="text-[10px] font-display font-semibold text-muted-foreground/30">Taxa fixa de saque</p>
                          <p className="text-[11px] font-display font-bold text-warning tabular-nums">- R$ 5,00</p>
                        </div>
                        {amount && parseFloat(amount) > 5 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center"><Zap className="h-3 w-3 text-primary" /></div>
                                <span className="text-[11px] text-muted-foreground/50 font-display font-semibold">Você receberá</span>
                              </div>
                              <span className="text-lg font-display font-black text-primary tabular-nums">{fmt(parseFloat(amount) - 5)}</span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                      <div className="pl-1.5">
                        <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Chave PIX</Label>
                        {pixKeys.length > 0 ? (
                          <div className="mt-2.5 space-y-1.5">
                            {pixKeys.map((pk) => {
                              const isSelected = (selectedPixKeyId || pixKeys[0]?.id) === pk.id;
                              return (
                                <button key={pk.id} type="button" onClick={() => setSelectedPixKeyId(pk.id)} className={cn(
                                  "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-300 text-left",
                                  isSelected ? "border-primary/20 bg-primary/5 ring-1 ring-primary/10" : "border-border/15 bg-muted/5 hover:border-border/30"
                                )}>
                                  <div className={cn("h-8 w-8 rounded-lg ring-1 flex items-center justify-center shrink-0", isSelected ? "bg-primary/10 ring-primary/15" : "bg-muted/10 ring-border/15")}>
                                    <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground/30")} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("text-[10px] font-display font-bold", isSelected ? "text-primary" : "text-muted-foreground/40")}>{pixKeyTypeLabels[pk.key_type]}</p>
                                    <p className={cn("font-mono text-[12px] font-bold truncate", isSelected ? "text-foreground" : "text-foreground/50")}>{pk.key_value}</p>
                                  </div>
                                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border/30")}>
                                    {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-2.5 p-3.5 rounded-xl border border-destructive/10 bg-destructive/5">
                            <p className="text-[11px] text-destructive font-display font-bold flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="submit" disabled={pixKeys.length === 0} className={cn(
                      "w-full h-11 rounded-xl text-[12px] font-display font-bold flex items-center justify-center gap-2",
                      "gradient-primary text-primary-foreground shadow-lg shadow-primary/20",
                      "hover:shadow-xl active:scale-[0.985] transition-all duration-300",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    )}>
                      <ArrowDownToLine className="h-4 w-4" /> Solicitar Saque
                    </button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* MAIN FOCAL — Total Approved */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-primary/40 to-transparent" />
              <p className="text-[10px] font-heading uppercase tracking-[0.3em] text-gradient-premium">Total Sacado no Período</p>
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-l from-primary/40 to-transparent" />
            </div>
            <div className="flex items-end gap-5 mb-3">
              <motion.span className="text-5xl sm:text-7xl lg:text-[100px] font-heading tabular-nums text-foreground leading-[0.82] glow-value [text-shadow:0_0_120px_hsl(var(--primary)/0.3),0_0_60px_hsl(var(--primary)/0.1),0_4px_24px_hsl(var(--background)/0.5)]" initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
                {hidden ? "R$ •••••••" : <AnimatedNumber value={m.totalApproved} />}
              </motion.span>
              {!hidden && <DeltaBadge cur={m.totalApproved} prev={m.prevTotalApproved} />}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 mt-6">
              {[
                { icon: CalendarDays, text: selectedPeriod.label },
                { icon: CheckCircle2, text: `${m.approved.length} aprovados`, iconColor: "text-success" },
                { icon: Banknote, text: `solicitado ${hidden ? HIDE : fmtCompact(m.totalRequested)}` },
              ].map((chip, i) => (
                <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                  <chip.icon className={cn("h-3 w-3", chip.iconColor)} /> {chip.text}
                </motion.span>
              ))}
              {m.pending.length > 0 && (
                <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="inline-flex items-center gap-2 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-warning opacity-40" /><span className="relative h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_6px_hsl(var(--warning))]" /></span>
                  {m.pending.length} pendente{m.pending.length > 1 ? "s" : ""} · {hidden ? HIDE : fmtCompact(m.totalPending)}
                </motion.span>
              )}
            </div>
          </motion.div>

          {/* Executive Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: "Taxa de Aprovação", value: hidden ? HIDE : `${m.approvalRate.toFixed(1)}%`, color: m.approvalRate >= 80 ? "success" : m.approvalRate >= 50 ? "warning" : "destructive", icon: Target },
              { label: "Ticket Médio", value: hidden ? HIDE : fmt(m.avgAmount), sub: !hidden && <DeltaBadge cur={m.avgAmount} prev={m.prevAvg} />, color: "primary", icon: Receipt },
              { label: "Total em Taxas", value: hidden ? HIDE : fmtCompact(m.totalFees), color: "warning", icon: Percent },
              { label: "Pendentes", value: hidden ? HIDE : String(m.pending.length), sub: hidden ? "" : fmtCompact(m.totalPending), color: m.pending.length > 0 ? "warning" : "success", icon: Clock },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }} className="group relative rounded-2xl glass-panel animated-border p-5 overflow-hidden card-premium">
                <div className={cn("absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[50px] pointer-events-none", `bg-${item.color}/10`)} />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground/30 mb-2.5">{item.label}</p>
                    <p className={cn("text-2xl font-heading tabular-nums tracking-tight leading-none", item.color === "primary" ? "text-foreground" : `text-${item.color}`)}>{item.value}</p>
                    {item.sub && <div className="mt-2 text-[10px] text-muted-foreground/25 font-mono">{item.sub}</div>}
                  </div>
                  <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* KPI GRID                                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Total Aprovado" value={m.totalApproved} icon={TrendingUp} delta={{ cur: m.totalApproved, prev: m.prevTotalApproved }} sparkData={m.dailyApprovedArr} hidden={hidden} color="primary" delay={0} />
        <KpiTile label="Saques Aprovados" value={m.approved.length} icon={CheckCircle2} delta={{ cur: m.approved.length, prev: metrics.previous.filter(w => w.status === "approved").length }} sparkData={m.dailyCountArr} hidden={hidden} color="success" delay={0.05} formatter={(v) => Math.round(v).toString()} />
        <KpiTile label="Total Solicitado" value={m.totalRequested} icon={Banknote} delta={{ cur: m.totalRequested, prev: m.prevTotalRequested }} hidden={hidden} color="info" delay={0.1} />
        <KpiTile label="Total em Taxas" value={m.totalFees} icon={Percent} hidden={hidden} color="destructive" delay={0.15} />
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* WITHDRAWAL TIMELINE                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/12 flex items-center justify-center">
              <Activity className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-heading text-foreground/80 uppercase tracking-[0.12em]">Evolução de Saques</h2>
              <p className="text-[9px] text-muted-foreground/25 font-display mt-0.5">Comparativo com período anterior</p>
            </div>
          </div>
          <div className="flex gap-5 text-[11px] font-display tabular-nums">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]" /> Aprovado <span className="font-bold text-primary">{hidden ? HIDE : fmtCompact(m.totalApproved)}</span></span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/15 border border-dashed border-muted-foreground/25" /> Anterior</span>
          </div>
        </div>
        <div className="rounded-2xl glass-panel animated-border p-6 relative overflow-hidden scan-line">
          <div className="absolute -top-40 right-0 w-72 h-72 bg-primary/3 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 left-10 w-48 h-48 bg-info/3 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <WithdrawalChart data={m.chartData} hidden={hidden} />
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TRANSACTIONS TABLE                                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-card/50 border border-border/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <h2 className="text-sm font-heading text-foreground/80 uppercase tracking-[0.1em]">Histórico de Saques</h2>
          </div>
          <div className="relative w-full xl:w-80">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou valor…"
              className="h-10 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-12 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-muted-foreground/15 font-mono border border-border/10 rounded-md px-1.5 py-0.5">⌘K</kbd>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-none mb-1">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            const dotColors: Record<string, string> = { all: "bg-primary", approved: "bg-success", pending: "bg-warning", rejected: "bg-destructive" };
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "relative shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-heading transition-all duration-300 active:scale-[0.97]",
                  isActive
                    ? "glass-panel ring-1 ring-primary/15 text-foreground shadow-sm"
                    : "text-muted-foreground/25 hover:text-muted-foreground/50 hover:bg-card/20"
                )}
              >
                {isActive && (
                  <motion.span layoutId="saque-tab-indicator" className={cn("h-1.5 w-1.5 rounded-full", dotColors[tab.value])} transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                )}
                {tab.label}
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-heading min-w-[20px] text-center tabular-nums", isActive ? "bg-foreground/5 text-foreground/60" : "bg-muted/10 text-muted-foreground/20")}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-2xl glass-panel animated-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/[0.06]">
                  {["ID", "Valor Bruto", "Taxa", "Valor Líquido", "Status", "Data"].map(h => (
                    <th key={h} className="text-left py-3.5 px-4 text-[10px] font-display font-bold text-muted-foreground/25 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center"><Wallet className="h-7 w-7 text-muted-foreground/8" /></div>
                      <p className="text-[12px] text-muted-foreground/20 font-display font-semibold">Nenhum saque encontrado</p>
                      <p className="text-[10px] text-muted-foreground/12 font-display">Solicite seu primeiro saque</p>
                    </div>
                  </td></tr>
                ) : filtered.map((w, i) => {
                  const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                  return (
                    <motion.tr
                      key={w.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      className="group border-b border-border/[0.04] row-glow transition-all duration-200"
                    >
                      <td className="py-4 px-4">
                        <span className="font-mono text-[10px] text-muted-foreground/25 bg-muted/8 px-2 py-0.5 rounded-md">{w.id.slice(0, 8)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[14px] font-display font-black text-foreground tabular-nums tracking-[-0.02em]">{hidden ? HIDE : fmt(Number(w.amount))}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-display font-bold text-warning/70 text-[12px] tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-display font-black text-primary text-[14px] tabular-nums tracking-[-0.02em]">{hidden ? HIDE : fmt(Number(w.net_amount))}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-display font-bold tracking-wide border", st.fg, st.bg, st.border)}>
                          {w.status === "pending" && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                            </span>
                          )}
                          {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {st.label}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-muted-foreground/35 tabular-nums font-mono">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                          <span className="text-[9px] text-muted-foreground/20 tabular-nums font-mono">{new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Summary */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/[0.06]">
            <p className="text-[10px] font-display font-bold text-muted-foreground/20">{filtered.length} saque{filtered.length !== 1 ? "s" : ""}</p>
            {filtered.length > 0 && (
              <p className="text-[10px] font-display font-bold text-primary/50 tabular-nums">{hidden ? HIDE : fmt(filtered.reduce((a, w) => a + Number(w.net_amount), 0))} líquido total</p>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center"><Wallet className="h-7 w-7 text-muted-foreground/8" /></div>
              <p className="text-[12px] text-muted-foreground/20 font-display font-semibold">Nenhum saque</p>
            </div>
          ) : filtered.map((w, i) => {
            const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.15), ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl bg-card/50 backdrop-blur-lg border border-border/10 p-4 active:scale-[0.985] transition-all hover:border-primary/15 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xl font-display font-black text-foreground tabular-nums tracking-tight leading-none">{hidden ? HIDE : fmt(Number(w.amount))}</p>
                    <p className="text-[9px] text-muted-foreground/20 font-mono mt-1">{w.id.slice(0, 12)}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-display font-bold shrink-0 border", st.fg, st.bg, st.border)}>
                    {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                    {st.label}
                  </span>
                </div>
                <div className="flex items-end justify-between pt-3 border-t border-border/6">
                  <div className="flex items-center gap-5">
                    <div>
                      <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Taxa</p>
                      <p className="text-warning/60 font-display font-bold text-[11px] mt-0.5 tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Líquido</p>
                      <p className="text-primary font-display font-black text-[13px] mt-0.5 tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground/20 text-[10px] font-display tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Security Footer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10">
        <GlowCard glowColor="success" delay={0.4} className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-success/8 ring-1 ring-success/10 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-success/60" />
            </div>
            <p className="text-[10px] text-muted-foreground/30 font-display font-semibold">
              Saques são processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
            </p>
          </div>
        </GlowCard>
      </motion.div>

      {/* Approved Popup */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-sm rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors z-10"><X className="h-4 w-4 text-muted-foreground/40" /></button>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center"><PartyPopper className="h-9 w-9 text-primary" /></div>
                <h2 className="text-2xl font-display font-black text-foreground mb-2 tracking-[-0.03em]">Saque Aprovado!</h2>
                <p className="text-muted-foreground/50 text-[13px] font-display mb-6">Seu saque de <span className="text-primary font-display font-black">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!</p>
                <button onClick={() => setApprovedPopup(null)} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-[12px] shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-300">
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

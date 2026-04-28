import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, Shield,
  Eye, EyeOff, Search, MapPin, AlertTriangle, Copy,
  TrendingUp, Clock3, DollarSign, Percent, Clock, Receipt,
  type LucideIcon,
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
import { ptBR } from "date-fns/locale";

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
const WITHDRAW_FEE = 5;

const PERIODS: { label: string; days: number }[] = [
  { label: "Hoje", days: 0 },
  { label: "7D", days: 7 },
  { label: "15D", days: 15 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "Tudo", days: 9999 },
];

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string; ring: string }> = {
  approved: { label: "Aprovado", fg: "text-success", dot: "bg-success", bg: "bg-success/10", border: "border-success/20", ring: "ring-success/20" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10", border: "border-warning/20", ring: "ring-warning/20" },
  rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/20", ring: "ring-destructive/20" },
};

function maskPix(value: string, type: string) {
  if (!value) return "—";
  if (type === "email") {
    const [u, d] = value.split("@");
    if (!u || !d) return value;
    return `${u.slice(0, 2)}•••@${d}`;
  }
  if (type === "cpf" || type === "cnpj" || type === "telefone") {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 4) return value;
    return `${digits.slice(0, 3)}•••${digits.slice(-2)}`;
  }
  return value.length > 12 ? `${value.slice(0, 6)}•••${value.slice(-4)}` : value;
}

type KpiTone = "success" | "info" | "warning" | "neutral" | "destructive";
function Kpi({ label, value, sub, icon: Icon, tone = "neutral" }: {
  label: string; value: string; sub?: string; icon: LucideIcon; tone?: KpiTone;
}) {
  const toneCls: Record<KpiTone, string> = {
    success: "text-success", info: "text-info", warning: "text-warning",
    neutral: "text-foreground", destructive: "text-destructive",
  };
  const iconBg: Record<KpiTone, string> = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    neutral: "bg-secondary text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="bg-card px-5 py-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</span>
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", iconBg[tone])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
      </div>
      <div className={cn("font-display text-[24px] font-black leading-none tabular-nums tracking-tight", toneCls[tone])}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/70 font-medium truncate">{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE */
/* ═══════════════════════════════════════════════════════════════════════ */
export default function Saques() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
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
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[3]);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);

  const hasAddress = !!(profile as any)?.zip_code && !!(profile as any)?.street && !!(profile as any)?.street_number && !!(profile as any)?.city;
  const primaryPixKey = pixKeys[0];

  useEffect(() => {
    if (!user?.id) return;
    const fetchBalance = async () => {
      const { data, error } = await supabase.rpc("get_ledger_balance", { _user_id: user.id });
      if (!error && data !== null) setAvailableBalance(Number(data));
      // Retained
      const { data: tx } = await supabase
        .from("transactions")
        .select("retained_amount, retention_released, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .eq("retention_released", false);
      if (tx) {
        setRetainedAmount(tx.reduce((acc: number, t: any) => acc + Number(t.retained_amount || 0), 0));
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

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
    if (numAmount <= WITHDRAW_FEE) { toast.error(`Valor mínimo deve ser maior que a taxa de ${fmt(WITHDRAW_FEE)}`); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }
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
    const approvalRate = current.length > 0 ? (approved.length / current.length) * 100 : 0;

    // Avg approval time (hours) for approved+processed_at
    const approvedWithTime = approved.filter((w: any) => w.processed_at);
    const avgApprovalHours = approvedWithTime.length > 0
      ? approvedWithTime.reduce((acc: number, w: any) => {
          const diff = (new Date(w.processed_at).getTime() - new Date(w.created_at).getTime()) / 3_600_000;
          return acc + diff;
        }, 0) / approvedWithTime.length
      : 0;

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
      prevTotalApproved, avgAmount, approvalRate, chartData, avgApprovalHours,
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
    { label: "Todos", value: "all" as StatusFilter, count: metrics.current.length, color: "primary" },
    { label: "Aprovados", value: "approved" as StatusFilter, count: metrics.approved.length, color: "success" },
    { label: "Pendentes", value: "pending" as StatusFilter, count: metrics.pending.length, color: "warning" },
    { label: "Recusados", value: "rejected" as StatusFilter, count: metrics.rejected.length, color: "destructive" },
  ], [metrics]);

  const m = metrics;
  const numAmount = parseFloat(amount) || 0;
  const netPreview = numAmount > WITHDRAW_FEE ? numAmount - WITHDRAW_FEE : 0;
  const quickAmounts = [
    Math.min(availableBalance * 0.25, availableBalance),
    Math.min(availableBalance * 0.5, availableBalance),
    Math.min(availableBalance * 0.75, availableBalance),
    availableBalance,
  ].filter(v => v > WITHDRAW_FEE);

  /* ═══════════ RENDER ═══════════ */
  /* KPI rails for the Vendas-style strip */
  const kpiRails = [
    { label: "Saldo disponível", value: hidden ? HIDE : fmtCompact(availableBalance), sub: `Retido ${hidden ? HIDE : fmtCompact(retainedAmount)}`, accent: availableBalance > 0 ? "text-success" : "text-foreground", rail: "bg-success" },
    { label: "Total sacado", value: hidden ? HIDE : fmtCompact(m.totalApproved), sub: `${m.approved.length} ${m.approved.length === 1 ? "saque aprovado" : "saques aprovados"}`, accent: "text-foreground", rail: "bg-info" },
    { label: "Taxa de aprovação", value: hidden ? HIDE : `${m.approvalRate.toFixed(1)}%`, sub: `${m.approved.length}/${m.current.length} solicitações`, accent: m.approvalRate >= 80 ? "text-success" : "text-warning", rail: m.approvalRate >= 80 ? "bg-success" : "bg-warning" },
    { label: "Pendentes", value: hidden ? HIDE : String(m.pending.length), sub: m.pending.length > 0 ? `${fmtCompact(m.totalPending)} aguardando` : "Sem fila", accent: m.pending.length > 0 ? "text-warning" : "text-foreground", rail: m.pending.length > 0 ? "bg-warning" : "bg-foreground/40" },
  ];
  const riskRails = [
    { label: "Ticket médio", value: hidden ? HIDE : fmtCompact(m.avgAmount), count: m.approved.length, sub: m.avgAmount > 0 ? "Por saque aprovado" : "Sem dados", accent: "text-foreground" },
    { label: "Total em taxas", value: hidden ? HIDE : fmtCompact(m.totalFees), count: m.current.length, sub: `${fmt(WITHDRAW_FEE)}/op`, accent: "text-warning" },
    { label: "Aprovação média", value: m.avgApprovalHours > 0 ? `${m.avgApprovalHours.toFixed(1)}h` : "—", count: m.approved.length, sub: "tempo até liberação", accent: "text-foreground" },
  ];

  return (
    <div
      className="mx-auto w-full max-w-[1480px] pb-24 md:pb-10 antialiased [text-rendering:geometricPrecision] [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]"
      style={{ fontFeatureSettings: '"ss01","cv11","tnum","kern"' }}
    >

      <div className="px-5 pt-4 sm:px-8 sm:pt-6">

        {/* Address warning — flat Vendas-like alert */}
        {!hasAddress && (
          <div
            onClick={() => navigate("/perfil")}
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/10 cursor-pointer hover:bg-warning/15 transition-colors"
          >
            <div className="h-8 w-8 rounded-md bg-warning/15 border border-warning/25 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-warning" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-display font-black text-warning tracking-[-0.01em]">Endereço não cadastrado</p>
              <p className="text-[10.5px] text-warning/80 font-medium">Preencha seu endereço no Perfil para realizar saques normalmente.</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-warning/70 shrink-0" />
          </div>
        )}

        {/* ─────────── COMANDO LIMPO (Vendas pattern) ─────────── */}
        <header className="border-b border-border/70 pb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[44px] font-black leading-[0.88] tracking-[-0.06em] text-foreground sm:text-[64px]">
                Saques
              </h1>
              <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
                <p
                  className={cn(
                    "font-display text-[54px] font-black leading-[0.84] tracking-[-0.075em] tabular-nums sm:text-[78px]",
                    hidden ? "text-foreground" : (availableBalance > 0 ? "text-success" : "text-foreground"),
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {hidden ? HIDE : fmt(availableBalance)}
                </p>
                <div className="pb-1.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.005em] text-foreground">
                    <span className="inline-block h-2 w-[3px] rounded-full bg-success" />
                    Saldo disponível para saque
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium text-muted-foreground/85">
                    <span className="font-bold text-foreground">{m.pending.length > 0 ? `${m.pending.length} ${m.pending.length === 1 ? "saque pendente" : "saques pendentes"}` : "Sem fila"}</span>
                    <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                    Retido <span className="font-bold text-foreground tabular-nums">{hidden ? HIDE : fmt(retainedAmount)}</span>
                    <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                    Atualização automática a cada 15s
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-1 xl:w-auto xl:justify-end">
              {/* Period segment-control — Vendas style */}
              <div className="hidden items-center rounded-lg border border-border/60 bg-card p-[3px] md:inline-flex">
                {PERIODS.map((opt) => {
                  const active = selectedPeriod.label === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setSelectedPeriod(opt)}
                      className={cn(
                        "relative rounded-[6px] px-2.5 py-[5px] text-[11px] font-bold tracking-[-0.005em] transition-all duration-200",
                        active
                          ? "bg-success/15 text-success ring-1 ring-success/30"
                          : "text-muted-foreground/90 hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <span className="hidden h-5 w-px bg-border/60 md:mx-1 md:block" />

              {/* Privacy toggle — Vendas circular button */}
              <button
                onClick={toggleHidden}
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                  hidden
                    ? "border-foreground/80 bg-secondary text-foreground"
                    : "border-border/60 bg-card/70 text-muted-foreground/90 hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {hidden ? <EyeOff className="h-[15px] w-[15px]" strokeWidth={2.1} /> : <Eye className="h-[15px] w-[15px]" strokeWidth={2.1} />}
              </button>

              <span className="hidden h-5 w-px bg-border/60 md:mx-1 md:block" />

              {/* CTA — flat success/primary */}
              {!hasAddress ? (
                <button
                  onClick={() => { toast.info("Preencha seu endereço primeiro para realizar saques"); navigate("/perfil"); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-warning px-3.5 text-[11px] font-black tracking-[-0.005em] text-warning-foreground ring-1 ring-warning/40 transition-all duration-200 hover:bg-warning/90 hover:ring-warning/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning/50"
                >
                  <MapPin className="h-[14px] w-[14px]" strokeWidth={2.6} />
                  Preencher endereço
                </button>
              ) : (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-success px-3.5 text-[11px] font-black tracking-[-0.005em] text-success-foreground ring-1 ring-success/40 transition-all duration-200 hover:bg-success/90 hover:ring-success/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-success/50">
                      <Plus className="h-[14px] w-[14px]" strokeWidth={2.6} />
                      Novo saque
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-2xl border border-border/50 bg-card p-0 overflow-hidden">
                    <div className="px-6 pt-6 pb-4 border-b border-border/40">
                      <DialogHeader>
                        <DialogTitle className="font-display font-black text-lg tracking-[-0.03em] flex items-center gap-2.5">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <ArrowDownToLine className="h-4 w-4 text-primary" />
                          </div>
                          Solicitar Saque
                        </DialogTitle>
                      </DialogHeader>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 p-6">
                      {/* Saldo header */}
                      <div className="rounded-xl bg-secondary/40 border border-border/50 px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Saldo disponível</span>
                        <span className="text-[15px] font-display font-black text-success tabular-nums">{fmt(availableBalance)}</span>
                      </div>

                      {/* Amount */}
                      <div className="rounded-xl bg-card border border-border/50 p-4">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Valor do saque</Label>
                        <div className="relative mt-2">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-display font-black text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0,00"
                            required
                            className="h-12 pl-10 text-lg font-display font-black tabular-nums"
                          />
                        </div>
                        {/* Quick amounts */}
                        {quickAmounts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {[
                              { label: "25%", value: quickAmounts[0] },
                              { label: "50%", value: quickAmounts[1] },
                              { label: "75%", value: quickAmounts[2] },
                              { label: "Máx", value: quickAmounts[3] },
                            ].filter(q => q.value).map(q => (
                              <button
                                key={q.label}
                                type="button"
                                onClick={() => setAmount(q.value!.toFixed(2))}
                                className="px-2.5 h-7 rounded-md text-[10px] font-bold bg-secondary/40 hover:bg-secondary text-foreground/80 hover:text-foreground border border-border/50 transition-colors"
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Breakdown */}
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Valor solicitado</span>
                            <span className="font-display font-bold tabular-nums text-foreground">{fmt(numAmount)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Taxa fixa PIX</span>
                            <span className="font-display font-bold tabular-nums text-warning">- {fmt(WITHDRAW_FEE)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                            <span className="text-[11px] font-bold text-foreground/80">Você receberá</span>
                            <span className="text-base font-display font-black tabular-nums text-success">{fmt(netPreview)}</span>
                          </div>
                        </div>
                      </div>

                      {/* PIX Key */}
                      <div className="rounded-xl bg-card border border-border/50 p-4">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.16em]">Chave PIX de destino</Label>
                        {pixKeys.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {pixKeys.map((pk) => {
                              const isSelected = (selectedPixKeyId || pixKeys[0]?.id) === pk.id;
                              return (
                                <button key={pk.id} type="button" onClick={() => setSelectedPixKeyId(pk.id)} className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left",
                                  isSelected ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/30 hover:border-border"
                                )}>
                                  <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0", isSelected ? "bg-primary/10 border-primary/30" : "bg-secondary border-border/50")}>
                                    <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-wider", isSelected ? "text-primary" : "text-muted-foreground")}>{pixKeyTypeLabels[pk.key_type]}</p>
                                    <p className="font-mono text-[12px] font-bold truncate text-foreground">{pk.key_value}</p>
                                  </div>
                                  <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", isSelected ? "border-primary bg-primary" : "border-border")}>
                                    {isSelected && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <button type="button" onClick={() => navigate("/financeiro/dados-bancarios")} className="mt-2 w-full p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-left hover:bg-destructive/10 transition-colors">
                            <p className="text-[11px] text-destructive font-display font-bold flex items-center gap-2"><XCircle className="h-3.5 w-3.5" /> Cadastrar chave PIX</p>
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={pixKeys.length === 0 || numAmount <= WITHDRAW_FEE || numAmount > availableBalance}
                        className="w-full h-11 rounded-xl text-[12px] font-display font-black uppercase tracking-[0.12em] flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.985] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ArrowDownToLine className="h-4 w-4" /> Confirmar saque de {fmt(netPreview)}
                      </button>

                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        Aprovação em até 24h úteis · Verificação automática
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* ─────────── KPI strip — 4 cols, divisores, rails verticais ─────────── */}
          <div className="mt-8 grid grid-cols-2 border-y border-border/70 lg:grid-cols-4 lg:divide-x lg:divide-border/70">
            {kpiRails.map((k, idx) => (
              <div
                key={k.label}
                className={cn(
                  "group relative min-h-[150px] px-6 py-6 transition-colors duration-200 hover:bg-muted/25",
                  idx > 1 && "border-t border-border/70 lg:border-t-0",
                  idx === 1 && "border-l border-border/70 lg:border-l-0",
                )}
              >
                <span className={cn("absolute left-0 top-6 h-8 w-[3px] rounded-r-full", k.rail)} />
                <div className="flex items-center justify-between gap-2 pl-3">
                  <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-muted-foreground">{k.label}</p>
                </div>
                <p
                  className={cn(
                    "mt-3.5 pl-3 font-display text-[36px] font-black leading-[0.9] tracking-[-0.06em] tabular-nums sm:text-[44px]",
                    k.accent,
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {k.value}
                </p>
                <p className="mt-3 truncate pl-3 text-[12.5px] font-semibold text-muted-foreground/85">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Risk strip — 3 cols inline (Vendas pattern) */}
          <div className="grid grid-cols-1 border-b border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
            {riskRails.map((r) => (
              <div
                key={r.label}
                className="group relative flex flex-col gap-2.5 px-6 py-6 transition-colors duration-200 hover:bg-muted/25"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-[19px] font-black tracking-[-0.035em] text-foreground">{r.label}</p>
                  <p
                    className={cn("font-display text-[26px] font-black leading-none tabular-nums tracking-[-0.05em]", r.accent)}
                    style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                  >
                    {r.value}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
                  <span className="font-display tabular-nums font-black text-foreground">{r.count}</span>
                  <span>{r.count === 1 ? "Saque" : "Saques"}</span>
                  <span className="inline-block h-[3px] w-[3px] rounded-full bg-muted-foreground/50" />
                  <span className="font-medium">{r.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile period scroller */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto md:hidden">
            {PERIODS.map((opt) => {
              const active = selectedPeriod.label === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => setSelectedPeriod(opt)}
                  className={cn(
                    "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[-0.005em] transition-all",
                    active
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* ─────────── PIX Key card (compact, beneath header) ─────────── */}
        {primaryPixKey && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-card px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-md bg-success/10 border border-success/20 text-success flex items-center justify-center shrink-0">
                <Key className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Chave PIX padrão · {pixKeyTypeLabels[primaryPixKey.key_type]}
                </p>
                <p className="mt-0.5 font-mono text-[12.5px] font-bold text-foreground truncate">
                  {hidden ? "•••••••••••••" : primaryPixKey.key_value}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => { navigator.clipboard.writeText(primaryPixKey.key_value); toast.success("Chave copiada"); }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                aria-label="Copiar chave"
              >
                <Copy className="h-[14px] w-[14px]" />
              </button>
              <button
                onClick={() => navigate("/financeiro/dados-bancarios")}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
              >
                Gerenciar
              </button>
            </div>
          </div>
        )}

      <div className="px-5 sm:px-8 mt-6 space-y-5">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CHART */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {m.chartData.length >= 2 && !hidden && m.totalApproved > 0 && (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-[12px] font-display font-bold text-foreground tracking-[-0.01em]">Evolução de saques aprovados</h2>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{fmtCompact(m.totalApproved)} no período</span>
          </div>
          <div className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={m.chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="saques-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <ReTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, padding: "10px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
                  formatter={(v: number) => [fmt(v), "Aprovado"]}
                  labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saques-grad)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TRANSACTIONS TABLE */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Histórico de saques</h2>
            <span className="text-[10px] font-black tabular-nums text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{filtered.length}</span>
          </div>

          {/* Status segment-control */}
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-border/50 bg-card/60 p-1 overflow-x-auto scrollbar-none">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              const dotColors: Record<string, string> = { all: "bg-primary", approved: "bg-success", pending: "bg-warning", rejected: "bg-destructive" };
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-lg h-8 px-3 text-[12px] font-bold tracking-tight transition-colors duration-200",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tab.value])} />
                  {tab.label}
                  <span className={cn(
                    "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md transition-colors",
                    isActive ? "bg-card text-foreground" : "bg-secondary/60 text-muted-foreground"
                  )}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou valor…"
              className="h-9 w-full rounded-xl border border-border/50 bg-secondary/40 pl-10 pr-9 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/70" /></button>
            )}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr className="border-b border-border/60">
                  {[
                    { label: "Identificador", w: "w-[14%]" },
                    { label: "Destino PIX", w: "w-[22%]" },
                    { label: "Valor bruto", w: "w-[12%] text-right" },
                    { label: "Taxa", w: "w-[10%] text-right" },
                    { label: "Líquido", w: "w-[14%] text-right" },
                    { label: "Status", w: "w-[14%]" },
                    { label: "Solicitado em", w: "w-[14%]" },
                  ].map(h => (
                    <th key={h.label} className={cn("py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider", h.w)}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center"><Wallet className="h-6 w-6 text-muted-foreground" /></div>
                      <p className="text-[12px] text-foreground font-display font-bold">Nenhum saque encontrado</p>
                      <p className="text-[10px] text-muted-foreground">Solicite seu primeiro saque clicando em "Novo saque"</p>
                    </div>
                  </td></tr>
                ) : filtered.map((w) => {
                  const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                  const pixType = (profile as any)?.pix_key_type || primaryPixKey?.key_type || "aleatoria";
                  const pixValue = (profile as any)?.pix_key || primaryPixKey?.key_value || "—";
                  return (
                    <tr key={w.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", st.bg, "border", st.border)}>
                            <ArrowDownToLine className={cn("h-3.5 w-3.5", st.fg)} />
                          </div>
                          <div>
                            <span className="font-mono text-[11px] text-foreground/80 font-bold">#{w.id.slice(0, 8)}</span>
                            <p className="text-[9px] text-muted-foreground tabular-nums">{format(new Date(w.created_at), "HH:mm:ss")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
                            <Key className="h-3 w-3 text-success" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{pixKeyTypeLabels[pixType] || "PIX"}</p>
                            <p className="font-mono text-[11px] font-bold text-foreground truncate">{hidden ? "•••••••••" : maskPix(pixValue, pixType)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[13px] font-display font-black text-foreground tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-display font-bold text-warning text-[11px] tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-display font-black text-success text-[13px] tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 h-6 rounded-md text-[10px] font-bold border", st.fg, st.bg, st.border)}>
                          {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-warning opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-warning" /></span>}
                          {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-[11px] text-foreground/80 font-medium tabular-nums">{format(new Date(w.created_at), "dd MMM yyyy", { locale: ptBR })}</p>
                        <p className="text-[9px] text-muted-foreground tabular-nums flex items-center gap-1"><Clock3 className="h-2.5 w-2.5" />{format(new Date(w.created_at), "HH:mm")}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/10">
              <p className="text-[11px] font-bold text-muted-foreground">Exibindo <span className="text-foreground tabular-nums">{filtered.length}</span> {filtered.length !== 1 ? "saques" : "saque"}</p>
              <p className="text-[11px] font-bold text-muted-foreground">Total líquido: <span className="text-success font-display font-black tabular-nums">{hidden ? HIDE : fmt(filtered.reduce((a, w) => a + Number(w.net_amount), 0))}</span></p>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border/40">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center"><Wallet className="h-6 w-6 text-muted-foreground" /></div>
              <p className="text-[12px] text-foreground font-display font-bold">Nenhum saque</p>
            </div>
          ) : filtered.map((w) => {
            const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
            return (
              <div key={w.id} className="p-4 active:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", st.bg, "border", st.border)}>
                      <ArrowDownToLine className={cn("h-4 w-4", st.fg)} />
                    </div>
                    <div>
                      <p className="text-lg font-display font-black text-foreground tabular-nums leading-none">{hidden ? HIDE : fmt(Number(w.amount))}</p>
                      <p className="text-[9px] text-muted-foreground font-mono mt-1">#{w.id.slice(0, 12)}</p>
                    </div>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 h-5 rounded-md text-[9px] font-bold shrink-0 border", st.fg, st.bg, st.border)}>
                    {st.label}
                  </span>
                </div>
                <div className="flex items-end justify-between pt-3 border-t border-border/40">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-[0.16em] font-bold">Taxa</p>
                      <p className="text-warning font-display font-bold text-[11px] mt-0.5 tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-[0.16em] font-bold">Líquido</p>
                      <p className="text-success font-display font-black text-[13px] mt-0.5 tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[10px] font-medium tabular-nums">{format(new Date(w.created_at), "dd/MM HH:mm")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security Footer */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-display font-black text-foreground tracking-[-0.01em]">Ambiente seguro · Verificação automática anti-fraude</p>
            <p className="text-[10.5px] text-muted-foreground/85 font-medium">Saques processados via PIX com verificação de saldo em tempo real. Taxa fixa de {fmt(WITHDRAW_FEE)} por operação. Aprovação em até 24h úteis.</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-success uppercase tracking-[0.16em]">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            ATIVO
          </div>
        </div>
      </div>
      </div>

      {/* Approved Popup */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors z-10"><X className="h-4 w-4 text-muted-foreground" /></button>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center"><PartyPopper className="h-9 w-9 text-primary" /></div>
                <h2 className="text-2xl font-display font-black text-foreground mb-2">Saque aprovado!</h2>
                <p className="text-muted-foreground text-[13px] mb-6">Seu saque de <span className="text-primary font-display font-black">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!</p>
                <button onClick={() => setApprovedPopup(null)} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-display font-bold text-[12px] shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.985] transition-all">
                  <Rocket className="h-4 w-4" /> Entendido!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

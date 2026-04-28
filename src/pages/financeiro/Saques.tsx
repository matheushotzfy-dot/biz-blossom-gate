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
  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 space-y-5">

      {/* Address warning */}
      {!hasAddress && (
        <div onClick={() => navigate("/perfil")} className="flex items-center gap-3 p-4 rounded-2xl bg-warning/10 ring-1 ring-warning/20 cursor-pointer hover:bg-warning/15 transition-all">
          <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-display font-bold text-warning">Endereço não cadastrado</p>
            <p className="text-[10px] text-warning/70">Preencha seu endereço no Perfil para realizar saques normalmente.</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-warning/70 shrink-0" />
        </div>
      )}

      {/* ═══════ HERO ═══════ */}
      <div className="relative overflow-hidden animate-fade-in">
        <div
          className="pointer-events-none absolute -top-24 -left-20 h-[280px] w-[520px] rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.10), transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-2.5 py-1">
              <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", m.pending.length > 0 ? "bg-warning" : "bg-success")} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {m.pending.length > 0 ? `${m.pending.length} ${m.pending.length === 1 ? "saque pendente" : "saques pendentes"}` : "Sem saques pendentes"}
              </span>
            </div>
            <h1 className="font-display text-[40px] sm:text-[52px] font-black leading-[0.95] tracking-[-0.03em] text-foreground">
              Saques PIX
            </h1>
            <p className="text-[13px] text-muted-foreground/80 max-w-xl leading-relaxed">
              Solicite saques, acompanhe aprovação e taxas em tempo real. Atualização automática a cada 15s.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleHidden}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
                hidden ? "border-foreground/30 bg-foreground/5 text-foreground" : "border-border/50 bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {!hasAddress ? (
              <button
                onClick={() => { toast.info("Preencha seu endereço primeiro para realizar saques"); navigate("/perfil"); }}
                className="group inline-flex h-11 items-center gap-2 rounded-xl bg-warning px-5 text-[12px] font-black uppercase tracking-[0.12em] text-warning-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-warning/90"
              >
                <MapPin className="h-4 w-4" /> Preencher endereço
              </button>
            ) : (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-black uppercase tracking-[0.12em] text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90">
                    <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" /> Novo saque
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
      </div>

      {/* ═══════ BALANCE + PIX KEY ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40 animate-fade-in stagger-1">
        {/* Available balance */}
        <div className="lg:col-span-2 bg-card p-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Saldo disponível para saque</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className={cn("text-[44px] leading-none font-display font-black tabular-nums tracking-[-0.03em]", availableBalance > 0 ? "text-foreground" : "text-muted-foreground")}>
                  {hidden ? HIDE : fmt(availableBalance)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Retido:</span>
                  <span className="font-display font-bold text-foreground tabular-nums">{hidden ? HIDE : fmt(retainedAmount)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Pendente saque:</span>
                  <span className="font-display font-bold text-foreground tabular-nums">{hidden ? HIDE : fmt(m.totalPending)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="text-muted-foreground">Aprovação média:</span>
                  <span className="font-display font-bold text-foreground tabular-nums">{m.avgApprovalHours > 0 ? `${m.avgApprovalHours.toFixed(1)}h` : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PIX Key destination card */}
        <div className="bg-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-success/10 text-success flex items-center justify-center">
                <Key className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Chave PIX padrão</span>
            </div>
            <button onClick={() => navigate("/financeiro/dados-bancarios")} className="text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:underline">Gerenciar</button>
          </div>
          {primaryPixKey ? (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                  {pixKeyTypeLabels[primaryPixKey.key_type]}
                </span>
                <p className="mt-2 font-mono text-[14px] font-bold text-foreground break-all">{hidden ? "•••••••••••••" : primaryPixKey.key_value}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(primaryPixKey.key_value); toast.success("Chave copiada"); }}
                className="mt-3 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary text-[11px] font-bold text-foreground/80 transition-colors"
              >
                <Copy className="h-3 w-3" /> Copiar chave
              </button>
            </div>
          ) : (
            <button onClick={() => navigate("/financeiro/dados-bancarios")} className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors py-4">
              <Key className="h-5 w-5 text-muted-foreground" />
              <p className="text-[11px] font-bold text-muted-foreground">Cadastrar chave PIX</p>
            </button>
          )}
        </div>
      </div>

      {/* ═══════ PERIOD BAR ═══════ */}
      <div className="flex items-center justify-between gap-3 animate-fade-in stagger-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-border/50 bg-card/60 p-1">
          {PERIODS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setSelectedPeriod(opt)}
              className={cn(
                "rounded-lg h-8 px-3 text-[12px] font-bold tracking-tight transition-colors duration-200",
                selectedPeriod.label === opt.label
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ KPI GRID — 1px divider ═══════ */}
      <div key={`saques-kpis-${selectedPeriod.label}`} className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40 lg:grid-cols-5 animate-fade-in stagger-2">
        <Kpi
          label="Total sacado"
          value={hidden ? HIDE : fmtCompact(m.totalApproved)}
          sub={`${m.approved.length} ${m.approved.length === 1 ? "saque aprovado" : "saques aprovados"}`}
          icon={DollarSign}
          tone="success"
        />
        <Kpi
          label="Taxa de aprovação"
          value={hidden ? HIDE : `${m.approvalRate.toFixed(1)}%`}
          sub={`${m.approved.length}/${m.current.length} solicitações`}
          icon={Percent}
          tone={m.approvalRate >= 80 ? "success" : "warning"}
        />
        <Kpi
          label="Pendentes"
          value={hidden ? HIDE : String(m.pending.length)}
          sub={m.pending.length > 0 ? `${fmtCompact(m.totalPending)} aguardando` : "Sem fila"}
          icon={Clock}
          tone={m.pending.length > 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="Ticket médio"
          value={hidden ? HIDE : fmtCompact(m.avgAmount)}
          sub={m.avgAmount > 0 ? "Por saque aprovado" : "Sem dados"}
          icon={TrendingUp}
          tone="info"
        />
        <Kpi
          label="Total em taxas"
          value={hidden ? HIDE : fmtCompact(m.totalFees)}
          sub={`${fmt(WITHDRAW_FEE)}/op · ${m.current.length} ${m.current.length === 1 ? "op" : "ops"}`}
          icon={Receipt}
          tone="warning"
        />
      </div>
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CHART */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {m.chartData.length >= 2 && !hidden && m.totalApproved > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
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
      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[13px] font-display font-bold text-foreground tracking-[-0.01em]">Histórico de saques</h2>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{filtered.length}</span>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              const dotColors: Record<string, string> = { all: "bg-primary", approved: "bg-success", pending: "bg-warning", rejected: "bg-destructive" };
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-bold transition-all",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-background" : dotColors[tab.value])} />
                  {tab.label}
                  <span className={cn("text-[9.5px] tabular-nums", isActive ? "opacity-70" : "opacity-60")}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou valor…"
              className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
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
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-display font-bold text-foreground">Ambiente seguro · Verificação automática anti-fraude</p>
            <p className="text-[10px] text-muted-foreground">Saques processados via PIX com verificação de saldo em tempo real. Taxa fixa de {fmt(WITHDRAW_FEE)} por operação. Aprovação em até 24h úteis.</p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-bold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            ATIVO
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
  );
}

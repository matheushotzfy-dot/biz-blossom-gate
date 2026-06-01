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
  TrendingUp, Clock3, DollarSign, Percent, Clock, Receipt, History, LayoutDashboard, Bitcoin, PiggyBank,
  ChevronRight
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

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
  approved: { label: "Aprovado", fg: "text-success", dot: "bg-success", bg: "bg-success/10", border: "border-success/25" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10", border: "border-warning/25" },
  rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
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

  const metrics = useMemo(() => {
    const now = new Date();
    const cutoff = selectedPeriod.days === 9999 ? new Date(0) : selectedPeriod.days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)) : subDays(now, selectedPeriod.days);
    const current = withdrawals.filter(w => new Date(w.created_at) >= cutoff);
    const approved = current.filter(w => w.status === "approved");
    const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);
    const dailyMap = new Map<string, number>();
    const days = Math.min(selectedPeriod.days === 9999 ? 30 : Math.max(selectedPeriod.days, 1), 30);
    for (let i = 0; i < days; i++) {
      const d = format(subDays(now, days - 1 - i), "dd/MM");
      dailyMap.set(d, 0);
    }
    approved.forEach(w => {
      const d = format(new Date(w.created_at), "dd/MM");
      if (dailyMap.has(d)) dailyMap.set(d, (dailyMap.get(d) || 0) + Number(w.net_amount));
    });
    const chartData = Array.from(dailyMap.entries()).map(([label, value]) => ({ label, value }));
    return { totalApproved, chartData, approvedCount: approved.length, pendingCount: current.filter(w => w.status === "pending").length };
  }, [withdrawals, selectedPeriod]);

  const filtered = useMemo(() => {
    const cutoff = selectedPeriod.days === 9999 ? new Date(0) : selectedPeriod.days === 0 ? new Date(new Date().setHours(0, 0, 0, 0)) : subDays(new Date(), selectedPeriod.days);
    let list = withdrawals.filter(w => new Date(w.created_at) >= cutoff);
    if (statusFilter !== "all") list = list.filter(w => w.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w => w.id.toLowerCase().includes(q) || fmt(Number(w.amount)).includes(q));
    }
    return list;
  }, [withdrawals, statusFilter, search, selectedPeriod]);

  const numAmount = parseFloat(amount) || 0;
  const netPreview = numAmount > WITHDRAW_FEE ? numAmount - WITHDRAW_FEE : 0;
  const quickAmounts = [availableBalance * 0.5, availableBalance].filter(v => v > WITHDRAW_FEE);

  return (
    <div className="mx-auto w-full max-w-[1280px] min-h-screen px-5 pt-4 pb-24 sm:px-8 sm:pt-8 bg-background">
      {/* ─────────── HEADER MINIMALISTA ─────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <PiggyBank className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Gestão de Saques</span>
          </div>
          <h1 className={cn(
            "font-display text-[48px] md:text-[64px] font-black leading-none tracking-[-0.06em] tabular-nums",
            hidden ? "text-foreground/40" : "text-foreground"
          )}>
            {hidden ? HIDE : fmt(availableBalance)}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-[11px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Atualizado agora</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>Retido: <span className="text-foreground">{hidden ? HIDE : fmt(retainedAmount)}</span></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-card p-[3px]">
            {PERIODS.slice(1).map((opt) => (
              <button
                key={opt.label}
                onClick={() => setSelectedPeriod(opt)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-black transition-all",
                  selectedPeriod.label === opt.label ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={toggleHidden} className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/60 bg-card hover:bg-muted transition-colors">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button disabled={!hasAddress} className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                Solicitar Saque
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md p-0 overflow-hidden border-border/40">
              <div className="p-6 bg-muted/30 border-b border-border/40">
                <DialogTitle className="font-display font-black text-xl flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><ArrowDownToLine className="h-5 w-5 text-primary" /></div>
                  Novo Saque
                </DialogTitle>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor desejado</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display font-black text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-14 pl-11 text-xl font-display font-black tabular-nums border-2 focus-visible:ring-primary/20"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {quickAmounts.map(v => (
                      <button key={v} type="button" onClick={() => setAmount(v.toFixed(2))} className="px-3 py-1 rounded-md bg-secondary text-[10px] font-bold hover:bg-muted transition-colors">
                        {v === availableBalance ? "Máximo" : "50%"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4 bg-muted/20 space-y-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Taxa de saque</span>
                    <span className="font-bold text-destructive">-{fmt(WITHDRAW_FEE)}</span>
                  </div>
                  <div className="flex justify-between items-end pt-2 border-t border-border/40">
                    <span className="text-[11px] font-black uppercase text-muted-foreground">Total Líquido</span>
                    <span className="text-xl font-display font-black text-success tabular-nums">{fmt(netPreview)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={numAmount <= WITHDRAW_FEE || numAmount > availableBalance}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-display font-black uppercase tracking-widest text-[12px] hover:opacity-90 transition-all disabled:opacity-40"
                >
                  Confirmar Saque
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* ─────────── DASHBOARD DE SAQUES ─────────── */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Esquerdo: Métricas e Gráfico */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border/50 bg-card">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Total Sacado</p>
              <p className="text-2xl font-display font-black tabular-nums">{hidden ? HIDE : fmtCompact(metrics.totalApproved)}</p>
              <p className="text-[11px] font-bold text-success mt-1">{metrics.approvedCount} aprovados</p>
            </div>
            <div className="p-5 rounded-2xl border border-border/50 bg-card">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Em análise</p>
              <p className={cn("text-2xl font-display font-black tabular-nums", metrics.pendingCount > 0 ? "text-warning" : "text-foreground")}>
                {metrics.pendingCount}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground mt-1">Solicitações abertas</p>
            </div>
            <div className="p-5 rounded-2xl border border-border/50 bg-card">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Taxa Fixa</p>
              <p className="text-2xl font-display font-black tabular-nums">{fmt(WITHDRAW_FEE)}</p>
              <p className="text-[11px] font-bold text-muted-foreground mt-1">Por transação PIX</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[13px] font-display font-black uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução {selectedPeriod.label}
              </h2>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))"}} dy={10} />
                  <YAxis hide />
                  <ReTooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontVariantNumeric: 'tabular-nums' }}
                    formatter={(v: any) => [fmt(v), '']}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lado Direito: Histórico Lateral ou Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden h-fit">
            <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Últimos Saques
              </h3>
              <div className="flex gap-1">
                {["all", "pending"].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s as any)} className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-colors",
                    statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}>
                    {s === "all" ? "Tudo" : "Fila"}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto scrollbar-none">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Wallet className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  <p className="text-[11px] font-bold">Nenhum registro</p>
                </div>
              ) : filtered.map((w) => {
                const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                return (
                  <div key={w.id} className="p-4 hover:bg-muted/30 transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[14px] font-display font-black tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">#{w.id.slice(0, 8)}</p>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border", st.bg, st.fg, st.border)}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 border-dashed">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center"><ArrowDownToLine className="h-3 w-3 text-muted-foreground" /></div>
                        <span className="text-[10px] font-bold text-muted-foreground">{format(new Date(w.created_at), "dd MMM")}</span>
                      </div>
                      <span className="text-[10px] font-black text-success tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > 0 && (
              <button className="w-full p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all border-t border-border/40">
                Ver extrato completo
              </button>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[12px] font-display font-black text-foreground">Ambiente Seguro</p>
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">Saques PIX são processados em até 24h úteis após verificação.</p>
              </div>
            </div>
            {primaryPixKey && (
              <div onClick={() => navigate("/financeiro/dados-bancarios")} className="p-3 rounded-xl bg-card border border-border/60 cursor-pointer hover:border-primary/40 transition-all group">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Destino Padrão</p>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-mono font-bold truncate pr-4">{hidden ? "••••••••••" : primaryPixKey.key_value}</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {!hasAddress && (
        <div onClick={() => navigate("/perfil")} className="fixed bottom-24 left-5 right-5 md:bottom-10 md:left-auto md:right-10 md:w-96 p-4 rounded-2xl bg-warning border-2 border-warning-foreground/10 text-warning-foreground shadow-2xl animate-in slide-in-from-bottom-5 cursor-pointer z-50">
          <div className="flex items-center gap-4">
            <MapPin className="h-8 w-8 opacity-40 shrink-0" />
            <div>
              <p className="text-[13px] font-display font-black uppercase">Endereço Pendente</p>
              <p className="text-[11px] font-medium opacity-80 mt-0.5">Complete seu cadastro para habilitar saques em sua conta.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
  TrendingUp, Clock3, Clock, History, LayoutDashboard, ChevronRight, Filter, ChevronDown, ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─────────────────────── Helpers ─────────────────────── */
const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return fmt(v);
};
const HIDE = "••••••";
const WITHDRAW_FEE = 5;

const PERIODS = [
  { label: "Hoje", days: 0 },
  { label: "7 Dias", days: 7 },
  { label: "30 Dias", days: 30 },
  { label: "Tudo", days: 9999 },
];

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
  approved: { label: "Aprovado", fg: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pending: { label: "Pendente", fg: "text-amber-500", dot: "bg-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  rejected: { label: "Recusado", fg: "text-rose-500", dot: "bg-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export default function Saques() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: withdrawals = [], refetch } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hidden, setHidden] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);
  const invalidateAll = useInvalidateAll();

  const hasAddress = !!(profile as any)?.zip_code;

  useEffect(() => {
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user?.id });
      if (data !== null) setAvailableBalance(Number(data));
      const { data: tx } = await supabase.from("transactions").select("retained_amount").eq("user_id", user?.id).eq("status", "approved").eq("retention_released", false);
      if (tx) setRetainedAmount(tx.reduce((acc, t) => acc + Number(t.retained_amount || 0), 0));
    };
    fetchBalance();
  }, [user?.id]);

  const metrics = useMemo(() => {
    const dailyMap = new Map();
    for (let i = 6; i >= 0; i--) dailyMap.set(format(subDays(new Date(), i), "dd/MM"), 0);
    withdrawals.filter(w => w.status === "approved").forEach(w => {
      const d = format(new Date(w.created_at), "dd/MM");
      if (dailyMap.has(d)) dailyMap.set(d, (dailyMap.get(d) || 0) + Number(w.net_amount));
    });
    return { 
      chartData: Array.from(dailyMap.entries()).map(([label, value]) => ({ label, value })),
      pendingCount: withdrawals.filter(w => w.status === "pending").length
    };
  }, [withdrawals]);

  const filtered = useMemo(() => {
    return withdrawals.filter(w => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (selectedPeriod.days !== 9999) {
        const cutoff = selectedPeriod.days === 0 ? new Date(new Date().setHours(0,0,0,0)) : subDays(new Date(), selectedPeriod.days);
        return new Date(w.created_at) >= cutoff;
      }
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [withdrawals, statusFilter, selectedPeriod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!user || isNaN(numAmount) || numAmount <= WITHDRAW_FEE) { toast.error("Valor inválido"); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) { toast.error(error.message); return; }
    toast.success("Saque solicitado!"); setOpen(false); setAmount(""); invalidateAll(["withdrawals"]);
  };

  const netPreview = parseFloat(amount) > WITHDRAW_FEE ? parseFloat(amount) - WITHDRAW_FEE : 0;

  return (
    <div className="min-h-screen bg-[#FBFBFB] selection:bg-black selection:text-white pb-20">
      
      {/* ─── Header Moderno ─── */}
      <div className="bg-white border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-neutral-900">Financeiro</h1>
              <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">Gestão de Saques</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setHidden(!hidden)} className="h-10 px-4 bg-neutral-50 rounded-xl text-[11px] font-bold text-neutral-500 hover:bg-neutral-100 transition-colors uppercase tracking-wider">
              {hidden ? "Mostrar" : "Ocultar"}
            </button>
            <button onClick={() => setOpen(true)} className="h-10 px-6 bg-neutral-900 rounded-xl text-[11px] font-black text-white hover:bg-neutral-800 transition-all uppercase tracking-widest shadow-lg shadow-black/10">
              Novo Saque
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* ─── Esquerda: Saldo e Gráfico ─── */}
        <div className="lg:col-span-8 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-white border border-neutral-100 rounded-[32px] shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <p className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-4">Saldo Disponível</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-5xl font-black text-neutral-900 tabular-nums tracking-tighter">
                    {hidden ? HIDE : fmt(availableBalance)}
                  </h2>
                </div>
                <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-neutral-400">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Atualização em tempo real
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ArrowDownToLine size={160} />
              </div>
            </div>

            <div className="p-8 bg-neutral-900 rounded-[32px] shadow-2xl shadow-black/20 text-white flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-black text-neutral-500 uppercase tracking-widest mb-4">Saldo Retido</p>
                <h3 className="text-4xl font-black tabular-nums tracking-tighter">
                  {hidden ? HIDE : fmt(retainedAmount)}
                </h3>
              </div>
              <p className="text-[10px] font-bold text-neutral-400 leading-relaxed mt-4">
                Valores em processamento e reservas de segurança.
              </p>
            </div>
          </div>

          <div className="p-8 bg-white border border-neutral-100 rounded-[32px] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-neutral-400" /> Rendimento Semanal
              </h4>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">Histórico Ativo</span>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: "#A3A3A3"}} dy={10} />
                  <YAxis hide />
                  <ReTooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontVariantNumeric: 'tabular-nums' }}
                    formatter={(v: any) => [fmt(v), '']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#171717" strokeWidth={3} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── Direita: Histórico ─── */}
        <div className="lg:col-span-4 space-y-8">
          
          <div className="bg-white border border-neutral-100 rounded-[32px] shadow-sm overflow-hidden flex flex-col h-[740px]">
            <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-neutral-900">Histórico</h3>
                <div className="flex bg-white p-1 rounded-xl border border-neutral-200">
                  {PERIODS.map(p => (
                    <button 
                      key={p.label}
                      onClick={() => setSelectedPeriod(p)}
                      className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all", 
                        selectedPeriod.label === p.label ? "bg-neutral-900 text-white shadow-lg" : "text-neutral-400 hover:text-neutral-900")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {["all", "pending", "approved"].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase border transition-all",
                    statusFilter === s ? "bg-black text-white border-black" : "bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400"
                  )}>
                    {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : "Aprovados"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-50 scrollbar-none">
              {filtered.length === 0 ? (
                <div className="py-20 text-center opacity-20">
                  <History size={48} className="mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Vazio</p>
                </div>
              ) : filtered.map(w => {
                const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                return (
                  <div key={w.id} className="p-6 hover:bg-neutral-50 transition-colors group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-xl font-black text-neutral-900 tabular-nums tracking-tight">
                          {hidden ? HIDE : fmt(Number(w.amount))}
                        </div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1">Líquido: {hidden ? HIDE : fmt(Number(w.net_amount))}</p>
                      </div>
                      <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm", st.bg, st.fg, st.border)}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400">
                      <div className="flex items-center gap-2">
                        <Clock size={12} />
                        {format(new Date(w.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </div>
                      <span className="font-mono opacity-50">#{w.id.slice(0, 8)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <button className="p-5 w-full bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-colors border-t border-neutral-100">
              Carregar mais registros
            </button>
          </div>

          <div className="p-8 bg-emerald-500 rounded-[32px] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <Shield size={32} className="mb-4 text-emerald-100" />
              <h4 className="text-lg font-black tracking-tight mb-2 leading-none">Proteção Ativa</h4>
              <p className="text-[11px] font-bold text-emerald-100 leading-relaxed">
                Seus saques são verificados por nossa IA de segurança antes da liberação.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
              <Shield size={120} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal de Saque ─── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
          <div className="p-8 bg-white">
            <div className="flex items-center justify-between mb-10">
              <div className="h-12 w-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
                <ArrowDownToLine size={24} />
              </div>
              <button onClick={() => setOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 hover:text-neutral-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Quanto quer sacar?</h2>
              <p className="text-sm text-neutral-400 font-medium mt-1">O valor será enviado para sua chave PIX padrão.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-neutral-300">R$</span>
                  <Input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-20 pl-16 pr-6 text-4xl font-black tabular-nums border-2 border-neutral-100 rounded-[24px] focus-visible:ring-black focus-visible:border-black transition-all" 
                    placeholder="0,00"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAmount((availableBalance * 0.5).toFixed(2))} className="flex-1 h-10 bg-neutral-50 rounded-xl text-[11px] font-bold hover:bg-neutral-100">50% do saldo</button>
                  <button type="button" onClick={() => setAmount(availableBalance.toFixed(2))} className="flex-1 h-10 bg-neutral-50 rounded-xl text-[11px] font-bold hover:bg-neutral-100">Tudo</button>
                </div>
              </div>

              <div className="p-6 bg-neutral-50 rounded-[24px] space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 font-bold uppercase tracking-wider">Taxa de saque</span>
                  <span className="font-black text-neutral-900">-{fmt(WITHDRAW_FEE)}</span>
                </div>
                <div className="pt-4 border-t border-neutral-200 flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase tracking-widest text-neutral-400">Você recebe</span>
                  <span className="text-2xl font-black text-emerald-500 tabular-nums">{fmt(netPreview)}</span>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full h-16 bg-neutral-900 rounded-[24px] text-white font-black uppercase tracking-widest text-xs hover:bg-neutral-800 transition-all shadow-xl shadow-black/10 active:scale-95"
              >
                Confirmar Saque
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

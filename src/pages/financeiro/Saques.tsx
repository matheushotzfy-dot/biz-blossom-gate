import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, Key, CheckCircle2, Wallet, Shield,
  Eye, EyeOff, Clock, History, TrendingUp, ArrowUpRight,
  ArrowDown, DollarSign, CreditCard, ChevronRight, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const WITHDRAW_FEE = 5;

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Concluído", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  pending: { label: "Em análise", color: "text-orange-500", bg: "bg-orange-500/10" },
  rejected: { label: "Estornado", color: "text-rose-500", bg: "bg-rose-500/10" },
};

export default function Saques() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: withdrawals = [], refetch } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [hidden, setHidden] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const invalidateAll = useInvalidateAll();

  useEffect(() => {
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user?.id });
      if (data !== null) setAvailableBalance(Number(data));
    };
    fetchBalance();
  }, [user?.id]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "dd/MM");
      const total = withdrawals
        .filter(w => w.status === "approved" && format(new Date(w.created_at), "dd/MM") === date)
        .reduce((acc, curr) => acc + Number(curr.net_amount), 0);
      data.push({ date, total });
    }
    return data;
  }, [withdrawals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!user || isNaN(numAmount) || numAmount <= WITHDRAW_FEE) { toast.error("Valor inválido"); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação enviada!"); setOpen(false); setAmount(""); invalidateAll(["withdrawals"]);
  };

  const netPreview = parseFloat(amount) > WITHDRAW_FEE ? parseFloat(amount) - WITHDRAW_FEE : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-emerald-500 selection:text-black">
      
      {/* ─── Top Navigation ─── */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Wallet className="text-black w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white/90">Finanças</h1>
              <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">Painel de Retiradas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setHidden(!hidden)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="h-10 px-6 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Novo Saque
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#121214] border-white/5 rounded-[32px] p-0 overflow-hidden max-w-md shadow-2xl">
                <div className="p-8">
                  <DialogTitle className="text-2xl font-black mb-2">Solicitar Retirada</DialogTitle>
                  <p className="text-white/40 text-sm mb-8">O valor será enviado para sua conta PIX cadastrada.</p>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Quanto deseja sacar?</label>
                      <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-white/20 group-focus-within:text-emerald-500 transition-colors">R$</span>
                        <Input 
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-20 pl-16 bg-white/5 border-white/5 rounded-2xl text-3xl font-black focus:border-emerald-500/50 transition-all tabular-nums"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white/40">Taxa de rede</span>
                        <span className="text-rose-400">-{fmt(WITHDRAW_FEE)}</span>
                      </div>
                      <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Você recebe</span>
                        <span className="text-2xl font-black text-emerald-400 tabular-nums">{fmt(netPreview)}</span>
                      </div>
                    </div>

                    <button type="submit" className="w-full h-16 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      Confirmar Transação
                    </button>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* ─── Left Section: Stats & Chart ─── */}
        <div className="lg:col-span-8 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-10 rounded-[40px] bg-gradient-to-br from-[#121214] to-[#0A0A0B] border border-white/5 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Disponível para Saque</span>
                </div>
                <h2 className="text-6xl font-black tabular-nums tracking-tighter mb-4">
                  {hidden ? "••••••" : fmt(availableBalance)}
                </h2>
                <div className="flex items-center gap-4 text-[11px] font-bold text-white/40">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-[#121214] bg-white/5" />)}
                  </div>
                  <span>+420 usuários sacando agora</span>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <TrendingUp size={300} strokeWidth={1} />
              </div>
            </div>

            <div className="grid grid-rows-2 gap-6">
              <div className="p-8 rounded-[32px] bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/[0.07] transition-all cursor-default">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Últimos 7 dias</p>
                  <p className="text-2xl font-black tabular-nums">{hidden ? "••••" : fmt(withdrawals.filter(w => w.status === 'approved' && new Date(w.created_at) > subDays(new Date(), 7)).reduce((acc, curr) => acc + Number(curr.net_amount), 0))}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <ArrowUpRight size={24} />
                </div>
              </div>
              <div className="p-8 rounded-[32px] bg-white/5 border border-white/5 flex items-center justify-between group hover:bg-white/[0.07] transition-all cursor-default">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Taxas Pagas</p>
                  <p className="text-2xl font-black tabular-nums">{hidden ? "••••" : fmt(withdrawals.length * WITHDRAW_FEE)}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <ArrowDown size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 rounded-[40px] bg-[#121214] border border-white/5">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-lg font-black tracking-tight">Fluxo de Retiradas</h3>
                <p className="text-xs text-white/30 font-bold uppercase tracking-widest mt-1">Volume líquido aprovado p/ dia</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black uppercase text-white/40">Performance</span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: "rgba(255,255,255,0.2)"}} dy={15} />
                  <YAxis hide />
                  <ReTooltip 
                    contentStyle={{ backgroundColor: "#121214", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", fontSize: "12px", fontWeight: "900" }}
                    itemStyle={{ color: "#10b981" }}
                    cursor={{ stroke: "rgba(16,185,129,0.2)", strokeWidth: 2 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={4} fill="url(#chartGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── Right Section: History ─── */}
        <div className="lg:col-span-4 space-y-8">
          
          <div className="bg-[#121214] border border-white/5 rounded-[40px] overflow-hidden flex flex-col h-[780px] shadow-2xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                  <History size={14} /> Histórico Recente
                </h4>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors cursor-pointer">
                  <Search size={14} />
                </div>
              </div>
              <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                {['Tudo', 'Hoje'].map(t => (
                  <button key={t} className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    t === 'Hoje' ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
                  )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-white/5">
              {withdrawals.length === 0 ? (
                <div className="py-20 text-center text-white/10 uppercase font-black tracking-widest text-xs">Sem registros</div>
              ) : withdrawals.slice(0, 10).map((w, idx) => {
                const config = STATUS_MAP[w.status] || STATUS_MAP.pending;
                return (
                  <div key={idx} className="p-8 hover:bg-white/[0.02] transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xl font-black tabular-nums tracking-tighter">
                          {hidden ? "••••" : fmt(Number(w.amount))}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">Ref: #{w.id.slice(0, 8)}</p>
                      </div>
                      <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", config.bg, config.color)}>
                        {config.label}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 border-dashed">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-white/30">
                        <Clock size={12} />
                        {format(new Date(w.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </div>
                      <ChevronRight size={14} className="text-white/10 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button className="p-6 w-full text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-emerald-500 hover:bg-emerald-500/[0.02] transition-all border-t border-white/5">
              Visualizar Extrato Completo
            </button>
          </div>

          <div className="p-8 rounded-[40px] bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/10 relative overflow-hidden group">
            <div className="relative z-10">
              <Shield className="text-emerald-500 mb-4" size={32} />
              <h4 className="font-black text-lg mb-2">Saque Verificado</h4>
              <p className="text-[11px] font-bold text-white/40 leading-relaxed">
                Cada transação passa por nossa camada de segurança IA antes de chegar no seu banco.
              </p>
            </div>
            <ArrowUpRight className="absolute -right-2 -bottom-2 text-emerald-500 opacity-10 group-hover:scale-125 transition-transform" size={120} />
          </div>

        </div>
      </div>
    </div>
  );
}

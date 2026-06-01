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
  TrendingUp, Clock3, Clock, History, LayoutDashboard, ChevronRight, Filter, ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
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
  const { data: withdrawals = [] } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hidden, setHidden] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  const hasAddress = !!(profile as any)?.zip_code;

  useEffect(() => {
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user?.id });
      if (data !== null) setAvailableBalance(Number(data));
    };
    fetchBalance();
  }, [user?.id]);

  const metrics = useMemo(() => {
    const cutoff = selectedPeriod.days === 9999 ? new Date(0) : new Date(new Date().setHours(0,0,0,0));
    const current = withdrawals.filter(w => new Date(w.created_at) >= cutoff);
    const approved = current.filter(w => w.status === "approved");
    const total = approved.reduce((a, w) => a + Number(w.net_amount), 0);
    
    // Gráfico de 7 dias fixo para ficar bonito
    const dailyMap = new Map();
    for (let i = 6; i >= 0; i--) dailyMap.set(format(subDays(new Date(), i), "dd/MM"), 0);
    approved.forEach(w => {
      const d = format(new Date(w.created_at), "dd/MM");
      if (dailyMap.has(d)) dailyMap.set(d, (dailyMap.get(d) || 0) + Number(w.net_amount));
    });
    
    return { 
      total, 
      chartData: Array.from(dailyMap.entries()).map(([label, value]) => ({ label, value })),
      pending: current.filter(w => w.status === "pending").length
    };
  }, [withdrawals, selectedPeriod]);

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

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Financeiro</h1>
            <p className="text-neutral-500 mt-1 font-medium">Gestão e acompanhamento de saques</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHidden(!hidden)} className="px-4 py-2 bg-white border rounded-xl shadow-sm text-xs font-bold hover:bg-neutral-50">
              {hidden ? "Mostrar Valores" : "Ocultar Valores"}
            </button>
            <button onClick={() => setOpen(true)} className="px-6 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-neutral-800 transition-all">
              Solicitar Saque
            </button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-8 rounded-3xl bg-neutral-900 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-neutral-400 font-medium mb-2">Saldo Disponível</p>
              <h2 className="text-5xl font-black tabular-nums">{hidden ? HIDE : fmt(availableBalance)}</h2>
            </div>
            <div className="absolute right-0 top-0 p-8 opacity-10">
              <Wallet size={120} />
            </div>
          </div>
          <div className="p-8 rounded-3xl bg-white border border-neutral-100 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-neutral-500 font-medium text-sm">Próximos Saques</p>
              <h3 className="text-3xl font-black mt-2 text-neutral-900">{metrics.pending}</h3>
            </div>
            <div className="text-xs font-bold text-emerald-600 mt-4 flex items-center gap-1">
              <CheckCircle2 size={14} /> Processamento em 24h
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <History size={18} className="text-neutral-400" /> Histórico de Saques
            </h3>
            <div className="flex gap-2">
              {PERIODS.map(p => (
                <button 
                  key={p.label}
                  onClick={() => setSelectedPeriod(p)}
                  className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", 
                    selectedPeriod.label === p.label ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:bg-neutral-50")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50/50 text-neutral-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(w => {
                  const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={w.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-neutral-700">{format(new Date(w.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold border", st.bg, st.fg, st.border)}>{st.label}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-neutral-900">{hidden ? HIDE : fmt(Number(w.net_amount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

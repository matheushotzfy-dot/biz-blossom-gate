import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWithdrawals, usePixKeys, useBankAccounts, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, Wallet, Clock, History, Search, ArrowDownToLine, Info,
  CheckCircle2, Key, Building2, MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DadosBancarios from "./DadosBancarios";
import AutoWithdrawalSettings from "@/components/financeiro/AutoWithdrawalSettings";
import { friendlyError } from "@/lib/friendlyError";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const DEFAULT_WITHDRAW_FEE = 5;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Concluído", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  pending: { label: "Pendente", color: "text-amber-500", bg: "bg-amber-500/10" },
  rejected: { label: "Recusado", color: "text-red-500", bg: "bg-red-500/10" },
};

export default function Saques() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: withdrawals = [], isError: withdrawalsError, refetch: refetchWithdrawals } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);
  const [withdrawFee, setWithdrawFee] = useState<number>(DEFAULT_WITHDRAW_FEE);
  const [search, setSearch] = useState("");
  const invalidateAll = useInvalidateAll();

  const hasAddress = !!profile?.zip_code && !!profile?.street
    && !!profile?.street_number && !!profile?.city && !!profile?.state;

  useEffect(() => {
    if (!user?.id) return;
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user.id });
      if (data !== null) setAvailableBalance(Number(data));

      const { data: tx } = await supabase
        .from("transactions")
        .select("retained_amount")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .eq("retention_released", false);
      if (tx) setRetainedAmount(tx.reduce((acc, t) => acc + Number(t.retained_amount || 0), 0));

      const { data: feeRow } = await supabase
        .from("fees")
        .select("value")
        .eq("name", "Taxa de Saque")
        .eq("fee_type", "fixed")
        .maybeSingle();
      if (feeRow?.value != null) setWithdrawFee(Number(feeRow.value));
    };
    fetchBalance();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search) return withdrawals;
    const q = search.toLowerCase();
    return withdrawals.filter(w => w.id.toLowerCase().includes(q) || fmt(Number(w.amount)).includes(q));
  }, [withdrawals, search]);

  const handleOpenChange = (next: boolean) => {
    if (next && !hasAddress) {
      toast.error("Preencha seu endereço antes de solicitar saques");
      navigate("/perfil?focus=address");
      return;
    }
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAddress) {
      toast.error("Endereço obrigatório para saques");
      navigate("/perfil?focus=address");
      setOpen(false);
      return;
    }
    const numAmount = parseFloat(amount);
    if (!user || isNaN(numAmount) || numAmount <= withdrawFee) { toast.error("Valor inválido"); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }
    if (pixKeys.length === 0 && bankAccounts.length === 0) { toast.error("Cadastre uma chave PIX ou conta bancária"); return; }

    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Solicitação enviada!"); setOpen(false); setAmount(""); invalidateAll(["withdrawals"]);
  };

  const netPreview = parseFloat(amount) > withdrawFee ? parseFloat(amount) - withdrawFee : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase tracking-tight">Saques</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
            Solicite a transferência dos seus lucros
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <button className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest">
              <Plus size={18} strokeWidth={3} /> Solicitar Saque
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border-border/60">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Solicitar Saque</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor do Saque</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">R$</span>
                  <Input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-11 h-14 text-xl font-black tabular-nums bg-background border-border/60 rounded-xl"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> Taxa fixa de {fmt(withdrawFee)} por transação.
                </p>
              </div>
              <div className="bg-muted/30 p-5 rounded-2xl border border-border/60 space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground uppercase tracking-widest">Taxa Administrativa</span>
                  <span className="text-red-500">-{fmt(withdrawFee)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-4 items-center">
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Você receberá</span>
                  <span className="text-2xl font-black text-emerald-500 tabular-nums">{fmt(netPreview)}</span>
                </div>
              </div>
              <button type="submit" className="w-full bg-primary text-primary-foreground h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10">
                Confirmar Solicitação
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Wallet size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">Saldo Disponível</span>
                </div>
                <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(availableBalance)}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Wallet size={160} />
              </div>
            </div>
            <div className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Clock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">Aguardando Liberação</span>
                </div>
                <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(retainedAmount)}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Clock size={160} />
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <History size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Histórico</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Ultimos registros</p>
                </div>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                <input 
                  type="text" 
                  placeholder="ID ou Valor..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                    <th className="px-8 py-5">ID / Data</th>
                    <th className="px-8 py-5 text-center">Status</th>
                    <th className="px-8 py-5 text-right">Valores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {withdrawalsError ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <History size={48} strokeWidth={1} className="opacity-30" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-destructive">Falha ao carregar histórico</p>
                          <button
                            onClick={() => refetchWithdrawals()}
                            className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <History size={48} strokeWidth={1} />
                          <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Sem saques registrados</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((w) => {
                      const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                      return (
                        <tr key={w.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-8 py-6">
                            <p className="font-mono text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                              #{w.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground/50 mt-1 uppercase">
                              {format(new Date(w.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", status.bg, status.color, "border-current/10")}>
                                {status.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <p className="text-sm font-black text-foreground tabular-nums tracking-tight">
                              {fmt(Number(w.amount))}
                            </p>
                            <p className="text-[10px] font-bold text-emerald-500 tabular-nums">
                              Líq: {fmt(Number(w.net_amount))}
                            </p>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Account Settings Column */}
        <div className="space-y-6">
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden sticky top-6">
            <div className="p-6 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Building2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Destino</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Configurações</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Simplified PIX Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Key size={12} className="text-primary" /> Chaves PIX
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground/40">{pixKeys.length}/3</span>
                </div>
                
                {pixKeys.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border/60 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Nenhuma chave</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pixKeys.slice(0, 2).map((pk) => (
                      <div key={pk.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between group">
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-foreground truncate">{(pk as any).key_value_masked ?? pk.key_value ?? "•••"}</p>
                          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase">{pk.key_type}</p>
                        </div>
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Simplified Bank Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Building2 size={12} className="text-primary" /> Contas
                  </span>
                </div>
                
                {bankAccounts.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border/60 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Nenhuma conta</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bankAccounts.slice(0, 1).map((acc) => (
                      <div key={acc.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 group">
                        <p className="text-[11px] font-black text-foreground truncate uppercase">{acc.bank_name}</p>
                        <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-0.5">Ag {acc.agency} · CC {(acc as any).account_number_masked ?? acc.account_number ?? "••••"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full h-11 rounded-xl bg-muted/50 border border-border/60 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted transition-all">
                    Gerenciar Dados Bancários
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-background border-border/60 p-0 overflow-hidden rounded-3xl">
                  <div className="p-8">
                    <DadosBancarios />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
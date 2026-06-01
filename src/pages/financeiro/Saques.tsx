import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, useInvalidateAll } from "@/hooks/useQueryData";
import { Plus, Wallet, Clock, History, Search, ArrowDownToLine, Info, CheckCircle2, X, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const WITHDRAW_FEE = 5;

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
  approved: { label: "Concluído", fg: "text-success", dot: "bg-success", bg: "bg-success/10", border: "border-success/25" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10", border: "border-warning/25" },
  rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
};

export default function Saques() {
  const { user } = useAuth();
  const { data: withdrawals = [] } = useWithdrawals();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);
  const [search, setSearch] = useState("");
  const invalidateAll = useInvalidateAll();

  const [privacyHidden, setPrivacyHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });

  useEffect(() => {
    const handleStorage = () => setPrivacyHidden(localStorage.getItem("privacy_mode") === "true");
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user?.id });
      if (data !== null) setAvailableBalance(Number(data));
      
      const { data: tx } = await supabase
        .from("transactions")
        .select("retained_amount")
        .eq("user_id", user?.id)
        .eq("status", "approved")
        .eq("retention_released", false);
      if (tx) setRetainedAmount(tx.reduce((acc, t) => acc + Number(t.retained_amount || 0), 0));
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search) return withdrawals;
    const q = search.toLowerCase();
    return withdrawals.filter(w => w.id.toLowerCase().includes(q));
  }, [withdrawals, search]);

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
  const HIDE = "••••••";

  return (
    <div className="mx-auto w-full max-w-[1480px] pb-10">
      <div className="px-5 pt-4 sm:px-8 sm:pt-6">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 bg-primary/10 border border-primary/25 rounded-xl flex items-center justify-center">
                <ArrowDownToLine className="h-4 w-4 text-primary" strokeWidth={2.5} />
              </div>
              <h1 className="text-[13px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">Gestão de Saques</h1>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Saldo Disponível</p>
                <h2 className={cn(
                  "font-display text-[42px] md:text-[54px] font-black leading-none tracking-[-0.05em] tabular-nums",
                  privacyHidden ? "text-foreground/40" : "text-foreground"
                )}>
                  {privacyHidden ? HIDE : fmt(availableBalance)}
                </h2>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Aguardando Liberação</p>
                <h3 className={cn(
                  "font-display text-[32px] md:text-[40px] font-black leading-none tracking-[-0.05em] tabular-nums",
                  privacyHidden ? "text-foreground/40" : "text-foreground"
                )}>
                  {privacyHidden ? HIDE : fmt(retainedAmount)}
                </h3>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 shadow-lg shadow-primary/15 transition-all active:scale-95">
                  <Plus className="h-4 w-4" strokeWidth={3} /> Solicitar Saque
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md p-0 overflow-hidden border-border bg-card">
                <div className="p-6 bg-muted/30 border-b border-border">
                  <DialogTitle className="font-display font-black text-xl flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><ArrowDownToLine className="h-5 w-5 text-primary" /></div>
                    Solicitar Saque
                  </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor desejado</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display font-black text-muted-foreground group-focus-within:text-primary transition-colors">R$</span>
                      <Input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-14 pl-11 text-xl font-display font-black tabular-nums border-2 border-border focus:border-primary/50"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="bg-muted p-5 rounded-2xl border border-border space-y-3">
                    <div className="flex justify-between text-xs font-bold text-muted-foreground">
                      <span>Taxa Fixa PIX</span>
                      <span className="text-destructive">-{fmt(WITHDRAW_FEE)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-border font-display">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Líquido</span>
                      <span className="text-2xl font-black text-success tabular-nums">{fmt(netPreview)}</span>
                    </div>
                  </div>
                  <button type="submit" className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-display font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/10 hover:opacity-90 transition-all active:scale-[0.98]">
                    Confirmar Transação
                  </button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <section className="mt-10 rounded-[2rem] border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border/60 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted/60 rounded-xl flex items-center justify-center text-muted-foreground">
                <History size={18} />
              </div>
              <h2 className="font-display font-black text-foreground tracking-tight">Histórico de Saques</h2>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-muted/40 border border-border/40 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/60">
                  <th className="px-8 py-5">Identificador</th>
                  <th className="px-8 py-5">Valor Solicitado</th>
                  <th className="px-8 py-5">Taxa Fixa</th>
                  <th className="px-8 py-5">Líquido</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Solicitação</th>
                  <th className="px-8 py-5">Concluído em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center opacity-30">
                      <div className="flex flex-col items-center gap-3">
                        <History size={48} strokeWidth={1} />
                        <p className="text-[11px] font-black uppercase tracking-widest">Nenhum saque registrado</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={w.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-8 py-6">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                            #{w.id.slice(0, 12).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-[13px] font-bold tabular-nums">
                          {privacyHidden ? HIDE : fmt(Number(w.amount))}
                        </td>
                        <td className="px-8 py-6 text-[12px] font-bold text-destructive/80 tabular-nums">
                          -{fmt(Number(w.fee_amount || WITHDRAW_FEE))}
                        </td>
                        <td className="px-8 py-6 text-[14px] font-black text-success tabular-nums">
                          {privacyHidden ? HIDE : fmt(Number(w.net_amount))}
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                            st.fg, st.bg, st.border
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-[11px] font-bold text-foreground/80">{format(new Date(w.created_at), "dd MMM, yyyy", { locale: ptBR })}</div>
                          <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{format(new Date(w.created_at), "HH:mm")}</div>
                        </td>
                        <td className="px-8 py-6">
                          {(w as any).processed_at ? (
                            <>
                              <div className="text-[11px] font-bold text-foreground/80">{format(new Date((w as any).processed_at), "dd MMM, yyyy", { locale: ptBR })}</div>
                              <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{format(new Date((w as any).processed_at), "HH:mm")}</div>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground/30">
                              <span className="text-[10px] font-black uppercase tracking-widest">Processando</span>
                              <div className="h-1 w-1 rounded-full bg-current animate-pulse" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 p-6 rounded-[2rem] border border-border/40 bg-card/60 flex items-center gap-4">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[12px] font-display font-black text-foreground leading-none">Ambiente Seguro</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">Sua transação é processada em até 24h úteis após verificação automática anti-fraude.</p>
            </div>
          </div>
          <div className="flex-1 p-6 rounded-[2rem] border border-border/40 bg-card/60 flex items-center gap-4">
            <div className="h-10 w-10 bg-success/10 rounded-xl flex items-center justify-center text-success shrink-0">
              <Info size={20} />
            </div>
            <div>
              <p className="text-[12px] font-display font-black text-foreground leading-none">Informação PIX</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">Certifique-se de que sua chave PIX está correta em seu Perfil para evitar estornos.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

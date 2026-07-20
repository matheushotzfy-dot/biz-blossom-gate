import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWithdrawals, usePixKeys, useBankAccounts, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, Wallet, Clock, History, Search, ArrowDownToLine, Info,
  CheckCircle2, Key, Building2, MapPin, ClipboardPaste, QrCode,
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
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

const fmt = (v: number) =>
  `R$ ${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mask raw digits into BR currency string "1.234,56"
const maskBRL = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Parse BR currency string back to number
const parseBRL = (masked: string): number => {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};
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
  // pickedKey: id of a saved pix key, "copy_paste" for one-off, or "" for none
  const [pickedKey, setPickedKey] = useState<string>("");
  const [copyPasteCode, setCopyPasteCode] = useState("");
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
    const numAmount = parseBRL(amount);
    if (!user || !numAmount || numAmount <= withdrawFee) { toast.error("Valor inválido"); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }

    if (!pickedKey) {
      toast.error("Selecione uma chave PIX ou use Copia e Cola");
      return;
    }
    if (pickedKey === "copy_paste" && copyPasteCode.trim().length < 20) {
      toast.error("Cole o código PIX Copia e Cola completo");
      return;
    }

    const payload: Record<string, unknown> = { user_id: user.id, amount: numAmount };
    if (pickedKey === "copy_paste") {
      payload.withdrawal_type = "pix_copy_paste";
      payload.pix_copy_paste_code = copyPasteCode.trim();
    } else {
      payload.withdrawal_type = "pix";
      payload.pix_key_id = pickedKey;
    }

    const { error } = await supabase.from("withdrawals").insert(payload as any);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Solicitação enviada!");
    setOpen(false);
    setAmount("");
    setCopyPasteCode("");
    setPickedKey("");
    invalidateAll(["withdrawals"]);
  };

  const parsedAmount = parseBRL(amount);
  const netPreview = parsedAmount > withdrawFee ? parsedAmount - withdrawFee : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Clean Hero */}
      <FinanceiroHero
        eyebrow="Financeiro · Saques"
        title="Saques"
        subtitle="Solicite a transferência dos seus lucros com liquidação em até 24h úteis."
        status={{
          tone: availableBalance > 0 ? "success" : "neutral",
          label: availableBalance > 0 ? "Saldo disponível" : "Sem saldo",
          pulse: availableBalance > 0,
        }}
        actions={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <button className="bg-primary text-primary-foreground h-11 px-5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                <Plus size={16} strokeWidth={3} /> Solicitar Saque
              </button>
            </DialogTrigger>
          <DialogContent className="max-w-md bg-card border-border/60 max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Solicitar Saque</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor do Saque</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(maskBRL(e.target.value))}
                    className="pl-11 h-14 text-xl font-black tabular-nums bg-background border-border/60 rounded-xl"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> Taxa fixa de {fmt(withdrawFee)} por transação.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chave de recebimento</label>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                  <div className="grid grid-cols-2 border-b border-border/40 p-1.5">
                    <button
                      type="button"
                      onClick={() => setPickedKey(pixKeys[0]?.id ?? "")}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200",
                        pickedKey !== "copy_paste"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground",
                      )}
                    >
                      <Key className="h-3.5 w-3.5" strokeWidth={2.5} /> Minhas Chaves
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickedKey("copy_paste")}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200",
                        pickedKey === "copy_paste"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground",
                      )}
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" strokeWidth={2.5} /> Copia e Cola
                    </button>
                  </div>

                  {pickedKey === "copy_paste" ? (
                    <div className="space-y-3 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                          <QrCode className="h-4 w-4" strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-foreground">PIX Copia e Cola avulso</p>
                          <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                            Use para um código de cobrança única. Ele vai apenas nesta solicitação e não será cadastrado como chave.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código BR Code</label>
                        <textarea
                          value={copyPasteCode}
                          onChange={(e) => setCopyPasteCode(e.target.value)}
                          rows={5}
                          placeholder="Cole aqui o código completo do PIX Copia e Cola"
                          className="w-full resize-none rounded-xl border border-border/60 bg-card px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-muted-foreground/70">
                          <span className="flex items-center gap-1.5">
                            <Info className="h-3 w-3" /> Não fica salvo no perfil
                          </span>
                          <span className="tabular-nums">{copyPasteCode.trim().length} caracteres</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {pixKeys.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 p-5 text-center">
                          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Nenhuma chave PIX cadastrada</p>
                        </div>
                      ) : (
                        pixKeys.map((pk) => {
                          const active = pickedKey === pk.id;
                          const label = pk.key_value || (pk as any).key_value_masked || "Chave indisponível";
                          const typeLabel = ({ cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Aleatória" } as Record<string, string>)[pk.key_type] || pk.key_type;
                          return (
                            <button
                              key={pk.id}
                              type="button"
                              onClick={() => setPickedKey(pk.id)}
                              className={cn(
                                "group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                                active
                                  ? "border-primary/60 bg-primary/[0.07]"
                                  : "border-border/60 bg-card hover:-translate-y-[1px] hover:border-primary/35 hover:bg-primary/[0.03]",
                              )}
                            >
                              <span className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
                                active ? "border-primary/45 bg-primary/[0.12] text-primary" : "border-border/60 bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-primary",
                              )}>
                                <Key className="h-4 w-4" strokeWidth={2.5} />
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                                    {typeLabel}
                                  </span>
                                  {active && <span className="text-[9px] font-black uppercase tracking-widest text-primary">Selecionada</span>}
                                </div>
                                <p className="break-all font-mono text-[12px] font-black leading-relaxed text-foreground">
                                  {label}
                                </p>
                              </div>
                              {active && <CheckCircle2 className="mt-2 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
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
              <table className="w-full min-w-[640px] text-left">
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
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                #{w.id.slice(0, 8).toUpperCase()}
                              </p>
                              {(w as any).origin === "auto" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                  Auto
                                </span>
                              )}
                            </div>
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
        <div className="flex flex-col gap-4 h-full">
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">


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
                          <p className="text-[11px] font-black text-foreground truncate">{pk.key_value ?? (pk as any).key_value_masked ?? "•••"}</p>
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

          <div className="flex-1 min-h-0 [&>*]:h-full">
            <AutoWithdrawalSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
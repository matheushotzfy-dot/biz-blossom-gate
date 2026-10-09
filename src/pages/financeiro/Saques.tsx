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
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DadosBancarios from "./DadosBancarios";
import AutoWithdrawalSettings from "@/components/financeiro/AutoWithdrawalSettings";
import { friendlyError } from "@/lib/friendlyError";
import { displayPixKey } from "@/lib/financial-input";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { WithdrawDestinationPicker, getPixKeyLabel, getPixKeyMeta } from "@/components/financeiro/WithdrawDestinationPicker";

const fmt = formatCurrency;

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

const QUICK_FILLS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "Tudo", pct: 1 },
] as const;

function StepLabel({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">{n}</span>
      {title}
    </h3>
  );
}

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

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
  const [balanceUnknown, setBalanceUnknown] = useState<boolean>(true);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);
  const [withdrawFee, setWithdrawFee] = useState<number>(DEFAULT_WITHDRAW_FEE);
  const [search, setSearch] = useState("");
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const invalidateAll = useInvalidateAll();

  const hasAddress = !!profile?.zip_code && !!profile?.street
    && !!profile?.street_number && !!profile?.city && !!profile?.state;

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    const fetchBalance = async () => {
      setBalanceUnknown(true);
      const { data, error } = await supabase.rpc("get_ledger_balance", { _user_id: user.id });
      if (ignore) return;
      if (error) {
        toast.error("Não foi possível carregar seu saldo disponível. Tente novamente.");
      } else if (data !== null) {
        setAvailableBalance(Number(data));
        setBalanceUnknown(false);
      }

      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select("retained_amount")
        .eq("user_id", user.id)
        .in("status", ["approved", "paid", "completed"])
        .eq("retention_released", false);
      if (ignore) return;
      if (txError) toast.error("Não foi possível carregar os valores retidos.");
      else if (tx) setRetainedAmount(tx.reduce((acc, t) => acc + Number(t.retained_amount || 0), 0));

      const { data: feeRows, error: feeError } = await supabase.rpc("get_platform_fees");
      if (ignore) return;
      if (feeError) {
        toast.error("Não foi possível carregar as taxas de saque.");
      } else {
        const feeRow = feeRows?.find((fee) => fee.name === "Taxa de Saque");
        if (feeRow?.value != null) setWithdrawFee(Number(feeRow.value));
      }
    };
    fetchBalance();
    return () => { ignore = true; };
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
    // Pre-select the first saved key so the seller never lands on an empty choice
    if (next && !pickedKey && pixKeys[0]?.id) setPickedKey(pixKeys[0].id);
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

    const payload: Record<string, unknown> = { amount: numAmount };
    if (pickedKey === "copy_paste") {
      payload.withdrawal_type = "pix_copy_paste";
      payload.pix_copy_paste_code = copyPasteCode.trim();
    } else {
      payload.withdrawal_type = "pix";
      payload.pix_key_id = pickedKey;
    }

    setPendingWithdrawal(payload);
    setReauthOpen(true);
  };

  const confirmWithdrawal = async (currentPassword: string) => {
    if (!pendingWithdrawal) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("sensitive-financial-action", {
      body: { action: "request_withdrawal", password: currentPassword, payload: pendingWithdrawal },
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error(data?.error || friendlyError(error));
      return;
    }
    toast.success("Solicitação enviada!");
    setReauthOpen(false);
    setPendingWithdrawal(null);
    setOpen(false);
    setAmount("");
    setCopyPasteCode("");
    setPickedKey("");
    invalidateAll(["withdrawals"]);
  };

  const parsedAmount = parseBRL(amount);
  const netPreview = parsedAmount > withdrawFee ? parsedAmount - withdrawFee : 0;

  // Human-readable summary of where the money is going (shown in the dialog footer)
  const destinationSummary = (() => {
    if (pickedKey === "copy_paste") {
      return copyPasteCode.trim() ? "PIX Copia e Cola · código avulso" : "Cole o código PIX Copia e Cola";
    }
    const key = pixKeys.find((k) => k.id === pickedKey);
    if (!key) return "Selecione uma chave PIX";
    return `${getPixKeyMeta(key.key_type).label} · ${getPixKeyLabel(key)}`;
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReauthenticationDialog
        open={reauthOpen}
        busy={submitting}
        onOpenChange={(nextOpen) => { setReauthOpen(nextOpen); if (!nextOpen) setPendingWithdrawal(null); }}
        onConfirm={confirmWithdrawal}
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Saques</h1>
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-2">
            <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
            Solicite a transferência dos seus lucros
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <button className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-semibold text-sm hover:opacity-90 transition-all flex items-center gap-2  ">
              <Plus size={18} strokeWidth={3} /> Solicitar Saque
            </button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[760px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-border bg-card p-0">
            <DialogHeader className="flex-row items-center gap-4 space-y-0 border-b border-border/60 px-6 py-5 text-left sm:px-8">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Wallet className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight">Solicitar saque</DialogTitle>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Transfira seu saldo disponível via Pix</p>
              </div>
              <div className="mr-8 hidden rounded-2xl border border-border/60 bg-background px-4 py-2 text-right sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Disponível</p>
                <p className="text-[15px] font-bold tabular-nums text-foreground">{fmt(availableBalance)}</p>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-6 px-6 py-6 sm:px-8 md:grid-cols-2">
                {/* 1 — Valor */}
                <section className="flex flex-col gap-3" aria-labelledby="saque-step-valor">
                  <StepLabel id="saque-step-valor" n={1} title="Quanto sacar" />
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      aria-label="Valor do saque"
                      value={amount}
                      onChange={(e) => setAmount(maskBRL(e.target.value))}
                      className="h-16 rounded-2xl border-primary/40 bg-primary/[0.05] pl-12 text-2xl font-bold tabular-nums"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_FILLS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        disabled={availableBalance <= withdrawFee}
                        onClick={() => setAmount(maskBRL(String(Math.floor(availableBalance * q.pct * 100))))}
                        className="h-9 rounded-xl border border-border/60 bg-background text-[12px] font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background px-4">
                    <div className="border-b border-border/50 py-2.5"><SummaryRow label="Valor solicitado" value={fmt(parsedAmount)} /></div>
                    <div className="border-b border-border/50 py-2.5"><SummaryRow label="Taxa de saque" value={`-${fmt(withdrawFee)}`} valueClass="text-destructive" /></div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-[12px] font-semibold text-muted-foreground">Você receberá</span>
                      <span className="text-2xl font-black tabular-nums text-success">{fmt(netPreview)}</span>
                    </div>
                  </div>
                </section>

                {/* 2 — Destino */}
                <section className="flex flex-col gap-3" aria-labelledby="saque-step-destino">
                  <StepLabel id="saque-step-destino" n={2} title="Para onde enviar" />
                  <WithdrawDestinationPicker
                    pixKeys={pixKeys}
                    pickedKey={pickedKey}
                    onPickKey={setPickedKey}
                    copyPasteCode={copyPasteCode}
                    onCopyPasteChange={setCopyPasteCode}
                  />
                </section>
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 border-t border-border/60 bg-background/60 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Destino</p>
                  <p className="truncate text-[13px] font-semibold text-foreground">{destinationSummary}</p>
                </div>
                <button
                  type="submit"
                  disabled={balanceUnknown}
                  className="h-14 w-full rounded-2xl bg-primary px-8 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none sm:w-auto sm:min-w-[260px]"
                >
                  {balanceUnknown
                    ? "Carregando saldo…"
                    : netPreview > 0
                    ? `Confirmar saque de ${fmt(parsedAmount)}`
                    : "Confirmar solicitação"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Saldos — carrossel com snap no mobile, grid no desktop */}
          <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 [&>*]:min-w-[82%] [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:min-w-0 md:[&>*]:shrink">
            <div className="bg-card p-5 sm:p-8 rounded-[20px] sm:rounded-[24px] border border-border/60 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Wallet size={16} />
                  <span className="text-[11px] font-semibold ">Saldo Disponível</span>
                </div>
                <p className="text-[30px] sm:text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(availableBalance)}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Wallet size={160} />
              </div>
            </div>
            <div className="bg-card p-5 sm:p-8 rounded-[20px] sm:rounded-[24px] border border-border/60 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Clock size={16} />
                  <span className="text-[11px] font-semibold ">Aguardando Liberação</span>
                </div>
                <p className="text-[30px] sm:text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(retainedAmount)}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Clock size={160} />
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-card rounded-[24px] border border-border/60  overflow-hidden">
            <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <History size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground tracking-tight leading-none ">Histórico</h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-1">Ultimos registros</p>
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

            {/* Lista mobile — linhas amplas, alvo de toque confortável */}
            <div className="divide-y divide-border/40 md:hidden">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-14 opacity-40">
                  <History size={40} strokeWidth={1} />
                  <p className="text-[12px] font-semibold">Sem saques registrados</p>
                </div>
              ) : (
                filtered.map((w) => {
                  const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={w.id} className="flex items-center gap-3 px-4 py-4 active:bg-muted/25">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50", status.bg, status.color)}>
                        <History className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-mono text-[11px] font-bold text-muted-foreground">
                            #{w.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="shrink-0 text-[14px] font-black tabular-nums tracking-tight text-foreground">
                            {fmt(Number(w.amount))}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-medium text-muted-foreground/60">
                            {format(new Date(w.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", status.bg, status.color)}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="bg-muted/30 text-[11px] font-semibold text-muted-foreground/60 border-b border-border/40">
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
                          <p className="text-[11px] font-semibold text-destructive">Falha ao carregar histórico</p>
                          <button
                            onClick={() => refetchWithdrawals()}
                            className="px-4 py-2 bg-primary text-primary-foreground text-[11px] font-semibold rounded-lg hover:bg-primary/90 transition-colors"
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
                          <p className="mt-4 text-[11px] font-semibold ">Sem saques registrados</p>
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
                              {w.origin === "auto" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                  Auto
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-medium text-muted-foreground/50 mt-1 ">
                              {format(new Date(w.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center">
                              <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border", status.bg, status.color, "border-current/10")}>
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
          <div className="bg-card rounded-[24px] border border-border/60  overflow-hidden">


            <div className="p-6 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Building2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground tracking-tight leading-none ">Destino</h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-1">Configurações</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Simplified PIX Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <Key size={12} className="text-primary" /> Chaves PIX
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground/40">{pixKeys.length}/3</span>
                </div>
                
                {pixKeys.length === 0 ? (
                  <div className="p-4 rounded-[12px] bg-muted/30 border border-dashed border-border/60 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground/60 ">Nenhuma chave</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pixKeys.slice(0, 2).map((pk) => (
                      <div key={pk.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between group">
                        <div className="min-w-0">
                          <p className="break-all text-[11px] font-black text-foreground">{displayPixKey(pk.key_value, pk.key_type, (pk as { key_value_masked?: string | null }).key_value_masked)}</p>
                          <p className="text-[11px] font-medium text-muted-foreground/60 ">{pk.key_type}</p>
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
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <Building2 size={12} className="text-primary" /> Contas
                  </span>
                </div>
                
                {bankAccounts.length === 0 ? (
                  <div className="p-4 rounded-[12px] bg-muted/30 border border-dashed border-border/60 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground/60 ">Nenhuma conta</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bankAccounts.slice(0, 1).map((acc) => (
                      <div key={acc.id} className="p-3 rounded-xl bg-muted/30 border border-border/60 group">
                        <p className="text-[11px] font-semibold text-foreground truncate ">{acc.bank_name}</p>
                        <p className="text-[11px] font-medium text-muted-foreground/60 mt-0.5">Ag {acc.agency} · CC {(acc as any).account_number_masked ?? acc.account_number ?? "••••"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <button className="w-full h-11 rounded-xl bg-muted/50 border border-border/60 text-[11px] font-semibold text-foreground hover:bg-muted transition-all">
                    Gerenciar Dados Bancários
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-background border-border/60 p-0 overflow-hidden rounded-[14px]">
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
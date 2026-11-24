import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useWithdrawals, usePixKeys, useBankAccounts, useInvalidateAll } from "@/hooks/useQueryData";
import { ArrowDownToLine, Building2, ChevronRight, Eye, EyeOff, Landmark, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AutoWithdrawalSettings from "@/components/financeiro/AutoWithdrawalSettings";
import { friendlyError } from "@/lib/friendlyError";
import { displayPixKey } from "@/lib/financial-input";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { WithdrawDestinationPicker, getPixKeyLabel, getPixKeyMeta } from "@/components/financeiro/WithdrawDestinationPicker";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { Pager } from "@/components/seller-ui/Pager";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { StatusPill } from "@/components/seller-ui/tx";
import type { TxTone } from "@/components/seller-ui/txMeta";

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
const PAGE_SIZE = 8;

const QUICK_FILLS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "Tudo", pct: 1 },
] as const;

type StatusKey = "approved" | "pending" | "rejected";
const STATUS: Record<StatusKey, { label: string; tone: TxTone }> = {
  approved: { label: "Concluído", tone: "ok" },
  pending: { label: "Pendente", tone: "wait" },
  rejected: { label: "Recusado", tone: "alert" },
};
// Qualquer status desconhecido é tratado como pendente, como sempre foi.
const statusKey = (s: string): StatusKey => (s in STATUS ? (s as StatusKey) : "pending");

function StepLabel({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2.5 text-[15px] font-bold text-foreground">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-accent-foreground">{n}</span>
      {title}
    </h3>
  );
}

export default function Saques() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { hidden, toggle: togglePrivacy } = usePrivacyMode();
  const navigate = useNavigate();
  const { data: withdrawals = [], isLoading: withdrawalsLoading, isError: withdrawalsError, refetch: refetchWithdrawals } = useWithdrawals();
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
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [page, setPage] = useState(1);
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

      // O banco cobra a taxa personalizada quando ela existe (enforce_withdrawal_fee). O resumo mostra a mesma.
      const { data: customFee } = await supabase.from("custom_user_fees").select("withdrawal_fee").eq("user_id", user.id).maybeSingle();
      if (ignore) return;
      if (customFee?.withdrawal_fee != null) setWithdrawFee(Number(customFee.withdrawal_fee));
    };
    fetchBalance();
    return () => { ignore = true; };
  }, [user?.id]);

  const counts = useMemo(() => {
    const c: Record<StatusKey | "all", number> = { all: withdrawals.length, approved: 0, pending: 0, rejected: 0 };
    for (const w of withdrawals) c[statusKey(w.status)] += 1;
    return c;
  }, [withdrawals]);

  const inReview = useMemo(
    () => withdrawals.filter((w) => statusKey(w.status) === "pending").reduce((acc, w) => acc + Number(w.amount || 0), 0),
    [withdrawals],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusFilter !== "all" && statusKey(w.status) !== statusFilter) return false;
      return !q || w.id.toLowerCase().includes(q) || fmt(Number(w.amount)).includes(q);
    });
  }, [withdrawals, search, statusFilter]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      return copyPasteCode.trim() ? "Pix Copia e Cola, código avulso" : "Cole o código Pix Copia e Cola";
    }
    const key = pixKeys.find((k) => k.id === pickedKey);
    if (!key) return "Selecione uma chave PIX";
    return `${getPixKeyMeta(key.key_type).label}: ${getPixKeyLabel(key)}`;
  })();

  const requestWithdrawal = () => handleOpenChange(true);

  return (
    <div className="space-y-6 pb-10">
      <ReauthenticationDialog
        open={reauthOpen}
        busy={submitting}
        onOpenChange={(nextOpen) => { setReauthOpen(nextOpen); if (!nextOpen) setPendingWithdrawal(null); }}
        onConfirm={confirmWithdrawal}
      />
      <SectionTabs section="money" />
      <PageHead title="Saldo e saques" subtitle="Veja quanto já é seu, quanto está a caminho e peça o saque por Pix." />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-[780px] gap-0 overflow-y-auto rounded-[28px] border-border bg-card p-0">
          <DialogHeader className="flex-row items-center gap-4 space-y-0 border-b border-border px-6 py-5 text-left sm:px-8">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <ArrowDownToLine className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-[22px] font-extrabold tracking-[-0.03em]">Solicitar saque</DialogTitle>
              <DialogDescription className="mt-0.5 text-[14px] text-muted-foreground">O dinheiro sai do seu saldo disponível, por Pix.</DialogDescription>
            </div>
            <div className="mr-8 hidden rounded-2xl bg-accent px-4 py-2 text-right sm:block">
              <p className="text-[12.5px] font-semibold text-accent-foreground/80">Disponível</p>
              <Money value={availableBalance} hidden={hidden} className="text-[18px] font-extrabold text-accent-foreground" />
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-7 px-6 py-6 sm:px-8 md:grid-cols-2">
              <section className="flex flex-col gap-3.5" aria-labelledby="saque-step-valor">
                <StepLabel id="saque-step-valor" n={1} title="Quanto sacar" />
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Valor do saque"
                    value={amount}
                    onChange={(e) => setAmount(maskBRL(e.target.value))}
                    className="vp-field vp-field-lg"
                    placeholder="0,00"
                  />
                </div>
                <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                  {QUICK_FILLS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      disabled={availableBalance <= withdrawFee}
                      onClick={() => setAmount(maskBRL(String(Math.floor(availableBalance * q.pct * 100))))}
                      className="vp-pill justify-center border border-border bg-background disabled:pointer-events-none disabled:opacity-40"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <dl className="rounded-2xl bg-muted/60 px-4">
                  <div className="flex items-center justify-between py-3 text-[14px]">
                    <dt className="text-muted-foreground">Valor solicitado</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{fmt(parsedAmount)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border py-3 text-[14px]">
                    <dt className="text-muted-foreground">Taxa de saque</dt>
                    <dd className="font-semibold tabular-nums text-destructive">−{fmt(withdrawFee)}</dd>
                  </div>
                  <div className="flex items-end justify-between border-t border-border py-4">
                    <dt className="text-[14px] font-semibold text-foreground">Você recebe</dt>
                    <dd><Money value={netPreview} className="vp-green-ink text-[28px] font-extrabold leading-none tracking-[-0.04em]" /></dd>
                  </div>
                </dl>
              </section>

              <section className="flex flex-col gap-3.5" aria-labelledby="saque-step-destino">
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

            <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-card px-6 py-4 shadow-[0_-12px_24px_-18px_hsl(222_47%_11%/.25)] sm:flex-row sm:items-center sm:px-8 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-muted-foreground">Destino</p>
                <p className="truncate text-[14px] font-bold text-foreground">{destinationSummary}</p>
              </div>
              <button type="submit" disabled={balanceUnknown} className="vp-cta h-[52px] w-full sm:w-auto sm:min-w-[260px]">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_372px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="vp-bal flex flex-col p-6 sm:p-8" aria-label="Saldo disponível">
            <span aria-hidden className="vp-bal-ring" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-white/85">Disponível para saque</p>
              <button onClick={togglePrivacy} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} aria-pressed={hidden} className="vp-bal-eye">
                {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>

            {balanceUnknown ? (
              <span aria-label="Carregando saldo" className="mt-4 block h-[52px] w-64 rounded-2xl bg-white/20 motion-safe:animate-pulse sm:h-[62px]" />
            ) : (
              <Money value={Math.max(availableBalance, 0)} hidden={hidden} className="mt-3 block text-[46px] font-extrabold leading-none tracking-[-0.045em] sm:text-[64px]" centsClassName="opacity-70" />
            )}

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <p className="text-[12.5px] text-white/75">Aguardando liberação</p>
                <Money value={retainedAmount} hidden={hidden} className="text-[17px] font-bold" centsClassName="opacity-75" />
              </div>
              {inReview > 0 && (
                <div className="border-white/25 sm:border-l sm:pl-8">
                  <p className="text-[12.5px] text-white/75">Saques em análise</p>
                  <Money value={inReview} hidden={hidden} className="text-[17px] font-bold" centsClassName="opacity-75" />
                </div>
              )}
              <div className="border-white/25 sm:border-l sm:pl-8">
                <p className="text-[12.5px] text-white/75">Taxa por saque</p>
                <p className="vp-num text-[17px] font-bold">{fmt(withdrawFee)}</p>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2.5 pt-8">
              <button onClick={requestWithdrawal} className="vp-bal-btn vp-bal-btn-main flex-1 justify-center sm:flex-none"><ArrowDownToLine className="h-[18px] w-[18px]" strokeWidth={2.2} />Solicitar saque</button>
              <Link to="/financeiro/config" className="vp-bal-btn vp-bal-btn-ghost flex-1 justify-center sm:flex-none"><Landmark className="h-[18px] w-[18px]" strokeWidth={2.2} />Dados bancários</Link>
            </div>
          </section>

          {!profileLoading && profile && !hasAddress && (
            <div role="status" className="flex items-start gap-3.5 rounded-2xl bg-warning/15 p-4 sm:items-center sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/20 text-warning"><MapPin className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-foreground">Falta o seu endereço para sacar</p>
                <p className="text-[13.5px] text-muted-foreground">Preencha o endereço no perfil para liberar os saques.</p>
              </div>
              <Link to="/perfil?focus=address" className="vp-ghost shrink-0">Completar</Link>
            </div>
          )}

          <section className="vp-sheet overflow-hidden" aria-label="Histórico de saques">
            <div className="flex flex-col gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-heading text-[20px] font-extrabold tracking-[-0.03em] text-foreground">Histórico de saques</h2>
                <p className="mt-0.5 text-[14px] text-muted-foreground">Cada pedido com status e valor líquido.</p>
              </div>
              <SearchField className="lg:w-72" label="Buscar saque" placeholder="Buscar por ID ou valor" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
            </div>
            <div className="px-4 sm:px-5">
              <FilterPills
                label="Filtrar por status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
                options={[
                  { value: "all", label: "Todos", count: counts.all },
                  { value: "approved", label: "Concluídos", count: counts.approved },
                  { value: "pending", label: "Pendentes", count: counts.pending },
                  { value: "rejected", label: "Recusados", count: counts.rejected },
                ]}
              />
            </div>

            <div className="mt-2 border-t border-border">
              {withdrawalsLoading ? (
                <div className="space-y-3 p-5 sm:p-6" aria-busy="true" aria-label="Carregando saques">
                  {[0, 1, 2].map((i) => <span key={i} className="vp-skel block h-14 w-full" />)}
                </div>
              ) : withdrawalsError ? (
                <EmptyPanel
                  title="Não deu para carregar o histórico"
                  text="Confira sua conexão e tente de novo. Seus saques continuam seguros."
                  action={<button onClick={() => refetchWithdrawals()} className="vp-ghost">Tentar de novo</button>}
                />
              ) : filtered.length === 0 ? (
                withdrawals.length === 0 ? (
                  <EmptyPanel
                    icon={<ArrowDownToLine className="h-7 w-7" />}
                    title="Nenhum saque ainda"
                    text="Quando você pedir o primeiro saque, ele aparece aqui com o status e o valor líquido."
                    action={<button onClick={requestWithdrawal} className="vp-cta">Solicitar saque</button>}
                  />
                ) : (
                  <EmptyPanel
                    title="Nada com esse filtro"
                    text="Tente outro status ou apague a busca."
                    action={<button onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }} className="vp-ghost">Limpar filtros</button>}
                  />
                )
              ) : (
                <ul className="divide-y divide-border">
                  {pageItems.map((w) => {
                    const st = STATUS[statusKey(w.status)];
                    return (
                      <li key={w.id} className="flex items-center gap-3.5 px-5 py-4 sm:gap-4 sm:px-6">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><ArrowDownToLine className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-foreground">Saque #{w.id.slice(0, 8).toUpperCase()}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                            {format(new Date(w.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {w.origin === "auto" && <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-foreground">Automático</span>}
                          </p>
                        </div>
                        <StatusPill label={st.label} tone={st.tone} className="hidden sm:inline-flex" />
                        <div className="flex flex-col items-end gap-1.5 text-right sm:w-[150px] sm:gap-0.5">
                          <Money value={Number(w.amount)} hidden={hidden} className="text-[17px] font-extrabold text-foreground" centsClassName="opacity-70" />
                          <p className="text-[13px] text-muted-foreground">Líquido <Money value={Number(w.net_amount)} hidden={hidden} className="font-semibold text-foreground" /></p>
                          <StatusPill label={st.label} tone={st.tone} className="sm:hidden" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {!withdrawalsLoading && !withdrawalsError && <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />}
          </section>
        </div>

        <aside className="min-w-0 space-y-4" aria-label="Destino e automação">
          <section className="vp-sheet overflow-hidden">
            <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <h2 className="font-heading text-[19px] font-extrabold tracking-[-0.03em] text-foreground">Destino dos saques</h2>
              <p className="mt-0.5 text-[14px] text-muted-foreground">O dinheiro sai por Pix, para uma das suas chaves.</p>
            </div>

            <div className="border-t border-border px-5 py-4 sm:px-6">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-foreground">Chaves Pix</h3>
                <span className="text-[13px] tabular-nums text-muted-foreground">{pixKeys.length} de 3</span>
              </div>
              {pixKeys.length === 0 ? (
                <Link to="/financeiro/config" className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                  Cadastrar a primeira chave
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              ) : (
                <ul className="space-y-2">
                  {pixKeys.map((pk) => {
                    const meta = getPixKeyMeta(pk.key_type);
                    return (
                      <li key={pk.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><meta.icon className="h-[18px] w-[18px]" /></span>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-muted-foreground">{meta.label}</p>
                          <p className="truncate text-[14px] font-bold text-foreground" title={displayPixKey(pk.key_value, pk.key_type, (pk as { key_value_masked?: string | null }).key_value_masked)}>{displayPixKey(pk.key_value, pk.key_type, (pk as { key_value_masked?: string | null }).key_value_masked)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border px-5 py-4 sm:px-6">
              <h3 className="mb-2.5 text-[13.5px] font-bold text-foreground">Conta bancária</h3>
              {bankAccounts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-3.5 text-[14px] text-muted-foreground">Nenhuma conta cadastrada.</p>
              ) : (
                <ul className="space-y-2">
                  {bankAccounts.slice(0, 1).map((acc) => (
                    <li key={acc.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Building2 className="h-[18px] w-[18px]" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-foreground">{acc.bank_name}</p>
                        <p className="text-[13px] tabular-nums text-muted-foreground">Ag {acc.agency}, conta {(acc as { account_number_masked?: string | null }).account_number_masked ?? acc.account_number ?? "••••"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border p-4 sm:p-5">
              <Link to="/financeiro/config" className="vp-ghost w-full">Gerenciar dados bancários</Link>
            </div>
          </section>

          <AutoWithdrawalSettings />
        </aside>
      </div>
    </div>
  );
}

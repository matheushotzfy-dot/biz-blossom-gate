import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import { Building2, Plus, Trash2, Key, User, Mail, Phone, Hash, Shuffle, Landmark, PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { BankCombobox } from "@/components/ui/bank-combobox";
import { toast } from "sonner";
import {
  bankAccountSchema,
  pixKeySchema,
  flattenZodErrors,
  type FieldErrors,
} from "@/lib/validation";
import { InlineError } from "@/components/ui/inline-error";
import { friendlyError } from "@/lib/friendlyError";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { detectPixKeyType, displayPixKey, formatPixKey, maskAccount, maskAgency, maskDocument } from "@/lib/financial-input";
import { getPixKeyMeta } from "@/components/financeiro/WithdrawDestinationPicker";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Avatar } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";

const MAX_PIX_KEYS = 3;

const PIX_TYPES = [
  { value: "cpf" as const, label: "CPF", description: "Documento pessoal", icon: User },
  { value: "cnpj" as const, label: "CNPJ", description: "Documento empresarial", icon: Hash },
  { value: "email" as const, label: "E-mail", description: "Endereço cadastrado", icon: Mail },
  { value: "phone" as const, label: "Telefone", description: "Celular com DDD", icon: Phone },
  { value: "random" as const, label: "Aleatória", description: "Chave gerada", icon: Shuffle },
];

const PIX_PLACEHOLDER: Record<string, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "voce@email.com",
  phone: "(00) 00000-0000",
  random: "Cole a chave aleatória",
};

const ACCOUNT_TYPES = [
  { value: "corrente" as const, label: "Conta corrente", description: "Movimentação diária", icon: Landmark },
  { value: "poupanca" as const, label: "Poupança", description: "Conta de rendimento", icon: PiggyBank },
];

type PixForm = { key_type: "cpf" | "cnpj" | "email" | "phone" | "random"; key_value: string };
type BankForm = {
  bank_name: string; bank_code: string; agency: string; account_number: string;
  account_type: "corrente" | "poupanca"; holder_name: string; holder_document: string;
};

const labelClass = "text-[13.5px] font-semibold text-foreground";
const iconButton = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40";
const dialogClass = "w-[calc(100vw-1.5rem)] max-w-xl max-h-[90dvh] gap-0 overflow-hidden rounded-[28px] border-border bg-card p-0";

export default function DadosBancarios() {
  const { user } = useAuth();
  const { data: accounts = [] } = useBankAccounts();
  const { data: pixKeys = [] } = usePixKeys();
  const invalidateAll = useInvalidateAll();

  const [pixOpen, setPixOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; payload: Record<string, unknown>; onSuccess: () => void } | null>(null);
  const [toRemove, setToRemove] = useState<{ kind: "pix" | "bank"; id: string; name: string } | null>(null);

  const [pixForm, setPixForm] = useState<PixForm>({ key_type: "cpf", key_value: "" });
  const [pixErrors, setPixErrors] = useState<FieldErrors<PixForm>>({});

  const [bankForm, setBankForm] = useState<BankForm>({
    bank_name: "", bank_code: "", agency: "", account_number: "",
    account_type: "corrente", holder_name: "", holder_document: "",
  });
  const [bankErrors, setBankErrors] = useState<FieldErrors<BankForm>>({});

  const handleAddPix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = pixKeySchema.safeParse(pixForm);
    if (!parsed.success) {
      const errs = flattenZodErrors<PixForm>(parsed.error);
      setPixErrors(errs);
      toast.error(Object.values(errs)[0] || "Verifique os campos");
      return;
    }
    setPixErrors({});
    setPendingAction({
      action: "add_pix_key",
      payload: { key_type: parsed.data.key_type, key_value: parsed.data.key_value.trim() },
      onSuccess: () => {
        toast.success("Chave Pix adicionada");
        setPixForm({ key_type: "cpf", key_value: "" });
        setPixOpen(false);
        invalidateAll(["pix_keys"]);
      },
    });
    setReauthOpen(true);
  };

  const handleDeletePix = (id: string) => {
    if (!user) return;
    setPendingAction({ action: "delete_pix_key", payload: { id }, onSuccess: () => {
      toast.success("Chave removida");
      invalidateAll(["pix_keys"]);
    } });
    setReauthOpen(true);
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = bankAccountSchema.safeParse(bankForm);
    if (!parsed.success) {
      const errs = flattenZodErrors<BankForm>(parsed.error);
      setBankErrors(errs);
      toast.error(Object.values(errs)[0] || "Verifique os campos");
      return;
    }
    setBankErrors({});
    setPendingAction({
      action: "add_bank_account",
      payload: {
      bank_name: parsed.data.bank_name,
      bank_code: parsed.data.bank_code || null,
      agency: parsed.data.agency,
      account_number: parsed.data.account_number,
      account_type: parsed.data.account_type,
      holder_name: parsed.data.holder_name,
      holder_document: parsed.data.holder_document.replace(/\D/g, ""),
      },
      onSuccess: () => {
        toast.success("Conta bancária adicionada");
        setBankForm({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
        setBankOpen(false);
        invalidateAll(["bank_accounts"]);
      },
    });
    setReauthOpen(true);
  };

  const handleDeleteBank = (id: string) => {
    if (!user) return;
    setPendingAction({ action: "delete_bank_account", payload: { id }, onSuccess: () => {
      toast.success("Conta removida");
      invalidateAll(["bank_accounts"]);
    } });
    setReauthOpen(true);
  };

  // Remover pede duas confirmações: esta (o que será removido) e depois a senha.
  const confirmRemove = () => {
    if (!toRemove) return;
    if (toRemove.kind === "pix") handleDeletePix(toRemove.id);
    else handleDeleteBank(toRemove.id);
    setToRemove(null);
  };

  const confirmSensitiveAction = async (currentPassword: string) => {
    if (!pendingAction) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("sensitive-financial-action", {
      body: { action: pendingAction.action, password: currentPassword, payload: pendingAction.payload },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error || friendlyError(error, "Não foi possível concluir a operação"));
      return;
    }
    pendingAction.onSuccess();
    setPendingAction(null);
    setReauthOpen(false);
  };

  const clearPixError = (field: keyof PixForm) => {
    if (pixErrors[field]) setPixErrors((p) => ({ ...p, [field]: undefined }));
  };
  const clearBankError = (field: keyof BankForm) => {
    if (bankErrors[field]) setBankErrors((p) => ({ ...p, [field]: undefined }));
  };

  const pixFull = pixKeys.length >= MAX_PIX_KEYS;

  return (
    <div className="space-y-6 pb-10">
      <ReauthenticationDialog
        open={reauthOpen}
        busy={busy}
        onOpenChange={(open) => { setReauthOpen(open); if (!open) setPendingAction(null); }}
        onConfirm={confirmSensitiveAction}
      />
      <SectionTabs section="money" />
      <PageHead
        title="Dados bancários"
        subtitle="Chaves Pix e contas para receber seus saques. Qualquer mudança aqui pede a sua senha."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Chaves Pix */}
        <section className="vp-sheet overflow-hidden" aria-label="Chaves Pix">
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <h2 className="font-heading text-[20px] font-extrabold tracking-[-0.03em] text-foreground">Chaves Pix</h2>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                {pixKeys.length} de {MAX_PIX_KEYS} cadastradas. Os saques saem por elas.
              </p>
              <div className="mt-3 flex gap-1.5" aria-hidden>
                {Array.from({ length: MAX_PIX_KEYS }, (_, i) => (
                  <span key={i} className={cn("h-1.5 w-9 rounded-full", i < pixKeys.length ? "bg-primary" : "bg-muted")} />
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setPixOpen(true)} disabled={pixFull} className="vp-cta h-10 shrink-0 px-4 text-[13.5px]">
              <Plus className="h-4 w-4" strokeWidth={2.6} />Nova chave
            </button>
          </div>

          {pixKeys.length === 0 ? (
            <div className="border-t border-border">
              <EmptyPanel
                icon={<Key className="h-7 w-7" />}
                title="Nenhuma chave Pix ainda"
                text="Cadastre a chave que vai receber seus saques. Você pode ter até 3."
                action={<button type="button" onClick={() => setPixOpen(true)} className="vp-cta">Cadastrar chave Pix</button>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {pixKeys.map((pk) => {
                const meta = getPixKeyMeta(pk.key_type);
                const shown = displayPixKey(pk.key_value, pk.key_type, (pk as { key_value_masked?: string | null }).key_value_masked);
                return (
                  <li key={pk.id} className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><meta.icon className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-muted-foreground">{meta.label}</p>
                      <p className="break-all text-[15px] font-bold text-foreground">{shown}</p>
                    </div>
                    <button type="button" aria-label={`Remover chave ${meta.label}`} onClick={() => setToRemove({ kind: "pix", id: pk.id, name: shown })} className={iconButton}>
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {pixFull && <p className="border-t border-border px-5 py-3.5 text-[13.5px] text-muted-foreground sm:px-6">Você chegou ao limite de {MAX_PIX_KEYS} chaves. Remova uma para cadastrar outra.</p>}
        </section>

        {/* Contas bancárias */}
        <section className="vp-sheet overflow-hidden" aria-label="Contas bancárias">
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <h2 className="font-heading text-[20px] font-extrabold tracking-[-0.03em] text-foreground">Contas bancárias</h2>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                {accounts.length === 0 ? "Nenhuma conta cadastrada." : accounts.length === 1 ? "1 conta cadastrada." : `${accounts.length} contas cadastradas.`}
              </p>
            </div>
            <button type="button" onClick={() => setBankOpen(true)} className="vp-cta h-10 shrink-0 px-4 text-[13.5px]">
              <Plus className="h-4 w-4" strokeWidth={2.6} />Nova conta
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="border-t border-border">
              <EmptyPanel
                icon={<Building2 className="h-7 w-7" />}
                title="Nenhuma conta bancária ainda"
                text="Guarde os dados da conta em que você recebe. Os saques continuam saindo por Pix."
                action={<button type="button" onClick={() => setBankOpen(true)} className="vp-cta">Cadastrar conta</button>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {accounts.map((acc) => (
                <li key={acc.id} className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
                  <Avatar name={acc.bank_name} ok={!!acc.is_primary} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[15px] font-bold text-foreground">
                      <span className="truncate">{acc.bank_name}</span>
                      {acc.is_primary && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-foreground">Principal</span>}
                    </p>
                    <p className="text-[13.5px] tabular-nums text-muted-foreground">
                      Agência {acc.agency}, {acc.account_type === "poupanca" ? "poupança" : "conta corrente"} {(acc as { account_number_masked?: string | null }).account_number_masked ?? "••••"}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">{acc.holder_name}</p>
                  </div>
                  <button type="button" aria-label={`Remover conta ${acc.bank_name}`} onClick={() => setToRemove({ kind: "bank", id: acc.id, name: acc.bank_name })} className={iconButton}>
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Nova chave Pix */}
      <Dialog open={pixOpen} onOpenChange={(o) => { setPixOpen(o); if (!o) setPixErrors({}); }}>
        <DialogContent className={dialogClass}>
          <div className="overflow-y-auto p-6 sm:p-8">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-heading text-[22px] font-extrabold tracking-[-0.03em]">Nova chave Pix</DialogTitle>
              <DialogDescription className="text-[14px] text-muted-foreground">Escolha o tipo e digite a chave. Vamos pedir sua senha para salvar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPix} className="mt-6 space-y-5" noValidate>
              <div className="space-y-2.5">
                <Label className={labelClass}>Tipo de chave</Label>
                <SegmentedChoice
                  value={pixForm.key_type}
                  onValueChange={(v) => { setPixForm({ ...pixForm, key_type: v }); clearPixError("key_value"); }}
                  options={PIX_TYPES}
                  columns={2}
                  size="sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pix-key-input" className={labelClass}>Chave</Label>
                <Input
                  id="pix-key-input"
                  value={pixForm.key_value}
                  onChange={(e) => {
                    // Tipo escolhido manualmente como aleatória/e-mail é respeitado:
                    // nunca troca para celular/CPF ao colar ou digitar.
                    const locked = pixForm.key_type === "random" || pixForm.key_type === "email";
                    const detected = locked ? null : detectPixKeyType(e.target.value);
                    const nextType = detected ?? pixForm.key_type;
                    setPixForm({ key_type: nextType, key_value: formatPixKey(e.target.value, nextType) });
                    clearPixError("key_value");
                  }}
                  placeholder={PIX_PLACEHOLDER[pixForm.key_type]}
                  inputMode={pixForm.key_type === "email" || pixForm.key_type === "random" ? "text" : "numeric"}
                  autoComplete={pixForm.key_type === "email" ? "email" : pixForm.key_type === "phone" ? "tel" : "off"}
                  aria-invalid={!!pixErrors.key_value}
                  aria-describedby={pixErrors.key_value ? "pix-key-error" : undefined}
                  className="vp-field"
                />
                <InlineError id="pix-key-error" message={pixErrors.key_value} />
              </div>
              <button type="submit" disabled={busy} className="vp-cta h-[52px] w-full">
                {busy ? "Adicionando…" : "Adicionar chave Pix"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova conta bancária */}
      <Dialog open={bankOpen} onOpenChange={(o) => { setBankOpen(o); if (!o) setBankErrors({}); }}>
        <DialogContent className={dialogClass}>
          <div className="overflow-y-auto p-6 sm:p-8">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-heading text-[22px] font-extrabold tracking-[-0.03em]">Nova conta bancária</DialogTitle>
              <DialogDescription className="text-[14px] text-muted-foreground">Use uma conta no seu nome ou da sua empresa. Vamos pedir sua senha para salvar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddBank} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label className={labelClass}>Banco</Label>
                <BankCombobox
                  bankName={bankForm.bank_name}
                  bankCode={bankForm.bank_code}
                  onSelect={(b) => {
                    setBankForm({ ...bankForm, bank_name: b.name, bank_code: b.code });
                    clearBankError("bank_name");
                    clearBankError("bank_code");
                  }}
                  onBankNameChange={(name) => {
                    setBankForm((f) => ({ ...f, bank_name: name }));
                    clearBankError("bank_name");
                  }}
                  invalid={!!bankErrors.bank_name}
                />
                <InlineError message={bankErrors.bank_name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bank-agency" className={labelClass}>Agência</Label>
                  <Input
                    id="bank-agency"
                    value={bankForm.agency}
                    onChange={(e) => { setBankForm({ ...bankForm, agency: maskAgency(e.target.value) }); clearBankError("agency"); }}
                    placeholder="0001"
                    inputMode="numeric"
                    maxLength={7}
                    aria-invalid={!!bankErrors.agency}
                    className="vp-field"
                  />
                  <InlineError message={bankErrors.agency} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-account" className={labelClass}>Conta</Label>
                  <Input
                    id="bank-account"
                    value={bankForm.account_number}
                    onChange={(e) => { setBankForm({ ...bankForm, account_number: maskAccount(e.target.value) }); clearBankError("account_number"); }}
                    placeholder="12345-6"
                    inputMode="numeric"
                    maxLength={18}
                    aria-invalid={!!bankErrors.account_number}
                    className="vp-field"
                  />
                  <InlineError message={bankErrors.account_number} />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className={labelClass}>Tipo de conta</Label>
                <SegmentedChoice
                  value={bankForm.account_type}
                  onValueChange={(v) => setBankForm({ ...bankForm, account_type: v })}
                  options={ACCOUNT_TYPES}
                  columns={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-holder" className={labelClass}>Nome do titular</Label>
                <Input
                  id="bank-holder"
                  value={bankForm.holder_name}
                  onChange={(e) => { setBankForm({ ...bankForm, holder_name: e.target.value }); clearBankError("holder_name"); }}
                  autoComplete="name"
                  aria-invalid={!!bankErrors.holder_name}
                  className="vp-field"
                />
                <InlineError message={bankErrors.holder_name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-document" className={labelClass}>CPF ou CNPJ do titular</Label>
                <Input
                  id="bank-document"
                  value={bankForm.holder_document}
                  onChange={(e) => { setBankForm({ ...bankForm, holder_document: maskDocument(e.target.value) }); clearBankError("holder_document"); }}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={18}
                  aria-invalid={!!bankErrors.holder_document}
                  className="vp-field"
                />
                <InlineError message={bankErrors.holder_document} />
              </div>
              <button type="submit" disabled={busy} className="vp-cta mt-2 h-[52px] w-full">
                {busy ? "Salvando…" : "Salvar conta bancária"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção */}
      <AlertDialog open={!!toRemove} onOpenChange={(o) => { if (!o) setToRemove(null); }}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">
              {toRemove?.kind === "pix" ? "Remover esta chave Pix?" : "Remover esta conta bancária?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed">
              <span className="block break-all font-semibold text-foreground">{toRemove?.name}</span>
              Na próxima etapa vamos pedir a sua senha para concluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="vp-ghost m-0 h-11 border-border">Manter</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="vp-cta vp-cta-danger h-11">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import { Building2, Plus, Trash2, Key, User, Mail, Phone, Hash, Shuffle, Landmark, PiggyBank } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, ChoiceGrid, DialogBody, DialogFoot, DialogHead, FieldLabel, FormField, chipTone, dialogBox } from "@/components/seller-ui/form";
import { ConfirmDialog } from "@/components/seller-ui/confirm";
import { BankCombobox } from "@/components/ui/bank-combobox";
import { toast } from "sonner";
import {
  bankAccountSchema,
  pixKeySchema,
  flattenZodErrors,
  type FieldErrors,
} from "@/lib/validation";
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

const PIX_HINT: Record<string, string> = {
  cpf: "Só números; formatamos para você.",
  cnpj: "Só números; formatamos para você.",
  email: "O e-mail que está cadastrado como chave no seu banco.",
  phone: "Celular com DDD, o mesmo cadastrado como chave.",
  random: "Cole a chave aleatória que o seu banco gerou.",
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

const iconButton = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40";

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
        <DialogContent className={dialogBox("md")}>
          <DialogHead icon={<Key className="h-5 w-5" />} title="Nova chave Pix" subtitle="Escolha o tipo e digite a chave. Vamos pedir sua senha para salvar." />
          <form onSubmit={handleAddPix} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <div>
                <FieldLabel>Tipo de chave</FieldLabel>
                <div role="radiogroup" aria-label="Tipo de chave" className="flex flex-wrap gap-2">
                  {PIX_TYPES.map((t) => (
                    <ChoiceChip key={t.value} active={pixForm.key_type === t.value} onClick={() => { setPixForm({ ...pixForm, key_type: t.value }); clearPixError("key_value"); }} className={chipTone(pixForm.key_type === t.value)}>
                      <t.icon className="h-4 w-4" />{t.label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
              <FormField id="pix-key-input" label="Chave" error={pixErrors.key_value} hint={PIX_HINT[pixForm.key_type]}>
                <input
                  id="pix-key-input"
                  className="vp-field"
                  value={pixForm.key_value}
                  autoFocus
                  spellCheck={false}
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
                  aria-invalid={pixErrors.key_value ? true : undefined}
                  aria-describedby="pix-key-input-msg"
                />
              </FormField>
            </DialogBody>
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => setPixOpen(false)} disabled={busy}>Cancelar</button>
              <button type="submit" disabled={busy} className="vp-cta !h-12 justify-center sm:min-w-[190px]">{busy ? "Adicionando…" : "Adicionar chave Pix"}</button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nova conta bancária */}
      <Dialog open={bankOpen} onOpenChange={(o) => { setBankOpen(o); if (!o) setBankErrors({}); }}>
        <DialogContent className={dialogBox("lg")}>
          <DialogHead icon={<Landmark className="h-5 w-5" />} title="Nova conta bancária" subtitle="Use uma conta no seu nome ou da sua empresa. Vamos pedir sua senha para salvar." />
          <form onSubmit={handleAddBank} noValidate className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
              <FormField id="bank-name" label="Banco" error={bankErrors.bank_name}>
                <BankCombobox
                  id="bank-name"
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
              </FormField>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
                <FormField id="bank-agency" label="Agência" error={bankErrors.agency}>
                  <input
                    id="bank-agency" className="vp-field"
                    value={bankForm.agency}
                    onChange={(e) => { setBankForm({ ...bankForm, agency: maskAgency(e.target.value) }); clearBankError("agency"); }}
                    placeholder="0001" inputMode="numeric" maxLength={7}
                    aria-invalid={bankErrors.agency ? true : undefined} aria-describedby="bank-agency-msg"
                  />
                </FormField>
                <FormField id="bank-account" label="Conta" error={bankErrors.account_number}>
                  <input
                    id="bank-account" className="vp-field"
                    value={bankForm.account_number}
                    onChange={(e) => { setBankForm({ ...bankForm, account_number: maskAccount(e.target.value) }); clearBankError("account_number"); }}
                    placeholder="12345-6" inputMode="numeric" maxLength={18}
                    aria-invalid={bankErrors.account_number ? true : undefined} aria-describedby="bank-account-msg"
                  />
                </FormField>
              </div>
              <div>
                <FieldLabel>Tipo de conta</FieldLabel>
                <ChoiceGrid label="Tipo de conta" value={bankForm.account_type} onChange={(v) => setBankForm({ ...bankForm, account_type: v })} options={ACCOUNT_TYPES} />
              </div>
              <FormField id="bank-holder" label="Nome do titular" error={bankErrors.holder_name}>
                <input
                  id="bank-holder" className="vp-field"
                  value={bankForm.holder_name}
                  onChange={(e) => { setBankForm({ ...bankForm, holder_name: e.target.value }); clearBankError("holder_name"); }}
                  autoComplete="name"
                  aria-invalid={bankErrors.holder_name ? true : undefined} aria-describedby="bank-holder-msg"
                />
              </FormField>
              <FormField id="bank-document" label="CPF ou CNPJ do titular" error={bankErrors.holder_document} hint="Tem que ser o mesmo documento da conta bancária.">
                <input
                  id="bank-document" className="vp-field"
                  value={bankForm.holder_document}
                  onChange={(e) => { setBankForm({ ...bankForm, holder_document: maskDocument(e.target.value) }); clearBankError("holder_document"); }}
                  placeholder="000.000.000-00" inputMode="numeric" maxLength={18}
                  aria-invalid={bankErrors.holder_document ? true : undefined} aria-describedby="bank-document-msg"
                />
              </FormField>
            </DialogBody>
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => setBankOpen(false)} disabled={busy}>Cancelar</button>
              <button type="submit" disabled={busy} className="vp-cta !h-12 justify-center sm:min-w-[190px]">{busy ? "Salvando…" : "Salvar conta bancária"}</button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção */}
      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => { if (!o) setToRemove(null); }}
        title={toRemove?.kind === "pix" ? "Remover esta chave Pix?" : "Remover esta conta bancária?"}
        description="Na próxima etapa vamos pedir a sua senha para concluir."
        confirmLabel="Remover"
        cancelLabel="Manter"
        onConfirm={confirmRemove}
      >
        <p className="mt-3 break-all rounded-[12px] bg-muted px-3.5 py-2.5 text-[14px] font-semibold text-foreground">{toRemove?.name}</p>
      </ConfirmDialog>
    </div>
  );
}

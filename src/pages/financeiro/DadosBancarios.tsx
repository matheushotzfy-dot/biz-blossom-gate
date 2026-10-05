import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import { Building2, Plus, Trash2, Key, CheckCircle2, User, Mail, Phone, Hash, Shuffle, Landmark, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { BankCombobox } from "@/components/ui/bank-combobox";
import { toast } from "sonner";
import {
  bankAccountSchema,
  pixKeySchema,
  flattenZodErrors,
  type FieldErrors,
} from "@/lib/validation";
import { InlineError, errorInputClass } from "@/components/ui/inline-error";
import { friendlyError } from "@/lib/friendlyError";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { detectPixKeyType, displayPixKey, formatPixKey, maskAccount, maskAgency, maskDocument } from "@/lib/financial-input";

const PIX_TYPES = [
  { value: "cpf" as const, label: "CPF", description: "Documento pessoal", icon: User },
  { value: "cnpj" as const, label: "CNPJ", description: "Documento empresarial", icon: Hash },
  { value: "email" as const, label: "E-mail", description: "Endereço cadastrado", icon: Mail },
  { value: "phone" as const, label: "Telefone", description: "Celular com DDD", icon: Phone },
  { value: "random" as const, label: "Aleatória", description: "Chave gerada", icon: Shuffle },
];

const ACCOUNT_TYPES = [
  { value: "corrente" as const, label: "Conta Corrente", description: "Movimentação diária", icon: Landmark },
  { value: "poupanca" as const, label: "Poupança", description: "Conta de rendimento", icon: PiggyBank },
];

const PIX_LABEL: Record<string, string> = Object.fromEntries(PIX_TYPES.map((t) => [t.value, t.label]));

type PixForm = { key_type: "cpf" | "cnpj" | "email" | "phone" | "random"; key_value: string };
type BankForm = {
  bank_name: string; bank_code: string; agency: string; account_number: string;
  account_type: "corrente" | "poupanca"; holder_name: string; holder_document: string;
};

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
        toast.success("Chave PIX adicionada");
        setPixForm({ key_type: "cpf", key_value: "" });
        setPixOpen(false);
        invalidateAll(["pix_keys"]);
      },
    });
    setReauthOpen(true);
  };

  const handleDeletePix = async (id: string) => {
    if (!user || !confirm("Remover esta chave PIX?")) return;
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

  const handleDeleteBank = async (id: string) => {
    if (!user || !confirm("Remover esta conta bancária?")) return;
    setPendingAction({ action: "delete_bank_account", payload: { id }, onSuccess: () => {
      toast.success("Conta removida");
      invalidateAll(["bank_accounts"]);
    } });
    setReauthOpen(true);
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

  return (
    <div className="space-y-6">
      <ReauthenticationDialog
        open={reauthOpen}
        busy={busy}
        onOpenChange={(open) => { setReauthOpen(open); if (!open) setPendingAction(null); }}
        onConfirm={confirmSensitiveAction}
      />
      {/* PIX KEYS */}
      <div className="bg-card rounded-[12px] border border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0">
              <Key size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground tracking-tight text-sm">Chaves PIX</h2>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                {pixKeys.length}/3 cadastradas · usadas para receber saques
              </p>
            </div>
          </div>
          <Dialog open={pixOpen} onOpenChange={(o) => { setPixOpen(o); if (!o) setPixErrors({}); }}>
            <DialogTrigger asChild>
              <Button
                disabled={pixKeys.length >= 3}
                className="h-10 px-4 rounded-xl font-semibold text-[11px] "
              >
                <Plus size={14} strokeWidth={3} className="mr-1.5" /> Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-hidden p-0 rounded-3xl">
              <div className="overflow-y-auto p-6 sm:p-7">
              <DialogHeader><DialogTitle>Adicionar Chave PIX</DialogTitle></DialogHeader>
              <form onSubmit={handleAddPix} className="space-y-4 pt-2" noValidate>
                <div className="space-y-2">
                  <Label>Tipo de chave</Label>
                  <SegmentedChoice
                    value={pixForm.key_type}
                    onValueChange={(v) => { setPixForm({ ...pixForm, key_type: v }); clearPixError("key_value"); }}
                    options={PIX_TYPES}
                    columns={2}
                    size="sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chave</Label>
                  <Input
                    value={pixForm.key_value}
                    onChange={(e) => {
                      const detected = detectPixKeyType(e.target.value);
                      const nextType = detected ?? pixForm.key_type;
                      setPixForm({ key_type: nextType, key_value: formatPixKey(e.target.value, nextType) });
                      clearPixError("key_value");
                    }}
                    placeholder="Digite sua chave PIX"
                    inputMode={pixForm.key_type === "email" || pixForm.key_type === "random" ? "text" : "numeric"}
                    autoComplete={pixForm.key_type === "email" ? "email" : pixForm.key_type === "phone" ? "tel" : "off"}
                    aria-invalid={!!pixErrors.key_value}
                    aria-describedby={pixErrors.key_value ? "pix-key-error" : undefined}
                    className={errorInputClass(!!pixErrors.key_value)}
                  />
                  <InlineError id="pix-key-error" message={pixErrors.key_value} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Adicionando..." : "Adicionar Chave PIX"}
                </Button>
              </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {pixKeys.length === 0 ? (
          <div className="p-10 text-center text-[11px] font-medium text-muted-foreground/60 ">
            Nenhuma chave PIX cadastrada
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {pixKeys.map((pk) => (
              <div key={pk.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm font-bold text-foreground">{displayPixKey(pk.key_value, pk.key_type, (pk as { key_value_masked?: string | null }).key_value_masked)}</p>
                  <p className="text-[11px] font-medium text-muted-foreground/70 mt-0.5">
                    {PIX_TYPES.find(t => t.value === pk.key_type)?.label || pk.key_type}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeletePix(pk.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BANK ACCOUNTS */}
      <div className="bg-card rounded-[12px] border border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground tracking-tight text-sm">Contas Bancárias</h2>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                {accounts.length} cadastrada(s)
              </p>
            </div>
          </div>
          <Dialog open={bankOpen} onOpenChange={(o) => { setBankOpen(o); if (!o) setBankErrors({}); }}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl font-semibold text-[11px] ">
                <Plus size={14} strokeWidth={3} className="mr-1.5" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-hidden p-0 rounded-3xl">
              <div className="overflow-y-auto p-6 sm:p-7">
              <DialogHeader><DialogTitle>Adicionar Conta Bancária</DialogTitle></DialogHeader>
              <form onSubmit={handleAddBank} className="space-y-3 pt-2" noValidate>
                <div className="space-y-1.5">
                  <Label>Banco</Label>
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
                  <div className="space-y-1.5">
                    <Label>Agência</Label>
                    <Input
                      value={bankForm.agency}
                      onChange={(e) => { setBankForm({ ...bankForm, agency: maskAgency(e.target.value) }); clearBankError("agency"); }}
                      placeholder="0001"
                      inputMode="numeric"
                      maxLength={7}
                      aria-invalid={!!bankErrors.agency}
                      className={errorInputClass(!!bankErrors.agency)}
                    />
                    <InlineError message={bankErrors.agency} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta</Label>
                    <Input
                      value={bankForm.account_number}
                      onChange={(e) => { setBankForm({ ...bankForm, account_number: maskAccount(e.target.value) }); clearBankError("account_number"); }}
                      placeholder="12345-6"
                      inputMode="numeric"
                      maxLength={18}
                      aria-invalid={!!bankErrors.account_number}
                      className={errorInputClass(!!bankErrors.account_number)}
                    />
                    <InlineError message={bankErrors.account_number} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de conta</Label>
                  <SegmentedChoice
                    value={bankForm.account_type}
                    onValueChange={(v) => setBankForm({ ...bankForm, account_type: v })}
                    options={ACCOUNT_TYPES}
                    columns={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do titular</Label>
                  <Input
                    value={bankForm.holder_name}
                    onChange={(e) => { setBankForm({ ...bankForm, holder_name: e.target.value }); clearBankError("holder_name"); }}
                    aria-invalid={!!bankErrors.holder_name}
                    className={errorInputClass(!!bankErrors.holder_name)}
                  />
                  <InlineError message={bankErrors.holder_name} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF/CNPJ do titular</Label>
                  <Input
                    value={bankForm.holder_document}
                    onChange={(e) => { setBankForm({ ...bankForm, holder_document: maskDocument(e.target.value) }); clearBankError("holder_document"); }}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={18}
                    aria-invalid={!!bankErrors.holder_document}
                    className={errorInputClass(!!bankErrors.holder_document)}
                  />
                  <InlineError message={bankErrors.holder_document} />
                </div>
                <Button type="submit" disabled={busy} className="w-full mt-2">
                  {busy ? "Adicionando..." : "Salvar Conta Bancária"}
                </Button>
              </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {accounts.length === 0 ? (
          <div className="p-10 text-center text-[11px] font-medium text-muted-foreground/60 ">
            Nenhuma conta bancária cadastrada
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {accounts.map((acc) => (
              <div key={acc.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">
                    {acc.bank_name} {acc.is_primary && <CheckCircle2 size={12} className="inline text-emerald-500 ml-1" />}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground/70 mt-0.5 tabular-nums">
                    Ag {acc.agency} · {acc.account_type === "poupanca" ? "Poup" : "CC"} {(acc as { account_number_masked?: string | null }).account_number_masked ?? "••••"} · {acc.holder_name}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteBank(acc.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import { Building2, Plus, Trash2, Key, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  bankAccountSchema,
  pixKeySchema,
  flattenZodErrors,
  type FieldErrors,
} from "@/lib/validation";
import { InlineError, errorInputClass } from "@/components/ui/inline-error";
import { friendlyError } from "@/lib/friendlyError";

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const ACCOUNT_TYPES = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
];

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
    setBusy(true);
    const { error } = await supabase.from("pix_keys").insert({
      user_id: user.id,
      key_type: parsed.data.key_type,
      key_value: parsed.data.key_value.trim(),
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error, "Erro ao adicionar chave")); return; }
    toast.success("Chave PIX adicionada");
    setPixForm({ key_type: "cpf", key_value: "" });
    setPixOpen(false);
    invalidateAll(["pix_keys"]);
  };

  const handleDeletePix = async (id: string) => {
    if (!user || !confirm("Remover esta chave PIX?")) return;
    const { error } = await supabase.from("pix_keys").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Chave removida");
    invalidateAll(["pix_keys"]);
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
    setBusy(true);
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      bank_name: parsed.data.bank_name,
      bank_code: parsed.data.bank_code || null,
      agency: parsed.data.agency,
      account_number: parsed.data.account_number,
      account_type: parsed.data.account_type,
      holder_name: parsed.data.holder_name,
      holder_document: parsed.data.holder_document.replace(/\D/g, ""),
    });
    setBusy(false);
    if (error) { toast.error(friendlyError(error, "Erro ao adicionar conta")); return; }
    toast.success("Conta bancária adicionada");
    setBankForm({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
    setBankOpen(false);
    invalidateAll(["bank_accounts"]);
  };

  const handleDeleteBank = async (id: string) => {
    if (!user || !confirm("Remover esta conta bancária?")) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Conta removida");
    invalidateAll(["bank_accounts"]);
  };

  const clearPixError = (field: keyof PixForm) => {
    if (pixErrors[field]) setPixErrors((p) => ({ ...p, [field]: undefined }));
  };
  const clearBankError = (field: keyof BankForm) => {
    if (bankErrors[field]) setBankErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <div className="space-y-6">
      {/* PIX KEYS */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0">
              <Key size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-foreground uppercase tracking-tight text-sm">Chaves PIX</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                {pixKeys.length}/3 cadastradas · usadas para receber saques
              </p>
            </div>
          </div>
          <Dialog open={pixOpen} onOpenChange={(o) => { setPixOpen(o); if (!o) setPixErrors({}); }}>
            <DialogTrigger asChild>
              <Button
                disabled={pixKeys.length >= 3}
                className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest"
              >
                <Plus size={14} strokeWidth={3} className="mr-1.5" /> Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Adicionar Chave PIX</DialogTitle></DialogHeader>
              <form onSubmit={handleAddPix} className="space-y-4 pt-2" noValidate>
                <div className="space-y-2">
                  <Label>Tipo de chave</Label>
                  <Select
                    value={pixForm.key_type}
                    onValueChange={(v) => { setPixForm({ ...pixForm, key_type: v as PixForm["key_type"] }); clearPixError("key_value"); }}
                  >
                    <SelectTrigger className="finance-select-trigger h-11 border-primary/25 bg-primary/[0.045] font-black"><SelectValue /></SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {PIX_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-[13px] font-black">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave</Label>
                  <Input
                    value={pixForm.key_value}
                    onChange={(e) => { setPixForm({ ...pixForm, key_value: e.target.value }); clearPixError("key_value"); }}
                    placeholder="Digite sua chave PIX"
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
            </DialogContent>
          </Dialog>
        </div>

        {pixKeys.length === 0 ? (
          <div className="p-10 text-center text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            Nenhuma chave PIX cadastrada
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {pixKeys.map((pk) => (
              <div key={pk.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">{(pk as any).key_value_masked ?? pk.key_value ?? "•••"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-0.5">
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
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-foreground uppercase tracking-tight text-sm">Contas Bancárias</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                {accounts.length} cadastrada(s)
              </p>
            </div>
          </div>
          <Dialog open={bankOpen} onOpenChange={(o) => { setBankOpen(o); if (!o) setBankErrors({}); }}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest">
                <Plus size={14} strokeWidth={3} className="mr-1.5" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Adicionar Conta Bancária</DialogTitle></DialogHeader>
              <form onSubmit={handleAddBank} className="space-y-3 pt-2" noValidate>
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Input
                    value={bankForm.bank_name}
                    onChange={(e) => { setBankForm({ ...bankForm, bank_name: e.target.value }); clearBankError("bank_name"); }}
                    placeholder="Ex: Nubank, Itaú..."
                    aria-invalid={!!bankErrors.bank_name}
                    className={errorInputClass(!!bankErrors.bank_name)}
                  />
                  <InlineError message={bankErrors.bank_name} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cód. Banco</Label>
                    <Input
                      value={bankForm.bank_code}
                      onChange={(e) => { setBankForm({ ...bankForm, bank_code: e.target.value }); clearBankError("bank_code"); }}
                      placeholder="260"
                      aria-invalid={!!bankErrors.bank_code}
                      className={errorInputClass(!!bankErrors.bank_code)}
                    />
                    <InlineError message={bankErrors.bank_code} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Agência</Label>
                    <Input
                      value={bankForm.agency}
                      onChange={(e) => { setBankForm({ ...bankForm, agency: e.target.value }); clearBankError("agency"); }}
                      placeholder="0001"
                      aria-invalid={!!bankErrors.agency}
                      className={errorInputClass(!!bankErrors.agency)}
                    />
                    <InlineError message={bankErrors.agency} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta</Label>
                    <Input
                      value={bankForm.account_number}
                      onChange={(e) => { setBankForm({ ...bankForm, account_number: e.target.value }); clearBankError("account_number"); }}
                      placeholder="12345-6"
                      aria-invalid={!!bankErrors.account_number}
                      className={errorInputClass(!!bankErrors.account_number)}
                    />
                    <InlineError message={bankErrors.account_number} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de conta</Label>
                  <Select
                    value={bankForm.account_type}
                    onValueChange={(v) => setBankForm({ ...bankForm, account_type: v as BankForm["account_type"] })}
                  >
                    <SelectTrigger className="finance-select-trigger h-11 border-primary/25 bg-primary/[0.045] font-black"><SelectValue /></SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-[13px] font-black">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                    onChange={(e) => { setBankForm({ ...bankForm, holder_document: e.target.value }); clearBankError("holder_document"); }}
                    placeholder="Somente números"
                    aria-invalid={!!bankErrors.holder_document}
                    className={errorInputClass(!!bankErrors.holder_document)}
                  />
                  <InlineError message={bankErrors.holder_document} />
                </div>
                <Button type="submit" disabled={busy} className="w-full mt-2">
                  {busy ? "Adicionando..." : "Salvar Conta Bancária"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {accounts.length === 0 ? (
          <div className="p-10 text-center text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
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
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-0.5 tabular-nums">
                    Ag {acc.agency} · {acc.account_type === "poupanca" ? "Poup" : "CC"} {(acc as any).account_number_masked ?? acc.account_number ?? "••••"} · {acc.holder_name}
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

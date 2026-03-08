import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Building2, Plus, Trash2, Key, Shield, Fingerprint,
  CreditCard, Landmark, CheckCircle2, AlertCircle, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlowPanel, SectionHeader } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { searchBanks, type BrazilianBank } from "@/lib/brazilianBanks";

/* ─── PIX Key types — msDev's ─── */
const pixKeyTypes = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

/* ─── Validation utils — msDev's ─── */
function validateCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(nums[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(nums[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, "");
  if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(nums[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(nums[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(nums[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(nums[13]) === d2;
}

function formatCPF(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function formatCNPJ(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 14);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function formatPhone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : "";
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function validatePixKey(type: string, value: string): string | null {
  const v = value.trim();
  if (!v) return "Preencha a chave";
  switch (type) {
    case "cpf": return validateCPF(v) ? null : "CPF inválido";
    case "cnpj": return validateCNPJ(v) ? null : "CNPJ inválido";
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido";
    case "telefone": {
      const nums = v.replace(/\D/g, "");
      return nums.length >= 10 && nums.length <= 11 ? null : "Telefone inválido (DDD + número)";
    }
    case "aleatoria": return v.length >= 10 ? null : "Chave aleatória inválida";
    default: return "Selecione o tipo";
  }
}

function formatPixInput(type: string, value: string): string {
  switch (type) {
    case "cpf": return formatCPF(value);
    case "cnpj": return formatCNPJ(value);
    case "telefone": return formatPhone(value);
    default: return value;
  }
}

function getPlaceholder(type: string): string {
  switch (type) {
    case "cpf": return "000.000.000-00";
    case "cnpj": return "00.000.000/0000-00";
    case "email": return "seu@email.com";
    case "telefone": return "(00) 00000-0000";
    case "aleatoria": return "Chave aleatória";
    default: return "Sua chave PIX";
  }
}

function getPixIcon(type: string) {
  switch (type) {
    case "cpf":
    case "cnpj":
      return Fingerprint;
    default:
      return Key;
  }
}

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

/* ─── BankAutocomplete Component — msDev's ─── */
function BankAutocomplete({ value, onChange }: { value: { name: string; code: string }; onChange: (bank: { name: string; code: string }) => void }) {
  const [query, setQuery] = useState(value.name ? `${value.code} - ${value.name}` : "");
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => searchBanks(query), [query]);

  const handleSelect = (bank: BrazilianBank) => {
    onChange({ name: bank.name, code: bank.code });
    setQuery(`${bank.code} - ${bank.name}`);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Label className="kicker">Banco</Label>
      <div className="relative mt-1.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); onChange({ name: "", code: "" }); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Busque por nome ou código..."
          className="pl-9 rounded-xl h-11"
          autoComplete="off"
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl">
          {results.map((bank) => (
            <button
              key={bank.code}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-border/10 last:border-0"
              onClick={() => handleSelect(bank)}
            >
              <span className="text-[11px] font-mono text-primary font-bold w-8 shrink-0">{bank.code}</span>
              <span className="text-[13px] text-foreground/80 font-medium truncate">{bank.name}</span>
            </button>
          ))}
        </div>
      )}
      {isOpen && query && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl p-4 text-center text-[12px] text-muted-foreground/50">
          Nenhum banco encontrado
        </div>
      )}
    </div>
  );
}

/* ─── Main Component — msDev's ─── */
export default function DadosBancarios() {
  const { user } = useAuth();
  const { data: accounts = [], refetch: refetchAccounts } = useBankAccounts();
  const { data: pixKeysData = [], refetch: refetchPixKeys } = usePixKeys();
  const pixKeys = pixKeysData as PixKey[];
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState({ name: "", code: "" });
  const [form, setForm] = useState({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
  const [newPixType, setNewPixType] = useState("");
  const [newPixValue, setNewPixValue] = useState("");
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  /* ─── Bank Account CRUD — msDev's ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedBank.name) { toast.error("Selecione um banco"); return; }
    const { error } = await supabase.from("bank_accounts").insert({
      ...form,
      bank_name: selectedBank.name,
      bank_code: selectedBank.code,
      user_id: user.id,
    });
    if (error) { toast.error("Erro ao cadastrar"); return; }
    toast.success("Conta cadastrada!");
    setOpen(false);
    setSelectedBank({ name: "", code: "" });
    setForm({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
    invalidateAll(["bank_accounts"]);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("bank_accounts").delete().eq("id", id);
    toast.success("Conta removida");
    loadAccounts();
  };

  /* ─── PIX Key CRUD — msDev's ─── */
  const handleAddPix = async () => {
    if (!user) return;
    if (!newPixType) { setPixError("Selecione o tipo da chave"); return; }
    const err = validatePixKey(newPixType, newPixValue);
    if (err) { setPixError(err); return; }
    if (pixKeys.length >= 3) { toast.error("Máximo de 3 chaves PIX"); return; }
    setPixLoading(true);
    setPixError(null);
    const cleanValue = newPixValue.trim();
    const { error } = await supabase.from("pix_keys").insert({ user_id: user.id, key_type: newPixType, key_value: cleanValue } as any);
    setPixLoading(false);
    if (error) {
      if (error.code === "23505") toast.error("Essa chave já está cadastrada");
      else toast.error("Erro ao cadastrar chave PIX");
      return;
    }
    toast.success("Chave PIX cadastrada!");
    setNewPixType("");
    setNewPixValue("");
    loadPixKeys();
    const { data: keys } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at").limit(1) as { data: PixKey[] | null };
    if (keys && keys.length > 0) {
      await supabase.from("profiles").update({ pix_key: keys[0].key_value, pix_key_type: keys[0].key_type }).eq("user_id", user.id);
    }
  };

  const handleDeletePix = async (id: string) => {
    if (!user) return;
    await supabase.from("pix_keys").delete().eq("id", id);
    toast.success("Chave removida");
    loadPixKeys();
    const { data: keys } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at").limit(1) as { data: PixKey[] | null };
    if (keys && keys.length > 0) {
      await supabase.from("profiles").update({ pix_key: keys[0].key_value, pix_key_type: keys[0].key_type }).eq("user_id", user.id);
    } else {
      await supabase.from("profiles").update({ pix_key: null, pix_key_type: null }).eq("user_id", user.id);
    }
  };

  const pixTypeLabel = (t: string) => pixKeyTypes.find(x => x.value === t)?.label || t;

  return (
    <PageShell>
      <PageTitle icon={<Landmark className="h-6 w-6" />} title="Dados Bancários" subtitle="Gerencie suas chaves PIX e contas bancárias" />

      {/* ─── PIX KEYS SECTION — msDev's ─── */}
      <GlowPanel>
        <div className="flex items-center justify-between mb-6">
          <SectionHeader icon={<Key className="h-4.5 w-4.5" />} title="Chaves PIX" subtitle="Até 3 chaves • Utilizadas para saques" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/15">
            <Shield className="h-3.5 w-3.5 text-primary/60" />
            <span className="text-[13px] font-display font-black text-primary">{pixKeys.length}<span className="text-muted-foreground/40 font-normal">/3</span></span>
          </div>
        </div>

        {pixKeys.length > 0 && (
          <div className="space-y-2.5 mb-6">
            {pixKeys.map((pk, i) => {
              const IconComp = getPixIcon(pk.key_type);
              return (
                <div key={pk.id} className="flex items-center justify-between p-4 rounded-xl border border-border/30 bg-gradient-to-r from-muted/15 to-transparent hover:border-primary/20 transition-all animate-fade-in group" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                      <IconComp className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/60">{pixTypeLabel(pk.key_type)}</span>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      </div>
                      <p className="font-mono text-foreground text-[14px] mt-0.5 truncate font-medium">{pk.key_value}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive/30 hover:text-destructive hover:bg-destructive/5 shrink-0 rounded-xl h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeletePix(pk.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {pixKeys.length < 3 && (
          <div className="pt-5 border-t border-border/20">
            <p className="text-[11px] text-muted-foreground/50 font-medium mb-3">Adicionar nova chave</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
              <div>
                <Select value={newPixType} onValueChange={(v) => { setNewPixType(v); setNewPixValue(""); setPixError(null); }}>
                  <SelectTrigger className="rounded-xl border-border/40 h-12"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {pixKeyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input value={newPixValue} onChange={e => { setNewPixValue(formatPixInput(newPixType, e.target.value)); setPixError(null); }} placeholder={getPlaceholder(newPixType)} className="font-mono rounded-xl border-border/40 h-12 flex-1" />
                <Button onClick={handleAddPix} disabled={pixLoading} className="rounded-xl font-bold gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/15 h-12 px-5 shrink-0">
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </div>
            {pixError && (
              <div className="flex items-center gap-2 mt-2.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[12px] font-medium">{pixError}</p>
              </div>
            )}
          </div>
        )}
      </GlowPanel>

      {/* ─── BANK ACCOUNTS SECTION — msDev's ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <SectionHeader icon={<Building2 className="h-4.5 w-4.5" />} title="Contas Bancárias" subtitle="Cadastre suas contas para recebimento" />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedBank({ name: "", code: "" }); setForm({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold gradient-primary text-primary-foreground h-11 px-6 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all">
              <Plus className="h-4 w-4" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent rounded-2xl pointer-events-none" />
            <div className="relative px-6 pt-6 pb-4 border-b border-border/20">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Building2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  Cadastrar Conta Bancária
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 relative p-6">
              {/* Bank Autocomplete — msDev's */}
              <BankAutocomplete value={selectedBank} onChange={setSelectedBank} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="kicker">Agência</Label>
                  <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} required className="mt-1.5 rounded-xl h-11" placeholder="0001" />
                </div>
                <div>
                  <Label className="kicker">Conta</Label>
                  <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} required className="mt-1.5 rounded-xl h-11" placeholder="12345-6" />
                </div>
              </div>
              <div>
                <Label className="kicker">Tipo</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="kicker">Titular</Label>
                <Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
              </div>
              <div>
                <Label className="kicker">CPF/CNPJ</Label>
                <Input value={form.holder_document} onChange={(e) => setForm({ ...form, holder_document: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold rounded-xl h-12 shadow-xl shadow-primary/15 text-sm">
                Cadastrar Conta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 ? (
          <div className="panel-enterprise col-span-full">
            <EmptyState icon={<Building2 className="h-8 w-8" />} title="Nenhuma conta cadastrada" subtitle="Cadastre uma conta bancária para recebimentos" />
          </div>
        ) : accounts.map((acc, i) => (
          <div key={acc.id} className="panel-enterprise p-5 animate-fade-in group" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-info/10 border border-info/15 flex items-center justify-center shrink-0 group-hover:bg-info/15 transition-colors">
                  <CreditCard className="h-5 w-5 text-info" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-foreground text-[15px]">{acc.bank_name}</h3>
                  {acc.bank_code && <p className="text-[11px] text-muted-foreground/40 font-mono">Código {acc.bank_code}</p>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive/30 hover:text-destructive hover:bg-destructive/5 shrink-0 rounded-xl h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(acc.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/15">
              <div>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold">Agência</p>
                <p className="font-mono text-foreground/80 text-[14px] font-bold mt-1">{acc.agency}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold">Conta</p>
                <p className="font-mono text-foreground/80 text-[14px] font-bold mt-1">{acc.account_number}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold">Tipo</p>
                <p className="text-foreground/80 text-[13px] font-bold capitalize mt-1">{acc.account_type === "corrente" ? "Corrente" : "Poupança"}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/10">
              <p className="text-muted-foreground/40 text-[12px]">{acc.holder_name} — <span className="font-mono">{acc.holder_document}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Security footer — msDev's */}
      <div className="panel-enterprise-subtle p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground/50">
            Seus dados bancários são criptografados e protegidos. Apenas você tem acesso às suas informações financeiras.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

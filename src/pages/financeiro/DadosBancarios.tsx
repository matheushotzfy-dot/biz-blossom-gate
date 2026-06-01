import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
 Building2, Plus, Trash2, Key, Shield, Fingerprint,
 CreditCard, Landmark, CheckCircle2, AlertCircle, Search,
 Lock, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, SectionHeader } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { searchBanks, type BrazilianBank } from "@/lib/brazilianBanks";
import { motion } from "framer-motion";

/* ─── PIX Key types ─── */
const pixKeyTypes = [
 { value: "cpf", label: "CPF" },
 { value: "cnpj", label: "CNPJ" },
 { value: "email", label: "E-mail" },
 { value: "telefone", label: "Telefone" },
 { value: "aleatoria", label: "Chave Aleatória" },
];

/* ─── Validation utils ─── */
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
 case "telefone": { const nums = v.replace(/\D/g, ""); return nums.length >= 10 && nums.length <= 11 ? null : "Telefone inválido (DDD + número)"; }
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
 case "cpf": case "cnpj": return Fingerprint;
 default: return Key;
 }
}

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

/* ─── BankAutocomplete Component ─── */
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
 <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Banco</Label>
 <div className="relative mt-1.5">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
 <Input value={query}
 onChange={(e) => { setQuery(e.target.value); setIsOpen(true); onChange({ name: "", code: "" }); }}
 onFocus={() => setIsOpen(true)}
 placeholder="Busque por nome ou código..."
 className="pl-9 rounded-xl h-11 border-border/40 bg-card/80"
 autoComplete="off" />
 </div>
 {isOpen && results.length > 0 && (
 <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl">
 {results.map((bank) => (
 <button key={bank.code} type="button"
 className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-border/10 last:border-0"
 onClick={() => handleSelect(bank)}>
 <span className="text-[11px] font-mono text-primary font-bold w-8 shrink-0">{bank.code}</span>
 <span className="text-[13px] text-foreground/80 font-medium truncate">{bank.name}</span>
 </button>
 ))}
 </div>
 )}
 {isOpen && query && results.length === 0 && (
 <div className="absolute z-50 w-full mt-1 rounded-xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl p-4 text-center text-[12px] text-muted-foreground/50">
 Nenhum banco encontrado
 </div>
 )}
 </div>
 );
}

/* ─── Main Component ─── */
export default function DadosBancarios() {
 const { user } = useAuth();
 const { data: accounts = [] } = useBankAccounts();
 const { data: pixKeysData = [] } = usePixKeys();
 const pixKeys = pixKeysData as PixKey[];
 const invalidateAll = useInvalidateAll();
 const [open, setOpen] = useState(false);
 const [selectedBank, setSelectedBank] = useState({ name: "", code: "" });
 const [form, setForm] = useState({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
 const [newPixType, setNewPixType] = useState("");
 const [newPixValue, setNewPixValue] = useState("");
 const [pixError, setPixError] = useState<string | null>(null);
 const [pixLoading, setPixLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!user) return;
 if (!selectedBank.name) { toast.error("Selecione um banco"); return; }
 const { error } = await supabase.from("bank_accounts").insert({
 ...form, bank_name: selectedBank.name, bank_code: selectedBank.code, user_id: user.id,
 });
 if (error) { toast.error("Erro ao cadastrar"); return; }
 toast.success("Conta cadastrada!");
 setOpen(false);
 setSelectedBank({ name: "", code: "" });
 setForm({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
 invalidateAll(["bank_accounts"]);
 };

 const handleDelete = async (id: string) => {
 if (!user) return;
 if (!window.confirm("Tem certeza que deseja excluir esta conta bancária?")) return;
 const { error } = await supabase.from("bank_accounts").delete().eq("id", id).eq("user_id", user.id);
 if (error) { toast.error("Erro ao excluir conta"); return; }
 toast.success("Conta removida");
 invalidateAll(["bank_accounts"]);
 };

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
 setNewPixType(""); setNewPixValue("");
 invalidateAll(["pix_keys"]);
 const { data: keys } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at").limit(1) as { data: PixKey[] | null };
 if (keys && keys.length > 0) {
 await supabase.from("profiles").update({ pix_key: keys[0].key_value, pix_key_type: keys[0].key_type }).eq("user_id", user.id);
 }
 };

 const handleDeletePix = async (id: string) => {
 if (!user) return;
 if (!window.confirm("Tem certeza que deseja excluir esta chave PIX?")) return;
 const { error } = await supabase.from("pix_keys").delete().eq("id", id).eq("user_id", user.id);
 if (error) { toast.error("Erro ao excluir chave PIX"); return; }
 invalidateAll(["pix_keys"]);
 const { data: keys } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at").limit(1) as { data: PixKey[] | null };
 if (keys && keys.length > 0) {
 await supabase.from("profiles").update({ pix_key: keys[0].key_value, pix_key_type: keys[0].key_type }).eq("user_id", user.id);
 } else {
 await supabase.from("profiles").update({ pix_key: null, pix_key_type: null }).eq("user_id", user.id);
 }
 };

 const pixTypeLabel = (t: string) => pixKeyTypes.find(x => x.value === t)?.label || t;

 const primaryAccount = accounts[0];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Dados Bancários</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Gerencie suas chaves PIX e contas bancárias
          </p>
        </div>
      </div>

      {/* PIX KEYS SECTION */}
      <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
              <Key size={20} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight">Chaves PIX</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Utilizadas para recebimento de saques
              </p>
            </div>
          </div>
          <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            {pixKeys.length}/3 Cadastradas
          </div>
        </div>

        {pixKeys.length > 0 && (
          <div className="divide-y divide-border">
            {pixKeys.map((pk, i) => {
              const IconComp = getPixIcon(pk.key_type);
              const isPrimary = i === 0;
              return (
                <div
                  key={pk.id}
                  className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 border border-border flex items-center justify-center shrink-0">
                      <IconComp className="h-5 w-5 text-foreground/70" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {pixTypeLabel(pk.key_type)}
                        </span>
                        {isPrimary && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-primary/20 bg-primary/10 text-primary">
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-foreground text-sm font-bold">{pk.key_value}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-10 w-10 rounded-xl"
                    onClick={() => handleDeletePix(pk.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

     {pixKeys.length < 3 && (
      <div className="bg-muted/20 border-t border-border px-6 py-4">
       <p className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
        Adicionar nova chave PIX
       </p>
       <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2">
        <Select value={newPixType} onValueChange={(v) => { setNewPixType(v); setNewPixValue(""); setPixError(null); }}>
         <SelectTrigger className="rounded-lg border-border h-10 bg-card"><SelectValue placeholder="Tipo da chave" /></SelectTrigger>
         <SelectContent>
          {pixKeyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
         </SelectContent>
        </Select>
        <Input value={newPixValue}
         onChange={e => { setNewPixValue(formatPixInput(newPixType, e.target.value)); setPixError(null); }}
         placeholder={newPixType ? getPlaceholder(newPixType) : "Selecione o tipo primeiro"}
         disabled={!newPixType}
         className="font-mono rounded-lg border-border h-10 bg-card" />
        <Button onClick={handleAddPix} disabled={pixLoading || !newPixType}
         className="rounded-lg font-bold gap-2 h-10 px-4 shrink-0">
         <Plus className="h-4 w-4" /> Adicionar
        </Button>
       </div>
       {pixError && (
        <div className="flex items-center gap-2 mt-2 text-destructive">
         <AlertCircle className="h-3.5 w-3.5 shrink-0" />
         <p className="text-xs font-medium">{pixError}</p>
        </div>
       )}
      </div>
     )}
    </motion.section>

    {/* ════ BANK ACCOUNTS ════ */}
    <motion.section
     initial={{ opacity: 0, y: 8 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ delay: 0.15 }}
     className="rounded-2xl border border-border bg-card overflow-hidden"
    >
     <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div className="flex items-center gap-3">
       <div className="h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center">
        <Building2 className="h-4 w-4 text-info" />
       </div>
       <div>
        <h3 className="text-sm font-display font-black text-foreground tracking-tight">Contas Bancárias</h3>
        <p className="text-[11px] text-muted-foreground font-display">Para recebimento de transferências e saques alternativos</p>
       </div>
      </div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedBank({ name: "", code: "" }); setForm({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" }); } }}>
       <DialogTrigger asChild>
        <Button className="h-9 px-4 rounded-lg text-xs font-display font-bold gap-2">
         <Plus className="h-3.5 w-3.5" /> Nova Conta
        </Button>
       </DialogTrigger>
       <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
         <DialogHeader>
          <DialogTitle className="font-display font-black text-lg tracking-tight flex items-center gap-2.5">
           <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
           </div>
           Cadastrar Conta Bancária
          </DialogTitle>
         </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
         <BankAutocomplete value={selectedBank} onChange={setSelectedBank} />
         <div className="grid grid-cols-2 gap-3">
          <div>
           <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Agência</Label>
           <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} required className="mt-1.5 rounded-lg h-10 border-border" placeholder="0001" />
          </div>
          <div>
           <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Conta</Label>
           <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} required className="mt-1.5 rounded-lg h-10 border-border" placeholder="12345-6" />
          </div>
         </div>
         <div>
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Tipo</Label>
          <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
           <SelectTrigger className="mt-1.5 rounded-lg h-10 border-border"><SelectValue /></SelectTrigger>
           <SelectContent>
            <SelectItem value="corrente">Corrente</SelectItem>
            <SelectItem value="poupanca">Poupança</SelectItem>
           </SelectContent>
          </Select>
         </div>
         <div>
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Titular</Label>
          <Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required className="mt-1.5 rounded-lg h-10 border-border" />
         </div>
         <div>
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">CPF/CNPJ</Label>
          <Input value={form.holder_document} onChange={(e) => setForm({ ...form, holder_document: e.target.value })} required className="mt-1.5 rounded-lg h-10 border-border" />
         </div>
         <Button type="submit" className="w-full font-bold rounded-lg h-11 text-sm">
          Cadastrar Conta
         </Button>
        </form>
       </DialogContent>
      </Dialog>
     </div>

     {accounts.length === 0 ? (
      <div className="px-6 py-16 text-center">
       <div className="h-14 w-14 rounded-xl bg-muted/30 border border-border flex items-center justify-center mx-auto mb-4">
        <Building2 className="h-6 w-6 text-muted-foreground/40" />
       </div>
       <h3 className="text-sm font-display font-bold text-foreground mb-1">Nenhuma conta bancária</h3>
       <p className="text-xs text-muted-foreground mb-4">Cadastre uma conta para habilitar saques via TED</p>
       <Button onClick={() => setOpen(true)} variant="outline" className="h-9 px-4 rounded-lg text-xs font-bold gap-2">
        <Plus className="h-3.5 w-3.5" /> Cadastrar primeira conta
       </Button>
      </div>
     ) : (
      <div className="divide-y divide-border">
       {accounts.map((acc, i) => {
        const isPrimary = acc.id === primaryAccount?.id;
        return (
         <motion.div
          key={acc.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className="px-6 py-4 hover:bg-muted/30 transition-colors group"
         >
          <div className="flex items-start justify-between gap-4">
           <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0">
             <CreditCard className="h-4 w-4 text-foreground/70" />
            </div>
            <div className="min-w-0 flex-1">
             <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-display font-black text-foreground text-sm truncate">{acc.bank_name}</h4>
              {acc.bank_code && (
               <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {acc.bank_code}
               </span>
              )}
              {isPrimary && (
               <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-primary">
                <Star className="h-2.5 w-2.5 fill-primary" /> Principal
               </span>
              )}
             </div>
             <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">Ag</span>
               <span className="font-mono font-bold text-foreground">{acc.agency}</span>
              </div>
              <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">Cc</span>
               <span className="font-mono font-bold text-foreground">{acc.account_number}</span>
              </div>
              <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">Tipo</span>
               <span className="font-display font-semibold text-foreground capitalize">
                {acc.account_type === "corrente" ? "Corrente" : "Poupança"}
               </span>
              </div>
             </div>
             <p className="text-[11px] text-muted-foreground font-display mt-1.5">
              <span className="font-semibold text-foreground/80">{acc.holder_name}</span>
              <span className="mx-1.5 text-border">·</span>
              <span className="font-mono">{acc.holder_document}</span>
             </p>
            </div>
           </div>
           <Button variant="ghost" size="sm"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0 h-8 px-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleDelete(acc.id)}>
            <Trash2 className="h-3.5 w-3.5" />
           </Button>
          </div>
         </motion.div>
        );
       })}
      </div>
     )}
    </motion.section>

    {/* ════ Security footer ════ */}
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex items-center gap-3">
     <div className="h-8 w-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
      <Shield className="h-4 w-4 text-success" />
     </div>
     <div className="flex-1 min-w-0">
      <p className="text-xs font-display font-bold text-foreground">Dados protegidos com criptografia AES-256</p>
      <p className="text-[11px] text-muted-foreground font-display">Apenas você tem acesso às suas informações financeiras. Nenhuma alteração ocorre sem sua confirmação.</p>
     </div>
    </div>
   </div>
  </div>
 );
}

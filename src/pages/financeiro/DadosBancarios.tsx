import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Plus, Trash2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const pixKeyTypes = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

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
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido (precisa conter @)";
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

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

export default function DadosBancarios() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });

  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [newPixType, setNewPixType] = useState("");
  const [newPixValue, setNewPixValue] = useState("");
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase.from("bank_accounts").select("*").order("created_at");
    if (data) setAccounts(data);
  };

  const loadPixKeys = async () => {
    if (!user) return;
    const { data } = await supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at") as { data: PixKey[] | null };
    if (data) setPixKeys(data);
  };

  useEffect(() => { loadAccounts(); loadPixKeys(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("bank_accounts").insert({ ...form, user_id: user.id });
    if (error) { toast.error("Erro ao cadastrar"); return; }
    toast.success("Conta cadastrada!");
    setOpen(false);
    setForm({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
    loadAccounts();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("bank_accounts").delete().eq("id", id);
    toast.success("Conta removida");
    loadAccounts();
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
    setNewPixType("");
    setNewPixValue("");
    loadPixKeys();
    // Sync first key to profiles for cashout compatibility
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
    // Sync profiles
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
      <PageTitle icon={<Building2 className="h-6 w-6" />} title="Dados Bancários" subtitle="Gerencie suas chaves PIX e contas bancárias" />

      {/* PIX Section */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)" }}>
              <Key className="h-4 w-4 text-[#080c18]" />
            </div>
            <div>
              <h3 className="font-bold text-white text-[15px]">Chaves PIX</h3>
              <p className="text-[11px] text-white/30">Até 3 chaves • Utilizadas para saques</p>
            </div>
          </div>
          <span className="text-[12px] font-mono text-white/30">{pixKeys.length}/3</span>
        </div>

        {/* Existing keys */}
        {pixKeys.length > 0 && (
          <div className="space-y-2 mb-4">
            {pixKeys.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">{pixTypeLabel(pk.key_type)}</p>
                  <p className="font-mono text-white text-[14px] mt-0.5">{pk.key_value}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDeletePix(pk.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new key */}
        {pixKeys.length < 3 && (
          <div className="space-y-3 pt-2 border-t border-white/[0.04]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/50 text-[12px]">Tipo da Chave</Label>
                <Select value={newPixType} onValueChange={(v) => { setNewPixType(v); setNewPixValue(""); setPixError(null); }}>
                  <SelectTrigger className="text-white border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pixKeyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/50 text-[12px]">Chave PIX</Label>
                <Input
                  value={newPixValue}
                  onChange={e => { setNewPixValue(formatPixInput(newPixType, e.target.value)); setPixError(null); }}
                  placeholder={getPlaceholder(newPixType)}
                  className="border-white/[0.08] bg-white/[0.03] text-white font-mono"
                />
              </div>
            </div>
            {pixError && <p className="text-[12px] text-red-400">{pixError}</p>}
            <Button onClick={handleAddPix} disabled={pixLoading} className="rounded-xl text-[13px] font-bold gap-2" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}>
              <Plus className="h-4 w-4" /> Adicionar Chave
            </Button>
          </div>
        )}
      </Panel>

      {/* Bank Accounts Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-white/40 text-[12px] uppercase tracking-widest font-semibold">Contas Bancárias</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}><Plus className="h-4 w-4" /> Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Conta Bancária</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Banco</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Nome do banco" required /></div>
                <div><Label>Código</Label><Input value={form.bank_code} onChange={(e) => setForm({ ...form, bank_code: e.target.value })} placeholder="001" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Agência</Label><Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} required /></div>
                <div><Label>Conta</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} required /></div>
              </div>
              <div><Label>Tipo</Label><Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem></SelectContent></Select></div>
              <div><Label>Titular</Label><Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required /></div>
              <div><Label>CPF/CNPJ</Label><Input value={form.holder_document} onChange={(e) => setForm({ ...form, holder_document: e.target.value })} required /></div>
              <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}>Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {accounts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-white/20"><Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-[13px]">Nenhuma conta cadastrada</p></div>
        ) : accounts.map((acc) => (
          <Panel key={acc.id}>
            <div className="flex justify-between items-start">
              <div><h3 className="font-bold text-white text-[14px]">{acc.bank_name}</h3>{acc.bank_code && <p className="text-[11px] text-white/30">Cód: {acc.bank_code}</p>}</div>
              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(acc.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="mt-3 space-y-1 text-[13px] text-white/50">
              <p>Ag: <span className="font-mono text-white/70">{acc.agency}</span> | Conta: <span className="font-mono text-white/70">{acc.account_number}</span></p>
              <p className="capitalize">{acc.account_type === "corrente" ? "Conta Corrente" : "Poupança"}</p>
              <p className="text-white/30">{acc.holder_name} — {acc.holder_document}</p>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

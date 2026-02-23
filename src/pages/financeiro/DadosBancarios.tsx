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

export default function DadosBancarios() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });

  // PIX state
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");
  const [savedPixKey, setSavedPixKey] = useState<string | null>(null);
  const [savedPixKeyType, setSavedPixKeyType] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase.from("bank_accounts").select("*").order("created_at");
    if (data) setAccounts(data);
  };

  const loadPixKey = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("pix_key, pix_key_type").eq("user_id", user.id).single();
    if (data) {
      setSavedPixKey(data.pix_key);
      setSavedPixKeyType(data.pix_key_type);
      setPixKey(data.pix_key || "");
      setPixKeyType(data.pix_key_type || "");
    }
  };

  useEffect(() => { loadAccounts(); loadPixKey(); }, [user]);

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

  const handleSavePix = async () => {
    if (!user) return;
    if (!pixKey.trim() || !pixKeyType) { toast.error("Preencha a chave e o tipo"); return; }
    setPixLoading(true);
    const { error } = await supabase.from("profiles").update({ pix_key: pixKey.trim(), pix_key_type: pixKeyType }).eq("user_id", user.id);
    setPixLoading(false);
    if (error) { toast.error("Erro ao salvar chave PIX"); return; }
    toast.success("Chave PIX salva!");
    setSavedPixKey(pixKey.trim());
    setSavedPixKeyType(pixKeyType);
  };

  const handleRemovePix = async () => {
    if (!user) return;
    setPixLoading(true);
    const { error } = await supabase.from("profiles").update({ pix_key: null, pix_key_type: null }).eq("user_id", user.id);
    setPixLoading(false);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Chave PIX removida");
    setSavedPixKey(null);
    setSavedPixKeyType(null);
    setPixKey("");
    setPixKeyType("");
  };

  const pixTypeLabel = pixKeyTypes.find(t => t.value === savedPixKeyType)?.label || savedPixKeyType;

  return (
    <PageShell>
      <PageTitle icon={<Building2 className="h-6 w-6" />} title="Dados Bancários" subtitle="Gerencie suas chaves PIX e contas bancárias" />

      {/* PIX Section */}
      <Panel>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)" }}>
            <Key className="h-4 w-4 text-[#080c18]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-[15px]">Chave PIX</h3>
            <p className="text-[11px] text-white/30">Utilizada para receber seus saques</p>
          </div>
        </div>

        {savedPixKey ? (
          <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div>
              <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">{pixTypeLabel}</p>
              <p className="font-mono text-white text-[14px] mt-0.5">{savedPixKey}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleRemovePix} disabled={pixLoading}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/50 text-[12px]">Tipo da Chave</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger className="text-white border-white/[0.08] bg-white/[0.03]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pixKeyTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/50 text-[12px]">Chave PIX</Label>
                <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Sua chave PIX" className="border-white/[0.08] bg-white/[0.03] text-white" />
              </div>
            </div>
            <Button onClick={handleSavePix} disabled={pixLoading} className="rounded-xl text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}>
              Salvar Chave PIX
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

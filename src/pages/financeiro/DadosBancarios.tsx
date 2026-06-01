import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBankAccounts, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Building2, Plus, Trash2, Key, Search, AlertCircle,
  CreditCard, Landmark, CheckCircle2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { searchBanks, type BrazilianBank } from "@/lib/brazilianBanks";

export default function DadosBancarios() {
  const { user } = useAuth();
  const { data: accounts = [] } = useBankAccounts();
  const { data: pixKeysData = [] } = usePixKeys();
  const pixKeys = pixKeysData as any[];
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState({ name: "", code: "" });
  const [form, setForm] = useState({ agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir esta conta bancária?")) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir conta"); return; }
    toast.success("Conta removida");
    invalidateAll(["bank_accounts"]);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("bank_accounts").insert({
      user_id: user.id,
      bank_name: selectedBank.name,
      bank_code: selectedBank.code,
      agency: form.agency,
      account_number: form.account_number,
      account_type: form.account_type,
      holder_name: form.holder_name,
      holder_document: form.holder_document,
    });
    if (error) { toast.error("Erro ao adicionar conta"); return; }
    toast.success("Conta adicionada");
    setOpen(false);
    invalidateAll(["bank_accounts"]);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Dados Bancários</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Gerencie suas chaves PIX e contas bancárias
          </p>
        </div>
      </div>

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
        {pixKeys.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-xs">Nenhuma chave PIX cadastrada.</div>
        )}
      </div>

      <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight">Contas Bancárias</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Contas cadastradas para transferência
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-90">
                <Plus size={16} strokeWidth={3} className="mr-2" /> Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Conta Bancária</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAccount} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input placeholder="Nome do banco" onChange={(e) => setSelectedBank({ name: e.target.value, code: "000" })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input value={form.agency} onChange={(e) => setForm({...form, agency: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Input value={form.account_number} onChange={(e) => setForm({...form, account_number: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Titular</Label>
                  <Input value={form.holder_name} onChange={(e) => setForm({...form, holder_name: e.target.value})} />
                </div>
                <Button type="submit" className="w-full">Salvar Conta</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {accounts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-xs">Nenhuma conta bancária cadastrada.</div>
        )}
        {accounts.map((acc: any) => (
          <div key={acc.id} className="p-6 flex items-center justify-between border-b border-border last:border-0">
            <div>
              <p className="font-black text-sm">{acc.bank_name}</p>
              <p className="text-xs text-muted-foreground">Agência {acc.agency} · Conta {acc.account_number}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(acc.id)}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

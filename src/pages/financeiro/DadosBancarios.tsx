import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function DadosBancarios() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase.from("bank_accounts").select("*").order("created_at");
    if (data) setAccounts(data);
  };

  useEffect(() => { loadAccounts(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("bank_accounts").insert({ ...form, user_id: user.id });
    if (error) { toast.error("Erro ao cadastrar conta"); return; }
    toast.success("Conta cadastrada com sucesso!");
    setOpen(false);
    setForm({ bank_name: "", bank_code: "", agency: "", account_number: "", account_type: "corrente", holder_name: "", holder_document: "" });
    loadAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Conta removida");
    loadAccounts();
  };

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Dados Bancários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas contas bancárias para saques</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cadastrar Conta Bancária</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Nome do banco" required />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input value={form.bank_code} onChange={(e) => setForm({ ...form, bank_code: e.target.value })} placeholder="Ex: 001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Agência</Label>
                  <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="0001" required />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="12345-6" required />
                </div>
              </div>
              <div>
                <Label>Tipo de Conta</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Conta Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Titular</Label>
                <Input value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} required />
              </div>
              <div>
                <Label>CPF/CNPJ do Titular</Label>
                <Input value={form.holder_document} onChange={(e) => setForm({ ...form, holder_document: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 ? (
          <div className="col-span-full bg-card rounded-xl border border-border p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma conta bancária cadastrada</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div key={acc.id} className="stat-card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{acc.bank_name}</h3>
                  <p className="text-sm text-muted-foreground">{acc.bank_code ? `Cód: ${acc.bank_code}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p>Ag: <span className="font-mono">{acc.agency}</span> | Conta: <span className="font-mono">{acc.account_number}</span></p>
                <p className="capitalize">{acc.account_type === "corrente" ? "Conta Corrente" : "Conta Poupança"}</p>
                <p className="text-muted-foreground">{acc.holder_name} — {acc.holder_document}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

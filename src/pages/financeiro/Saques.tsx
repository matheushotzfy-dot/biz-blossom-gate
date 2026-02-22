import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDownToLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function Saques() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");

  const loadData = async () => {
    if (!user) return;
    const [wRes, baRes] = await Promise.all([
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("*"),
    ]);
    if (wRes.data) setWithdrawals(wRes.data);
    if (baRes.data) setBankAccounts(baRes.data);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    const feeAmount = 5.00;
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      bank_account_id: selectedAccount || null,
      amount: numAmount,
      fee_amount: feeAmount,
      net_amount: numAmount - feeAmount,
    });
    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado com sucesso!");
    setOpen(false);
    setAmount("");
    setSelectedAccount("");
    loadData();
  };

  const totalPending = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="h-6 w-6 text-primary" /> Saques
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Solicite e acompanhe seus saques</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Saque</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Solicitar Saque</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
                <p className="text-xs text-muted-foreground mt-1">Taxa de saque: R$ 5,00</p>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.bank_name} — Ag: {acc.agency} Conta: {acc.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bankAccounts.length === 0 && <p className="text-xs text-destructive mt-1">Cadastre uma conta bancária primeiro</p>}
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={bankAccounts.length === 0}>
                Solicitar Saque
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-xl font-bold mt-1 text-warning">R$ {totalPending.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total de Saques</p>
          <p className="text-xl font-bold mt-1">{withdrawals.length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">ID</th>
              <th className="text-left p-4 font-medium">Valor</th>
              <th className="text-left p-4 font-medium">Taxa</th>
              <th className="text-left p-4 font-medium">Líquido</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum saque realizado</td></tr>
            ) : (
              withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono text-xs">{w.id.slice(0, 8)}</td>
                  <td className="p-4 font-semibold">R$ {Number(w.amount).toFixed(2)}</td>
                  <td className="p-4 text-warning">R$ {Number(w.fee_amount).toFixed(2)}</td>
                  <td className="p-4 text-success">R$ {Number(w.net_amount).toFixed(2)}</td>
                  <td className="p-4"><StatusBadge status={w.status} /></td>
                  <td className="p-4 text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

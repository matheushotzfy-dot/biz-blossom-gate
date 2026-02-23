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
import { PageShell, Panel, PageTitle, DataTable } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Saques() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Tables<"bank_accounts">[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");

  const loadData = async () => {
    if (!user?.id) return;
    const [wRes, baRes] = await Promise.all([
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("*").eq("user_id", user.id),
    ]);
    if (wRes.data) setWithdrawals(wRes.data);
    if (baRes.data) setBankAccounts(baRes.data);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    const feeAmount = 5.00;
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, bank_account_id: selectedAccount || null, amount: numAmount, fee_amount: feeAmount, net_amount: numAmount - feeAmount });
    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado!");
    setOpen(false); setAmount(""); setSelectedAccount(""); loadData();
  };

  const totalPending = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<ArrowDownToLine className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}><Plus className="h-4 w-4" /> Novo Saque</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-foreground">Solicitar Saque</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-foreground/70">Valor (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="text-foreground" />
                <p className="text-xs text-foreground/40 mt-1">Taxa de saque: R$ 5,00</p>
              </div>
              <div>
                <Label className="text-foreground/70">Conta Bancária</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="text-foreground"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                  <SelectContent>{bankAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.bank_name} — Ag: {acc.agency} Conta: {acc.account_number}</SelectItem>))}</SelectContent>
                </Select>
                {bankAccounts.length === 0 && <p className="text-xs text-destructive mt-1">Cadastre uma conta bancária primeiro</p>}
              </div>
              <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }} disabled={bankAccounts.length === 0}>Solicitar Saque</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Pendentes</p><p className="text-[22px] font-extrabold mt-2" style={{ color: "#FFAA00" }}>R$ {totalPending.toFixed(2)}</p></Panel>
        <Panel><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Total de Saques</p><p className="text-[22px] font-extrabold mt-2 text-white">{withdrawals.length}</p></Panel>
      </div>

      <DataTable headers={["ID", "Valor", "Taxa", "Líquido", "Status", "Data"]}>
        {withdrawals.length === 0 ? (
          <tr><td colSpan={6} className="p-8 text-center text-white/20">Nenhum saque realizado</td></tr>
        ) : withdrawals.map((w) => (
          <tr key={w.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
            <td className="p-3.5 font-mono text-[11px] text-white/35">{w.id.slice(0, 8)}</td>
            <td className="p-3.5 font-bold text-white text-[13px]">R$ {Number(w.amount).toFixed(2)}</td>
            <td className="p-3.5 font-semibold text-[13px]" style={{ color: "#FFAA00" }}>R$ {Number(w.fee_amount).toFixed(2)}</td>
            <td className="p-3.5 font-semibold text-[13px]" style={{ color: "#00FFA3" }}>R$ {Number(w.net_amount).toFixed(2)}</td>
            <td className="p-3.5"><StatusBadge status={w.status} /></td>
            <td className="p-3.5 text-white/30 text-[13px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}

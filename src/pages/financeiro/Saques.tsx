import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDownToLine, Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

export default function Saques() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [selectedPixKeyId, setSelectedPixKeyId] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const loadData = async () => {
    if (!user?.id) return;
    const [wRes, pkRes] = await Promise.all([
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at") as any,
    ]);
    if (wRes.data) setWithdrawals(wRes.data);
    if (pkRes.data) setPixKeys(pkRes.data as PixKey[]);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pixKeys.length === 0) { toast.error("Cadastre uma chave PIX em Dados Bancários"); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }

    const selected = pixKeys.find(k => k.id === selectedPixKeyId) || pixKeys[0];
    await supabase.from("profiles").update({ pix_key: selected.key_value, pix_key_type: selected.key_type }).eq("user_id", user.id);

    const feeAmount = 5.00;
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount, fee_amount: feeAmount, net_amount: numAmount - feeAmount });
    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado!");
    setOpen(false); setAmount(""); setSelectedPixKeyId(""); loadData();
  };

  const totalPending = withdrawals.filter((w) => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0);

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<ArrowDownToLine className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo</span> Saque</Button>
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
                <Label>Chave PIX</Label>
                {pixKeys.length > 0 ? (
                  <Select value={selectedPixKeyId || pixKeys[0]?.id} onValueChange={setSelectedPixKeyId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a chave PIX" /></SelectTrigger>
                    <SelectContent>
                      {pixKeys.map((pk) => (
                        <SelectItem key={pk.id} value={pk.id}>
                          <span className="flex items-center gap-2">
                            <Key className="h-3 w-3 text-primary" />
                            <span className="text-xs text-muted-foreground">{pixKeyTypeLabels[pk.key_type] || pk.key_type}:</span>
                            <span className="font-mono">{pk.key_value}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-destructive mt-1">Cadastre uma chave PIX em Dados Bancários primeiro</p>
                )}
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={pixKeys.length === 0}>Solicitar Saque</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Pendentes</p>
          <p className="text-base md:text-[22px] font-extrabold mt-1 md:mt-2 text-warning truncate">R$ {totalPending.toFixed(2)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Saques</p>
          <p className="text-base md:text-[22px] font-extrabold mt-1 md:mt-2 text-foreground">{withdrawals.length}</p>
        </Panel>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum saque realizado</td></tr>
                ) : withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{w.id.slice(0, 8)}</td>
                    <td className="p-3.5 font-bold text-foreground text-[13px]">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-3.5 font-semibold text-[13px] text-warning">R$ {Number(w.fee_amount).toFixed(2)}</td>
                    <td className="p-3.5 font-semibold text-[13px] text-primary">R$ {Number(w.net_amount).toFixed(2)}</td>
                    <td className="p-3.5"><StatusBadge status={w.status} /></td>
                    <td className="p-3.5 text-muted-foreground text-[13px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {withdrawals.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-4">Nenhum saque realizado</p></Panel>
        ) : withdrawals.map((w) => (
          <Panel key={w.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-foreground font-bold text-base">R$ {Number(w.amount).toFixed(2)}</span>
              <StatusBadge status={w.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-primary font-semibold text-sm">Líq. R$ {Number(w.net_amount).toFixed(2)}</span>
              <span className="text-muted-foreground text-xs">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
            <p className="text-muted-foreground text-[11px] mt-1">Taxa: R$ {Number(w.fee_amount).toFixed(2)}</p>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

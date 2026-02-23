import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDownToLine, Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle, DataTable } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const pixKeyTypes: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Chave Aleatória", phone: "Telefone", random: "Aleatória",
};

export default function Saques() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [pixKeyType, setPixKeyType] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const loadData = async () => {
    if (!user?.id) return;
    const [wRes, pRes] = await Promise.all([
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("pix_key, pix_key_type").eq("user_id", user.id).single(),
    ]);
    if (wRes.data) setWithdrawals(wRes.data);
    if (pRes.data) {
      setPixKey(pRes.data.pix_key);
      setPixKeyType(pRes.data.pix_key_type);
    }
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!pixKey) { toast.error("Cadastre uma chave PIX em Dados Bancários primeiro"); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    const feeAmount = 5.00;
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount, fee_amount: feeAmount, net_amount: numAmount - feeAmount });
    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado!");
    setOpen(false); setAmount(""); loadData();
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
                <Label className="text-foreground/70">Chave PIX</Label>
                {pixKey ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] mt-1">
                    <Key className="h-4 w-4 text-[#00FFA3]" />
                    <div>
                      <p className="text-[11px] text-foreground/40">{pixKeyTypes[pixKeyType || ""] || pixKeyType}</p>
                      <p className="font-mono text-foreground text-[13px]">{pixKey}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive mt-1">Cadastre uma chave PIX em Dados Bancários primeiro</p>
                )}
              </div>
              <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }} disabled={!pixKey}>Solicitar Saque</Button>
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

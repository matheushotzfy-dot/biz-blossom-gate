import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle, Rocket, PartyPopper, X } from "lucide-react";
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

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Saques() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [selectedPixKeyId, setSelectedPixKeyId] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [approvedPopup, setApprovedPopup] = useState<Tables<"withdrawals"> | null>(null);

  const loadData = async () => {
    if (!user?.id) return;
    const [wRes, pkRes] = await Promise.all([
      supabase.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("pix_keys").select("*").eq("user_id", user.id).order("created_at") as any,
    ]);
    if (wRes.data) {
      // Check for newly approved withdrawals
      const oldIds = new Set(withdrawals.filter(w => w.status === "approved").map(w => w.id));
      const newApproved = (wRes.data as Tables<"withdrawals">[]).find(
        w => w.status === "approved" && !oldIds.has(w.id) && withdrawals.length > 0
      );
      if (newApproved) setApprovedPopup(newApproved);
      setWithdrawals(wRes.data);
    }
    if (pkRes.data) setPixKeys(pkRes.data as PixKey[]);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  // Poll for status changes
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user?.id, withdrawals]);

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
    toast.success("Saque solicitado com sucesso!");
    setOpen(false); setAmount(""); setSelectedPixKeyId(""); loadData();
  };

  const pending = withdrawals.filter((w) => w.status === "pending");
  const approved = withdrawals.filter((w) => w.status === "approved");
  const rejected = withdrawals.filter((w) => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<ArrowDownToLine className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques via PIX" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold gradient-primary text-primary-foreground h-11 px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Plus className="h-4 w-4" /> Novo Saque
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Solicitar Saque</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div>
                <Label className="text-sm font-semibold">Valor do saque (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1.5 h-12 text-lg font-bold"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">Taxa fixa de saque</p>
                  <p className="text-xs font-bold text-warning">R$ 5,00</p>
                </div>
                {amount && parseFloat(amount) > 5 && (
                  <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Você receberá</span>
                      <span className="text-sm font-black text-primary">{fmt(parseFloat(amount) - 5)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-semibold">Chave PIX</Label>
                {pixKeys.length > 0 ? (
                  <Select value={selectedPixKeyId || pixKeys[0]?.id} onValueChange={setSelectedPixKeyId}>
                    <SelectTrigger className="mt-1.5 h-12"><SelectValue placeholder="Selecione a chave PIX" /></SelectTrigger>
                    <SelectContent>
                      {pixKeys.map((pk) => (
                        <SelectItem key={pk.id} value={pk.id}>
                          <span className="flex items-center gap-2">
                            <Key className="h-3 w-3 text-primary" />
                            <span className="text-xs text-muted-foreground">{pixKeyTypeLabels[pk.key_type]}:</span>
                            <span className="font-mono text-sm">{pk.key_value}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1.5 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                    <p className="text-xs text-destructive font-semibold">⚠️ Cadastre uma chave PIX em Dados Bancários</p>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl shadow-lg shadow-primary/15 text-sm"
                disabled={pixKeys.length === 0}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Solicitar Saque
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pendente", value: fmt(totalPending), sub: `${pending.length} saques`, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
          { label: "Sacado", value: fmt(totalApproved), sub: `${approved.length} aprovados`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
          { label: "Recusados", value: String(rejected.length), sub: "saques", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Total", value: String(withdrawals.length), sub: "solicitações", icon: ArrowDownToLine, color: "text-primary", bg: "bg-primary/10" },
        ].map((kpi) => (
          <Panel key={kpi.label} className="relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-display font-black text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
          </Panel>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                          <ArrowDownToLine className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Nenhum saque realizado</p>
                        <p className="text-muted-foreground/60 text-xs">Solicite seu primeiro saque</p>
                      </div>
                    </td>
                  </tr>
                ) : withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono text-[11px] text-muted-foreground">{w.id.slice(0, 8)}</td>
                    <td className="p-4 font-bold text-foreground text-[14px]">{fmt(Number(w.amount))}</td>
                    <td className="p-4 text-warning font-semibold text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                    <td className="p-4 text-primary font-bold text-[14px]">{fmt(Number(w.net_amount))}</td>
                    <td className="p-4"><StatusBadge status={w.status} /></td>
                    <td className="p-4 text-muted-foreground text-[12px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {withdrawals.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <ArrowDownToLine className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum saque</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Solicite seu primeiro saque</p>
          </div>
        ) : withdrawals.map((w) => (
          <Panel key={w.id} className="relative overflow-hidden">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-foreground font-display font-black text-xl">{fmt(Number(w.amount))}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{w.id.slice(0, 12)}</p>
              </div>
              <StatusBadge status={w.status} />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Taxa</p>
                  <p className="text-warning font-semibold text-[12px]">- {fmt(Number(w.fee_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Líquido</p>
                  <p className="text-primary font-bold text-[13px]">{fmt(Number(w.net_amount))}</p>
                </div>
              </div>
              <span className="text-muted-foreground text-[11px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </Panel>
        ))}
      </div>

      {/* ─── APPROVED CELEBRATION POPUP ─── */}
      {approvedPopup && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl animate-scale-in overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <button
              onClick={() => setApprovedPopup(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="relative p-8 text-center">
              <div className="mx-auto mb-5 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-black text-foreground mb-2">PARABÉNS! 🎉</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Seu saque de <strong className="text-primary font-black text-lg">{fmt(Number(approvedPopup.net_amount))}</strong> foi aprovado!
              </p>
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 mb-5">
                <div className="flex items-center gap-2 justify-center">
                  <Rocket className="h-5 w-5 text-primary" />
                  <p className="text-sm font-bold text-foreground">Bora para o próximo! Você está voando! 🚀</p>
                </div>
              </div>
              <Button
                onClick={() => setApprovedPopup(null)}
                className="w-full gradient-primary text-primary-foreground font-bold h-11 rounded-xl shadow-lg shadow-primary/15"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, TrendingUp, Shield, Zap,
  Sparkles, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Saques() {
  const { user } = useAuth();
  const { data: withdrawals = [], refetch: refetchWithdrawals } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const invalidateAll = useInvalidateAll();
  const [selectedPixKeyId, setSelectedPixKeyId] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [approvedPopup, setApprovedPopup] = useState<Tables<"withdrawals"> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => refetchWithdrawals(), 30000);
    return () => clearInterval(interval);
  }, [user?.id, refetchWithdrawals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pixKeys.length === 0) { toast.error("Cadastre uma chave PIX em Dados Bancários"); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    if (numAmount <= 5) { toast.error("Valor mínimo deve ser maior que a taxa de R$ 5,00"); return; }
    const selected = pixKeys.find(k => k.id === selectedPixKeyId) || pixKeys[0];
    await supabase.from("profiles").update({ pix_key: selected.key_value, pix_key_type: selected.key_type }).eq("user_id", user.id);
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("Saldo insuficiente")) toast.error(msg);
      else if (msg.includes("Máximo de 3")) toast.error("Você já tem 3 saques pendentes");
      else if (msg.includes("congelado")) toast.error("Saldo congelado pelo administrador");
      else toast.error("Erro ao solicitar saque");
      return;
    }
    toast.success("Saque solicitado com sucesso!");
    setOpen(false); setAmount(""); setSelectedPixKeyId(""); invalidateAll(["withdrawals"]);
  };

  const pending = withdrawals.filter((w) => w.status === "pending");
  const approved = withdrawals.filter((w) => w.status === "approved");
  const rejected = withdrawals.filter((w) => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Wallet className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques via PIX" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl h-10 text-sm font-bold shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Novo Saque
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30">
              <DialogHeader>
                <DialogTitle className="font-display font-black text-lg tracking-tight flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                    <ArrowDownToLine className="h-4.5 w-4.5 text-primary" />
                  </div>
                  Solicitar Saque
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Amount field with accent card */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Valor do saque (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-1.5 h-14 text-xl font-numbers font-black rounded-xl bg-card/80 border-border/40" />
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11px] text-muted-foreground/70">Taxa fixa de saque</p>
                  <p className="text-[12px] font-numbers font-bold text-warning">- R$ 5,00</p>
                </div>
                {amount && parseFloat(amount) > 5 && (
                  <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                          <Zap className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-[12px] text-muted-foreground font-medium">Você receberá</span>
                      </div>
                      <span className="text-lg font-numbers font-black text-primary">{fmt(parseFloat(amount) - 5)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* PIX key selector with accent card */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Chave PIX</Label>
                {pixKeys.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {pixKeys.map((pk) => {
                      const isSelected = (selectedPixKeyId || pixKeys[0]?.id) === pk.id;
                      return (
                        <button
                          key={pk.id}
                          type="button"
                          onClick={() => setSelectedPixKeyId(pk.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] text-left",
                            isSelected
                              ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5"
                              : "border-border/30 bg-card/50 hover:border-border/50 hover:bg-muted/20"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg ring-1 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-primary/15 ring-primary/20" : "bg-muted/30 ring-border/20"
                          )}>
                            <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[11px] font-bold", isSelected ? "text-primary" : "text-muted-foreground")}>
                              {pixKeyTypeLabels[pk.key_type]}
                            </p>
                            <p className={cn("font-mono text-sm font-bold truncate", isSelected ? "text-foreground" : "text-foreground/70")}>
                              {pk.key_value}
                            </p>
                          </div>
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected ? "border-primary bg-primary" : "border-border/60"
                          )}>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 p-4 rounded-xl border border-destructive/15 bg-destructive/5">
                    <p className="text-[12px] text-destructive font-bold flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários
                    </p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full font-bold h-11 rounded-xl text-sm shadow-lg shadow-primary/20" disabled={pixKeys.length === 0}>
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs — Premium Glass */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Hero KPI - Total Aprovado */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="relative col-span-2 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-6 overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Total Aprovado</span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-4xl md:text-5xl font-numbers font-black text-foreground leading-none tracking-tight">{fmt(totalApproved)}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-2 font-medium">{approved.length} saques aprovados · {withdrawals.length} total</p>
        </motion.div>

        {/* Pendente */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
          className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Pendente</span>
            <div className="h-9 w-9 rounded-xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-numbers font-black text-foreground leading-none tracking-tight">{fmt(totalPending)}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-1.5 flex items-center gap-1.5 font-medium">
            {pending.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
            )}
            {pending.length} saques
          </p>
        </motion.div>

        {/* Recusados */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }}
          className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-destructive" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Recusados</span>
            <div className="h-9 w-9 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-numbers font-black text-foreground leading-none tracking-tight">{rejected.length}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-1.5 font-medium">saques recusados</p>
        </motion.div>
      </div>

      {/* Desktop Table — Premium */}
      <div className="hidden md:block">
        <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden shadow-sm">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/5">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {withdrawals.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque realizado" subtitle="Solicite seu primeiro saque" />
                  </td></tr>
                ) : withdrawals.map((w, i) => (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="p-4 font-mono text-[11px] text-muted-foreground/60">{w.id.slice(0, 8)}</td>
                    <td className="p-4 font-numbers font-black text-foreground text-[15px]">{fmt(Number(w.amount))}</td>
                    <td className="p-4 text-warning font-numbers font-bold text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                    <td className="p-4 text-primary font-numbers font-black text-[15px]">{fmt(Number(w.net_amount))}</td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        w.status === "approved" && "bg-success/10 text-success",
                        w.status === "pending" && "bg-warning/10 text-warning",
                        w.status === "rejected" && "bg-destructive/10 text-destructive",
                      )}>
                        {w.status === "pending" && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                          </span>
                        )}
                        {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground/70 text-[12px] font-bold">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile Cards — Premium */}
      <div className="md:hidden space-y-2">
        {withdrawals.length === 0 ? (
          <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque" subtitle="Solicite seu primeiro saque" />
        ) : withdrawals.map((w, i) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-4 overflow-hidden"
          >
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
              w.status === "approved" ? "bg-success" : w.status === "pending" ? "bg-warning" : "bg-destructive"
            )} />
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-foreground font-numbers font-black text-xl">{fmt(Number(w.amount))}</p>
                <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">{w.id.slice(0, 12)}</p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                w.status === "approved" && "bg-success/10 text-success",
                w.status === "pending" && "bg-warning/10 text-warning",
                w.status === "rejected" && "bg-destructive/10 text-destructive",
              )}>
                {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/20">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em] font-bold">Taxa</p>
                  <p className="text-warning font-numbers font-bold text-[12px] mt-0.5">- {fmt(Number(w.fee_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em] font-bold">Líquido</p>
                  <p className="text-primary font-numbers font-black text-[14px] mt-0.5">{fmt(Number(w.net_amount))}</p>
                </div>
              </div>
              <span className="text-muted-foreground/60 text-[11px] font-medium">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Security footer — Premium */}
      <div className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-4 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
            <Shield className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="text-[11px] text-muted-foreground/70 font-medium">
            Saques são processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
          </p>
        </div>
      </div>

      {/* Approved Celebration Popup — Premium */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setApprovedPopup(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden"
            >
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors z-10">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="p-8 text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <PartyPopper className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-black text-foreground mb-2 tracking-tight">Saque Aprovado!</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Seu saque de <span className="text-primary font-numbers font-black">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!
                </p>
                <Button onClick={() => setApprovedPopup(null)} className="w-full rounded-xl font-bold shadow-lg shadow-primary/20">
                  <Rocket className="h-4 w-4 mr-2" /> Entendido!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

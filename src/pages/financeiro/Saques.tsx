import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, TrendingUp, Shield, Zap,
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
            <Button className="gap-2 rounded-lg h-9 text-[12px] font-medium">
              <Plus className="h-3.5 w-3.5" /> Novo Saque
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowDownToLine className="h-4 w-4 text-primary" />
                  </div>
                  Solicitar Saque
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Valor do saque (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-1.5 h-14 text-xl font-display font-bold rounded-lg" />
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11px] text-muted-foreground/70">Taxa fixa de saque</p>
                  <p className="text-[12px] font-medium text-warning">- R$ 5,00</p>
                </div>
                {amount && parseFloat(amount) > 5 && (
                  <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[12px] text-muted-foreground">Você receberá</span>
                      </div>
                      <span className="text-lg font-display font-bold text-primary">{fmt(parseFloat(amount) - 5)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Chave PIX</Label>
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
                            "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left",
                            isSelected
                              ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/5"
                              : "border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-primary/15" : "bg-muted/50"
                          )}>
                            <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[11px] font-medium", isSelected ? "text-primary" : "text-muted-foreground")}>
                              {pixKeyTypeLabels[pk.key_type]}
                            </p>
                            <p className={cn("font-mono text-sm font-semibold truncate", isSelected ? "text-foreground" : "text-foreground/70")}>
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
                    <p className="text-[12px] text-destructive font-medium flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários
                    </p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full font-medium h-11 rounded-lg text-sm" disabled={pixKeys.length === 0}>
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs — Glass */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="col-span-2 rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Total Aprovado</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <p className="text-4xl md:text-5xl font-display font-bold text-foreground leading-none tracking-tight">{fmt(totalApproved)}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-2">{approved.length} saques aprovados · {withdrawals.length} total</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }} className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Pendente</span>
            <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground leading-none tracking-tight">{fmt(totalPending)}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-1.5 flex items-center gap-1.5">
            {pending.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
            )}
            {pending.length} saques
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }} className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Recusados</span>
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground leading-none tracking-tight">{rejected.length}</p>
          <p className="text-[12px] text-muted-foreground/70 mt-1.5">saques recusados</p>
        </motion.div>
      </div>

      {/* Desktop Table — no outer border, breathing */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 dark:border-foreground/[0.05]">
                {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                  <th key={h} className="text-left p-4 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 dark:divide-foreground/[0.03]">
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
                  className="hover:bg-muted/20 dark:hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="p-4 font-mono text-[11px] text-muted-foreground/60">{w.id.slice(0, 8)}</td>
                  <td className="p-4 font-display font-bold text-foreground text-[15px]">{fmt(Number(w.amount))}</td>
                  <td className="p-4 text-warning font-medium text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                  <td className="p-4 text-primary font-display font-bold text-[15px]">{fmt(Number(w.net_amount))}</td>
                  <td className="p-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
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
                  <td className="p-4 text-muted-foreground/70 text-[12px] font-medium">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {withdrawals.length === 0 ? (
          <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque" subtitle="Solicite seu primeiro saque" />
        ) : withdrawals.map((w, i) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-foreground font-display font-bold text-xl">{fmt(Number(w.amount))}</p>
                <p className="text-[11px] text-muted-foreground/50 font-mono mt-0.5">{w.id.slice(0, 12)}</p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                w.status === "approved" && "bg-success/10 text-success",
                w.status === "pending" && "bg-warning/10 text-warning",
                w.status === "rejected" && "bg-destructive/10 text-destructive",
              )}>
                {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/20 dark:border-foreground/[0.04]">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Taxa</p>
                  <p className="text-warning font-medium text-[12px] mt-0.5">- {fmt(Number(w.fee_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Líquido</p>
                  <p className="text-primary font-display font-bold text-[14px] mt-0.5">{fmt(Number(w.net_amount))}</p>
                </div>
              </div>
              <span className="text-muted-foreground/60 text-[11px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Security footer */}
      <div className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground/70">
            Saques são processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
          </p>
        </div>
      </div>

      {/* Approved Celebration Popup */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setApprovedPopup(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden"
            >
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors z-10">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="p-8 text-center">
                <div className="mx-auto mb-5 h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PartyPopper className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">PARABÉNS! 🎉</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Seu saque de <span className="text-primary font-bold">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!
                </p>
                <Button onClick={() => setApprovedPopup(null)} className="w-full rounded-lg font-medium">
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

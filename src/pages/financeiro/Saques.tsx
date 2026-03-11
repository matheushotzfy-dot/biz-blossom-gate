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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
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

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } } },
};

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
    const selected = pixKeys.find(k => k.id === selectedPixKeyId) || pixKeys[0];
    await supabase.from("profiles").update({ pix_key: selected.key_value, pix_key_type: selected.key_type }).eq("user_id", user.id);
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) { toast.error("Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado com sucesso!");
    setOpen(false); setAmount(""); setSelectedPixKeyId(""); invalidateAll(["withdrawals"]);
  };

  const pending = withdrawals.filter((w) => w.status === "pending");
  const approved = withdrawals.filter((w) => w.status === "approved");
  const rejected = withdrawals.filter((w) => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);
  const totalAll = withdrawals.reduce((a, w) => a + Number(w.amount), 0);

  return (
    <PageShell>
      {/* Spatial ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[30%] w-[600px] h-[600px] rounded-full bg-primary/[0.05] blur-[150px]" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-[1]">
        <PageTitle icon={<Wallet className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques via PIX" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold bg-primary/20 text-primary border border-primary/30 h-11 px-6 hover:bg-primary/30 hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-all duration-300">
              <Plus className="h-4 w-4" /> Novo Saque
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-white/[0.06] bg-[#141418]/95 backdrop-blur-3xl p-0 overflow-hidden shadow-2xl shadow-black/60">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent rounded-2xl pointer-events-none" />
            <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <ArrowDownToLine className="h-4 w-4 text-primary-foreground" />
                  </div>
                  Solicitar Saque
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6 relative">
              <div>
                <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Valor do saque (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-1.5 h-14 text-xl font-display font-black rounded-xl border-white/[0.08] bg-white/[0.02]" />
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11px] text-muted-foreground/40">Taxa fixa de saque</p>
                  <p className="text-[12px] font-bold text-warning">- R$ 5,00</p>
                </div>
                {amount && parseFloat(amount) > 5 && (
                  <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/15 ring-1 ring-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[12px] text-muted-foreground/60">Você receberá</span>
                      </div>
                      <span className="text-lg font-display font-black text-primary">{fmt(parseFloat(amount) - 5)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Chave PIX</Label>
                {pixKeys.length > 0 ? (
                  <Select value={selectedPixKeyId || pixKeys[0]?.id} onValueChange={setSelectedPixKeyId}>
                    <SelectTrigger className="mt-1.5 h-12 rounded-xl border-white/[0.08] bg-white/[0.02]">
                      <SelectValue placeholder="Selecione a chave PIX" />
                    </SelectTrigger>
                    <SelectContent>
                      {pixKeys.map((pk) => (
                        <SelectItem key={pk.id} value={pk.id}>
                          <span className="flex items-center gap-2">
                            <Key className="h-3 w-3 text-primary" />
                            <span className="text-[11px] text-muted-foreground/60">{pixKeyTypeLabels[pk.key_type]}:</span>
                            <span className="font-mono text-sm font-medium">{pk.key_value}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1.5 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                    <p className="text-[12px] text-destructive font-semibold flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários
                    </p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl shadow-xl shadow-primary/15 text-sm" disabled={pixKeys.length === 0}>
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── BENTO GRID ─── */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* HERO: Total Disponível */}
        <motion.div variants={stagger.item} className="lg:col-span-2 relative rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-6 md:p-8 overflow-hidden">
          <div className="absolute -bottom-16 -right-16 w-[300px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px] pointer-events-none" />
          <div className="relative z-[1]">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Total Disponível</span>
            <p className="mt-3 text-5xl md:text-6xl font-display font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 leading-none">
              {fmt(totalApproved)}
            </p>
            <p className="text-[13px] text-muted-foreground/50 mt-3 font-medium">{approved.length} saques aprovados no total</p>
            <div className="flex items-center gap-3 mt-5">
              <div className="flex items-center gap-1.5 text-primary text-[13px] font-bold">
                <TrendingUp className="h-4 w-4" />
                <span>{withdrawals.length} solicitações</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bento Secundários */}
        <div className="flex flex-col gap-4">
          <motion.div variants={stagger.item} className="relative flex-1 rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-5 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-warning/[0.08] blur-[50px] pointer-events-none" />
            <div className="relative z-[1]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Pendente</span>
                <Clock className="h-4 w-4 text-warning drop-shadow-[0_0_6px_hsl(var(--warning)/0.5)]" />
              </div>
              <p className="text-2xl font-display font-black text-foreground leading-none">{fmt(totalPending)}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1.5 font-medium flex items-center gap-1.5">
                {pending.length > 0 && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-warning" /></span>}
                {pending.length} saques
              </p>
            </div>
          </motion.div>
          <motion.div variants={stagger.item} className="relative flex-1 rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-5 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-destructive/[0.06] blur-[50px] pointer-events-none" />
            <div className="relative z-[1]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Recusados</span>
                <XCircle className="h-4 w-4 text-destructive drop-shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />
              </div>
              <p className="text-2xl font-display font-black text-foreground leading-none">{rejected.length}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1.5 font-medium">saques recusados</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ─── GHOST TABLE (Desktop) ─── */}
      <div className="hidden md:block">
        <div className="relative rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {withdrawals.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={<Wallet className="h-8 w-8" />} title="Nenhum saque realizado" subtitle="Solicite seu primeiro saque" />
                  </td></tr>
                ) : (
                  <AnimatePresence>
                    {withdrawals.map((w, i) => (
                      <motion.tr
                        key={w.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.04, type: "spring", stiffness: 300, damping: 30 }}
                        className="hover:bg-white/[0.02] transition-all duration-200 group/row"
                      >
                        <td className="p-4 font-mono text-[11px] text-muted-foreground/30">{w.id.slice(0, 8)}</td>
                        <td className="p-4 font-display font-black text-foreground text-[15px]">{fmt(Number(w.amount))}</td>
                        <td className="p-4 text-warning/70 font-semibold text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                        <td className="p-4 text-primary font-display font-black text-[16px] drop-shadow-[0_0_8px_hsl(var(--primary)/0.3)]">{fmt(Number(w.net_amount))}</td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                            w.status === "approved" && "bg-emerald-500/[0.12] text-emerald-400",
                            w.status === "pending" && "bg-amber-500/[0.12] text-amber-400",
                            w.status === "rejected" && "bg-red-500/[0.12] text-red-400",
                          )}>
                            {w.status === "pending" && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                              </span>
                            )}
                            {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                            {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                            {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground/30 text-[12px] font-medium">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── MOBILE CARDS ─── */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="md:hidden space-y-3">
        {withdrawals.length === 0 ? (
          <div className="rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl">
            <EmptyState icon={<Wallet className="h-8 w-8" />} title="Nenhum saque" subtitle="Solicite seu primeiro saque" />
          </div>
        ) : withdrawals.map((w) => (
          <motion.div key={w.id} variants={stagger.item} className="rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-foreground font-display font-black text-xl">{fmt(Number(w.amount))}</p>
                <p className="text-[11px] text-muted-foreground/30 font-mono mt-0.5">{w.id.slice(0, 12)}</p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                w.status === "approved" && "bg-emerald-500/[0.12] text-emerald-400",
                w.status === "pending" && "bg-amber-500/[0.12] text-amber-400",
                w.status === "rejected" && "bg-red-500/[0.12] text-red-400",
              )}>
                {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" /></span>}
                {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold">Taxa</p>
                  <p className="text-warning/70 font-semibold text-[12px] mt-0.5">- {fmt(Number(w.fee_amount))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-bold">Líquido</p>
                  <p className="text-primary font-display font-bold text-[14px] mt-0.5 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]">{fmt(Number(w.net_amount))}</p>
                </div>
              </div>
              <span className="text-muted-foreground/30 text-[11px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Security footer */}
      <div className="rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary/40 shrink-0 drop-shadow-[0_0_4px_hsl(var(--primary)/0.3)]" />
          <p className="text-[11px] text-muted-foreground/40">
            Saques são processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
          </p>
        </div>
      </div>

      {/* ─── APPROVED CELEBRATION POPUP ─── */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#040405]/80 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="relative w-full max-w-sm rounded-2xl ring-1 ring-primary/20 bg-[#141418]/95 backdrop-blur-3xl shadow-2xl shadow-black/60 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-white/[0.05] flex items-center justify-center hover:bg-white/[0.1] z-10 ring-1 ring-white/[0.06]">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center">
                  <PartyPopper className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-black text-foreground mb-2">PARABÉNS! 🎉</h2>
                <p className="text-muted-foreground/70 text-sm mb-4">
                  Seu saque de <strong className="text-primary font-display font-black text-lg">{fmt(Number(approvedPopup.net_amount))}</strong> foi aprovado!
                </p>
                <div className="rounded-xl bg-primary/5 ring-1 ring-primary/10 p-4 mb-5">
                  <div className="flex items-center gap-2 justify-center">
                    <Rocket className="h-5 w-5 text-primary" />
                    <p className="text-sm font-bold text-foreground">Bora para o próximo! Você está voando! 🚀</p>
                  </div>
                </div>
                <Button onClick={() => setApprovedPopup(null)} className="w-full gradient-primary text-primary-foreground font-bold h-11 rounded-xl shadow-xl shadow-primary/15">
                  Fechar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

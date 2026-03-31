import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Plus, Key, Clock, CheckCircle2, XCircle,
  Rocket, PartyPopper, X, Wallet, TrendingUp, Shield, Zap,
  ChevronDown, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, GlassKpi, Panel, SectionHeader, EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type TabFilter = "all" | "pending" | "approved" | "rejected";

const TAB_CONFIG: Record<TabFilter, { label: string; dot: string; active: string }> = {
  all:      { label: "Todos",     dot: "bg-primary",     active: "bg-primary/10 text-primary ring-primary/15" },
  pending:  { label: "Pendentes", dot: "bg-warning",     active: "bg-warning/10 text-warning ring-warning/15" },
  approved: { label: "Aprovados", dot: "bg-success",     active: "bg-success/10 text-success ring-success/15" },
  rejected: { label: "Recusados", dot: "bg-destructive", active: "bg-destructive/10 text-destructive ring-destructive/15" },
};

const STATUS_ACCENT: Record<string, string> = {
  approved: "bg-success", pending: "bg-warning", rejected: "bg-destructive",
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
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

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

  const filteredWithdrawals = activeTab === "all" ? withdrawals : withdrawals.filter(w => w.status === activeTab);

  const tabCounts: Record<TabFilter, number> = {
    all: withdrawals.length,
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
  };

  return (
    <PageShell>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Wallet className="h-6 w-6" />} title="Saques" subtitle="Solicite e acompanhe seus saques via PIX" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className={cn(
              "h-10 px-5 rounded-xl text-[12px] font-display font-bold flex items-center gap-2",
              "gradient-primary text-primary-foreground shadow-lg shadow-primary/20",
              "hover:shadow-xl hover:shadow-primary/25 active:scale-[0.985] transition-all duration-300"
            )}>
              <Plus className="h-4 w-4" /> Novo Saque
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
            <div className="px-6 pt-6 pb-4 border-b border-border/15">
              <DialogHeader>
                <DialogTitle className="font-display font-black text-lg tracking-[-0.03em] flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                    <ArrowDownToLine className="h-4 w-4 text-primary" />
                  </div>
                  Solicitar Saque
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {/* Amount */}
              <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                <div className="pl-1.5">
                  <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Valor do saque (R$)</Label>
                  <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-2 h-14 text-xl font-display font-black rounded-xl bg-muted/5 border-border/15 focus:ring-2 focus:ring-primary/10" />
                  <div className="flex items-center justify-between mt-2.5">
                    <p className="text-[10px] font-display font-semibold text-muted-foreground/30">Taxa fixa de saque</p>
                    <p className="text-[11px] font-display font-bold text-warning tabular-nums">- R$ 5,00</p>
                  </div>
                  {amount && parseFloat(amount) > 5 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                            <Zap className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-[11px] text-muted-foreground/50 font-display font-semibold">Você receberá</span>
                        </div>
                        <span className="text-lg font-display font-black text-primary tabular-nums">{fmt(parseFloat(amount) - 5)}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* PIX key selector */}
              <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                <div className="pl-1.5">
                  <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Chave PIX</Label>
                  {pixKeys.length > 0 ? (
                    <div className="mt-2.5 space-y-1.5">
                      {pixKeys.map((pk) => {
                        const isSelected = (selectedPixKeyId || pixKeys[0]?.id) === pk.id;
                        return (
                          <button
                            key={pk.id}
                            type="button"
                            onClick={() => setSelectedPixKeyId(pk.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] text-left",
                              isSelected
                                ? "border-primary/20 bg-primary/5 ring-1 ring-primary/10"
                                : "border-border/15 bg-muted/5 hover:border-border/30 hover:bg-muted/10"
                            )}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-lg ring-1 flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "bg-primary/10 ring-primary/15" : "bg-muted/10 ring-border/15"
                            )}>
                              <Key className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground/30")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[10px] font-display font-bold", isSelected ? "text-primary" : "text-muted-foreground/40")}>
                                {pixKeyTypeLabels[pk.key_type]}
                              </p>
                              <p className={cn("font-mono text-[12px] font-bold truncate", isSelected ? "text-foreground" : "text-foreground/50")}>
                                {pk.key_value}
                              </p>
                            </div>
                            <div className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
                              isSelected ? "border-primary bg-primary" : "border-border/30"
                            )}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2.5 p-3.5 rounded-xl border border-destructive/10 bg-destructive/5">
                      <p className="text-[11px] text-destructive font-display font-bold flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5" /> Cadastre uma chave PIX em Dados Bancários
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={pixKeys.length === 0}
                className={cn(
                  "w-full h-11 rounded-xl text-[12px] font-display font-bold flex items-center justify-center gap-2",
                  "gradient-primary text-primary-foreground shadow-lg shadow-primary/20",
                  "hover:shadow-xl hover:shadow-primary/25 active:scale-[0.985] transition-all duration-300",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                )}
              >
                <ArrowDownToLine className="h-4 w-4" /> Solicitar Saque
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Total Aprovado" value={fmt(totalApproved)} sub={`${approved.length} saques aprovados`} icon={TrendingUp} tone="primary" delay={0} large />
        <GlassKpi label="Total Solicitado" value={fmt(withdrawals.reduce((a, w) => a + Number(w.amount), 0))} sub={`${withdrawals.length} saques totais`} icon={CheckCircle2} tone="success" delay={1} large />
        <GlassKpi label="Pendente" value={fmt(totalPending)} sub={`${pending.length} saques`} icon={Clock} tone="warning" delay={2} />
        <GlassKpi label="Recusados" value={String(rejected.length)} sub="saques recusados" icon={XCircle} tone="destructive" delay={3} />
      </div>

      {/* ─── Tabs + Table ─── */}
      <Panel className="p-0 overflow-visible">
        {/* Tab bar */}
        <div className="px-4 pt-3.5 pb-0">
          <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-none border-b border-border/10">
            {(Object.keys(TAB_CONFIG) as TabFilter[]).map((tab) => {
              const isActive = activeTab === tab;
              const config = TAB_CONFIG[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-display font-bold transition-all duration-300",
                    isActive
                      ? config.active + " ring-1"
                      : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/5"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="saque-tab-dot"
                      className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  {config.label}
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-md font-display font-bold min-w-[20px] text-center tabular-nums",
                    isActive ? "bg-foreground/5" : "bg-muted/10 text-muted-foreground/20"
                  )}>{tabCounts[tab]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/10">
                  {["ID", "Valor", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-4 text-[9px] font-display font-bold text-muted-foreground/25 uppercase tracking-[0.18em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque encontrado" subtitle="Solicite seu primeiro saque" />
                  </td></tr>
                ) : filteredWithdrawals.map((w, i) => (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                    className="border-b border-border/10 hover:bg-muted/5 transition-all duration-300 group"
                  >
                    <td className="p-4">
                      <span className="font-mono text-[10px] text-muted-foreground/25 bg-muted/8 px-2 py-0.5 rounded-md">{w.id.slice(0, 8)}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-display font-black text-foreground text-[14px] tabular-nums tracking-[-0.02em]">{fmt(Number(w.amount))}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-display font-bold text-warning/70 text-[12px] tabular-nums">- {fmt(Number(w.fee_amount))}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-display font-black text-primary text-[14px] tabular-nums tracking-[-0.02em]">{fmt(Number(w.net_amount))}</span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] ring-1",
                        w.status === "approved" && "bg-success/8 text-success ring-success/10",
                        w.status === "pending" && "bg-warning/8 text-warning ring-warning/10",
                        w.status === "rejected" && "bg-destructive/8 text-destructive ring-destructive/10",
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
                    <td className="p-4">
                      <span className="text-muted-foreground/30 text-[11px] font-display font-semibold tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-3 space-y-2">
          {filteredWithdrawals.length === 0 ? (
            <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque" subtitle="Solicite seu primeiro saque" />
          ) : filteredWithdrawals.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300"
            >
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", STATUS_ACCENT[w.status] || "bg-muted")} />
              <div className="flex items-start justify-between mb-3 pl-1.5">
                <div>
                  <p className="text-foreground font-display font-black text-xl tabular-nums tracking-[-0.03em]">{fmt(Number(w.amount))}</p>
                  <p className="text-[9px] text-muted-foreground/20 font-mono mt-0.5">{w.id.slice(0, 12)}</p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] ring-1",
                  w.status === "approved" && "bg-success/8 text-success ring-success/10",
                  w.status === "pending" && "bg-warning/8 text-warning ring-warning/10",
                  w.status === "rejected" && "bg-destructive/8 text-destructive ring-destructive/10",
                )}>
                  {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                  {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/10 pl-1.5">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Taxa</p>
                    <p className="text-warning/60 font-display font-bold text-[11px] mt-0.5 tabular-nums">- {fmt(Number(w.fee_amount))}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Líquido</p>
                    <p className="text-primary font-display font-black text-[13px] mt-0.5 tabular-nums">{fmt(Number(w.net_amount))}</p>
                  </div>
                </div>
                <span className="text-muted-foreground/20 text-[10px] font-display tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/10">
          <p className="text-[10px] font-display font-bold text-muted-foreground/25">
            {filteredWithdrawals.length} saque{filteredWithdrawals.length !== 1 ? "s" : ""}
          </p>
          {filteredWithdrawals.length > 0 && (
            <p className="text-[10px] font-display font-bold text-primary/50 tabular-nums">
              {fmt(filteredWithdrawals.reduce((a, w) => a + Number(w.net_amount), 0))} líquido total
            </p>
          )}
        </div>
      </Panel>

      {/* ─── Security Footer ─── */}
      <Panel className="overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
        <div className="flex items-center gap-3 pl-1.5">
          <div className="h-8 w-8 rounded-xl bg-success/8 ring-1 ring-success/10 flex items-center justify-center shrink-0">
            <Shield className="h-3.5 w-3.5 text-success/60" />
          </div>
          <p className="text-[10px] text-muted-foreground/30 font-display font-semibold">
            Saques são processados via PIX com verificação de saldo em tempo real. Taxa fixa de R$ 5,00 por operação.
          </p>
        </div>
      </Panel>

      {/* ─── Approved Popup ─── */}
      <AnimatePresence>
        {approvedPopup && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setApprovedPopup(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <button onClick={() => setApprovedPopup(null)} className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors z-10">
                <X className="h-4 w-4 text-muted-foreground/40" />
              </button>
              <div className="relative p-8 text-center">
                <div className="mx-auto mb-5 h-20 w-20 rounded-2xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                  <PartyPopper className="h-9 w-9 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-black text-foreground mb-2 tracking-[-0.03em]">Saque Aprovado!</h2>
                <p className="text-muted-foreground/50 text-[13px] font-display mb-6">
                  Seu saque de <span className="text-primary font-display font-black">{fmt(Number(approvedPopup.net_amount))}</span> foi aprovado!
                </p>
                <button
                  onClick={() => setApprovedPopup(null)}
                  className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-[12px] shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-300"
                >
                  <Rocket className="h-4 w-4" /> Entendido!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

/**
 * Suporte — Ultra-Premium Support Center
 * @module Suporte
 * @version 5.0.0 — Fintech Premium Redesign (Vendas-quality)
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send,
  ChevronDown, Inbox, Search, X, Headphones, Shield, Zap,
  Sparkles, ArrowUpRight, MessageCircleMore, LifeBuoy, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock; bg: string; accent: string; glow: string }> = {
  open:        { label: "Aberto",        color: "text-warning",           icon: Clock,        bg: "bg-warning/8 ring-warning/15",      accent: "bg-warning",     glow: "shadow-warning/10" },
  in_progress: { label: "Em andamento", color: "text-info",             icon: AlertCircle,  bg: "bg-info/8 ring-info/15",            accent: "bg-info",        glow: "shadow-info/10" },
  resolved:    { label: "Resolvido",     color: "text-success",          icon: CheckCircle2, bg: "bg-success/8 ring-success/15",      accent: "bg-success",     glow: "shadow-success/10" },
  closed:      { label: "Fechado",       color: "text-muted-foreground", icon: CheckCircle2, bg: "bg-muted/8 ring-border/15",         accent: "bg-muted-foreground", glow: "shadow-muted/10" },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  low:    { label: "Baixa",   cls: "bg-muted/8 text-muted-foreground ring-border/15" },
  normal: { label: "Normal",  cls: "bg-info/8 text-info ring-info/15" },
  high:   { label: "Alta",    cls: "bg-warning/8 text-warning ring-warning/15" },
  urgent: { label: "Urgente", cls: "bg-destructive/8 text-destructive ring-destructive/15" },
};

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;
const ease = [0.16, 1, 0.3, 1] as const;

/* ─── Micro Components ─── */

function LivePulse() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
      </div>
      <span className="text-[9px] font-display font-bold text-success/70 uppercase tracking-[0.15em]">Online</span>
    </div>
  );
}

function GlowKpi({ label, value, icon: Icon, tone = "primary", delay = 0 }: {
  label: string; value: string; icon: any; tone?: string; delay?: number;
}) {
  const colors: Record<string, { bg: string; ring: string; text: string; accent: string; glow: string }> = {
    primary: { bg: "bg-primary/8", ring: "ring-primary/15", text: "text-primary", accent: "bg-primary", glow: "shadow-primary/10" },
    success: { bg: "bg-success/8", ring: "ring-success/15", text: "text-success", accent: "bg-success", glow: "shadow-success/10" },
    info:    { bg: "bg-info/8",    ring: "ring-info/15",    text: "text-info",    accent: "bg-info",    glow: "shadow-info/10" },
    warning: { bg: "bg-warning/8", ring: "ring-warning/15", text: "text-warning", accent: "bg-warning", glow: "shadow-warning/10" },
  };
  const c = colors[tone] || colors.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay * 0.06, duration: 0.5, ease }}
      className={cn(
        "relative group rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden",
        "hover:ring-border/40 transition-all duration-300",
        `hover:shadow-lg ${c.glow}`
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", c.accent)} />
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `${c.bg}`)} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1 transition-all group-hover:scale-110 group-hover:shadow-lg", c.bg, c.ring)}>
            <Icon className={cn("h-4 w-4", c.text)} />
          </div>
          <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">{label}</span>
        </div>
        <p className={cn("text-2xl font-display font-black tracking-[-0.04em] tabular-nums", c.text)}>{value}</p>
      </div>
    </motion.div>
  );
}

export default function Suporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadTickets = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, [user?.id]);

  const handleSubmit = async () => {
    if (!user?.id) return;
    const trimSubject = subject.trim();
    const trimMessage = message.trim();
    if (!trimSubject || trimSubject.length < 3) { toast.error("O assunto deve ter no mínimo 3 caracteres."); return; }
    if (trimSubject.length > MAX_SUBJECT) { toast.error(`O assunto deve ter no máximo ${MAX_SUBJECT} caracteres.`); return; }
    if (!trimMessage || trimMessage.length < 10) { toast.error("A mensagem deve ter no mínimo 10 caracteres."); return; }
    if (trimMessage.length > MAX_MESSAGE) { toast.error(`A mensagem deve ter no máximo ${MAX_MESSAGE} caracteres.`); return; }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id, subject: trimSubject, message: trimMessage, priority,
    });
    setSubmitting(false);
    if (error) { toast.error("Não foi possível criar o ticket."); }
    else {
      toast.success("Ticket criado com sucesso! Responderemos em breve.");
      setSubject(""); setMessage(""); setPriority("normal"); setShowForm(false);
      loadTickets();
    }
  };

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    replied: tickets.filter(t => !!t.admin_reply).length,
  }), [tickets]);

  const filtered = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.subject.toLowerCase().includes(q) || t.message.toLowerCase().includes(q));
    }
    return result;
  }, [tickets, search, statusFilter]);

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative space-y-5">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.18, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[200px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-info/12 rounded-full blur-[180px]" />
      </div>

      {/* ═══ Hero Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/3 pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/3 to-transparent pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.6 }}
                className="h-14 w-14 rounded-2xl bg-primary/8 ring-1 ring-primary/20 flex items-center justify-center shadow-lg shadow-primary/10"
              >
                <Headphones className="h-7 w-7 text-primary" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-xl md:text-2xl font-display font-black tracking-[-0.04em] text-foreground">Central de Suporte</h1>
                  <LivePulse />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground/40">Abra tickets e acompanhe suas solicitações em tempo real</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="gap-2 rounded-xl text-sm font-display font-bold h-11 px-6 shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all active:scale-[0.985]"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancelar" : "Novo Ticket"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlowKpi label="Total" value={String(stats.total)} icon={Inbox} tone="primary" delay={0} />
        <GlowKpi label="Em Aberto" value={String(stats.open)} icon={Clock} tone="warning" delay={1} />
        <GlowKpi label="Resolvidos" value={String(stats.resolved)} icon={CheckCircle2} tone="success" delay={2} />
        <GlowKpi label="Respondidos" value={String(stats.replied)} icon={MessageCircleMore} tone="info" delay={3} />
      </div>

      {/* ═══ Form ═══ */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-7 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />

              <div className="relative z-10 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                    <Send className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-display font-black text-foreground tracking-[-0.02em]">Novo Ticket de Suporte</h3>
                    <p className="text-[9px] text-muted-foreground/40">Descreva seu problema com detalhes para agilizar o atendimento</p>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">
                    Assunto <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                    placeholder="Ex: Problema com saque pendente"
                    className="w-full rounded-xl border border-border/20 bg-muted/5 ring-1 ring-border/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/25 focus:border-primary/30 focus:ring-primary/15 focus:outline-none transition-all"
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-muted-foreground/25">Mínimo 3 caracteres</span>
                    <span className={cn("text-[9px] tabular-nums font-display font-bold", subject.length > MAX_SUBJECT * 0.9 ? "text-warning" : "text-muted-foreground/25")}>{subject.length}/{MAX_SUBJECT}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">
                    Mensagem <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                    placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
                    rows={5}
                    className="w-full rounded-xl border border-border/20 bg-muted/5 ring-1 ring-border/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/25 focus:border-primary/30 focus:ring-primary/15 focus:outline-none transition-all resize-none"
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-muted-foreground/25">Mínimo 10 caracteres</span>
                    <span className={cn("text-[9px] tabular-nums font-display font-bold", message.length > MAX_MESSAGE * 0.9 ? "text-warning" : "text-muted-foreground/25")}>{message.length}/{MAX_MESSAGE}</span>
                  </div>
                </div>

                <div className="flex items-end gap-4 flex-wrap">
                  <div>
                    <label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mb-1.5 block">Prioridade</label>
                    <div className="flex gap-1.5">
                      {(["low", "normal", "high", "urgent"] as const).map(p => {
                        const cfg = PRIORITY_MAP[p];
                        return (
                          <button
                            key={p}
                            onClick={() => setPriority(p)}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[10px] font-display font-bold ring-1 transition-all",
                              priority === p ? cn(cfg.cls, "shadow-sm") : "bg-muted/5 text-muted-foreground/30 ring-border/10 hover:ring-border/20"
                            )}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || subject.trim().length < 3 || message.trim().length < 10}
                    className="gap-2 rounded-xl font-display font-bold h-11 px-7 shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all active:scale-[0.985]"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Enviando..." : "Enviar Ticket"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Filters ═══ */}
      {tickets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ease }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary/40 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tickets..."
              className="w-full rounded-xl border border-border/15 bg-card/60 ring-1 ring-border/5 pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:border-primary/25 focus:ring-primary/10 focus:outline-none transition-all backdrop-blur-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {[
              { value: "all", label: "Todos" },
              { value: "open", label: "Abertos" },
              { value: "in_progress", label: "Em Andamento" },
              { value: "resolved", label: "Resolvidos" },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-3.5 py-2 text-[10px] font-display font-bold ring-1 transition-all",
                  statusFilter === f.value
                    ? "bg-primary/10 text-primary ring-primary/20 shadow-sm shadow-primary/5"
                    : "bg-muted/5 text-muted-foreground/30 ring-border/10 hover:text-muted-foreground/50 hover:ring-border/20"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ Tickets List ═══ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
              <LifeBuoy className="h-6 w-6 text-primary/50" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-[11px] text-muted-foreground/30 font-display font-bold">Carregando tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease }}
          className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 py-20 text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="h-16 w-16 rounded-2xl bg-muted/8 ring-1 ring-border/10 flex items-center justify-center mx-auto mb-5">
              <MessageSquare className="h-7 w-7 text-muted-foreground/12" />
            </div>
            <p className="text-sm font-display font-black text-muted-foreground/25 mb-1.5">Nenhum ticket criado</p>
            <p className="text-[11px] text-muted-foreground/15 mb-6">Clique em "Novo Ticket" para abrir seu primeiro chamado</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2 rounded-xl font-display font-bold text-xs h-9 px-5 ring-1 ring-border/15 hover:ring-primary/20 hover:text-primary transition-all">
              <Plus className="h-3.5 w-3.5" /> Criar Ticket
            </Button>
          </div>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 py-14 text-center"
        >
          <Search className="mx-auto h-8 w-8 text-muted-foreground/12 mb-3" />
          <p className="text-sm text-muted-foreground/25 font-display font-bold">Nenhum ticket encontrado</p>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-[10px] text-primary hover:underline mt-2 font-display font-bold">Limpar filtros</button>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence>
            {filtered.map((ticket, i) => {
              const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === ticket.id;
              const priorityCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4, ease }}
                >
                  <div
                    className={cn(
                      "relative group rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden cursor-pointer transition-all duration-300",
                      "hover:ring-border/40 hover:shadow-md",
                      isExpanded && `ring-border/40 shadow-lg ${status.glow}`
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  >
                    {/* Left accent bar */}
                    <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all duration-500", status.accent)} />

                    <div className="relative z-10 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {/* Badges row */}
                          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                            <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-display font-bold ring-1", status.bg)}>
                              <StatusIcon className={cn("h-3 w-3", status.color)} />
                              <span className={status.color}>{status.label}</span>
                            </span>
                            <span className={cn("inline-flex items-center rounded-lg px-2 py-1 text-[9px] font-display font-bold ring-1", priorityCfg.cls)}>
                              {priorityCfg.label}
                            </span>
                            {ticket.admin_reply && (
                              <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="inline-flex items-center gap-1 rounded-lg bg-success/8 ring-1 ring-success/15 px-2.5 py-1 text-[9px] font-display font-bold text-success"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" /> Respondido
                              </motion.span>
                            )}
                          </div>
                          <h4 className="text-[13px] font-display font-black text-foreground line-clamp-1 tracking-[-0.02em] group-hover:text-primary/80 transition-colors">{ticket.subject}</h4>
                          <p className="text-[10px] text-muted-foreground/30 mt-1.5 font-mono tabular-nums">
                            {new Date(ticket.created_at).toLocaleDateString("pt-BR")} às{" "}
                            {new Date(ticket.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.25, ease }}
                          className="mt-1"
                        >
                          <ChevronDown className="h-4 w-4 text-muted-foreground/20 shrink-0 group-hover:text-muted-foreground/40 transition-colors" />
                        </motion.div>
                      </div>

                      {/* Expanded content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease }}
                            className="overflow-hidden"
                          >
                            <div className="mt-5 space-y-4 border-t border-border/10 pt-5">
                              <div>
                                <p className="text-[9px] font-display font-bold text-muted-foreground/35 uppercase tracking-[0.15em] mb-2">Sua mensagem</p>
                                <div className="rounded-xl bg-muted/5 ring-1 ring-border/8 p-4">
                                  <p className="text-[12px] text-foreground/70 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                </div>
                              </div>
                              {ticket.admin_reply && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.1, ease }}
                                  className="rounded-xl bg-primary/3 ring-1 ring-primary/10 p-4 relative overflow-hidden"
                                >
                                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/30 rounded-full" />
                                  <p className="text-[9px] font-display font-bold text-primary/60 uppercase tracking-[0.15em] mb-2 pl-2">Resposta do suporte</p>
                                  <p className="text-[12px] text-foreground/70 whitespace-pre-wrap leading-relaxed pl-2">{ticket.admin_reply}</p>
                                  {ticket.replied_at && (
                                    <p className="text-[9px] text-muted-foreground/25 mt-3 pl-2 font-mono tabular-nums">
                                      Respondido em {new Date(ticket.replied_at).toLocaleDateString("pt-BR")} às{" "}
                                      {new Date(ticket.replied_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ Help Footer ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ease }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-7 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-info/[0.02] via-transparent to-primary/[0.02] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-info to-primary" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-info" />
            </div>
            <div>
              <h3 className="text-[13px] font-display font-black text-foreground tracking-[-0.02em]">Precisa de ajuda?</h3>
              <p className="text-[9px] text-muted-foreground/40">Dicas para um atendimento mais ágil</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: Zap, title: "Seja detalhado", desc: "Inclua prints, IDs de transação e passos para reproduzir o problema.", tone: "primary" },
              { icon: Timer, title: "Resposta em 24h", desc: "Nossa equipe responde todos os tickets em até 24 horas úteis.", tone: "warning" },
              { icon: Sparkles, title: "Prioridade alta", desc: "Marque como urgente apenas para problemas financeiros ou bloqueantes.", tone: "info" },
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.08, ease }}
                className={cn(
                  "rounded-xl p-4 ring-1 ring-border/10 bg-muted/3 transition-all duration-300",
                  "hover:ring-border/20 hover:bg-muted/5"
                )}
              >
                <item.icon className={cn("h-5 w-5 mb-2.5", `text-${item.tone}`)} />
                <h4 className="text-[11px] font-display font-bold text-foreground/70 mb-1">{item.title}</h4>
                <p className="text-[10px] text-muted-foreground/35 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

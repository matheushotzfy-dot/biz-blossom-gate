/**
 * Suporte — Flat Professional Support Center
 * @module Suporte
 * @version 6.0.0 — Clean Fintech Redesign
 */

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send,
  ChevronDown, Inbox, Search, X, Headphones, Shield, Zap,
  Sparkles, MessageCircleMore, LifeBuoy, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock; border: string }> = {
  open: { label: "Aberto", color: "text-warning", icon: Clock, border: "border-t-warning" },
  in_progress: { label: "Em andamento", color: "text-info", icon: AlertCircle, border: "border-t-info" },
  resolved: { label: "Resolvido", color: "text-success", icon: CheckCircle2, border: "border-t-success" },
  closed: { label: "Fechado", color: "text-muted-foreground", icon: CheckCircle2, border: "border-t-muted-foreground" },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-muted/40 text-muted-foreground" },
  normal: { label: "Normal", cls: "bg-info/10 text-info" },
  high: { label: "Alta", cls: "bg-warning/10 text-warning" },
  urgent: { label: "Urgente", cls: "bg-destructive/10 text-destructive" },
};

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;

/* ─── KPI Card ─── */
function KpiCard({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: any; tone: string;
}) {
  const toneMap: Record<string, { bg: string; text: string; border: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-t-primary" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-t-success" },
    info: { bg: "bg-info/10", text: "text-info", border: "border-t-info" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-t-warning" },
  };
  const c = toneMap[tone] || toneMap.primary;

  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 p-5", c.border)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", c.bg)}>
          <Icon className={cn("h-4.5 w-4.5", c.text)} />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-heading font-black tabular-nums text-foreground">{value}</p>
    </div>
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
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 md:px-6 space-y-5">

      {/* ═══ Header ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 border-t-primary p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Headphones className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <h1 className="text-xl md:text-2xl font-heading font-black tracking-tight text-foreground">Central de Suporte</h1>
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <div className="absolute inset-0 h-2 w-2 rounded-full bg-success/40 animate-ping" />
                  </div>
                  <span className="text-[10px] font-bold text-success uppercase tracking-wider">Online</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Abra tickets e acompanhe suas solicitações</p>
            </div>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2 rounded-xl text-sm font-bold h-11 px-6"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Novo Ticket"}
          </Button>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={String(stats.total)} icon={Inbox} tone="primary" />
        <KpiCard label="Em Aberto" value={String(stats.open)} icon={Clock} tone="warning" />
        <KpiCard label="Resolvidos" value={String(stats.resolved)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Respondidos" value={String(stats.replied)} icon={MessageCircleMore} tone="info" />
      </div>

      {/* ═══ Form ═══ */}
      {showForm && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 border-t-primary p-5 md:p-7">
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-foreground">Novo Ticket de Suporte</h3>
                <p className="text-xs text-muted-foreground">Descreva seu problema com detalhes para agilizar o atendimento</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Assunto <span className="text-destructive">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                placeholder="Ex: Problema com saque pendente"
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">Mínimo 3 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-bold", subject.length > MAX_SUBJECT * 0.9 ? "text-warning" : "text-muted-foreground")}>{subject.length}/{MAX_SUBJECT}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Mensagem <span className="text-destructive">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
                rows={5}
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all resize-none"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">Mínimo 10 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-bold", message.length > MAX_MESSAGE * 0.9 ? "text-warning" : "text-muted-foreground")}>{message.length}/{MAX_MESSAGE}</span>
              </div>
            </div>

            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Prioridade</label>
                <div className="flex gap-1.5">
                  {(["low", "normal", "high", "urgent"] as const).map(p => {
                    const cfg = PRIORITY_MAP[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-[11px] font-bold border transition-all",
                          priority === p ? cn(cfg.cls, "border-current/20") : "bg-background text-muted-foreground border-border/60 hover:bg-muted/20"
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
                className="gap-2 rounded-xl font-bold h-11 px-7"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar Ticket"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Filters ═══ */}
      {tickets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tickets..."
              className="w-full rounded-xl border border-border/60 bg-card pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all"
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
                  "whitespace-nowrap rounded-xl px-4 py-2 text-[11px] font-bold border transition-all",
                  statusFilter === f.value
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-background text-muted-foreground border-border/60 hover:bg-muted/20"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Tickets List ═══ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-bold">Carregando tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-5">
            <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-heading font-black text-muted-foreground mb-1.5">Nenhum ticket criado</p>
          <p className="text-xs text-muted-foreground mb-6">Clique em "Novo Ticket" para abrir seu primeiro chamado</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2 rounded-xl font-bold text-xs h-9 px-5">
            <Plus className="h-3.5 w-3.5" /> Criar Ticket
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm py-14 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-bold">Nenhum ticket encontrado</p>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-[11px] text-primary hover:underline mt-2 font-bold">Limpar filtros</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((ticket) => {
            const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === ticket.id;
            const priorityCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
            return (
              <div
                key={ticket.id}
                className={cn(
                  "rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden cursor-pointer transition-all border-t-2",
                  status.border,
                  isExpanded && "shadow-md"
                )}
                onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold", status.color === "text-warning" ? "bg-warning/10" : status.color === "text-info" ? "bg-info/10" : status.color === "text-success" ? "bg-success/10" : "bg-muted/30")}>
                          <StatusIcon className={cn("h-3 w-3", status.color)} />
                          <span className={status.color}>{status.label}</span>
                        </span>
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold", priorityCfg.cls)}>
                          {priorityCfg.label}
                        </span>
                        {ticket.admin_reply && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Respondido
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-heading font-black text-foreground line-clamp-1 tracking-tight">{ticket.subject}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1.5 font-mono tabular-nums">
                        {new Date(ticket.created_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(ticket.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 mt-1", isExpanded && "rotate-180")} />
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-5 space-y-4 border-t border-border/40 pt-5">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sua mensagem</p>
                        <div className="rounded-xl bg-muted/20 border border-border/40 p-4">
                          <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                        </div>
                      </div>
                      {ticket.admin_reply && (
                        <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 border-l-[3px] border-l-primary">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Resposta do suporte</p>
                          <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{ticket.admin_reply}</p>
                          {ticket.replied_at && (
                            <p className="text-[10px] text-muted-foreground mt-3 font-mono tabular-nums">
                              Respondido em {new Date(ticket.replied_at).toLocaleDateString("pt-BR")} às{" "}
                              {new Date(ticket.replied_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Help Footer ═══ */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm border-t-2 border-t-info p-5 md:p-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-info" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-black text-foreground">Precisa de ajuda?</h3>
            <p className="text-xs text-muted-foreground">Dicas para um atendimento mais ágil</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Zap, title: "Seja detalhado", desc: "Inclua prints, IDs de transação e passos para reproduzir o problema.", tone: "text-primary", bg: "bg-primary/10" },
            { icon: Timer, title: "Resposta em 24h", desc: "Nossa equipe responde todos os tickets em até 24 horas úteis.", tone: "text-warning", bg: "bg-warning/10" },
            { icon: Sparkles, title: "Prioridade alta", desc: "Marque como urgente apenas para problemas financeiros ou bloqueantes.", tone: "text-info", bg: "bg-info/10" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl p-4 border border-border/40 bg-background/80 hover:bg-muted/20 transition-colors"
            >
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", item.bg)}>
                <item.icon className={cn("h-4 w-4", item.tone)} />
              </div>
              <h4 className="text-xs font-bold text-foreground mb-1">{item.title}</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

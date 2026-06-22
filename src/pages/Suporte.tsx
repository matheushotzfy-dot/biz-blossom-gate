/**
 * Suporte — alinhado ao padrão visual de Saques
 * @module Suporte
 * @version 9.0.0
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send,
  ChevronRight, Inbox, Search, X, Headphones, BookOpen, CreditCard,
  Shield, Package, Zap, ArrowUpRight, Activity, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, TableSkeleton } from "@/components/PageShell";
import { Seo } from "@/components/Seo";

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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  open:        { label: "Aberto",       color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Clock },
  pending:     { label: "Aguardando",   color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Clock },
  in_progress: { label: "Em andamento", color: "text-blue-500",    bg: "bg-blue-500/10",    icon: AlertCircle },
  answered:    { label: "Respondido",   color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  resolved:    { label: "Resolvido",    color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  closed:      { label: "Fechado",      color: "text-muted-foreground", bg: "bg-muted/40",  icon: CheckCircle2 },
};

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Baixa",   color: "text-muted-foreground", bg: "bg-muted/40" },
  normal: { label: "Normal",  color: "text-blue-500",         bg: "bg-blue-500/10" },
  high:   { label: "Alta",    color: "text-amber-500",        bg: "bg-amber-500/10" },
  urgent: { label: "Urgente", color: "text-red-500",          bg: "bg-red-500/10" },
};

const HELP_CATEGORIES = [
  { icon: CreditCard, label: "Saques & Financeiro", desc: "Saques, taxas, antecipação",       subject: "Dúvida sobre saques e financeiro" },
  { icon: Package,    label: "Produtos & Checkout", desc: "Configuração e vendas",            subject: "Dúvida sobre produtos e checkout" },
  { icon: Shield,     label: "Conta & Segurança",   desc: "Acesso, KYC, identidade",          subject: "Problema com conta ou segurança" },
  { icon: Zap,        label: "Integrações & API",   desc: "Webhooks, apps, automação",        subject: "Dúvida sobre integrações ou API" },
];

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

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
      toast.success("Ticket criado. Responderemos em breve.");
      setSubject(""); setMessage(""); setPriority("normal"); setShowForm(false);
      loadTickets();
    }
  };

  const openCategory = (presetSubject: string) => {
    setSubject(presetSubject);
    setShowForm(true);
    setTimeout(() => document.getElementById("support-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const stats = useMemo(() => ({
    total:    tickets.length,
    open:     tickets.filter(t => ["open","pending","in_progress"].includes(t.status)).length,
    resolved: tickets.filter(t => ["answered","resolved","closed"].includes(t.status)).length,
    awaiting: tickets.filter(t => ["open","pending"].includes(t.status) && !t.admin_reply).length,
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

  const STATUS_FILTERS: { value: string; label: string; count: number }[] = [
    { value: "all",      label: "Todos",      count: tickets.length },
    { value: "open",     label: "Abertos",    count: tickets.filter(t => t.status === "open" || t.status === "pending").length },
    { value: "answered", label: "Respondidos",count: tickets.filter(t => t.status === "answered").length },
    { value: "closed",   label: "Fechados",   count: tickets.filter(t => t.status === "closed" || t.status === "resolved").length },
  ];

  const KPI_CARDS = [
    { icon: Inbox,        label: "Total de Tickets",     value: stats.total },
    { icon: Clock,        label: "Em Aberto",            value: stats.open },
    { icon: Activity,     label: "Aguardando Resposta",  value: stats.awaiting },
    { icon: CheckCircle2, label: "Resolvidos",           value: stats.resolved },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Seo title="Suporte | Hotzfy" description="Abra tickets e fale com nosso time de suporte. Resposta em até 24h úteis." path="/suporte" noindex />
      {/* Header — padrão Saques */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Suporte</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Headphones className="h-3.5 w-3.5 text-primary" />
            Equipe online · Resposta em até 24h úteis
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest"
        >
          {showForm ? <X size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
          {showForm ? "Cancelar" : "Novo Ticket"}
        </button>
      </div>

      {/* KPI cards — Saques style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{card.label}</span>
                </div>
                <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">
                  {card.value.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Icon size={160} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Categorias rápidas + Docs */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Headphones size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Como podemos ajudar?</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Selecione uma categoria</p>
            </div>
          </div>
          <Link
            to="/vendas/documentacao"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-muted/30 border border-border/60 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" /> Documentação <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HELP_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => openCategory(cat.subject)}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 text-left hover:border-primary/40 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground tracking-tight">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug font-medium">{cat.desc}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div id="support-form" className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Send size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Abrir Novo Ticket</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Quanto mais detalhes, mais rápido</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="h-9 w-9 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Assunto <span className="text-red-500">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                placeholder="Ex: Problema com saque pendente"
                className="w-full h-11 rounded-xl border border-border/60 bg-muted/20 px-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mínimo 3 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-black",
                  subject.length > MAX_SUBJECT * 0.9 ? "text-amber-500" : "text-muted-foreground/60")}>
                  {subject.length}/{MAX_SUBJECT}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                Mensagem <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="Descreva seu problema com o máximo de detalhes — IDs de transação, prints, passos para reproduzir."
                rows={6}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all resize-none"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mínimo 10 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-black",
                  message.length > MAX_MESSAGE * 0.9 ? "text-amber-500" : "text-muted-foreground/60")}>
                  {message.length}/{MAX_MESSAGE}
                </span>
              </div>
            </div>

            <div className="flex items-end gap-4 flex-wrap pt-4 border-t border-border/40">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                  Prioridade
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {(["low", "normal", "high", "urgent"] as const).map(p => {
                    const cfg = PRIORITY_MAP[p];
                    const active = priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "h-9 px-3.5 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-colors",
                          active
                            ? cn(cfg.bg, cfg.color, "border-current/20")
                            : "bg-muted/20 text-muted-foreground border-border/60 hover:bg-muted/40"
                        )}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex-1" />
              <button
                onClick={handleSubmit}
                disabled={submitting || subject.trim().length < 3 || message.trim().length < 10}
                className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={3} />}
                {submitting ? "Enviando…" : "Enviar Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de tickets — formato tabela Saques */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <MessageSquare size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Meus Tickets</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
              </p>
            </div>
          </div>
          {tickets.length > 0 && (
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tickets..."
                className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}
        </div>

        {tickets.length > 0 && (
          <div className="px-6 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2 overflow-x-auto">
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "inline-flex items-center gap-2 h-8 px-3.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors shrink-0",
                    active
                      ? "bg-card text-foreground border-border"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  {f.label}
                  <span className="tabular-nums text-muted-foreground/70">{f.count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-7 w-7" />}
              title="Nenhum ticket aberto"
              subtitle="Quando precisar de ajuda, abra um ticket e nossa equipe responde rapidamente."
              action={
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Abrir Ticket
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-7 w-7" />}
              title="Nenhum ticket encontrado"
              subtitle="Tente ajustar os filtros ou termo de busca."
              action={
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="text-[11px] text-primary hover:underline font-black uppercase tracking-widest"
                >
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                  <th className="px-8 py-5">ID / Assunto</th>
                  <th className="px-8 py-5 text-center">Prioridade</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Atualizado</th>
                  <th className="px-4 py-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map(ticket => {
                  const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                  const StatusIcon = status.icon;
                  const isExpanded = expandedId === ticket.id;
                  const priorityCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
                  return (
                    <React.Fragment key={ticket.id}>
                      <tr
                        className="hover:bg-muted/20 transition-colors cursor-pointer group"
                        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                      >
                        <td className="px-8 py-5">
                          <p className="font-mono text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            #{ticket.id.slice(0, 8).toUpperCase()}
                          </p>
                          <div className="flex items-center gap-2 mt-1 min-w-0">
                            <p className="text-sm font-black text-foreground truncate tracking-tight">{ticket.subject}</p>
                            {ticket.admin_reply && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                <MessageSquare className="h-2.5 w-2.5" /> Respondido
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center">
                            <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current/10", priorityCfg.bg, priorityCfg.color)}>
                              {priorityCfg.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center">
                            <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current/10", status.bg, status.color)}>
                              <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-[11px] font-bold text-muted-foreground tabular-nums uppercase">
                            {formatDate(ticket.replied_at || ticket.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <ChevronRight className={cn(
                            "h-4 w-4 text-muted-foreground/50 transition-transform",
                            isExpanded && "rotate-90"
                          )} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/10 border-t border-border/40">
                          <td colSpan={5} className="px-8 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                                  Sua mensagem
                                </p>
                                <div className="rounded-xl border border-border/60 bg-card p-4">
                                  <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                  <p className="text-[10px] text-muted-foreground mt-3 tabular-nums font-black uppercase tracking-widest">
                                    Enviado em {formatDate(ticket.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
                                  Resposta do suporte
                                </p>
                                {ticket.admin_reply ? (
                                  <div className="rounded-xl border border-primary/20 bg-primary/5 border-l-2 border-l-primary p-4">
                                    <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.admin_reply}</p>
                                    {ticket.replied_at && (
                                      <p className="text-[10px] text-primary/80 mt-3 tabular-nums font-black uppercase tracking-widest">
                                        Respondido em {formatDate(ticket.replied_at)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center">
                                    <Clock className="h-4 w-4 text-muted-foreground/60 mx-auto mb-1.5" />
                                    <p className="text-[11px] text-muted-foreground font-black uppercase tracking-widest">Aguardando resposta</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

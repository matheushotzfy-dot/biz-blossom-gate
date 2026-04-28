/**
 * Suporte — Billion-Dollar SaaS support center
 * @module Suporte
 * @version 8.0.0 — Premium redesign aligned with Minhas Vendas standard
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
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

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

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string; icon: typeof Clock }> = {
  open:        { label: "Aberto",       cls: "bg-warning/10 text-warning border-warning/20",         dot: "bg-warning",     icon: Clock },
  in_progress: { label: "Em andamento", cls: "bg-info/10 text-info border-info/20",                  dot: "bg-info",        icon: AlertCircle },
  resolved:    { label: "Resolvido",    cls: "bg-success/10 text-success border-success/20",         dot: "bg-success",     icon: CheckCircle2 },
  closed:      { label: "Fechado",      cls: "bg-secondary text-muted-foreground border-border/60",  dot: "bg-muted-foreground", icon: CheckCircle2 },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  low:    { label: "Baixa",   cls: "bg-secondary text-muted-foreground border-border/60" },
  normal: { label: "Normal",  cls: "bg-info/10 text-info border-info/20" },
  high:   { label: "Alta",    cls: "bg-warning/10 text-warning border-warning/20" },
  urgent: { label: "Urgente", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

const HELP_CATEGORIES = [
  { icon: CreditCard, label: "Saques & financeiro",  desc: "Saques, taxas, antecipação",       subject: "Dúvida sobre saques e financeiro" },
  { icon: Package,    label: "Produtos & checkout",  desc: "Configuração e vendas",            subject: "Dúvida sobre produtos e checkout" },
  { icon: Shield,     label: "Conta & segurança",    desc: "Acesso, KYC, identidade",          subject: "Problema com conta ou segurança" },
  { icon: Zap,        label: "Integrações & API",    desc: "Webhooks, apps, automação",        subject: "Dúvida sobre integrações ou API" },
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
    open:     tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    awaiting: tickets.filter(t => t.status === "open" && !t.admin_reply).length,
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

  const STATUS_FILTERS: { value: string; label: string; count: number; dot?: string }[] = [
    { value: "all",         label: "Todos",     count: tickets.length },
    { value: "open",        label: "Abertos",   count: tickets.filter(t => t.status === "open").length,        dot: "bg-warning" },
    { value: "in_progress", label: "Andamento", count: tickets.filter(t => t.status === "in_progress").length, dot: "bg-info" },
    { value: "resolved",    label: "Resolvidos",count: tickets.filter(t => t.status === "resolved").length,    dot: "bg-success" },
  ];

  return (
    <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HERO */}
      <FinanceiroHero
        eyebrow="CENTRAL DE SUPORTE"
        title="Suporte HOTZFY"
        subtitle="Tire dúvidas, abra tickets e acompanhe o status do atendimento. Equipe online com SLA de até 24h úteis."
        status={{ tone: "success", label: "Equipe online · Resposta ≤ 24h", pulse: true }}
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 h-10 px-5 font-bold">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Novo ticket"}
          </Button>
        }
      />

      {/* KPI GRID */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Total de tickets"
          value={stats.total.toLocaleString("pt-BR")}
          sub="Histórico completo"
          icon={Inbox}
          tone="neutral"
        />
        <FinanceiroKpi
          label="Em aberto"
          value={stats.open.toLocaleString("pt-BR")}
          sub="Abertos + Em andamento"
          icon={Clock}
          tone="warning"
        />
        <FinanceiroKpi
          label="Aguardando resposta"
          value={stats.awaiting.toLocaleString("pt-BR")}
          sub="Sem retorno do suporte"
          icon={Activity}
          tone="info"
        />
        <FinanceiroKpi
          label="Resolvidos"
          value={stats.resolved.toLocaleString("pt-BR")}
          sub="Resolvidos + Fechados"
          icon={CheckCircle2}
          tone="success"
        />
      </FinanceiroKpiGrid>

      {/* QUICK CATEGORIES */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-2">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Headphones className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">Como podemos ajudar?</h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Selecione uma categoria ou abra um ticket personalizado</p>
            </div>
          </div>
          <Link
            to="/vendas/documentacao"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary border border-border/40 text-[11px] font-bold text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
          >
            <BookOpen className="h-3 w-3" /> Documentação
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HELP_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => openCategory(cat.subject)}
                className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-4 text-left hover:border-primary/40 hover:bg-secondary/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors font-display tracking-[-0.01em]">
                    {cat.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug font-medium">{cat.desc}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* FORM */}
      {showForm && (
        <div id="support-form" className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Send className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">Abrir novo ticket</h3>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">Quanto mais detalhes, mais rápido respondemos</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="h-7 w-7 rounded-md bg-secondary border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-1.5 block">
                Assunto <span className="text-destructive">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                placeholder="Ex: Problema com saque pendente"
                className="w-full h-10 rounded-lg border border-border/60 bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Mínimo 3 caracteres</span>
                <span className={cn(
                  "text-[10px] tabular-nums font-bold",
                  subject.length > MAX_SUBJECT * 0.9 ? "text-warning" : "text-muted-foreground"
                )}>
                  {subject.length}/{MAX_SUBJECT}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-1.5 block">
                Mensagem <span className="text-destructive">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="Descreva seu problema com o máximo de detalhes — IDs de transação, prints, passos para reproduzir."
                rows={5}
                className="w-full rounded-lg border border-border/60 bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors resize-none"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Mínimo 10 caracteres</span>
                <span className={cn(
                  "text-[10px] tabular-nums font-bold",
                  message.length > MAX_MESSAGE * 0.9 ? "text-warning" : "text-muted-foreground"
                )}>
                  {message.length}/{MAX_MESSAGE}
                </span>
              </div>
            </div>

            <div className="flex items-end gap-4 flex-wrap pt-4 border-t border-border/40">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-1.5 block">
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
                          "px-3 py-1.5 rounded-md text-[11px] font-bold border transition-colors uppercase tracking-[0.08em]",
                          active
                            ? cfg.cls
                            : "bg-background text-muted-foreground border-border/60 hover:bg-secondary"
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
                className="gap-2 h-10 px-6 font-bold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Enviando…" : "Enviar ticket"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TICKETS */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">Meus tickets</h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"} {statusFilter !== "all" ? `· filtro ativo` : ""}
              </p>
            </div>
          </div>

          {tickets.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar tickets…"
                  className="h-9 w-full sm:w-56 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status segment-control */}
        {tickets.length > 0 && (
          <div className="px-5 py-3 border-b border-border/40 bg-secondary/30 flex items-center gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map(f => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "inline-flex items-center gap-2 h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-[0.08em] border transition-colors shrink-0",
                    active
                      ? "bg-card text-foreground border-border"
                      : "bg-transparent text-muted-foreground border-transparent hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  {f.dot && <span className={cn("h-1.5 w-1.5 rounded-full", f.dot)} />}
                  {f.label}
                  <span className="tabular-nums text-muted-foreground/70 font-bold">{f.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-secondary border border-border/60 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-display font-black text-foreground mb-1 tracking-[-0.01em]">Nenhum ticket aberto</p>
            <p className="text-xs text-muted-foreground/80 mb-5 font-medium">Selecione uma categoria acima ou crie um ticket manualmente.</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2 h-9 px-5 text-xs font-bold">
              <Plus className="h-3.5 w-3.5" /> Abrir ticket
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-foreground font-bold">Nenhum ticket encontrado</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="text-[11px] text-primary hover:underline mt-2 font-bold uppercase tracking-[0.1em]"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40 bg-secondary/30">
                <TableHead className="w-[8%] text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">ID</TableHead>
                <TableHead className="w-[40%] text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Assunto</TableHead>
                <TableHead className="w-[12%] text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Prioridade</TableHead>
                <TableHead className="w-[16%] text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</TableHead>
                <TableHead className="w-[18%] text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Atualizado</TableHead>
                <TableHead className="w-[6%] text-right text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">—</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ticket => {
                const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
                const StatusIcon = status.icon;
                const isExpanded = expandedId === ticket.id;
                const priorityCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
                return (
                  <React.Fragment key={ticket.id}>
                    <TableRow
                      className="border-border/40 cursor-pointer hover:bg-secondary/40 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    >
                      <TableCell className="py-3">
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          #{ticket.id.slice(0, 6)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{ticket.subject}</p>
                          {ticket.admin_reply && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success shrink-0 uppercase tracking-[0.1em]">
                              <MessageSquare className="h-2.5 w-2.5" /> Respondido
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", priorityCfg.cls)}>
                          {priorityCfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", status.cls)}>
                          <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground tabular-nums font-medium">
                          {formatDate(ticket.replied_at || ticket.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className={cn(
                          "h-4 w-4 text-muted-foreground/50 inline-block transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${ticket.id}-exp`} className="hover:bg-transparent bg-secondary/40 border-border/40">
                        <TableCell colSpan={6} className="py-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-2">
                                Sua mensagem
                              </p>
                              <div className="rounded-lg border border-border/60 bg-card p-4">
                                <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-3 tabular-nums font-bold uppercase tracking-[0.1em]">
                                  Enviado em {formatDate(ticket.created_at)}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.14em] mb-2">
                                Resposta do suporte
                              </p>
                              {ticket.admin_reply ? (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 border-l-2 border-l-primary p-4">
                                  <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{ticket.admin_reply}</p>
                                  {ticket.replied_at && (
                                    <p className="text-[10px] text-primary/80 mt-3 tabular-nums font-bold uppercase tracking-[0.1em]">
                                      Respondido em {formatDate(ticket.replied_at)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-border/60 bg-secondary/40 p-5 text-center">
                                  <Clock className="h-4 w-4 text-muted-foreground/60 mx-auto mb-1.5" />
                                  <p className="text-xs text-muted-foreground font-bold">Aguardando resposta da equipe</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

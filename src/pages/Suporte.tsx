/**
 * Suporte — Reliable, fast support center
 * @module Suporte
 * @version 7.0.0
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send,
  ChevronRight, Inbox, Search, X, Headphones, BookOpen, CreditCard,
  Shield, Package, Zap, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const STATUS_MAP: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  open: { label: "Aberto", cls: "bg-warning/8 text-warning border-warning/15", icon: Clock },
  in_progress: { label: "Em andamento", cls: "bg-info/8 text-info border-info/15", icon: AlertCircle },
  resolved: { label: "Resolvido", cls: "bg-success/8 text-success border-success/15", icon: CheckCircle2 },
  closed: { label: "Fechado", cls: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", cls: "bg-info/8 text-info border-info/15" },
  high: { label: "Alta", cls: "bg-warning/8 text-warning border-warning/15" },
  urgent: { label: "Urgente", cls: "bg-destructive/8 text-destructive border-destructive/15" },
};

const HELP_CATEGORIES = [
  { icon: CreditCard, label: "Saques & financeiro", desc: "Saques, taxas, antecipação", subject: "Dúvida sobre saques e financeiro" },
  { icon: Package, label: "Produtos & checkout", desc: "Configuração e vendas", subject: "Dúvida sobre produtos e checkout" },
  { icon: Shield, label: "Conta & segurança", desc: "Acesso, KYC, identidade", subject: "Problema com conta ou segurança" },
  { icon: Zap, label: "Integrações & API", desc: "Webhooks, apps, automação", subject: "Dúvida sobre integrações ou API" },
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
    total: tickets.length,
    open: tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
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

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 md:px-6 pt-2">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-border">
            <Headphones className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-[22px]">
              Central de Suporte
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-[10px] font-bold text-success uppercase tracking-wider">Online</span>
              </div>
              <span className="text-xs text-muted-foreground">· Resposta em até 24h úteis</span>
            </div>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 h-10 px-5 font-semibold">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo ticket"}
        </Button>
      </div>

      {/* ═══ SLA / KPI strip ═══ */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-xl font-extrabold text-foreground tabular-nums mt-1.5">{stats.total}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Em aberto</p>
          <p className="text-xl font-extrabold text-warning tabular-nums mt-1.5">{stats.open}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aguardando</p>
          <p className="text-xl font-extrabold text-info tabular-nums mt-1.5">{stats.awaiting}</p>
        </div>
        <div className="p-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resolvidos</p>
          <p className="text-xl font-extrabold text-success tabular-nums mt-1.5">{stats.resolved}</p>
        </div>
      </div>

      {/* ═══ Quick categories ═══ */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-foreground">Como podemos ajudar?</h3>
          <Link to="/vendas/documentacao" className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> Documentação
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HELP_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => openCategory(cat.subject)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-accent/30 transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{cat.desc}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Form ═══ */}
      {showForm && (
        <div id="support-form" className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Abrir novo ticket</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Assunto <span className="text-destructive">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                placeholder="Ex: Problema com saque pendente"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">Mínimo 3 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-semibold", subject.length > MAX_SUBJECT * 0.9 ? "text-warning" : "text-muted-foreground")}>{subject.length}/{MAX_SUBJECT}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Mensagem <span className="text-destructive">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="Descreva seu problema com o máximo de detalhes — IDs de transação, prints, passos para reproduzir."
                rows={5}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all resize-none"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">Mínimo 10 caracteres</span>
                <span className={cn("text-[10px] tabular-nums font-semibold", message.length > MAX_MESSAGE * 0.9 ? "text-warning" : "text-muted-foreground")}>{message.length}/{MAX_MESSAGE}</span>
              </div>
            </div>

            <div className="flex items-end gap-4 flex-wrap pt-2 border-t border-border">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Prioridade</label>
                <div className="flex gap-1.5">
                  {(["low", "normal", "high", "urgent"] as const).map(p => {
                    const cfg = PRIORITY_MAP[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-all",
                          priority === p ? cfg.cls : "bg-background text-muted-foreground border-border hover:bg-accent/30"
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
                className="gap-2 h-10 px-6 font-semibold"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Enviando…" : "Enviar ticket"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tickets section ═══ */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold text-foreground px-1">Meus tickets</h3>
          {tickets.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar tickets…"
                  className="h-9 w-full sm:w-56 rounded-lg border border-border bg-secondary pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-1 rounded-lg border border-border bg-secondary p-0.5">
                {[
                  { value: "all", label: "Todos" },
                  { value: "open", label: "Abertos" },
                  { value: "in_progress", label: "Andamento" },
                  { value: "resolved", label: "Resolvidos" },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                      statusFilter === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">Nenhum ticket aberto</p>
            <p className="text-xs text-muted-foreground mb-5">Selecione uma categoria acima ou crie um ticket manualmente.</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2 h-9 px-5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> Abrir ticket
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-12 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-foreground font-semibold">Nenhum ticket encontrado</p>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-[11px] text-primary hover:underline mt-2 font-semibold">Limpar filtros</button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-[6%]">ID</TableHead>
                  <TableHead className="w-[40%]">Assunto</TableHead>
                  <TableHead className="w-[14%]">Prioridade</TableHead>
                  <TableHead className="w-[16%]">Status</TableHead>
                  <TableHead className="w-[18%]">Atualizado</TableHead>
                  <TableHead className="w-[6%] text-right">Detalhe</TableHead>
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
                        className="border-border cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                      >
                        <TableCell className="py-3">
                          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                            #{ticket.id.slice(0, 6)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
                            {ticket.admin_reply && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-success/15 bg-success/8 px-1.5 py-0.5 text-[9px] font-bold text-success shrink-0">
                                <MessageSquare className="h-2.5 w-2.5" /> Respondido
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", priorityCfg.cls)}>
                            {priorityCfg.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", status.cls)}>
                            <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(ticket.replied_at || ticket.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight className={cn("h-4 w-4 text-muted-foreground/50 inline-block transition-transform", isExpanded && "rotate-90")} />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${ticket.id}-exp`} className="hover:bg-transparent bg-secondary/30 border-border">
                          <TableCell colSpan={6} className="py-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sua mensagem</p>
                                <div className="rounded-lg border border-border bg-card p-3.5">
                                  <p className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed">{ticket.message}</p>
                                  <p className="text-[10px] text-muted-foreground mt-3 tabular-nums">
                                    Enviado em {formatDate(ticket.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">Resposta do suporte</p>
                                {ticket.admin_reply ? (
                                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3.5 border-l-2 border-l-primary">
                                    <p className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed">{ticket.admin_reply}</p>
                                    {ticket.replied_at && (
                                      <p className="text-[10px] text-muted-foreground mt-3 tabular-nums">
                                        Respondido em {formatDate(ticket.replied_at)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-border bg-card/60 p-5 text-center">
                                    <Clock className="h-4 w-4 text-muted-foreground/50 mx-auto mb-1.5" />
                                    <p className="text-xs text-muted-foreground">Aguardando resposta da equipe</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

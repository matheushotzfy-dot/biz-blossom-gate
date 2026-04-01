import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel, GlassKpi, SectionHeader } from "@/components/PageShell";
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send, ChevronDown, ChevronUp, Inbox, Search, Filter, X } from "lucide-react";
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

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock; bg: string }> = {
  open: { label: "Aberto", color: "text-warning", icon: Clock, bg: "bg-warning/10 border-warning/15" },
  in_progress: { label: "Em andamento", color: "text-info", icon: AlertCircle, bg: "bg-info/10 border-info/15" },
  resolved: { label: "Resolvido", color: "text-success", icon: CheckCircle2, bg: "bg-success/10 border-success/15" },
  closed: { label: "Fechado", color: "text-muted-foreground", icon: CheckCircle2, bg: "bg-muted/10 border-border/15" },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-muted/10 text-muted-foreground border-border/15" },
  normal: { label: "Normal", cls: "bg-info/10 text-info border-info/15" },
  high: { label: "Alta", cls: "bg-warning/10 text-warning border-warning/15" },
  urgent: { label: "Urgente", cls: "bg-destructive/10 text-destructive border-destructive/15" },
};

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;

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
    if (!trimSubject || trimSubject.length < 3) {
      toast.error("O assunto deve ter no mínimo 3 caracteres.");
      return;
    }
    if (trimSubject.length > MAX_SUBJECT) {
      toast.error(`O assunto deve ter no máximo ${MAX_SUBJECT} caracteres.`);
      return;
    }
    if (!trimMessage || trimMessage.length < 10) {
      toast.error("A mensagem deve ter no mínimo 10 caracteres.");
      return;
    }
    if (trimMessage.length > MAX_MESSAGE) {
      toast.error(`A mensagem deve ter no máximo ${MAX_MESSAGE} caracteres.`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: trimSubject,
      message: trimMessage,
      priority,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar o ticket.");
    } else {
      toast.success("Ticket criado com sucesso! Responderemos em breve.");
      setSubject("");
      setMessage("");
      setPriority("normal");
      setShowForm(false);
      loadTickets();
    }
  };

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "open" || t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    avgResponseTime: "< 24h",
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
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<MessageSquare className="h-6 w-6" />} title="Suporte" subtitle="Abra tickets e acompanhe suas solicitações" />
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2 rounded-xl text-sm font-display font-bold h-10 px-5 shadow-lg shadow-primary/20"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Novo Ticket"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Total de Tickets" value={String(stats.total)} icon={Inbox} tone="primary" delay={0} />
        <GlassKpi label="Em Aberto" value={String(stats.open)} icon={Clock} tone="warning" delay={1} />
        <GlassKpi label="Resolvidos" value={String(stats.resolved)} icon={CheckCircle2} tone="success" delay={2} />
        <GlassKpi label="Tempo de Resposta" value={stats.avgResponseTime} icon={MessageSquare} tone="info" delay={3} />
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Panel accent="bg-primary" className="space-y-4">
              <SectionHeader icon={<Send className="h-4 w-4" />} title="Novo Ticket de Suporte" subtitle="Descreva seu problema com detalhes para agilizar o atendimento" />

              <div>
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
                  Assunto <span className="text-destructive">*</span>
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                  placeholder="Ex: Problema com saque pendente"
                  className="w-full rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground/30">Mínimo 3 caracteres</span>
                  <span className={cn("text-[10px] tabular-nums", subject.length > MAX_SUBJECT * 0.9 ? "text-warning" : "text-muted-foreground/30")}>{subject.length}/{MAX_SUBJECT}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
                  Mensagem <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                  placeholder="Descreva seu problema ou dúvida com o máximo de detalhes possível..."
                  rows={5}
                  className="w-full rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground/30">Mínimo 10 caracteres</span>
                  <span className={cn("text-[10px] tabular-nums", message.length > MAX_MESSAGE * 0.9 ? "text-warning" : "text-muted-foreground/30")}>{message.length}/{MAX_MESSAGE}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl px-4 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="flex-1" />
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || subject.trim().length < 3 || message.trim().length < 10}
                  className="gap-2 rounded-xl font-display font-bold h-10 px-6 shadow-lg shadow-primary/20"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Enviando..." : "Enviar Ticket"}
                </Button>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      {tickets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tickets..."
              className="w-full rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none transition-all"
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
                  "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all",
                  statusFilter === f.value
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "bg-muted/15 text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <Panel className="py-16 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-display font-bold text-muted-foreground/40 mb-1">Nenhum ticket criado</p>
          <p className="text-xs text-muted-foreground/30">Clique em "Novo Ticket" para abrir seu primeiro chamado</p>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground/40">Nenhum ticket encontrado com esses filtros</p>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-primary hover:underline mt-2">Limpar filtros</button>
        </Panel>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((ticket, i) => {
              const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === ticket.id;
              const priorityCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
                >
                  <Panel
                    className="cursor-pointer transition-all duration-300 hover:border-primary/15 hover:shadow-md"
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-bold border", status.bg)}>
                            <StatusIcon className={cn("h-3 w-3", status.color)} />
                            <span className={status.color}>{status.label}</span>
                          </span>
                          <span className={cn("inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold border", priorityCfg.cls)}>
                            {priorityCfg.label}
                          </span>
                          {ticket.admin_reply && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-success/10 border border-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Respondido
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-display font-bold text-foreground line-clamp-1 tracking-[-0.01em]">{ticket.subject}</h4>
                        <p className="text-[11px] text-muted-foreground/40 mt-1 tabular-nums">
                          {new Date(ticket.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(ticket.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                      </motion.div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-3 border-t border-border/20 pt-4">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1.5">Sua mensagem</p>
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed bg-muted/10 rounded-xl p-4 border border-border/10">{ticket.message}</p>
                            </div>
                            {ticket.admin_reply && (
                              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Resposta do suporte</p>
                                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{ticket.admin_reply}</p>
                                {ticket.replied_at && (
                                  <p className="text-[10px] text-muted-foreground/40 mt-3 tabular-nums">
                                    Respondido em {new Date(ticket.replied_at).toLocaleDateString("pt-BR")} às{" "}
                                    {new Date(ticket.replied_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Panel>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </PageShell>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Aberto", color: "text-warning", icon: Clock },
  in_progress: { label: "Em andamento", color: "text-info", icon: AlertCircle },
  resolved: { label: "Resolvido", color: "text-success", icon: CheckCircle2 },
  closed: { label: "Fechado", color: "text-muted-foreground", icon: CheckCircle2 },
};

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
    if (!user?.id || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
      priority,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar o ticket.", variant: "destructive" });
    } else {
      toast({ title: "Ticket criado!", description: "Responderemos em breve." });
      setSubject("");
      setMessage("");
      setShowForm(false);
      loadTickets();
    }
  };

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={MessageSquare} title="Suporte" subtitle="Abra tickets e acompanhe suas solicitações" />
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Ticket
        </button>
      </div>

      {showForm && (
        <Panel className="space-y-4 animate-in slide-in-from-top-2">
          <h3 className="text-base font-bold text-foreground">Novo Ticket de Suporte</h3>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto"
            className="w-full rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva seu problema ou dúvida com detalhes..."
            rows={4}
            className="w-full rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none resize-none"
          />
          <div className="flex items-center gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              <option value="low">Baixa</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
            <button
              onClick={handleSubmit}
              disabled={submitting || !subject.trim() || !message.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <Panel className="py-16 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">Nenhum ticket criado ainda</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === ticket.id;
            return (
              <Panel
                key={ticket.id}
                className="cursor-pointer transition hover:border-primary/20"
                onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className={cn("h-4 w-4 shrink-0", status.color)} />
                      <span className={cn("text-xs font-bold uppercase tracking-wider", status.color)}>{status.label}</span>
                      {ticket.priority === "urgent" && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">URGENTE</span>
                      )}
                      {ticket.priority === "high" && (
                        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">ALTA</span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate">{ticket.subject}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR")} às{" "}
                      {new Date(ticket.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t border-border/30 pt-4 animate-in slide-in-from-top-1">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground mb-1">Sua mensagem:</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                    </div>
                    {ticket.admin_reply && (
                      <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                        <p className="text-xs font-bold text-primary mb-1">Resposta do suporte:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.admin_reply}</p>
                        {ticket.replied_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Respondido em {new Date(ticket.replied_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

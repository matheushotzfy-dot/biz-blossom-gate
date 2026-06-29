import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, Send, Clock, CheckCircle2, AlertCircle, Inbox,
  Search, ChevronRight, RotateCcw, User as UserIcon, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logAdminAction } from "@/lib/auditLog";
import type { Tables } from "@/integrations/supabase/types";

type Ticket = Tables<"support_tickets">;

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  open:        { label: "Aberto",       color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Clock },
  pending:     { label: "Aguardando",   color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Clock },
  in_progress: { label: "Andamento",    color: "text-blue-500",    bg: "bg-blue-500/10",    icon: AlertCircle },
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

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function AdminSupportTab({
  profiles,
}: {
  profiles: { user_id: string; full_name: string | null; email: string | null }[];
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_admin");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // admin_user_id -> { name, role } to attribute replies ("GERENTE - CARLOS")
  const [responders, setResponders] = useState<Record<string, { name: string; role: string }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) {
      setTickets(data);
      const ids = Array.from(new Set(
        data.map((t) => t.admin_user_id).filter((x): x is string => !!x)
      ));
      if (ids.length > 0) {
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids),
          supabase.from("user_roles").select("user_id, role").in("user_id", ids),
        ]);
        const roleByUser: Record<string, string[]> = {};
        (rolesRes.data || []).forEach((r) => { (roleByUser[r.user_id] ||= []).push(r.role); });
        const map: Record<string, { name: string; role: string }> = {};
        (profilesRes.data || []).forEach((p) => {
          const roles = roleByUser[p.user_id] || [];
          const top = roles.includes("admin") ? "ADMIN"
            : roles.includes("manager") ? "GERENTE"
            : roles.includes("employee") ? "FUNCIONÁRIO"
            : "STAFF";
          map[p.user_id] = { name: (p.full_name || p.email || "—").toUpperCase(), role: top };
        });
        setResponders(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getProfile = (userId: string) =>
    profiles.find(p => p.user_id === userId);

  const handleReply = async (ticket: Ticket) => {
    if (!replyText.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("support_tickets").update({
      admin_reply: replyText.trim(),
      admin_user_id: user?.id ?? null,
      status: "answered",
      replied_at: new Date().toISOString(),
    } as any).eq("id", ticket.id);
    if (error) { toast.error("Erro ao responder"); setSending(false); return; }
    toast.success("Resposta enviada — o cliente foi notificado.");
    await logAdminAction("reply_ticket", "support_ticket", ticket.id);
    setReplyingId(null);
    setReplyText("");
    setSending(false);
    load();
  };

  const handleStatusChange = async (id: string, status: string, label: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(label);
    await logAdminAction(`set_ticket_${status}`, "support_ticket", id);
    load();
  };

  const counts = useMemo(() => ({
    all: tickets.length,
    pending_admin: tickets.filter(t => ["open","pending","in_progress"].includes(t.status)).length,
    answered: tickets.filter(t => t.status === "answered").length,
    closed: tickets.filter(t => t.status === "closed" || t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent" && t.status !== "closed").length,
  }), [tickets]);

  const filtered = useMemo(() => {
    let r = tickets;
    if (statusFilter === "pending_admin") r = r.filter(t => ["open","pending","in_progress"].includes(t.status));
    else if (statusFilter === "answered") r = r.filter(t => t.status === "answered");
    else if (statusFilter === "closed") r = r.filter(t => t.status === "closed" || t.status === "resolved");
    else if (statusFilter === "urgent") r = r.filter(t => t.priority === "urgent" && t.status !== "closed");
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(t => {
        const p = getProfile(t.user_id);
        return t.subject.toLowerCase().includes(q)
          || t.message.toLowerCase().includes(q)
          || (p?.full_name || "").toLowerCase().includes(q)
          || (p?.email || "").toLowerCase().includes(q);
      });
    }
    return r;
  }, [tickets, statusFilter, search, profiles]);

  const FILTERS: { value: string; label: string; count: number }[] = [
    { value: "pending_admin", label: "Pendentes",   count: counts.pending_admin },
    { value: "urgent",        label: "Urgentes",    count: counts.urgent },
    { value: "answered",      label: "Respondidos", count: counts.answered },
    { value: "closed",        label: "Fechados",    count: counts.closed },
    { value: "all",           label: "Todos",       count: counts.all },
  ];

  const KPIS = [
    { icon: Inbox,        label: "Total",         value: counts.all,            color: "text-foreground" },
    { icon: Clock,        label: "Pendentes",     value: counts.pending_admin,  color: "text-amber-500" },
    { icon: AlertCircle,  label: "Urgentes",      value: counts.urgent,         color: "text-red-500" },
    { icon: CheckCircle2, label: "Respondidos",   value: counts.answered,       color: "text-emerald-500" },
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
            <MessageSquare className="h-5 w-5 text-primary" /> Tickets de Suporte
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
            {counts.pending_admin} pendentes · {counts.answered} respondidos · {counts.all} no total
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card p-6 rounded-2xl border border-border/60">
              <div className="flex items-center gap-2 text-muted-foreground/70 mb-2">
                <Icon size={14} className={k.color} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">{k.label}</span>
              </div>
              <p className={cn("text-3xl font-black tabular-nums tracking-tighter", k.color)}>
                {k.value.toLocaleString("pt-BR")}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filtros + busca */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60 hover:text-foreground"
                )}
              >
                {f.label}
                <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground/70")}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar assunto, mensagem, cliente..."
            className="w-full h-10 pl-9 pr-3 bg-card border border-border/60 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 p-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-bold text-muted-foreground">Nenhum ticket nessa categoria.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const status = STATUS_MAP[ticket.status] || STATUS_MAP.open;
            const StatusIcon = status.icon;
            const priority = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
            const profile = getProfile(ticket.user_id);
            const isExpanded = expandedId === ticket.id;
            const isReplying = replyingId === ticket.id;

            return (
              <div key={ticket.id} className="bg-card rounded-xl border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full text-left p-4 hover:bg-muted/20 transition-colors flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-current/10", status.bg, status.color)}>
                        <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                      </span>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-current/10", priority.bg, priority.color)}>
                        {priority.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60 font-bold">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-foreground truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-bold">
                      <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{profile?.full_name || "Sem nome"}</span>
                      <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{profile?.email || "—"}</span>
                      <span className="tabular-nums">{formatDate(ticket.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground/50 mt-1 transition-transform shrink-0", isExpanded && "rotate-90")} />
                </button>

                {isExpanded && (
                  <div className="border-t border-border/40 bg-muted/10 p-4 space-y-4">
                    {/* Mensagem */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                        Mensagem do cliente
                      </p>
                      <div className="rounded-lg border border-border/60 bg-card p-3 text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {ticket.message}
                      </div>
                    </div>

                    {/* Resposta atual */}
                    {ticket.admin_reply && !isReplying && (
                      <div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span>
                            {(() => {
                              const aid = (ticket as any).admin_user_id as string | null;
                              const r = aid ? responders[aid] : null;
                              return r ? `${r.role} - ${r.name}` : "EQUIPE DE SUPORTE";
                            })()}
                          </span>
                          {ticket.replied_at && <span className="text-muted-foreground/60 font-bold">· {formatDate(ticket.replied_at)}</span>}
                        </p>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 border-l-2 border-l-emerald-500 p-3 text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {ticket.admin_reply}
                        </div>
                      </div>
                    )}

                    {/* Form resposta */}
                    {isReplying && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                          Sua resposta
                        </p>
                        <Textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Digite sua resposta para o cliente..."
                          className="min-h-[120px] text-sm bg-card border-border/60"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => { setReplyingId(null); setReplyText(""); }}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="gap-1.5" onClick={() => handleReply(ticket)} disabled={sending || !replyText.trim()}>
                            <Send className="h-3.5 w-3.5" /> {sending ? "Enviando..." : "Enviar e notificar"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Ações */}
                    {!isReplying && (
                      <div className="flex gap-2 justify-end flex-wrap pt-2 border-t border-border/40">
                        {(ticket.status === "closed" || ticket.status === "resolved") ? (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleStatusChange(ticket.id, "open", "Ticket reaberto")}>
                            <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleStatusChange(ticket.id, "closed", "Ticket encerrado")}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Encerrar
                            </Button>
                            <Button size="sm" className="gap-1.5" onClick={() => { setReplyingId(ticket.id); setReplyText(ticket.admin_reply || ""); }}>
                              <Send className="h-3.5 w-3.5" /> {ticket.admin_reply ? "Editar resposta" : "Responder"}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

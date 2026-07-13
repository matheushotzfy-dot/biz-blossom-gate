/**
 * AdminSupportTab — Inbox estilo Intercom
 * Lista + Thread lado a lado. Suporta conversa em ida e volta.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageSquare, Send, Clock, CheckCircle2, AlertCircle, Inbox, Search,
  User as UserIcon, Mail, ChevronLeft, RotateCcw, Zap, Filter, Paperclip, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logAdminAction } from "@/lib/auditLog";
import type { Tables } from "@/integrations/supabase/types";
import { useTicketTyping } from "@/hooks/useTicketTyping";
import {
  uploadTicketAttachments, purgeTicketAttachments, playIncomingBeep, humanSize,
  MAX_FILE_SIZE_MB, MAX_FILES_PER_MESSAGE, ACCEPTED_MIME, type Attachment,
} from "@/lib/ticketAttachments";
import { AttachmentChips } from "@/components/support/AttachmentChips";

type Ticket = Tables<"support_tickets"> & {
  last_message_at?: string | null;
  unread_by_staff?: number | null;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: "customer" | "staff";
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  created_at: string;
  attachments?: Attachment[] | null;
};

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  open:        { label: "Aberto",       dot: "bg-amber-500",   text: "text-amber-500",   bg: "bg-amber-500/10" },
  pending:     { label: "Aguardando",   dot: "bg-amber-500",   text: "text-amber-500",   bg: "bg-amber-500/10" },
  in_progress: { label: "Andamento",    dot: "bg-blue-500",    text: "text-blue-500",    bg: "bg-blue-500/10" },
  answered:    { label: "Respondido",   dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" },
  resolved:    { label: "Resolvido",    dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" },
  closed:      { label: "Fechado",      dot: "bg-muted-foreground/50", text: "text-muted-foreground", bg: "bg-muted/40" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: "Baixa",   color: "text-muted-foreground" },
  normal: { label: "Normal",  color: "text-blue-500" },
  high:   { label: "Alta",    color: "text-amber-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

const QUICK_REPLIES = [
  { label: "Recebido", text: "Olá! Recebemos seu ticket e nossa equipe já está analisando. Retornaremos em breve com a solução." },
  { label: "Análise", text: "Estamos analisando o caso em detalhes. Em algumas horas voltaremos com uma resposta definitiva." },
  { label: "Resolvido", text: "Tudo certo por aqui! Se precisar de mais alguma coisa, é só abrir um novo ticket. 🚀" },
  { label: "Info extra", text: "Para conseguirmos ajudar melhor, poderia enviar mais detalhes: ID da transação, prints da tela e passos para reproduzir?" },
];

const formatTime = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  if (diffMin < 43200) return `${Math.floor(diffMin / 1440)}d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
};

const formatFull = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const initials = (name?: string | null) => {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
};

export default function AdminSupportTab({
  profiles,
}: {
  profiles: { user_id: string; full_name: string | null; email: string | null }[];
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_admin");
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const meIdentity = useMemo(
    () => (me ? { role: "staff" as const, name: me.name } : null),
    [me?.name],
  );
  const { others: typingOthers, notifyTyping } = useTicketTyping(selectedId, meIdentity);

  const getProfile = (uid: string) => profiles.find(p => p.user_id === uid);

  const load = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setTickets(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Resolve current admin identity for replies
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const name = profRes.data?.full_name || profRes.data?.email || "Suporte";
      const roles = (rolesRes.data || []).map(r => r.role);
      const role = roles.includes("admin") ? "admin"
        : roles.includes("manager") ? "manager"
        : roles.includes("employee") ? "employee" : "staff";
      setMe({ id: user.id, name, role });
    })();
  }, []);

  // Load thread + realtime
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingThread(true);
    (supabase as any).from("ticket_messages").select("*")
      .eq("ticket_id", selectedId)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => {
        setMessages((data as TicketMessage[]) ?? []);
        setLoadingThread(false);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });
    // clear unread for staff
    (supabase as any).from("support_tickets").update({ unread_by_staff: 0 }).eq("id", selectedId)
      .then(() => setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, unread_by_staff: 0 } : t)));

    const channel = (supabase as any).channel(`admin_ticket_${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${selectedId}` },
        (payload: any) => {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
          if (payload.new.sender_type === "customer") playIncomingBeep();
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [selectedId]);

  const handleSendReply = async () => {
    if (!selectedId || !me) return;
    const body = reply.trim();
    if (body.length < 2 && replyFiles.length === 0) return;
    setSending(true);
    let attachments: Attachment[] = [];
    try {
      attachments = await uploadTicketAttachments(selectedId, replyFiles);
    } catch (e: any) {
      setSending(false);
      return toast.error(e?.message || "Falha ao enviar anexos.");
    }
    const { error } = await (supabase as any).from("ticket_messages").insert({
      ticket_id: selectedId, sender_id: me.id, sender_type: "staff",
      sender_name: me.name, sender_role: me.role,
      body: body || "(anexo)", attachments,
    });
    setSending(false);
    if (error) return toast.error("Falha ao enviar resposta.");
    toast.success("Resposta enviada.");
    await logAdminAction("reply_ticket", "support_ticket", selectedId);
    setReply("");
    setReplyFiles([]);
    load();
  };

  const addReplyFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const merged = [...replyFiles];
    for (const f of Array.from(incoming)) {
      if (merged.length >= MAX_FILES_PER_MESSAGE) {
        toast.error(`Máximo de ${MAX_FILES_PER_MESSAGE} arquivos.`);
        break;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}" excede ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }
      merged.push(f);
    }
    setReplyFiles(merged);
  };

  const handleStatusChange = async (id: string, status: string, label: string) => {
    const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar status");
    // When closing/resolving a ticket, purge every stored attachment to free space.
    if (status === "closed" || status === "resolved") {
      purgeTicketAttachments(id).catch(() => {});
    }
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
    unread: tickets.reduce((s, t) => s + (t.unread_by_staff ?? 0), 0),
  }), [tickets]);

  const filtered = useMemo(() => {
    let r = tickets;
    if (statusFilter === "pending_admin") r = r.filter(t => ["open","pending","in_progress"].includes(t.status));
    else if (statusFilter === "answered") r = r.filter(t => t.status === "answered");
    else if (statusFilter === "closed") r = r.filter(t => t.status === "closed" || t.status === "resolved");
    else if (statusFilter === "urgent") r = r.filter(t => t.priority === "urgent" && t.status !== "closed");
    else if (statusFilter === "unread") r = r.filter(t => (t.unread_by_staff ?? 0) > 0);
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

  const selected = selectedId ? tickets.find(t => t.id === selectedId) : null;
  const selectedProfile = selected ? getProfile(selected.user_id) : null;

  const FILTERS: { value: string; label: string; count: number; accent?: string }[] = [
    { value: "unread",        label: "Não lidas",    count: counts.unread, accent: "text-primary" },
    { value: "pending_admin", label: "Pendentes",    count: counts.pending_admin },
    { value: "urgent",        label: "Urgentes",     count: counts.urgent, accent: "text-red-500" },
    { value: "answered",      label: "Respondidos",  count: counts.answered },
    { value: "closed",        label: "Fechados",     count: counts.closed },
    { value: "all",           label: "Todos",        count: counts.all },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
            <MessageSquare className="h-5 w-5 text-primary" /> Central de Suporte
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
            {counts.pending_admin} pendentes · {counts.unread} não lidas · {counts.all} no total
          </p>
        </div>
      </div>

      {/* KPIs (compactos) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { icon: Inbox, label: "Total", value: counts.all, color: "text-foreground" },
          { icon: Zap, label: "Não lidas", value: counts.unread, color: "text-primary" },
          { icon: Clock, label: "Pendentes", value: counts.pending_admin, color: "text-amber-500" },
          { icon: AlertCircle, label: "Urgentes", value: counts.urgent, color: "text-red-500" },
          { icon: CheckCircle2, label: "Respondidos", value: counts.answered, color: "text-emerald-500" },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card p-4 rounded-xl border border-border/60">
              <div className="flex items-center gap-2 text-muted-foreground/70 mb-1.5">
                <Icon size={13} className={k.color} />
                <span className="text-[9px] font-black uppercase tracking-[0.15em]">{k.label}</span>
              </div>
              <p className={cn("text-2xl font-black tabular-nums tracking-tighter", k.color)}>
                {k.value.toLocaleString("pt-BR")}
              </p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 min-h-[640px]">
          {/* LIST PANEL */}
          <div className={cn("bg-card rounded-2xl border border-border/60 overflow-hidden flex flex-col", selectedId && "hidden lg:flex")}>
            <div className="p-3 border-b border-border/40 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, assunto..."
                  className="w-full h-9 pl-9 pr-3 bg-muted/20 border border-border/60 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {FILTERS.map(f => {
                  const active = statusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={cn(
                        "h-7 px-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1",
                        active
                          ? "bg-primary text-primary-foreground"
                          : cn("bg-muted/20 hover:text-foreground", f.accent || "text-muted-foreground")
                      )}
                    >
                      {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-bold text-muted-foreground">Nenhum ticket nessa categoria.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map(t => {
                    const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                    const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.normal;
                    const isSelected = selectedId === t.id;
                    const profile = getProfile(t.user_id);
                    const hasUnread = (t.unread_by_staff ?? 0) > 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors relative",
                          isSelected && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", st.text)}>{st.label}</span>
                          {t.priority === "urgent" && (
                            <span className={cn("text-[9px] font-black uppercase tracking-widest", pr.color)}>· {pr.label}</span>
                          )}
                          <span className="ml-auto text-[10px] font-bold text-muted-foreground/60 tabular-nums">
                            {formatTime(t.last_message_at || t.created_at)}
                          </span>
                        </div>
                        <p className={cn("text-[13px] truncate leading-tight", hasUnread ? "font-black text-foreground" : "font-bold text-foreground/85")}>
                          {t.subject}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          <UserIcon className="h-2.5 w-2.5 shrink-0" />
                          {profile?.full_name || profile?.email || "Cliente"}
                        </p>
                        {hasUnread && (
                          <span className="absolute top-3 right-3 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black tabular-nums flex items-center justify-center">
                            {t.unread_by_staff}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* THREAD PANEL */}
          <div className={cn("bg-card rounded-2xl border border-border/60 overflow-hidden flex flex-col", !selectedId && "hidden lg:flex")}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-tight">Selecione um ticket</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Escolha uma conversa na lista para responder ao cliente.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden h-9 w-9 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center text-[11px] font-black shrink-0">
                    {initials(selectedProfile?.full_name || selectedProfile?.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest", STATUS_MAP[selected.status]?.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_MAP[selected.status]?.dot)} />
                        {STATUS_MAP[selected.status]?.label}
                      </span>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", PRIORITY_MAP[selected.priority]?.color)}>
                        · {PRIORITY_MAP[selected.priority]?.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">#{selected.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <h2 className="text-sm font-black text-foreground truncate">{selected.subject}</h2>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground font-bold">
                      <span className="flex items-center gap-1"><UserIcon className="h-2.5 w-2.5" />{selectedProfile?.full_name || "Sem nome"}</span>
                      <span className="flex items-center gap-1 truncate"><Mail className="h-2.5 w-2.5" />{selectedProfile?.email || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(selected.status === "closed" || selected.status === "resolved") ? (
                      <button
                        onClick={() => handleStatusChange(selected.id, "open", "Ticket reaberto")}
                        className="h-8 px-3 rounded-lg border border-border/60 bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Reabrir
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(selected.id, "closed", "Ticket encerrado")}
                        className="h-8 px-3 rounded-lg border border-border/60 bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-emerald-500 flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Encerrar
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/5">
                  {loadingThread ? (
                    <div className="flex justify-center py-10">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.map(m => {
                    const isStaff = m.sender_type === "staff";
                    return (
                      <div key={m.id} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200", isStaff && "flex-row-reverse")}>
                        <div className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border",
                          isStaff
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                            : "bg-primary/15 border-primary/30 text-primary"
                        )}>
                          {isStaff ? initials(m.sender_name) : initials(selectedProfile?.full_name || selectedProfile?.email)}
                        </div>
                        <div className={cn("max-w-[75%] flex flex-col", isStaff && "items-end")}>
                          <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest">
                            {isStaff ? (
                              <>
                                <span className="text-emerald-500">{m.sender_role?.toUpperCase() || "STAFF"}</span>
                                <span className="text-muted-foreground/70 normal-case tracking-normal font-bold">· {m.sender_name || "—"}</span>
                              </>
                            ) : (
                              <span className="text-primary">Cliente</span>
                            )}
                            <span className="text-muted-foreground/50 normal-case tracking-normal font-bold">{formatFull(m.created_at)}</span>
                          </div>
                          <div className={cn(
                            "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                            isStaff
                              ? "bg-emerald-500/10 border border-emerald-500/25 text-foreground rounded-tr-sm"
                              : "bg-card border border-border/60 text-foreground rounded-tl-sm"
                          )}>
                            {m.body}
                            <AttachmentChips
                              attachments={m.attachments as Attachment[] | null}
                              tone={isStaff ? "emerald" : "muted"}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                  {typingOthers.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-primary animate-in fade-in duration-150">
                      <span className="flex gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                      </span>
                      Cliente está digitando…
                    </div>
                  )}
                </div>

                {/* Reply composer with quick replies */}
                <div className="border-t border-border/40 bg-card">
                  <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mr-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Rápida:
                    </span>
                    {QUICK_REPLIES.map(q => (
                      <button
                        key={q.label}
                        onClick={() => setReply(q.text)}
                        className="h-6 px-2 rounded-md bg-muted/20 border border-border/60 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                  {replyFiles.length > 0 && (
                    <div className="px-4 pt-2 flex flex-wrap gap-1.5">
                      {replyFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-bold max-w-[220px]">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="opacity-60 tabular-nums">{humanSize(f.size)}</span>
                          <button
                            type="button"
                            onClick={() => setReplyFiles(replyFiles.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remover"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_MIME}
                    className="hidden"
                    onChange={e => { addReplyFiles(e.target.files); e.target.value = ""; }}
                  />
                  <div className="p-4 flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => replyFileInputRef.current?.click()}
                      disabled={replyFiles.length >= MAX_FILES_PER_MESSAGE}
                      className="h-11 w-11 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 shrink-0 disabled:opacity-50"
                      aria-label={`Anexar (até ${MAX_FILES_PER_MESSAGE}, ${MAX_FILE_SIZE_MB}MB cada)`}
                      title={`Anexar arquivos (até ${MAX_FILES_PER_MESSAGE} · ${MAX_FILE_SIZE_MB}MB cada)`}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendReply(); }}
                      placeholder="Responder ao cliente... (Ctrl+Enter envia)"
                      rows={2}
                      className="flex-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none min-h-[52px] max-h-40"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || (reply.trim().length < 2 && replyFiles.length === 0)}
                      className="h-11 px-4 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 shrink-0 text-[11px] font-black uppercase tracking-widest"
                    >
                      <Send className="h-4 w-4" /> {sending ? "..." : "Enviar"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

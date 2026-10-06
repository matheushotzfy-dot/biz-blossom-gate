/**
 * Suporte — Central de Ajuda com conversa em thread
 * Layout inbox estilo Intercom: lista + conversa. Mobile empilha.
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { useTicketTyping } from "@/hooks/useTicketTyping";
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, Send, ChevronLeft,
  Inbox, Search, X, Headphones, BookOpen, CreditCard, Shield, Package, Zap,
  ArrowUpRight, HelpCircle, ChevronDown, ChevronUp, User as UserIcon, Sparkles,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import {
  uploadTicketAttachments, playIncomingBeep, humanSize,
  MAX_FILE_SIZE_MB, MAX_FILES_PER_MESSAGE, ACCEPTED_MIME, type Attachment,
} from "@/lib/ticketAttachments";
import { AttachmentChips } from "@/components/support/AttachmentChips";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  admin_name: string | null;
  admin_role: string | null;
  replied_at: string | null;
  created_at: string;
  last_message_at?: string | null;
  unread_by_customer?: number | null;
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

const ROLE_LABEL: Record<string, string> = {
  admin: "Equipe Venxpay",
  manager: "Gerente de Suporte",
  employee: "Atendente",
  staff: "Suporte",
};

const STATUS_MAP: Record<string, { label: string; dot: string; text: string }> = {
  open:        { label: "Aberto",       dot: "bg-amber-500",   text: "text-amber-500" },
  pending:     { label: "Aguardando",   dot: "bg-amber-500",   text: "text-amber-500" },
  in_progress: { label: "Em andamento", dot: "bg-blue-500",    text: "text-blue-500" },
  answered:    { label: "Respondido",   dot: "bg-emerald-500", text: "text-emerald-500" },
  resolved:    { label: "Resolvido",    dot: "bg-emerald-500", text: "text-emerald-500" },
  closed:      { label: "Fechado",      dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: "Baixa",   color: "text-muted-foreground" },
  normal: { label: "Normal",  color: "text-blue-500" },
  high:   { label: "Alta",    color: "text-amber-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

const HELP_CATEGORIES = [
  { icon: CreditCard, label: "Saques & Financeiro", subject: "Dúvida sobre saques e financeiro" },
  { icon: Package,    label: "Produtos & Checkout", subject: "Dúvida sobre produtos e checkout" },
  { icon: Shield,     label: "Conta & Segurança",   subject: "Problema com conta ou segurança" },
  { icon: Zap,        label: "Integrações & API",   subject: "Dúvida sobre integrações ou API" },
];

const FAQ_ITEMS = [
  { q: "Como criar meu primeiro produto?", a: "Acesse Produtos > clique em '+' > preencha nome, preço e descrição > salve. Depois configure o checkout e o conteúdo." },
  { q: "Como solicitar um saque?", a: "Financeiro > Saques > PIX ou Cripto > informe o valor > confirme. Processamento em até 24h úteis." },
  { q: "Quais são as taxas da plataforma?", a: "4,99% + R$ 2,50 por transação aprovada. Saque: R$ 5,00." },
  { q: "Meus dados estão seguros?", a: "Sim. Usamos criptografia SSL, tokens seguros e isolamento por linha (RLS)." },
  { q: "Como aumentar minha conversão?", a: "Ative timer de urgência, use prova social, configure Order Bumps e teste variações via A/B Testing." },
];

const MAX_SUBJECT = 100;
const MAX_MESSAGE = 2000;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  if (diffMin < 43200) return `${Math.floor(diffMin / 1440)}d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
};

const formatFull = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const initials = (name: string | null | undefined) => {
  if (!name) return "V";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "V";
};

export default function Suporte() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);

  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [composerFiles, setComposerFiles] = useState<File[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "answered" | "closed">("all");
  const [showFaq, setShowFaq] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);

  const meIdentity = useMemo(
    () => (user ? { role: "customer" as const, name: (user.email?.split("@")[0]) || "Cliente" } : null),
    [user?.email],
  );
  const { others: typingOthers, notifyTyping } = useTicketTyping(selectedId, meIdentity);


  const loadTickets = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar seus tickets.");
    if (data) setTickets(data as any);
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, [user?.id]);

  // Load thread when ticket selected + realtime subscribe
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingThread(true);
    (supabase as any)
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", selectedId)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => {
        setMessages((data as TicketMessage[]) ?? []);
        setLoadingThread(false);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      });

    // Mark unread as read
    supabase.from("support_tickets" as any)
      .update({ unread_by_customer: 0 } as any)
      .eq("id", selectedId)
      .then(() => {
        setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, unread_by_customer: 0 } : t));
      });

    const channel = (supabase as any)
      .channel(uniqueChannelName(`ticket_${selectedId}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${selectedId}` },
        (payload: any) => {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
          if (payload.new.sender_type === "staff") playIncomingBeep();
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [selectedId]);

  const handleCreateTicket = async () => {
    if (!user?.id) return;
    const s = subject.trim(), m = message.trim();
    if (s.length < 3) return toast.error("O assunto deve ter no mínimo 3 caracteres.");
    if (m.length < 10) return toast.error("A mensagem deve ter no mínimo 10 caracteres.");
    setSubmitting(true);
    const { data, error } = await supabase.from("support_tickets")
      .insert({ user_id: user.id, subject: s, message: m, priority })
      .select().single();
    if (error || !data) { setSubmitting(false); return toast.error("Não foi possível abrir o ticket."); }
    let attachments: Attachment[] = [];
    try {
      attachments = await uploadTicketAttachments(data.id, composerFiles);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar anexos.");
    }
    // Backfill the initial message into the thread so it lives in ticket_messages too
    await (supabase as any).from("ticket_messages").insert({
      ticket_id: data.id, sender_id: user.id, sender_type: "customer", body: m, attachments,
    });
    toast.success("Ticket aberto — responderemos em breve.");
    setSubject(""); setMessage(""); setPriority("normal"); setShowComposer(false);
    setComposerFiles([]);
    setSubmitting(false);
    await loadTickets();
    setSelectedId(data.id);
  };

  const handleReply = async () => {
    if (!user?.id || !selectedId) return;
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
      ticket_id: selectedId, sender_id: user.id, sender_type: "customer",
      body: body || "(anexo)", attachments,
    });
    setSending(false);
    if (error) return toast.error("Falha ao enviar. Tente novamente.");
    setReply("");
    setReplyFiles([]);
    loadTickets();
  };

  const addFiles = (
    incoming: FileList | null,
    current: File[],
    setter: (f: File[]) => void,
  ) => {
    if (!incoming || incoming.length === 0) return;
    const merged = [...current];
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
    setter(merged);
  };

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => ["open","pending","in_progress"].includes(t.status)).length,
    answered: tickets.filter(t => t.status === "answered").length,
    closed: tickets.filter(t => ["closed","resolved"].includes(t.status)).length,
  }), [tickets]);

  const filtered = useMemo(() => {
    let r = tickets;
    if (filter === "open") r = r.filter(t => ["open","pending","in_progress"].includes(t.status));
    else if (filter === "answered") r = r.filter(t => t.status === "answered");
    else if (filter === "closed") r = r.filter(t => ["closed","resolved"].includes(t.status));
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(t => t.subject.toLowerCase().includes(q) || t.message.toLowerCase().includes(q));
    }
    return r;
  }, [tickets, filter, search]);

  const selected = selectedId ? tickets.find(t => t.id === selectedId) : null;

  const openCategory = (subj: string) => {
    setSubject(subj);
    setShowComposer(true);
    setSelectedId(null);
    setTimeout(() => document.getElementById("support-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-8">
      <Seo title="Suporte | Venxpay" description="Central de ajuda — abra tickets e converse com o time de suporte." path="/suporte" noindex />

      {/* Cabeçalho da central */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.10),transparent_60%)]" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Equipe online · resposta em até 24h úteis
            </div>
            <h1 className="font-display font-black text-3xl md:text-4xl tracking-[-0.03em] leading-[1.05] flex items-center gap-3">
              <span className="h-11 w-11 rounded-xl border border-primary/25 bg-primary/10 flex items-center justify-center shrink-0">
                <Headphones className="h-5 w-5 text-primary" />
              </span>
              Central de Suporte
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Abra um chamado, acompanhe cada resposta em tempo real e encontre soluções rápidas para saques, vendas, integrações e conta.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowFaq(v => !v)}
              className="h-11 px-4 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" /> Perguntas frequentes
            </button>
            <button
              onClick={() => { setShowComposer(true); setSelectedId(null); }}
              className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Plus size={16} strokeWidth={3} /> Novo chamado
            </button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 lg:grid-cols-4 border-t border-border">
          {[
            { label: "Total de chamados", value: stats.total, tone: "text-foreground" },
            { label: "Em andamento", value: stats.open, tone: "text-warning" },
            { label: "Respondidos", value: stats.answered, tone: "text-primary" },
            { label: "Resolvidos", value: stats.closed, tone: "text-success" },
          ].map((k, i) => (
            <div key={k.label} className={`px-6 py-4 ${i % 2 === 1 ? "border-l border-border" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-border" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{k.label}</p>
              <p className={`mt-1 font-display text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Atalhos por assunto */}
      {!showComposer && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {HELP_CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.label}
                onClick={() => openCategory(c.subject)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left hover:border-primary/40 hover:-translate-y-0.5 transition-all"
              >
                <span className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-foreground truncate">{c.label}</span>
                  <span className="block text-[11px] text-muted-foreground">Abrir chamado</span>
                </span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* FAQ (collapsible) */}
      {showFaq && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Perguntas Frequentes
            </h2>
            <Link to="/vendas/documentacao" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1">
              Documentação completa <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {FAQ_ITEMS.map((f, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left rounded-lg border border-border/40 hover:border-border/80 bg-muted/10 transition-colors"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] font-bold text-foreground">{f.q}</span>
                  {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
                {openFaq === i && (
                  <div className="px-4 pb-4 pt-1 text-[12px] text-muted-foreground leading-relaxed border-t border-border/40">
                    {f.a}
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border/40">
            {HELP_CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  onClick={() => openCategory(c.subject)}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card hover:bg-muted/30 hover:border-primary/40 px-3 py-2.5 text-left transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[11px] font-bold text-foreground truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Composer (novo ticket) */}
      {showComposer && (
        <div id="support-composer" className="bg-card rounded-2xl border border-border/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Send className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">Abrir Novo Ticket</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Detalhes ajudam a resolver mais rápido
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowComposer(false)}
              className="h-9 w-9 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Assunto</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
                  placeholder="Ex: Saque pendente há 3 dias"
                  className="w-full h-11 rounded-xl border border-border/60 bg-muted/20 px-4 text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Prioridade</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="h-11 w-full md:w-40 rounded-xl border border-border/60 bg-muted/20 px-3 text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Mensagem</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                placeholder="Descreva com detalhes — IDs de transação, prints, passos para reproduzir..."
                rows={5}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mínimo 10 caracteres</span>
                <span className="text-[10px] tabular-nums font-black text-muted-foreground/60">{message.length}/{MAX_MESSAGE}</span>
              </div>
            </div>
            {/* Attachments */}
            <div>
              <input
                ref={composerFileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_MIME}
                className="hidden"
                onChange={e => { addFiles(e.target.files, composerFiles, setComposerFiles); e.target.value = ""; }}
              />
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => composerFileInputRef.current?.click()}
                  disabled={composerFiles.length >= MAX_FILES_PER_MESSAGE}
                  className="h-8 px-3 rounded-lg border border-border/60 bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Paperclip className="h-3 w-3" /> Anexar
                </button>
                <span className="text-[10px] font-bold text-muted-foreground/70">
                  Até {MAX_FILES_PER_MESSAGE} arquivos · {MAX_FILE_SIZE_MB}MB cada
                </span>
              </div>
              {composerFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {composerFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-bold max-w-[220px]">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="opacity-60 tabular-nums">{humanSize(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => setComposerFiles(composerFiles.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowComposer(false); setComposerFiles([]); }} className="h-10 px-4 rounded-xl border border-border/60 bg-card text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={submitting}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5" /> {submitting ? "Enviando..." : "Abrir Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inbox split */}
      <div className="grid min-h-[calc(100dvh-15rem)] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* LIST */}
        <div className={cn(
          "bg-card rounded-2xl border border-border overflow-hidden flex flex-col",
          selectedId && "hidden lg:flex"
        )}>
          <div className="p-3 border-b border-border/40 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tickets..."
                className="w-full h-9 pl-9 pr-3 bg-muted/20 border border-border/60 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-1">
              {([
                { v: "all", l: "Todos", c: stats.total },
                { v: "open", l: "Abertos", c: stats.open },
                { v: "answered", l: "Respondidos", c: stats.answered },
                { v: "closed", l: "Fechados", c: stats.closed },
              ] as const).map(f => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v as any)}
                  className={cn(
                    "flex-1 h-7 px-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors",
                    filter === f.v
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/20 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.l} <span className="tabular-nums opacity-70">{f.c}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs font-bold text-muted-foreground">
                  {tickets.length === 0 ? "Você ainda não abriu tickets." : "Nenhum ticket nessa categoria."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(t => {
                  const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                  const isSelected = selectedId === t.id;
                  const hasUnread = (t.unread_by_customer ?? 0) > 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors relative",
                        isSelected && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                        <span className={cn("text-[9px] font-black uppercase tracking-widest", st.text)}>{st.label}</span>
                        <span className="ml-auto text-[10px] font-bold text-muted-foreground/60 tabular-nums">
                          {formatTime(t.last_message_at || t.created_at)}
                        </span>
                      </div>
                      <p className={cn("text-[13px] truncate leading-tight", hasUnread ? "font-black text-foreground" : "font-bold text-foreground/85")}>
                        {t.subject}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {t.admin_reply || t.message}
                      </p>
                      {hasUnread && (
                        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* THREAD */}
        <div className={cn(
          "bg-card rounded-2xl border border-border overflow-hidden flex flex-col",
          !selectedId && "hidden lg:flex"
        )}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tight">Selecione um ticket</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Escolha uma conversa na lista ao lado para ver o histórico e responder ao time de suporte.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden h-9 w-9 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center text-muted-foreground shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest", STATUS_MAP[selected.status]?.text || "text-muted-foreground")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_MAP[selected.status]?.dot || "bg-muted-foreground/50")} />
                      {STATUS_MAP[selected.status]?.label || selected.status}
                    </span>
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", PRIORITY_MAP[selected.priority]?.color)}>
                      · {PRIORITY_MAP[selected.priority]?.label}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">#{selected.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <h2 className="text-sm font-black text-foreground truncate">{selected.subject}</h2>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/5">
                {loadingThread ? (
                  <div className="flex justify-center py-10">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.map(m => {
                  const isMe = m.sender_type === "customer";
                  const roleLabel = m.sender_role ? (ROLE_LABEL[m.sender_role] || "Equipe") : "Equipe Venxpay";
                  return (
                    <div key={m.id} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200", isMe && "flex-row-reverse")}>
                      <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border",
                        isMe
                          ? "bg-primary/15 border-primary/30 text-primary"
                           : "bg-success/15 border-success/30 text-success"
                      )}>
                        {isMe ? <UserIcon className="h-4 w-4" /> : initials(m.sender_name)}
                      </div>
                      <div className={cn("max-w-[75%] flex flex-col", isMe && "items-end")}>
                        <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase tracking-widest">
                          {isMe ? (
                            <span className="text-primary">Você</span>
                          ) : (
                            <>
                               <span className="text-success">{roleLabel}</span>
                              {m.sender_name && <span className="text-muted-foreground/70 normal-case tracking-normal font-bold">· {m.sender_name}</span>}
                            </>
                          )}
                          <span className="text-muted-foreground/50 normal-case tracking-normal font-bold">{formatFull(m.created_at)}</span>
                        </div>
                        <div className={cn(
                          "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-card border border-border/60 text-foreground rounded-tl-sm"
                        )}>
                          {m.body}
                          <AttachmentChips
                            attachments={m.attachments as Attachment[] | null}
                            tone={isMe ? "primary" : "muted"}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
                {typingOthers.length > 0 && (
                   <div className="flex items-center gap-2 text-[11px] font-bold text-success animate-in fade-in duration-150">
                    <span className="flex gap-0.5">
                       <span className="h-1.5 w-1.5 rounded-full bg-success animate-bounce [animation-delay:-0.3s]" />
                       <span className="h-1.5 w-1.5 rounded-full bg-success animate-bounce [animation-delay:-0.15s]" />
                       <span className="h-1.5 w-1.5 rounded-full bg-success animate-bounce" />
                    </span>
                    {typingOthers[0].name || "Suporte"} está digitando…
                  </div>
                )}
              </div>

              {/* Reply composer */}
              <div className="p-4 border-t border-border/40 bg-card space-y-2">
                {replyFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
                  onChange={e => { addFiles(e.target.files, replyFiles, setReplyFiles); e.target.value = ""; }}
                />
                <div className="flex items-end gap-2">
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
                    onChange={e => { setReply(e.target.value); notifyTyping(); }}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(); }}
                    placeholder="Escreva uma resposta... (Ctrl+Enter envia)"
                    rows={2}
                    className="flex-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none min-h-[44px] max-h-32"
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || (reply.trim().length < 2 && replyFiles.length === 0)}
                    className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-50 shrink-0"
                    aria-label="Enviar"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

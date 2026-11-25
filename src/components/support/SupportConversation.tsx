import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, Check, Copy, Info, Loader2, Paperclip, RefreshCw, Send, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { StatusPill } from '@/components/seller-ui/tx';
import { VenxpayLogo } from '@/components/VenxpayLogo';
import { cn } from '@/lib/utils';
import { ACCEPTED_MIME, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB } from '@/lib/ticketAttachments';
import { AttachmentChips } from './AttachmentChips';
import { SupportFiles } from './SupportFiles';
import {
  MESSAGE_MAX, PRIORITIES, ROLE_LABEL, formatClock, formatDate, formatFull, groupByDay, linkify, priorityTone, splitTicketBody, ticketBadge, ticketCode, ticketStage,
  type SupportMessage, type SupportTicket,
} from './supportModel';

export interface SupportConversationProps {
  ticket: SupportTicket; messages: SupportMessage[]; loading: boolean; error: boolean; visible: boolean;
  reply: string; files: File[]; sending: boolean; typing: { name: string }[];
  onBack: () => void; onRetry: () => void; onReply: (value: string) => void; onTyping: () => void;
  onFiles: (files: File[]) => void; onAddFiles: (files: File[]) => void; onSend: () => void;
  statusBusy: boolean; onStatus: (status: 'resolved' | 'open') => void;
}

function Text({ body }: { body: string }) {
  return <>{linkify(body).map((part, i) => part.type === 'link'
    ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
    : <Fragment key={i}>{part.text}</Fragment>)}</>;
}

const finePointer = (): boolean => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

export function SupportConversation(p: SupportConversationProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastTicket = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stage = ticketStage(p.ticket);
  const badge = ticketBadge(p.ticket);
  const groups = useMemo(() => groupByDay(p.messages), [p.messages]);
  const head = splitTicketBody(p.ticket.message);
  const firstId = p.messages[0]?.id;
  const typingName = p.typing[0]?.name || 'A equipe';
  const canSend = !p.sending && (p.reply.trim().length > 0 || p.files.length > 0);
  const answered = p.messages.some((m) => m.sender_type === 'staff');

  // Fica no fim da conversa quando chega mensagem, a menos que a pessoa tenha subido para reler.
  useLayoutEffect(() => {
    const el = transcript.current;
    if (!el) return;
    if (lastTicket.current !== p.ticket.id) { lastTicket.current = p.ticket.id; stick.current = true; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [p.ticket.id, p.messages.length, p.typing.length, p.loading]);

  // O campo cresce com o texto, até um limite.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [p.reply, p.ticket.id]);

  useEffect(() => { setCopied(false); }, [p.ticket.id]);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(ticketCode(p.ticket.id)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('Não foi possível copiar. Selecione o número e copie.'); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    // Teclado de verdade: Enter envia e Shift+Enter quebra a linha. No celular, Enter quebra a linha.
    if ((e.ctrlKey || e.metaKey) || (!e.shiftKey && finePointer())) { e.preventDefault(); if (canSend) { stick.current = true; p.onSend(); } }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) { e.preventDefault(); p.onAddFiles(pasted); }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (!p.sending && e.dataTransfer.files.length) p.onAddFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <section aria-label="Conversa do chamado" className={cn('sp-pane relative', p.visible ? 'flex' : 'hidden xl:flex')}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
      <header className="flex shrink-0 items-start gap-3 border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="-ml-1.5 xl:hidden"><button type="button" className="sp-icon" aria-label="Voltar aos chamados" onClick={p.onBack}><ArrowLeft className="h-5 w-5" /></button></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-[19px] font-extrabold leading-snug tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] sm:text-[21px]">{p.ticket.subject}</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusPill label={badge.label} tone={badge.tone} />
            {head.category && <span className="text-[13.5px] font-medium text-foreground/80">{head.category}</span>}
            {p.ticket.priority !== 'normal' && <span className={cn('text-[13.5px] font-semibold', priorityTone(p.ticket.priority) === 'alert' ? 'text-destructive' : 'text-warning')}>Prioridade {(PRIORITIES[p.ticket.priority] || p.ticket.priority).toLowerCase()}</span>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            <button type="button" onClick={() => { void copyCode(); }} aria-label={`Copiar número ${ticketCode(p.ticket.id)}`} className="-ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold tabular-nums text-foreground/80 hover:bg-muted">
              {ticketCode(p.ticket.id)}{copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <span aria-hidden>·</span>
            <span title={formatFull(p.ticket.created_at)}>Aberto em {formatDate(p.ticket.created_at)}</span>
            {stage !== 'done' && (
              <button type="button" className="sp-action ml-auto" disabled={p.statusBusy} onClick={() => p.onStatus('resolved')}>
                {p.statusBusy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" />}Marcar como resolvido
              </button>
            )}
          </p>
        </div>
      </header>

      {stage === 'done' ? (
        <div className="sp-note">
          <Info aria-hidden className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{p.ticket.status === 'closed' ? 'A equipe encerrou este chamado.' : 'Chamado resolvido.'} Precisa de ajuda? Escreva abaixo ou reabra.</span>
          <button type="button" className="sp-action" disabled={p.statusBusy} onClick={() => p.onStatus('open')}>
            {p.statusBusy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}Reabrir chamado
          </button>
        </div>
      ) : !answered && !p.loading && !p.error ? (
        <p className="sp-note" data-tone="ok"><Info aria-hidden className="h-4 w-4 shrink-0" />Recebemos seu chamado. A equipe responde por aqui e você recebe um aviso.</p>
      ) : null}

      <div ref={transcript} role="log" aria-label="Mensagens" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140; }}>
        {p.loading ? (
          <div role="status" aria-label="Carregando conversa" className="mx-auto w-full max-w-[860px] space-y-5">
            <span className="vp-skel ml-auto block h-16 w-2/3 !rounded-[20px]" /><span className="vp-skel block h-24 w-3/5 !rounded-[20px]" />
          </div>
        ) : p.error ? (
          <div className="mx-auto flex max-w-[360px] flex-col items-center gap-4 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><RefreshCw className="h-6 w-6" /></span>
            <div><p className="text-[16px] font-extrabold text-foreground">Não deu para abrir a conversa</p><p className="mt-1 text-[14px] text-muted-foreground">Confira sua conexão e tente de novo.</p></div>
            <button type="button" className="vp-cta" onClick={p.onRetry}>Tentar de novo</button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[860px] space-y-3">
            {groups.map((group) => (
              <Fragment key={group.key}>
                <p className="sp-day"><span>{group.label}</span></p>
                {group.items.map((m, i) => {
                  const mine = m.sender_type === 'customer';
                  const prev = group.items[i - 1];
                  const run = prev && prev.sender_type === m.sender_type && prev.sender_name === m.sender_name;
                  const parts = m.id === firstId && mine ? splitTicketBody(m.body) : { category: null, reference: null, text: m.body };
                  return (
                    <article key={m.id} className={cn('flex gap-2.5', mine ? 'justify-end' : 'justify-start', run ? 'mt-1' : 'mt-4')}>
                      {!mine && (run ? <span className="w-8 shrink-0" aria-hidden /> : <span className="mt-0.5 shrink-0"><VenxpayLogo size={32} /></span>)}
                      <div className={cn('flex min-w-0 max-w-full flex-col', mine ? 'items-end' : 'items-start')}>
                        {!mine && !run && <p className="mb-1 text-[12.5px] font-semibold text-muted-foreground">{ROLE_LABEL[m.sender_role || 'staff'] || 'Equipe Vemprapay'}{m.sender_name ? ` · ${m.sender_name}` : ''}</p>}
                        <div className="sp-bubble" data-mine={mine}>
                          {(parts.category || parts.reference) && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {parts.category && <span className="sp-chip">{parts.category}</span>}
                              {parts.reference && <span className="sp-chip">Referência: {parts.reference}</span>}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]"><Text body={parts.text} /></p>
                          <AttachmentChips attachments={m.attachments} mine={mine} />
                        </div>
                        <time dateTime={m.created_at} title={formatFull(m.created_at)} className="mt-1 px-1 text-[12px] tabular-nums text-muted-foreground">{formatClock(m.created_at)}</time>
                      </div>
                    </article>
                  );
                })}
              </Fragment>
            ))}
            {p.typing.length > 0 && (
              <div className="mt-4 flex items-center gap-2.5" role="status">
                <VenxpayLogo size={32} />
                <div className="sp-bubble !py-3"><span className="sp-dots" aria-hidden><i /><i /><i /></span><span className="sr-only">{typingName} está digitando</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-border bg-card p-3 sm:px-6 sm:py-4">
        <div className="mx-auto w-full max-w-[860px] space-y-2.5">
          <SupportFiles files={p.files} onChange={p.onFiles} disabled={p.sending} />
          <input ref={fileInput} type="file" multiple accept={ACCEPTED_MIME} className="hidden" onChange={(e) => { p.onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <div className="sp-compose">
            <textarea ref={field} rows={1} aria-label="Sua mensagem" value={p.reply} disabled={p.sending} maxLength={MESSAGE_MAX} placeholder={stage === 'done' ? 'Escreva para reabrir o chamado…' : 'Escreva sua mensagem…'}
              onChange={(e) => { p.onReply(e.target.value); p.onTyping(); }} onKeyDown={onKey} onPaste={onPaste} />
            <button type="button" className="sp-icon" disabled={p.sending || p.files.length >= MAX_FILES_PER_MESSAGE} aria-label="Anexar arquivos" title={`Até ${MAX_FILES_PER_MESSAGE} arquivos de ${MAX_FILE_SIZE_MB} MB`} onClick={() => fileInput.current?.click()}><Paperclip className="h-5 w-5" /></button>
            <button type="button" className="sp-send" disabled={!canSend} aria-label="Enviar mensagem" onClick={() => { stick.current = true; p.onSend(); }}>{p.sending ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Send className="h-5 w-5" />}</button>
          </div>
          <p className="hidden px-2 text-[12.5px] text-muted-foreground xl:block">
            Enter envia, Shift+Enter quebra a linha. Cole ou arraste prints aqui.{p.reply.length > MESSAGE_MAX - 200 && <span className="ml-2 font-semibold tabular-nums text-warning">{p.reply.length}/{MESSAGE_MAX}</span>}
          </p>
          {p.reply.length > MESSAGE_MAX - 200 && <p className="px-2 text-right text-[12.5px] font-semibold tabular-nums text-warning xl:hidden">{p.reply.length}/{MESSAGE_MAX}</p>}
        </div>
      </div>

      {dragging && <div className="sp-drop" aria-hidden><UploadCloud className="mx-auto h-9 w-9" /><p className="text-[16px] font-extrabold">Solte para anexar</p><p className="text-[13.5px] text-muted-foreground">Até {MAX_FILES_PER_MESSAGE} arquivos de {MAX_FILE_SIZE_MB} MB</p></div>}
    </section>
  );
}

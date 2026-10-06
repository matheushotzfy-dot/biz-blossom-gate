import { useRef, type RefObject } from 'react';
import { ChevronLeft, Headphones, Loader2, MessageSquare, Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttachmentChips } from './AttachmentChips';
import { SupportFiles } from './SupportFiles';
import { ACCEPTED_MIME, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB } from '@/lib/ticketAttachments';
import { cn } from '@/lib/utils';
import { ROLE_LABEL, STATUS_MAP, PRIORITIES, formatFull, type SupportTicket, type SupportMessage } from './supportModel';
export interface SupportConversationProps {
  ticket: SupportTicket | undefined; messages: SupportMessage[]; loading: boolean; reply: string; files: File[]; sending: boolean;
  typing: { name: string }[]; endRef: RefObject<HTMLDivElement>; onBack: () => void; onReply: (value: string) => void;
  onFiles: (files: File[]) => void; onAddFiles: (files: FileList | null) => void; onSend: () => void;
}
export function SupportConversation(p: SupportConversationProps) {
  const input = useRef<HTMLInputElement>(null);
  if (!p.ticket) return <section className="hidden flex-1 flex-col items-center justify-center bg-muted px-6 md:flex"><MessageSquare className="mb-3 h-7 w-7 text-primary" /><p className="text-sm font-medium">Suas conversas</p><p className="mt-1 text-xs text-muted-foreground">Nenhum chamado selecionado.</p></section>;
  const status = STATUS_MAP[p.ticket.status] ?? STATUS_MAP.open;
  // Legacy tickets can predate the message table; show their actual saved content, never demo messages.
  const fallback: SupportMessage[] = [
    { id: `${p.ticket.id}-initial`, body: p.ticket.message, created_at: p.ticket.created_at, sender_type: 'customer', sender_name: null, sender_role: null, attachments: [], ticket_id: p.ticket.id, sender_id: '', read_by_customer: true, read_by_staff: true },
    ...(p.ticket.admin_reply ? [{ id: `${p.ticket.id}-legacy-reply`, body: p.ticket.admin_reply, created_at: p.ticket.replied_at || p.ticket.created_at, sender_type: 'staff', sender_name: p.ticket.admin_name, sender_role: p.ticket.admin_role, attachments: [], ticket_id: p.ticket.id, sender_id: '', read_by_customer: true, read_by_staff: true }] : []),
  ];
  const messages = p.messages.length ? p.messages : fallback;
  return <section aria-label="Conversa do chamado" className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
    <header className="flex min-h-[76px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" aria-label="Voltar aos chamados" onClick={p.onBack}><ChevronLeft /></Button>
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary sm:flex"><Headphones className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold leading-snug">{p.ticket.subject}</h2><div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-mono">#{p.ticket.id.slice(0, 8).toUpperCase()}</span><span>·</span><span>{PRIORITIES[p.ticket.priority] || p.ticket.priority}</span><span>·</span><span className={cn('inline-flex items-center gap-1', status.text)}><span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />{status.label}</span></div></div>
    </header>
    <div role="log" aria-label="Mensagens" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6">
      {p.loading ? <div role="status" aria-label="Carregando conversa" className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : <div className="mx-auto w-full max-w-4xl space-y-7">{messages.map(m => {
        const customer = m.sender_type === 'customer';
        return <article key={m.id} className={cn('flex flex-col items-start', !customer && 'items-end')}>
          <div className={cn('support-message max-w-[92%] rounded-lg border px-4 py-3 text-[15px] leading-relaxed md:max-w-[82%]', customer ? 'rounded-tl-sm border-border bg-muted text-foreground' : 'rounded-tr-sm border-primary bg-primary text-primary-foreground')}><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.body}</p><AttachmentChips attachments={m.attachments} tone={customer ? 'muted' : 'primary'} /></div>
          <div className="mt-2 flex max-w-full flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{customer ? 'Você' : ROLE_LABEL[m.sender_role || 'staff'] || 'Equipe VENXPAY'}{!customer && m.sender_name ? ` · ${m.sender_name}` : ''}</span><span>·</span><time dateTime={m.created_at}>{formatFull(m.created_at)}</time></div>
        </article>;
      })}</div>}
      <div ref={p.endRef} />{p.typing.length > 0 && <p className="mt-4 text-xs text-primary">{p.typing[0]?.name || 'Suporte'} está digitando…</p>}
    </div>
    <div className="shrink-0 space-y-2 border-t border-border bg-card p-3 md:p-4">
      <SupportFiles files={p.files} onChange={p.onFiles} disabled={p.sending} />
      <input ref={input} type="file" multiple accept={ACCEPTED_MIME} className="hidden" onChange={e => { p.onAddFiles(e.target.files); e.target.value = ''; }} />
      <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-lg border border-input bg-background p-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
        <textarea aria-label="Sua resposta" placeholder="Escreva sua mensagem…" value={p.reply} disabled={p.sending} maxLength={2000} onChange={e => p.onReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!p.sending) p.onSend(); } }} rows={2} className="min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-base shadow-none focus-visible:outline-none focus-visible:ring-0" />
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={p.sending || p.files.length >= MAX_FILES_PER_MESSAGE} aria-label="Anexar arquivos" title={`Até ${MAX_FILES_PER_MESSAGE} arquivos, ${MAX_FILE_SIZE_MB}MB cada`} onClick={() => input.current?.click()}><Paperclip /></Button>
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-md" aria-label="Enviar resposta" disabled={p.sending || (p.reply.trim().length < 2 && !p.files.length)} onClick={p.onSend}>{p.sending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </div>
    </div>
  </section>;
}

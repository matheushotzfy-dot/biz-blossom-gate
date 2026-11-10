import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Loader2, Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACCEPTED_MIME, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB } from '@/lib/ticketAttachments';
import { SupportFiles } from './SupportFiles';
import { FAQ_ITEMS, HELP_CATEGORIES, PRIORITIES } from './supportModel';
export interface SupportDialogsProps {
  showFaq: boolean; onFaq: (v: boolean) => void; openFaq: number | null; onOpenFaq: (v: number | null) => void;
  showComposer: boolean; onComposer: (v: boolean) => void; subject: string; onSubject: (v: string) => void;
  message: string; onMessage: (v: string) => void; priority: string; onPriority: (v: string) => void;
  files: File[]; onFiles: (v: File[]) => void; onAddFiles: (v: FileList | null) => void; submitting: boolean; onSubmit: () => void; onCategory: (subject: string) => void;
}
export function SupportDialogs(p: SupportDialogsProps) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <Dialog open={p.showFaq} onOpenChange={p.onFaq}><DialogContent className="support-surface max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border-border shadow-none">
      <DialogTitle>Perguntas frequentes</DialogTitle><DialogDescription>Ajuda Vemprapay</DialogDescription>
      <div className="divide-y divide-border">{FAQ_ITEMS.map((item, i) => <div key={item.q}><Button variant="ghost" aria-expanded={p.openFaq === i} aria-controls={`support-faq-${i}`} className="h-auto w-full justify-between whitespace-normal rounded-none px-0 py-4 text-left text-sm" onClick={() => p.onOpenFaq(p.openFaq === i ? null : i)}>{item.q}<ChevronDown className="shrink-0" /></Button>{p.openFaq === i && <p id={`support-faq-${i}`} className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>}</div>)}</div>
      <div className="border-t border-border pt-3">{HELP_CATEGORIES.map(c => <Button key={c.label} variant="ghost" className="h-9 w-full justify-between px-0 text-xs" onClick={() => p.onCategory(c.subject)}>{c.label}<ArrowUpRight /></Button>)}</div>
      <Button asChild variant="link" className="justify-start px-0"><Link to="/vendas/documentacao">Documentação<ArrowUpRight /></Link></Button>
    </DialogContent></Dialog>
    <Dialog open={p.showComposer} onOpenChange={v => { if (!p.submitting) p.onComposer(v); }}><DialogContent className="support-surface max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border-border shadow-none">
      <DialogTitle>Novo chamado</DialogTitle><DialogDescription>Suporte Vemprapay</DialogDescription>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); p.onSubmit(); }}>
        <div><label htmlFor="support-subject" className="mb-1.5 block text-xs font-medium">Assunto</label><input id="support-subject" required minLength={3} maxLength={100} value={p.subject} disabled={p.submitting} onChange={e => p.onSubject(e.target.value)} className="h-10 w-full rounded-md border border-input bg-muted px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm" /></div>
        <div><label htmlFor="support-priority" className="mb-1.5 block text-xs font-medium">Prioridade</label><Select value={p.priority} onValueChange={p.onPriority} disabled={p.submitting}><SelectTrigger id="support-priority" className="h-10 rounded-md"><SelectValue /></SelectTrigger><SelectContent className="support-surface">{Object.entries(PRIORITIES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><label htmlFor="support-message" className="mb-1.5 block text-xs font-medium">Mensagem</label><textarea id="support-message" required minLength={10} maxLength={2000} rows={5} value={p.message} disabled={p.submitting} onChange={e => p.onMessage(e.target.value)} className="w-full resize-none rounded-md border border-input bg-muted p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm" /><p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{p.message.length}/2000</p></div>
        <input ref={input} type="file" multiple accept={ACCEPTED_MIME} className="hidden" onChange={e => { p.onAddFiles(e.target.files); e.target.value = ''; }} />
        <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={p.submitting || p.files.length >= MAX_FILES_PER_MESSAGE} onClick={() => input.current?.click()}><Paperclip />Anexar</Button><span className="text-[10px] text-muted-foreground">Até {MAX_FILES_PER_MESSAGE} arquivos · {MAX_FILE_SIZE_MB}MB cada</span></div>
        <SupportFiles files={p.files} onChange={p.onFiles} disabled={p.submitting} />
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="ghost" disabled={p.submitting} onClick={() => p.onComposer(false)}>Cancelar</Button><Button type="submit" disabled={p.submitting}>{p.submitting ? <Loader2 className="animate-spin" /> : <Send />}Abrir chamado</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}

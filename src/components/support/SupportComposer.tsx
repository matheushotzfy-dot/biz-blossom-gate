import { useRef, useState } from 'react';
import { Info, LifeBuoy, Loader2, Paperclip } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DialogHead, FieldHint, FieldLabel, FormSection, ChoiceChip, dialogShell } from '@/components/seller-ui/form';
import { cn } from '@/lib/utils';
import { ACCEPTED_MIME, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB } from '@/lib/ticketAttachments';
import { SupportFiles } from './SupportFiles';
import {
  CATEGORIES, REFERENCE_MAX, SUBJECT_MAX, URGENCY_OPTIONS, categoryById, isDraftDirty, messageBudget, validateNewTicket,
  type CategoryId, type ComposerDraft,
} from './supportModel';

export interface SupportComposerProps {
  open: boolean; draft: ComposerDraft; submitting: boolean;
  onOpenChange: (open: boolean) => void; onChange: (draft: ComposerDraft) => void; onAddFiles: (files: File[]) => void; onSubmit: () => void; onClear: () => void;
}

export function SupportComposer({ open, draft, submitting, onOpenChange, onChange, onAddFiles, onSubmit, onClear }: SupportComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const errors = validateNewTicket(draft);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);
  const budget = messageBudget(draft.category, draft.reference);
  const category = categoryById(draft.category);
  const set = (patch: Partial<ComposerDraft>) => onChange({ ...draft, ...patch });

  // Escolher o assunto sugere o título, mas nunca troca o que a pessoa já escreveu.
  const pickCategory = (id: CategoryId) => {
    const next = categoryById(id);
    const previous = categoryById(draft.category);
    const keep = draft.subject.trim() && draft.subject !== previous?.subject;
    set({ category: id, subject: keep ? draft.subject : next?.subject ?? '' });
  };
  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, 'flex max-h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-[660px] flex-col')}>
        <DialogHead icon={<LifeBuoy className="h-5 w-5" />} title="Novo chamado" subtitle="A equipe responde por aqui." />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
            <FormSection title="Sobre o que é?">
              <div role="group" aria-label="Assunto do chamado" className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => <ChoiceChip key={c.id} active={draft.category === c.id} onClick={() => pickCategory(c.id)}>{c.label}</ChoiceChip>)}
              </div>
              {category && <p className="flex items-start gap-2 text-[13.5px] leading-snug text-muted-foreground"><Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{category.tip}</p>}
            </FormSection>

            <div>
              <FieldLabel htmlFor="sp-subject">Assunto</FieldLabel>
              <input id="sp-subject" className="vp-field" value={draft.subject} maxLength={SUBJECT_MAX} disabled={submitting} placeholder="Ex.: Saque de ontem ainda não caiu" autoComplete="off"
                aria-invalid={Boolean(show('subject'))} aria-describedby="sp-subject-hint" onChange={(e) => set({ subject: e.target.value })} />
              <p id="sp-subject-hint" className={cn('mt-1.5 text-[12.5px] leading-snug', show('subject') ? 'font-medium text-destructive' : 'text-muted-foreground')}>{show('subject') ?? 'Resuma em poucas palavras.'}</p>
            </div>

            <div>
              <FieldLabel htmlFor="sp-message">O que aconteceu?</FieldLabel>
              <textarea id="sp-message" className="vp-field" rows={6} value={draft.message} maxLength={budget} disabled={submitting} placeholder="Conte com detalhes: o que você tentou, o que apareceu na tela e desde quando."
                aria-invalid={Boolean(show('message'))} aria-describedby="sp-message-hint" style={{ resize: 'none' }} onChange={(e) => set({ message: e.target.value })} />
              <p id="sp-message-hint" className="mt-1.5 flex justify-between gap-3 text-[12.5px] leading-snug">
                <span className={show('message') ? 'font-medium text-destructive' : 'text-muted-foreground'}>{show('message') ?? 'Quanto mais detalhe, mais rápida a resposta.'}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{draft.message.length}/{budget}</span>
              </p>
            </div>

            <div>
              <FieldLabel htmlFor="sp-reference" hint="Opcional. O ID da venda, do saque ou o nome do produto.">Referência</FieldLabel>
              <input id="sp-reference" className="vp-field" value={draft.reference} maxLength={REFERENCE_MAX} disabled={submitting} placeholder="Ex.: 9f3a1c2e" autoComplete="off" onChange={(e) => set({ reference: e.target.value })} />
            </div>

            <FormSection title="Urgência">
              <div role="radiogroup" aria-label="Urgência" className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                {URGENCY_OPTIONS.map((o) => (
                  <button key={o.value} type="button" role="radio" aria-checked={draft.priority === o.value} disabled={submitting} className="sp-radio" onClick={() => set({ priority: o.value })}>
                    <span className="text-[14.5px] font-bold text-foreground">{o.label}</span>
                    <span className="text-[12.5px] leading-snug text-muted-foreground">{o.hint}</span>
                  </button>
                ))}
              </div>
            </FormSection>

            <div>
              <FieldLabel>Anexos</FieldLabel>
              <input ref={fileInput} type="file" multiple accept={ACCEPTED_MIME} className="hidden" onChange={(e) => { onAddFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="vp-ghost !h-10 !text-[13.5px]" disabled={submitting || draft.files.length >= MAX_FILES_PER_MESSAGE} onClick={() => fileInput.current?.click()}><Paperclip className="h-4 w-4" />Anexar arquivos</button>
                <FieldHint className="!mt-0">Prints ajudam muito. Até {MAX_FILES_PER_MESSAGE} arquivos de {MAX_FILE_SIZE_MB} MB.</FieldHint>
              </div>
              {draft.files.length > 0 && <div className="mt-3"><SupportFiles files={draft.files} disabled={submitting} onChange={(files) => set({ files })} /></div>}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:px-8">
            {isDraftDirty(draft) && <button type="button" className="text-[13.5px] font-semibold text-muted-foreground hover:text-foreground sm:mr-auto" disabled={submitting} onClick={() => { onClear(); setTouched(false); }}>Limpar campos</button>}
            <button type="button" className="vp-ghost !h-12 justify-center" disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Abrindo…</> : 'Abrir chamado'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

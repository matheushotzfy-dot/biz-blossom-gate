import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_MAX, mergeAttachments } from "@/components/support/supportModel";
import { friendlyError } from "@/lib/friendlyError";
import { ACCEPTED_MIME, MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB, discardAttachments, humanSize, uploadTicketAttachments, type Attachment } from "@/lib/ticketAttachments";
import { cn } from "@/lib/utils";
import { callRpc } from "./supportAdminApi";
import { QUICK_REPLIES, replyProblem, withQuickReply } from "./supportAdminModel";

/**
 * Resposta ao seller. O rascunho e os arquivos ficam no pai, um por chamado: trocar de conversa não leva o texto de uma
 * para a outra. Quem responde (nome e cargo) é definido pelo servidor, nunca por esta tela.
 */
export function Composer({ ticketId, draft, files, onDraft, onFiles, onTyping, onSent }: {
  ticketId: string; draft: string; files: File[]; onDraft: (v: string) => void; onFiles: (f: File[]) => void; onTyping: () => void; onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const over = draft.trim().length > MESSAGE_MAX;
  const problem = replyProblem(draft, files.length);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const { files: merged, errors } = mergeAttachments(files, Array.from(list));
    onFiles(merged);
    setError(errors.length ? errors[0] : null);
  };

  // o campo cresce com o texto (até umas 8 linhas) e volta a encolher depois de enviar
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [draft, ticketId]);

  const send = async () => {
    if (sending || problem) { if (problem) setError(problem); return; }
    setSending(true);
    setError(null);
    let uploaded: Attachment[] = [];
    try {
      uploaded = await uploadTicketAttachments(ticketId, files);
      await callRpc("admin_reply_ticket", { _ticket_id: ticketId, _body: draft.trim(), _attachments: uploaded });
      toast.success("Resposta enviada.");
      onSent();
    } catch (e) {
      await discardAttachments(uploaded);
      setError(friendlyError(e, "Não foi possível enviar a resposta. Nada foi enviado."));
    } finally { setSending(false); }
  };

  return (
    <div className="shrink-0 border-t border-border/60 bg-card px-4 pb-4 pt-3">
      <div className="mb-2.5 flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible" role="group" aria-label="Textos prontos">
        <span className="shrink-0 text-[12.5px] text-muted-foreground">Textos prontos</span>
        {QUICK_REPLIES.map((q) => (
          <button key={q.label} type="button" disabled={sending} onClick={() => onDraft(withQuickReply(draft, q.text))} className="vp-ghost !h-8 shrink-0 justify-center !px-3 text-[12.5px]">{q.label}</button>
        ))}
      </div>

      {files.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-2" aria-label="Arquivos para enviar">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex max-w-[240px] items-center gap-2 rounded-full bg-muted/60 py-1 pl-3 pr-1.5 text-[12.5px] text-foreground">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{humanSize(f.size)}</span>
              <button type="button" disabled={sending} onClick={() => onFiles(files.filter((_, j) => j !== i))} aria-label={`Tirar ${f.name}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="support-reply" className="sr-only">Resposta ao seller</label>
      <textarea ref={area} id="support-reply" className="vp-field resize-none" rows={2} value={draft} disabled={sending}
        placeholder="Escreva a resposta ao seller. Ctrl+Enter envia."
        aria-invalid={over || undefined} aria-describedby="support-reply-count"
        onChange={(e) => { onDraft(e.target.value); setError(null); onTyping(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {error ? <p role="alert" className="text-[12.5px] font-medium text-destructive">{error}</p>
            : <p className="hidden text-[12.5px] text-muted-foreground sm:block">Até {MAX_FILES_PER_MESSAGE} arquivos de {MAX_FILE_SIZE_MB} MB. O seller recebe a resposta no painel dele.</p>}
        </div>
        <span id="support-reply-count" className={cn("shrink-0 text-[12.5px] tabular-nums", over ? "font-semibold text-destructive" : "text-muted-foreground")}>{draft.trim().length}/{MESSAGE_MAX}</span>
        <input ref={input} type="file" multiple accept={ACCEPTED_MIME} className="hidden" aria-hidden tabIndex={-1} data-testid="support-file-input"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="vp-ghost !h-11 justify-center gap-2" disabled={sending || files.length >= MAX_FILES_PER_MESSAGE} onClick={() => input.current?.click()}>
            <Paperclip className="h-4 w-4" /> Anexar
          </button>
          <button type="button" className="vp-cta !h-11 justify-center gap-2" disabled={sending || !!problem} onClick={() => void send()}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Enviar resposta</>}
          </button>
        </div>
      </div>
    </div>
  );
}

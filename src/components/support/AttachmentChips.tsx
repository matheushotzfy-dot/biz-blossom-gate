/**
 * Anexos de uma mensagem.
 * - Imagens: miniatura com endereço assinado; abre em tela cheia (setas e Esc).
 * - Outros arquivos: botão com ícone, nome e tamanho; abre em outra aba.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, FileText, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSignedUrl, humanSize, type Attachment } from "@/lib/ticketAttachments";

const isImage = (a: Attachment) => a.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.name);

function Thumb({ att, onOpen }: { att: Attachment; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let ok = true;
    void getSignedUrl(att.path).then((u) => { if (ok) { setUrl(u); if (!u) setErrored(true); } });
    return () => { ok = false; };
  }, [att.path]);

  return (
    <button type="button" onClick={onOpen} title={`${att.name} · ${humanSize(att.size)}`} aria-label={`Abrir imagem ${att.name}`}
      className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-[16px] bg-background/60 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/.12)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">
      {url && !errored ? (
        <img src={url} alt={att.name} className="h-full w-full object-cover" loading="lazy" onError={() => setErrored(true)} />
      ) : (
        <span className="grid h-full w-full place-items-center text-muted-foreground">
          {errored ? <ImageIcon className="h-5 w-5" /> : <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-semibold text-white">{att.name}</span>
    </button>
  );
}

function Lightbox({ images, index, onClose, onIndex }: { images: Attachment[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = images[index];

  useEffect(() => {
    setUrl(null);
    let ok = true;
    void getSignedUrl(current.path).then((u) => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [current.path]);

  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [onClose, prev, next]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Imagem ${current.name}`} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{current.name}</p>
          <p className="text-[12.5px] tabular-nums text-white/65">{humanSize(current.size)}{images.length > 1 ? ` · ${index + 1} de ${images.length}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {url && (
            <a href={url} download={current.name} target="_blank" rel="noopener noreferrer" className="vp-r12 inline-flex h-10 items-center gap-2 bg-white/10 px-4 text-[13.5px] font-semibold hover:bg-white/20">
              <Download className="h-4 w-4" /> Baixar
            </a>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className="vp-r12 grid h-10 w-10 place-items-center bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Imagem anterior" className="absolute left-3 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-5"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Próxima imagem" className="absolute right-3 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-5"><ChevronRight className="h-5 w-5" /></button>
        </>
      )}
      <div className="flex max-h-[85vh] max-w-[92vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {url ? <img src={url} alt={current.name} className="max-h-[85vh] max-w-[92vw] rounded-[16px] object-contain animate-in zoom-in-95 duration-200" /> : <Loader2 className="h-8 w-8 animate-spin text-white/60 motion-reduce:animate-none" />}
      </div>
    </div>,
    document.body,
  );
}

/** `mine` pinta os anexos para o balão verde; `tone` é o nome antigo (a tela do admin ainda usa). */
export function AttachmentChips({ attachments, tone, mine = tone === "primary" }: { attachments: Attachment[] | null | undefined; mine?: boolean; tone?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const list = useMemo(() => attachments ?? [], [attachments]);
  const images = useMemo(() => list.filter(isImage), [list]);
  const others = useMemo(() => list.filter((a) => !isImage(a)), [list]);
  if (list.length === 0) return null;

  const openFile = async (a: Attachment) => {
    setBusy(a.path);
    const url = await getSignedUrl(a.path);
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error(`Não foi possível abrir "${a.name}". Tente de novo.`);
  };

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map((a, i) => <Thumb key={a.path} att={a} onOpen={() => setOpen(i)} />)}</div>}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((a) => {
            const Icon = /pdf/i.test(a.type) || /\.pdf$/i.test(a.name) ? FileText : Paperclip;
            return (
              <button key={a.path} type="button" onClick={() => { void openFile(a); }} disabled={busy === a.path} title={a.name}
                className={cn("inline-flex h-10 max-w-[260px] items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
                  mine ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25" : "bg-background text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-card")}>
                {busy === a.path ? <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" /> : <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 font-medium tabular-nums opacity-70">{humanSize(a.size)}</span>
              </button>
            );
          })}
        </div>
      )}
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

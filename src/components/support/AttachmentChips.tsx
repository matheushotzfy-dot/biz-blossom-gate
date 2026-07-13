/**
 * Renders a message's attachments.
 * - Images: signed thumbnail (128x128) that opens a full-screen lightbox on click.
 * - Other files: chip with icon + download.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Paperclip, Download, ImageIcon, FileText, X, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedUrl, humanSize, type Attachment } from "@/lib/ticketAttachments";

const isImage = (a: Attachment) =>
  a.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.name);

function Thumb({ att, onOpen }: { att: Attachment; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let ok = true;
    getSignedUrl(att.path).then(u => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [att.path]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-24 w-24 rounded-xl overflow-hidden border border-border/60 bg-muted/40 hover:border-primary/50 transition-colors shrink-0"
      title={`${att.name} · ${humanSize(att.size)}`}
    >
      {url && !errored ? (
        <img
          src={url}
          alt={att.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          {errored ? <ImageIcon className="h-5 w-5 text-muted-foreground" /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[9px] font-bold text-white truncate text-left">
        {att.name}
      </span>
    </button>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: Attachment[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const current = images[index];

  useEffect(() => {
    setUrl(null);
    let ok = true;
    getSignedUrl(current.path).then(u => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [current.path]);

  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white z-10" onClick={e => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-sm font-black truncate">{current.name}</p>
          <p className="text-[11px] text-white/60 tabular-nums">
            {humanSize(current.size)} · {index + 1}/{images.length}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {url && (
            <a
              href={url}
              download={current.name}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Download className="h-3.5 w-3.5" /> Baixar
            </a>
          )}
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev(); }}
            className="absolute left-4 h-12 w-12 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 text-white flex items-center justify-center z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); next(); }}
            className="absolute right-4 h-12 w-12 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 text-white flex items-center justify-center z-10"
            aria-label="Próxima"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Image */}
      <div className="max-w-[92vw] max-h-[85vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {url ? (
          <img
            src={url}
            alt={current.name}
            className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg animate-in zoom-in-95 duration-200"
          />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        )}
      </div>
    </div>,
    document.body,
  );
}

export function AttachmentChips({
  attachments,
  tone = "muted",
}: {
  attachments: Attachment[] | null | undefined;
  tone?: "muted" | "primary" | "emerald";
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const list = attachments ?? [];
  const images = useMemo(() => list.filter(isImage), [list]);
  const others = useMemo(() => list.filter(a => !isImage(a)), [list]);

  if (list.length === 0) return null;

  const openFile = async (a: Attachment) => {
    setBusy(a.path);
    const url = await getSignedUrl(a.path);
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const toneClasses =
    tone === "primary"
      ? "bg-primary-foreground/10 border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/20"
      : tone === "emerald"
      ? "bg-emerald-500/10 border-emerald-500/30 text-foreground hover:bg-emerald-500/20"
      : "bg-muted/40 border-border/60 text-foreground hover:bg-muted/60";

  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((a, i) => (
            <Thumb key={a.path} att={a} onOpen={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map(a => {
            const Icon = /pdf/i.test(a.type) || /\.pdf$/i.test(a.name) ? FileText : Paperclip;
            return (
              <button
                key={a.path}
                onClick={() => openFile(a)}
                disabled={busy === a.path}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors max-w-[220px]",
                  toneClasses,
                  busy === a.path && "opacity-60",
                )}
                title={a.name}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.name}</span>
                <span className="opacity-60 tabular-nums">{humanSize(a.size)}</span>
                <Download className="h-3 w-3 shrink-0 opacity-70" />
              </button>
            );
          })}
        </div>
      )}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

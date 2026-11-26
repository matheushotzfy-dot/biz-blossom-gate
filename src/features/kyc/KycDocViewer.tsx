import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileText, ImageOff, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { openExternal } from "@/lib/safeUrl";
import type { KycDocType } from "@/components/kyc/kycSteps";
import { KYC_DOC_LABEL, duplicateGroups, formatBytes, type KycDocument } from "./kycReviewModel";

const isPdf = (d: KycDocument) => d.mime === "application/pdf" || /\.pdf$/i.test(d.name);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Documentos de uma verificação para quem analisa: um cartão por documento obrigatório (o que falta aparece como
 * falta), aviso quando a mesma imagem foi enviada em dois lugares e visualizador com zoom, giro e navegação.
 * PDF abre em outra aba (o storage não pode ser incorporado na página por causa do CSP).
 */
export function KycDocViewer({ documents, required, urls }: { documents: KycDocument[]; required: KycDocType[]; urls: Record<string, string> }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const byType = new Map(documents.map((d) => [d.type, d]));
  const viewable = required.map((t) => byType.get(t)).filter((d): d is KycDocument => !!d && !isPdf(d));
  const dups = duplicateGroups(documents);

  const open = (d: KycDocument) => {
    const url = urls[d.path];
    if (!url) return;
    if (isPdf(d)) { openExternal(url); return; }
    setOpenIdx(viewable.findIndex((v) => v.path === d.path));
  };

  return (
    <div className="space-y-3">
      {dups.map((g) => (
        <p key={g.join("-")} role="alert" className="flex items-start gap-2 rounded-[12px] bg-warning/10 px-3.5 py-2.5 text-[13px] font-medium text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          O mesmo arquivo foi enviado como {g.map((t) => KYC_DOC_LABEL[t].toLowerCase()).join(" e ")}. Confira antes de aprovar.
        </p>
      ))}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-0" style={{ listStyle: "none" }} aria-label="Documentos enviados">
        {required.map((type) => {
          const d = byType.get(type);
          const url = d ? urls[d.path] : undefined;
          return (
            <li key={type} className="min-w-0 overflow-hidden rounded-[14px] bg-card" style={{ border: "1px solid hsl(var(--border))" }}>
              {d ? (
                <button type="button" onClick={() => open(d)} disabled={!url} className="group block w-full text-left" aria-label={`Abrir ${KYC_DOC_LABEL[type]}`}>
                  <span className="relative block aspect-[4/3] w-full overflow-hidden bg-muted/40">
                    {isPdf(d) ? (
                      <span className="grid h-full w-full place-items-center text-muted-foreground"><span className="flex flex-col items-center gap-1.5"><FileText className="h-9 w-9 text-primary" aria-hidden /><span className="text-[12px] font-semibold">PDF, abre em outra aba</span></span></span>
                    ) : url ? (
                      <img src={url} alt={KYC_DOC_LABEL[type]} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-7 w-7" aria-hidden /></span>
                    )}
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{KYC_DOC_LABEL[type]}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{when(d.uploadedAt)} · {formatBytes(d.size)}</span>
                  </span>
                </button>
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 bg-destructive/5 px-3 text-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
                  <span className="text-[13px] font-semibold text-destructive">{KYC_DOC_LABEL[type]}</span>
                  <span className="text-[12px] text-muted-foreground">Não enviado</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Lightbox docs={viewable} urls={urls} index={openIdx} onIndex={setOpenIdx} />
    </div>
  );
}

function Lightbox({ docs, urls, index, onIndex }: { docs: KycDocument[]; urls: Record<string, string>; index: number | null; onIndex: (i: number | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const doc = index !== null ? docs[index] : null;

  useEffect(() => { setZoom(1); setTurn(0); }, [index]);

  useEffect(() => {
    if (index === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && docs.length > 1) onIndex((index + 1) % docs.length);
      if (e.key === "ArrowLeft" && docs.length > 1) onIndex((index - 1 + docs.length) % docs.length);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.5));
      if (e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
      if (e.key.toLowerCase() === "r") setTurn((t) => (t + 90) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, docs.length, onIndex]);

  const url = doc ? urls[doc.path] : undefined;
  const tool = "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-white/90 hover:bg-white/10 disabled:opacity-40";

  return (
    <Dialog open={index !== null} onOpenChange={(v) => { if (!v) onIndex(null); }}>
      <DialogContent className="z-[160] flex h-[min(94dvh,980px)] w-[calc(100vw-1rem)] max-w-[1200px] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-[hsl(222_47%_7%)] p-0 text-white [&>button]:text-white">
        <DialogTitle className="sr-only">{doc ? KYC_DOC_LABEL[doc.type] : "Documento"}</DialogTitle>
        <DialogDescription className="sr-only">Use as setas para trocar de documento, + e − para aproximar e R para girar.</DialogDescription>
        <div className="flex flex-wrap items-center gap-1 px-3 py-2.5 pr-12" style={{ borderBottom: "1px solid hsl(0 0% 100% / .1)" }}>
          <p className="mr-auto min-w-0 truncate px-1 text-[14px] font-semibold">{doc ? KYC_DOC_LABEL[doc.type] : ""}{docs.length > 1 && index !== null ? <span className="ml-2 font-normal text-white/60">{index + 1} de {docs.length}</span> : null}</p>
          <button type="button" className={tool} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label="Afastar"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-12 text-center text-[13px] tabular-nums text-white/80" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className={tool} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4} aria-label="Aproximar"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" className={tool} onClick={() => setTurn((t) => (t + 90) % 360)} aria-label="Girar"><RotateCw className="h-4 w-4" /></button>
          {url && <button type="button" className={tool} onClick={() => openExternal(url)}><ExternalLink className="h-4 w-4" aria-hidden />Abrir original</button>}
        </div>
        <div className="relative min-h-0 flex-1 overflow-auto">
          {url ? (
            <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: zoom > 1 ? `${zoom * 100}%` : undefined, height: zoom > 1 ? `${zoom * 100}%` : undefined }}>
              <img
                src={url}
                alt={doc ? KYC_DOC_LABEL[doc.type] : "Documento"}
                className="max-h-full max-w-full select-none object-contain"
                style={{ transform: `rotate(${turn}deg)`, transition: "transform .15s ease" }}
                draggable={false}
              />
            </div>
          ) : (
            <p className="grid h-full place-items-center text-[14px] text-white/70">Não foi possível abrir o arquivo.</p>
          )}
          {docs.length > 1 && index !== null && (
            <>
              <button type="button" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" onClick={() => onIndex((index - 1 + docs.length) % docs.length)} aria-label="Documento anterior"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" onClick={() => onIndex((index + 1) % docs.length)} aria-label="Próximo documento"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

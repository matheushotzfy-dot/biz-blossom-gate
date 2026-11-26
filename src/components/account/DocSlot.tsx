import { useRef, useState, type DragEvent } from "react";
import { Camera, CheckCircle2, ExternalLink, FileImage, FileText, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import type { KycStep } from "@/components/kyc/kycSteps";
import { acceptsPdf, isPdfName, kycAccept } from "@/features/kyc/kycFiles";
import { formatDay } from "./accountMeta";
import type { KycDocFile } from "./useAccountData";

/** Celular/tablet: oferece abrir a câmera direto, além de escolher da galeria. */
const touchDevice = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Um documento da verificação. Vazio: área para soltar ou escolher o arquivo (e, no celular, "Tirar foto").
 * Enviado: prévia (ou o cartão do PDF), data e, enquanto der para trocar, "Trocar arquivo".
 * A prévia vem de link assinado: se não carregar, mostra um ícone.
 */
export function DocSlot({ step, doc, editable, busy, problem, onFile }: {
  step: KycStep; doc: KycDocFile | undefined; editable: boolean; busy: boolean; problem: string | null; onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [broken, setBroken] = useState(false);
  const [touch] = useState(touchDevice);
  const Icon = step.icon;
  const pick = () => { if (editable && !busy) input.current?.click(); };
  const shoot = () => { if (editable && !busy) camera.current?.click(); };
  const take = (f: File | undefined) => { if (f && editable && !busy) { setBroken(false); onFile(f); } };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); };
  const dragOver = (e: DragEvent) => { if (!editable || busy) return; e.preventDefault(); setOver(true); };
  const id = `kyc-${step.type}`;
  const pdf = !!doc && isPdfName(doc.name);
  const formats = acceptsPdf(step.type) ? "Foto ou PDF" : "Foto";

  return (
    <article className="flex min-w-0 flex-col gap-3.5" aria-labelledby={`${id}-title`}>
      <input ref={input} id={`${id}-file`} type="file" accept={kycAccept(step.type)} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; take(f); }} />
      {touch && <input ref={camera} type="file" accept="image/*" capture={step.type === "selfie" ? "user" : "environment"} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; take(f); }} />}

      {doc ? (
        <div className="va-shot vp-r16 rounded-[16px]" onDragOver={dragOver} onDragLeave={() => setOver(false)} onDrop={drop} data-over={over}>
          {pdf ? (
            <span className="grid h-full w-full place-items-center text-muted-foreground">
              <span className="flex flex-col items-center gap-2"><FileText className="h-10 w-10 text-primary" aria-hidden /><span className="text-[13px] font-semibold">PDF enviado</span></span>
            </span>
          ) : doc.url && !broken ? (
            <img src={doc.url} alt={`Prévia: ${step.label}`} onError={() => setBroken(true)} />
          ) : (
            <span className="grid h-full w-full place-items-center text-muted-foreground"><FileImage className="h-10 w-10" aria-hidden /></span>
          )}
          <span className="absolute left-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-card/95 px-3 text-[12.5px] font-bold text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden />Enviado</span>
          {busy && <span className="va-shot-veil" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Enviando" /></span>}
        </div>
      ) : (
        <button type="button" onClick={pick} disabled={!editable || busy} data-over={over} data-bad={!!problem} onDragOver={dragOver} onDragLeave={() => setOver(false)} onDrop={drop} className="va-drop vp-r16" aria-describedby={`${id}-hint`} aria-label={`Enviar arquivo: ${step.label}`}>
          {busy ? (
            <span className="flex flex-col items-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden /><span className="text-[14px] font-semibold">Enviando…</span></span>
          ) : editable ? (
            <span className="flex flex-col items-center gap-2">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-primary"><UploadCloud className="h-6 w-6" aria-hidden /></span>
              <span className="text-[14.5px] font-bold text-foreground">{touch ? "Escolher da galeria" : "Escolher arquivo"}</span>
              <span className="text-[13px] text-muted-foreground">{touch ? `${formats}, até 10 MB` : `${formats} · ou solte aqui`}</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground"><Icon className="h-8 w-8" aria-hidden /><span className="text-[14px] font-semibold">Não enviado</span></span>
          )}
        </button>
      )}

      <div className="min-w-0">
        <h3 id={`${id}-title`} className="text-[15.5px] font-bold leading-tight text-foreground">{step.label}</h3>
        <p id={`${id}-hint`} className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{doc ? `Enviado em ${formatDay(doc.sentAt)}${pdf ? " (PDF)" : ""}.` : step.desc}</p>
        {!doc && editable && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.tip}</p>}
      </div>

      {(touch && editable && !doc) && (
        <button type="button" onClick={shoot} disabled={busy} className="vp-ghost h-10 justify-center px-4 text-[13.5px]"><Camera className="h-4 w-4" aria-hidden />{step.type === "selfie" ? "Tirar selfie agora" : "Tirar foto agora"}</button>
      )}
      {doc && (
        <div className="flex flex-wrap items-center gap-2">
          {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="vp-ghost h-9 px-3.5 text-[13px]"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Abrir</a>}
          {editable && <button type="button" onClick={pick} disabled={busy} className="vp-ghost h-9 px-3.5 text-[13px]"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Trocar arquivo</button>}
          {editable && touch && <button type="button" onClick={shoot} disabled={busy} className="vp-ghost h-9 px-3.5 text-[13px]"><Camera className="h-3.5 w-3.5" aria-hidden />Tirar outra</button>}
        </div>
      )}
      {problem && <p role="alert" className="text-[13.5px] font-medium text-destructive">{problem}</p>}
    </article>
  );
}

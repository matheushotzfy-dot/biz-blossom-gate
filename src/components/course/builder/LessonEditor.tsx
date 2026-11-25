import { useRef } from "react";
import { ArrowLeft, Download, File as FileIcon, Globe, Loader2, Paperclip, Plus, Trash2, Upload, Video } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { StudioPanel } from "@/components/seller-ui/studio";
import { cn } from "@/lib/utils";
import { formatFileSize, getVideoEmbed, isDirectVideoUrl, isValidVideoLink } from "@/components/course/builder/videoUtils";
import type { BuilderAttachment } from "@/components/course/builder/types";

export const VIDEO_ACCEPT = "video/mp4,video/webm,video/ogg,video/quicktime";

export interface LessonEditorProps {
  moduleTitle: string;
  lessonNumber: number;
  lessonTotal: number;
  title: string;
  onTitle: (v: string) => void;
  onTitleBlur: () => void;
  description: string;
  onDescription: (v: string) => void;
  /** Texto do campo de link (pode estar a meio caminho de ser salvo). */
  videoUrl: string;
  /** Vídeo que já está salvo na aula: é ele que aparece no player. */
  savedVideoUrl: string;
  onVideoUrl: (v: string) => void;
  onRemoveVideo: () => void;
  uploadingVideo: boolean;
  uploadingVideoName: string;
  onVideoFile: (file: File) => void;
  duration: number;
  onDuration: (v: number) => void;
  isFree: boolean;
  onIsFree: (v: boolean) => void;
  attachments: BuilderAttachment[];
  uploadingAttachment: boolean;
  onAttachmentFile: (file: File) => void;
  onDeleteAttachment: (att: BuilderAttachment) => void;
  onDeleteLesson: () => void;
  onBack: () => void;
}

export function LessonEditor(p: LessonEditorProps) {
  const videoInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const embed = p.savedVideoUrl ? getVideoEmbed(p.savedVideoUrl) : null;
  const direct = p.savedVideoUrl ? isDirectVideoUrl(p.savedVideoUrl) : false;
  const linkValid = isValidVideoLink(p.videoUrl);
  const titleEmpty = p.title.trim() === "";

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
      <button type="button" onClick={p.onBack} className="vp-ghost h-10 px-4 text-[13.5px] lg:hidden">
        <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
        Voltar para as aulas
      </button>

      <div>
        <p className="truncate text-[13.5px] text-muted-foreground">{p.moduleTitle}, aula {p.lessonNumber} de {p.lessonTotal}</p>
        <FieldLabel htmlFor="lesson-title" className="sr-only">Título da aula</FieldLabel>
        <Input
          id="lesson-title"
          value={p.title}
          onChange={(e) => p.onTitle(e.target.value.slice(0, 120))}
          onBlur={p.onTitleBlur}
          aria-invalid={titleEmpty}
          placeholder="Título da aula"
          autoComplete="off"
          className="vp-field mt-1.5 !h-14 font-heading !text-[20px] font-extrabold tracking-[-0.02em]"
        />
        {titleEmpty && <p className="mt-1.5 text-[12.5px] text-destructive">Dê um nome à aula. Sem nome, a alteração não é salva.</p>}
      </div>

      <StudioPanel title="Vídeo" subtitle="Envie um arquivo ou cole o link de um vídeo que já está no YouTube ou Vimeo.">
        <input ref={videoInput} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onVideoFile(f); e.target.value = ""; }} />
        {p.uploadingVideo ? (
          <div role="status" className="vp-r16 grid aspect-video place-items-center border border-border bg-muted/50 px-6 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" /></span>
              <p className="mt-4 text-[15px] font-bold text-foreground">Enviando o vídeo…</p>
              <p className="mt-1 max-w-[320px] truncate text-[13.5px] text-muted-foreground">{p.uploadingVideoName}</p>
              <p className="mt-1 text-[13.5px] text-muted-foreground">Vídeos grandes demoram. Não feche esta página até terminar.</p>
            </div>
          </div>
        ) : p.savedVideoUrl ? (
          <div className="space-y-3">
            <div className="vp-r16 aspect-video overflow-hidden border border-border bg-black">
              {direct ? (
                <video controls preload="metadata" className="h-full w-full" src={p.savedVideoUrl} />
              ) : embed ? (
                <iframe src={embed} title={`Vídeo da aula ${p.title}`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : (
                <div className="grid h-full w-full place-items-center bg-muted px-6 text-center">
                  <div>
                    <Video className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="mt-3 text-[14.5px] font-semibold text-foreground">Link salvo</p>
                    <p className="mt-0.5 text-[13.5px] text-muted-foreground">Essa prévia só toca YouTube, Vimeo e arquivos de vídeo. O aluno recebe o link como está.</p>
                    <a href={p.savedVideoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[14px] font-semibold text-primary underline-offset-4 hover:underline">Abrir o link</a>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => videoInput.current?.click()} className="vp-ghost h-10 px-4 text-[13.5px]"><Upload className="h-4 w-4" strokeWidth={2.2} />Trocar por um arquivo</button>
              <button type="button" onClick={p.onRemoveVideo} className="vp-ghost h-10 px-4 text-[13.5px] !text-destructive"><Trash2 className="h-4 w-4" strokeWidth={2.2} />Remover vídeo</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) p.onVideoFile(f); }}
            className="vp-r16 flex aspect-video max-h-[320px] w-full flex-col items-center justify-center gap-3 border border-dashed border-border bg-background px-6 text-center transition-colors hover:border-primary/60 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><Upload className="h-6 w-6" strokeWidth={2.2} /></span>
            <span>
              <span className="block text-[15px] font-semibold text-foreground">Escolher vídeo ou arrastar até aqui</span>
              <span className="mt-0.5 block text-[13.5px] text-muted-foreground">MP4, WebM, OGG ou MOV, até 500 MB.</span>
            </span>
          </button>
        )}

        <div className="mt-5">
          <FieldLabel htmlFor="video-link" hint="YouTube, Vimeo ou o endereço de um arquivo de vídeo.">Link do vídeo</FieldLabel>
          <div className="relative">
            <Globe aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <Input
              id="video-link"
              value={p.videoUrl}
              onChange={(e) => p.onVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!linkValid}
              className="vp-field !pl-11"
            />
          </div>
          {!linkValid && <FieldHint className="!text-destructive">O link precisa começar com https://. Enquanto estiver assim, ele não é salvo.</FieldHint>}
        </div>
      </StudioPanel>

      <StudioPanel title="Descrição" subtitle="Notas, referências e links que o aluno vê junto com a aula.">
        <label htmlFor="lesson-description" className="sr-only">Descrição da aula</label>
        <Textarea
          id="lesson-description"
          value={p.description}
          onChange={(e) => p.onDescription(e.target.value)}
          placeholder="Escreva o resumo da aula, links úteis e o que o aluno precisa fazer depois."
          rows={7}
          className="vp-field resize-y leading-relaxed"
        />
      </StudioPanel>

      <StudioPanel
        title="Materiais"
        subtitle="Arquivos para download, como PDFs e planilhas. Até 50 MB cada."
        aside={
          <button type="button" onClick={() => attachmentInput.current?.click()} disabled={p.uploadingAttachment} className="vp-ghost h-10 shrink-0 px-4 text-[13.5px]">
            {p.uploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus className="h-4 w-4" strokeWidth={2.4} />}
            {p.uploadingAttachment ? "Enviando…" : "Adicionar arquivo"}
          </button>
        }
      >
        <input ref={attachmentInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onAttachmentFile(f); e.target.value = ""; }} />
        {p.attachments.length === 0 ? (
          <div className="vp-r16 flex items-center gap-3.5 border border-dashed border-border px-4 py-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Paperclip className="h-[18px] w-[18px]" /></span>
            <p className="text-[14px] leading-snug text-muted-foreground">Nenhum arquivo nesta aula ainda.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {p.attachments.map((att) => (
              <li key={att.id} className="vp-r16 flex items-center gap-3 border border-border bg-card py-2.5 pl-3.5 pr-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><FileIcon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-foreground">{att.file_name}</span>
                  <span className="block text-[13px] text-muted-foreground">{formatFileSize(att.file_size)}</span>
                </span>
                <a href={att.file_url} target="_blank" rel="noopener noreferrer" aria-label={`Baixar ${att.file_name}`} title="Baixar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Download className="h-[18px] w-[18px]" />
                </a>
                <button type="button" onClick={() => p.onDeleteAttachment(att)} aria-label={`Remover ${att.file_name}`} title="Remover" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </StudioPanel>

      <StudioPanel title="Opções da aula">
        <div className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <label htmlFor="lesson-duration" className="text-[14.5px] font-semibold leading-tight text-foreground">Duração</label>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">Em minutos. O aluno vê esse tempo ao lado da aula.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="w-20">
                <Input
                  id="lesson-duration"
                  inputMode="numeric"
                  value={p.duration === 0 ? "" : String(p.duration)}
                  placeholder="0"
                  onChange={(e) => p.onDuration(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, 999))}
                  className="vp-field !h-11 text-center font-bold tabular-nums"
                />
              </div>
              <span className="text-[13.5px] text-muted-foreground">min</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p id="free-label" className="text-[14.5px] font-semibold leading-tight text-foreground">Aula grátis</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">Quem ainda não comprou pode assistir a esta aula.</p>
            </div>
            <Switch aria-labelledby="free-label" checked={p.isFree} onCheckedChange={p.onIsFree} />
          </div>
        </div>
        <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-destructive/25 bg-destructive/5 px-4 py-3.5")}>
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold leading-tight text-foreground">Excluir esta aula</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">O vídeo e os materiais dela também são apagados.</p>
          </div>
          <button type="button" onClick={p.onDeleteLesson} className="vp-ghost h-10 shrink-0 px-4 text-[13.5px] !text-destructive"><Trash2 className="h-4 w-4" strokeWidth={2.2} />Excluir aula</button>
        </div>
      </StudioPanel>
    </div>
  );
}

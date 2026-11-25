import { ExternalLink, FileText, Loader2, VideoOff } from "lucide-react";
import { videoKind } from "@/components/member/courseModel";
import { courseContentPathFromUrl, useCourseFileUrl } from "@/lib/courseFiles";
import { extractVimeoId, extractYouTubeId } from "@/lib/videoUrl";

type Props = {
  url: string | null | undefined;
  title: string;
  /** Chamado quando um vídeo em arquivo termina (YouTube/Vimeo não avisam daqui). */
  onEnded?: () => void;
};

const IFRAME_ALLOW = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full w-full place-items-center px-6 text-center">{children}</div>;
}

/** Vídeo da aula: embeds conhecidos, arquivo próprio (link assinado) ou só um link para abrir. */
export function LessonPlayer({ url, title, onEnded }: Props) {
  const clean = (url ?? "").trim();
  const kind = videoKind(clean, !!courseContentPathFromUrl(clean));
  const file = useCourseFileUrl(kind === "file" ? clean : null);

  if (kind === "none") {
    return (
      <Centered>
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-muted-foreground"><FileText className="h-6 w-6" /></span>
          <p className="mt-4 text-[17px] font-bold text-foreground">Aula de leitura</p>
          <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-muted-foreground">Esta aula não tem vídeo. O conteúdo está na descrição e nos materiais logo abaixo.</p>
        </div>
      </Centered>
    );
  }

  if (kind === "youtube") {
    const id = extractYouTubeId(clean);
    if (id) return <iframe key={id} src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`} title={`Vídeo: ${title}`} className="h-full w-full" allow={IFRAME_ALLOW} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  }
  if (kind === "vimeo") {
    const id = extractVimeoId(clean);
    if (id) return <iframe key={id} src={`https://player.vimeo.com/video/${id}?byline=0&portrait=0`} title={`Vídeo: ${title}`} className="h-full w-full" allow={IFRAME_ALLOW} allowFullScreen />;
  }
  if (kind === "embed") {
    return <iframe key={clean} src={clean} title={`Vídeo: ${title}`} className="h-full w-full" allow={IFRAME_ALLOW} allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />;
  }

  if (kind === "file") {
    if (file.status === "ready") {
      return <video key={file.src} controls playsInline preload="metadata" controlsList="nodownload" className="h-full w-full bg-black" src={file.src} onEnded={onEnded} aria-label={`Vídeo: ${title}`} />;
    }
    if (file.status === "error") {
      return (
        <Centered>
          <div role="alert">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-muted-foreground"><VideoOff className="h-6 w-6" /></span>
            <p className="mt-4 text-[17px] font-bold text-foreground">Não foi possível abrir o vídeo</p>
            <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-muted-foreground">Confira sua conexão. Se continuar assim, o seu acesso pode ter sido encerrado.</p>
            <button type="button" onClick={file.retry} className="mt-4 inline-flex h-11 items-center rounded-full bg-white/10 px-5 text-[14px] font-semibold text-foreground hover:bg-white/15">Tentar de novo</button>
          </div>
        </Centered>
      );
    }
    return <Centered><Loader2 className="h-7 w-7 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Carregando o vídeo" /></Centered>;
  }

  return (
    <Centered>
      <div>
        <p className="text-[17px] font-bold text-foreground">Este vídeo abre em outra página</p>
        <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-muted-foreground">O produtor usou um endereço que não toca aqui dentro.</p>
        <a href={clean} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-bold text-primary-foreground hover:opacity-90">
          Abrir o vídeo <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </Centered>
  );
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const YOUTUBE = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/;
const VIMEO = /vimeo\.com\/(\d+)/;

export function getVideoEmbed(url: string) {
  const yt = url.match(YOUTUBE);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(VIMEO);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function getVideoThumbnail(url: string) {
  const yt = url.match(YOUTUBE);
  return yt ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

export function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

/** Link aceito no campo de vídeo: vazio (remove o vídeo) ou http(s). */
export function isValidVideoLink(url: string) {
  const v = url.trim();
  return v === "" || /^https?:\/\/\S+$/i.test(v);
}

// Os arquivos do bucket "course-content" ficam em src/lib/courseFiles.ts (caminho, link assinado e pasta de envio).
export { courseContentPathFromUrl } from "@/lib/courseFiles";

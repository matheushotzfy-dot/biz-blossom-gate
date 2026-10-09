/**
 * Shared helpers for validating/embedding third-party video URLs.
 */
export function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

export function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

const ALLOWED_VIDEO_HOSTS = [
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'player.vimeo.com', 'vimeo.com', 'www.vimeo.com',
  'fast.wistia.net', 'player.hotmart.com', 'cdn.embedly.com', 'iframe.mediadelivery.net',
];

export function isAllowedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_VIDEO_HOSTS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

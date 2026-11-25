import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Arquivos de curso (vídeos enviados e materiais) ficam no bucket PRIVADO "course-content".
 * O banco guarda o endereço no formato público do storage só como identificador do arquivo;
 * quem lê (aluno, vendedor) pede um link assinado e temporário com `signCourseFile`.
 */
export const COURSE_CONTENT_BUCKET = "course-content";

const PUBLIC_MARKER = `/storage/v1/object/public/${COURSE_CONTENT_BUCKET}/`;

/** Caminho do arquivo no bucket, ou null quando o link é externo (YouTube, Vimeo etc.). */
export function courseContentPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const raw = url.slice(idx + PUBLIC_MARKER.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Pasta do arquivo: a política do storage exige `{dono}/{curso}/…` para o aluno matriculado poder ler. */
export function courseFilePath(ownerId: string, courseId: string, kind: "videos" | "attachments", ext: string) {
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return `${ownerId}/${courseId}/${kind}/${crypto.randomUUID()}.${clean}`;
}

type Signed = { url: string; expiresAt: number };
const cache = new Map<string, Signed>();
const inflight = new Map<string, Promise<string>>();

const SAFETY_MS = 60_000;

/**
 * Link assinado para um arquivo do bucket. Links externos voltam como estão.
 * Guarda o resultado até perto de vencer, então abrir a mesma aula de novo não pede outro.
 */
export async function signCourseFile(
  url: string,
  opts: { expiresIn?: number; downloadName?: string } = {},
): Promise<string> {
  const path = courseContentPathFromUrl(url);
  if (!path) return url;
  const expiresIn = opts.expiresIn ?? 4 * 3600;
  const key = `${path}|${opts.downloadName ?? ""}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt - Date.now() > SAFETY_MS) return hit.url;
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const { data, error } = await supabase.storage
      .from(COURSE_CONTENT_BUCKET)
      .createSignedUrl(path, expiresIn, opts.downloadName ? { download: opts.downloadName } : undefined);
    if (error || !data?.signedUrl) throw error ?? new Error("Sem link assinado");
    cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
    return data.signedUrl;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export type CourseFileState =
  | { status: "idle"; src: null }
  | { status: "loading"; src: null }
  | { status: "ready"; src: string }
  | { status: "error"; src: null };

/** Link pronto para tocar/baixar. Para um link externo devolve o próprio link na hora. */
export function useCourseFileUrl(url: string | null | undefined, opts: { downloadName?: string } = {}) {
  const [state, setState] = useState<CourseFileState>({ status: "idle", src: null });
  const [attempt, setAttempt] = useState(0);
  const downloadName = opts.downloadName;

  useEffect(() => {
    if (!url) { setState({ status: "idle", src: null }); return; }
    if (!courseContentPathFromUrl(url)) { setState({ status: "ready", src: url }); return; }
    let alive = true;
    setState({ status: "loading", src: null });
    signCourseFile(url, { downloadName })
      .then((src) => { if (alive) setState({ status: "ready", src }); })
      .catch(() => { if (alive) setState({ status: "error", src: null }); });
    return () => { alive = false; };
  }, [url, downloadName, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

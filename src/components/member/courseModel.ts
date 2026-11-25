/**
 * Regras puras da área do aluno (sem rede, sem React): ordem das aulas, progresso,
 * qual aula abrir e textos de duração. Testadas em src/test/member-course.test.ts.
 */

export type LessonLite = {
  id: string;
  module_id: string;
  title: string;
  description?: string | null;
  video_url?: string | null;
  duration_minutes?: number | null;
  is_free?: boolean | null;
  sort_order?: number | null;
};

export type ModuleLite<L extends LessonLite = LessonLite> = {
  id: string;
  title: string;
  description?: string | null;
  sort_order?: number | null;
  lessons: L[];
};

export type DoneMap = ReadonlyMap<string, boolean> | Readonly<Record<string, boolean>>;

const isDone = (done: DoneMap, id: string) => (done instanceof Map ? !!done.get(id) : !!(done as Record<string, boolean>)[id]);

const byOrder = <T extends { sort_order?: number | null }>(a: T, b: T) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/** Módulos e aulas na ordem em que o aluno os vê. */
export function sortCourse<L extends LessonLite>(modules: ModuleLite<L>[]): ModuleLite<L>[] {
  return modules
    .slice()
    .sort(byOrder)
    .map((m) => ({ ...m, lessons: m.lessons.slice().sort(byOrder) }));
}

export function orderedLessons<L extends LessonLite>(modules: ModuleLite<L>[]): L[] {
  return modules.flatMap((m) => m.lessons);
}

export type Progress = { done: number; total: number; pct: number };

export function progressOf(lessons: { id: string }[], done: DoneMap): Progress {
  const total = lessons.length;
  const n = lessons.filter((l) => isDone(done, l.id)).length;
  return { done: n, total, pct: total === 0 ? 0 : Math.round((n / total) * 100) };
}

/**
 * Aula que abre ao entrar no curso: a pedida (se existir), senão a primeira ainda não
 * concluída, senão (curso todo concluído) a primeira.
 */
export function pickStartLessonId(lessons: { id: string }[], done: DoneMap, requestedId?: string | null): string | null {
  if (lessons.length === 0) return null;
  if (requestedId && lessons.some((l) => l.id === requestedId)) return requestedId;
  return (lessons.find((l) => !isDone(done, l.id)) ?? lessons[0]).id;
}

export function neighbors<L extends { id: string }>(lessons: L[], id: string | null): { prev: L | null; next: L | null } {
  const i = id ? lessons.findIndex((l) => l.id === id) : -1;
  if (i === -1) return { prev: null, next: null };
  return { prev: lessons[i - 1] ?? null, next: lessons[i + 1] ?? null };
}

/** "8 min", "1 h", "1 h 05"; vazio quando a aula não tem duração. */
export function formatMinutes(min: number | null | undefined): string {
  const m = Math.round(Number(min) || 0);
  if (m <= 0) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

export function totalMinutes(lessons: { duration_minutes?: number | null }[]): number {
  return lessons.reduce((a, l) => a + (Number(l.duration_minutes) || 0), 0);
}

/** "Aula 3 de 12" a partir da posição da aula na ordem do curso. */
export function lessonPosition(lessons: { id: string }[], id: string | null): { index: number; total: number } {
  const i = id ? lessons.findIndex((l) => l.id === id) : -1;
  return { index: i + 1, total: lessons.length };
}

export type VideoKind = "youtube" | "vimeo" | "file" | "embed" | "link" | "none";

const EMBED_HOSTS = ["fast.wistia.net", "player.hotmart.com", "cdn.embedly.com", "iframe.mediadelivery.net"];
const FILE_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

/** Como a aula toca: arquivo próprio (bucket) ou direto, embed conhecido, ou só um link para abrir. */
export function videoKind(url: string | null | undefined, isBucketFile: boolean): VideoKind {
  const u = (url ?? "").trim();
  if (!u) return "none";
  if (isBucketFile) return "file";
  if (/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))/.test(u)) return "youtube";
  if (/vimeo\.com\/\d+/.test(u)) return "vimeo";
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return "link";
    if (FILE_RE.test(parsed.pathname)) return "file";
    if (EMBED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) return "embed";
  } catch {
    return "none";
  }
  return "link";
}

/** 270 → "4:30", 3723 → "1:02:03". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "4:30" → 270, "1:02:03" → 3723, vazio → 0, qualquer outra coisa → null. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (t === "") return 0;
  const m = t.match(/^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  if (m[1] && min > 59) return null;
  return h * 3600 + min * 60 + Number(m[3]);
}

/** Primeiro nome + inicial do sobrenome ("Maria S."), para nomes que outros alunos veem. */
export function shortName(full: string | null | undefined): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  if (parts.length === 1) return parts[0].slice(0, 30);
  return `${parts[0].slice(0, 30)} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" ou a data. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export type CourseStatus = "not_started" | "in_progress" | "completed" | "empty";

export type CourseSummary = {
  total: number;
  done: number;
  pct: number;
  status: CourseStatus;
  /** Próxima aula a assistir (primeira não concluída); null se o curso está vazio. */
  next: { id: string; title: string; moduleTitle: string } | null;
  /** Último movimento do aluno neste curso (ms); 0 se nunca mexeu. */
  lastActivityAt: number;
};

export type ProgressRow = { lesson_id: string; completed: boolean | null; updated_at: string };

/** Resumo de um curso para a tela inicial do aluno. */
export function summarizeCourse(modules: ModuleLite[], progress: ProgressRow[]): CourseSummary {
  const sorted = sortCourse(modules);
  const lessons = sorted.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const ids = new Set(lessons.map((l) => l.id));
  const done: Record<string, boolean> = {};
  let last = 0;
  for (const p of progress) {
    if (!ids.has(p.lesson_id)) continue;
    if (p.completed) done[p.lesson_id] = true;
    const t = new Date(p.updated_at).getTime();
    if (Number.isFinite(t) && t > last) last = t;
  }
  const prog = progressOf(lessons, done);
  const nextLesson = lessons.find((l) => !done[l.id]) ?? lessons[0] ?? null;
  const status: CourseStatus = prog.total === 0 ? "empty" : prog.done === prog.total ? "completed" : prog.done > 0 ? "in_progress" : "not_started";
  return { ...prog, status, next: nextLesson ? { id: nextLesson.id, title: nextLesson.title, moduleTitle: nextLesson.moduleTitle } : null, lastActivityAt: last };
}

/** Curso em destaque: o que o aluno mexeu por último e ainda não terminou; senão o primeiro que ele ainda não começou. */
export function pickContinueIndex(items: { summary: CourseSummary }[]): number {
  let best = -1;
  items.forEach((it, i) => {
    if (it.summary.status !== "in_progress") return;
    if (best === -1 || it.summary.lastActivityAt > items[best].summary.lastActivityAt) best = i;
  });
  if (best !== -1) return best;
  return items.findIndex((it) => it.summary.status === "not_started");
}

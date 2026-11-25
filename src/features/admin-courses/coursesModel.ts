import type { Tone } from "@/features/admin-disputes/disputesModel";
import { courseContentPathFromUrl } from "@/lib/courseFiles";
import { safeNavigationUrl } from "@/lib/safeUrl";

export const PAGE_SIZE = 25;
export type { Tone };
export type StatusFilter = "all" | "published" | "draft" | "held";

export const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "published", label: "No ar" },
  { value: "draft", label: "Rascunhos" },
  { value: "held", label: "Tirados do ar" },
];

/* ───────── dados que vêm do servidor ───────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);

export interface CourseItem {
  id: string; title: string; category: string | null; thumbnail_url: string | null; is_published: boolean;
  hold_reason: string | null; hold_at: string | null; created_at: string; updated_at: string | null;
  product_id: string | null; product_name: string | null; product_status: string | null; product_deleted: boolean;
  seller_user_id: string; seller_name: string; seller_email: string | null;
  modules: number; lessons: number; minutes: number; students: number; certificates: number;
}
export interface CoursesSummary { all: number; published: number; draft: number; held: number; published_empty: number; published_product_off: number }
export interface CoursesPage { items: CourseItem[]; total: number; summary: CoursesSummary }

function parseItem(r: Record<string, unknown>): CourseItem {
  return {
    id: str(r.id), title: str(r.title) || "Curso sem título", category: strOrNull(r.category), thumbnail_url: strOrNull(r.thumbnail_url), is_published: r.is_published === true,
    hold_reason: strOrNull(r.hold_reason), hold_at: strOrNull(r.hold_at), created_at: str(r.created_at), updated_at: strOrNull(r.updated_at),
    product_id: strOrNull(r.product_id), product_name: strOrNull(r.product_name), product_status: strOrNull(r.product_status), product_deleted: r.product_deleted === true,
    seller_user_id: str(r.seller_user_id), seller_name: str(r.seller_name) || str(r.seller_email) || "Seller sem nome", seller_email: strOrNull(r.seller_email),
    modules: num(r.modules), lessons: num(r.lessons), minutes: num(r.minutes), students: num(r.students), certificates: num(r.certificates),
  };
}

export function parseCoursesPage(raw: unknown): CoursesPage {
  if (!isObj(raw) || !Array.isArray(raw.items)) throw new Error("Resposta inesperada do servidor.");
  const s = isObj(raw.summary) ? raw.summary : {};
  return {
    items: raw.items.filter(isObj).map(parseItem), total: num(raw.total),
    summary: { all: num(s.all), published: num(s.published), draft: num(s.draft), held: num(s.held), published_empty: num(s.published_empty), published_product_off: num(s.published_product_off) },
  };
}

export interface CourseLesson { id: string; title: string; minutes: number; is_free: boolean; video_url: string | null; attachments: number }
export interface CourseDetail {
  course: { id: string; title: string; description: string; category: string | null; thumbnail_url: string | null; is_published: boolean; hold_reason: string | null; hold_at: string | null; created_at: string; updated_at: string | null };
  product: { id: string; name: string; status: string; deleted: boolean } | null;
  seller: { user_id: string; name: string; email: string | null; account_status: string | null };
  stats: { modules: number; lessons: number; minutes: number; free_lessons: number; without_video: number; students: number; revoked: number; with_progress: number; active_7d: number; certificates: number; comments: number };
  modules: { id: string; title: string; lessons: CourseLesson[] }[];
  history: { id: string; action: string; created_at: string; admin_name: string | null; reason: string | null }[];
}

export function parseCourseDetail(raw: unknown): CourseDetail {
  if (!isObj(raw) || !isObj(raw.course)) throw new Error("Resposta inesperada do servidor.");
  const c = raw.course, s = isObj(raw.seller) ? raw.seller : {}, st = isObj(raw.stats) ? raw.stats : {}, p = isObj(raw.product) ? raw.product : null;
  return {
    course: {
      id: str(c.id), title: str(c.title) || "Curso sem título", description: str(c.description), category: strOrNull(c.category), thumbnail_url: strOrNull(c.thumbnail_url),
      is_published: c.is_published === true, hold_reason: strOrNull(c.hold_reason), hold_at: strOrNull(c.hold_at), created_at: str(c.created_at), updated_at: strOrNull(c.updated_at),
    },
    product: p ? { id: str(p.id), name: str(p.name) || "Produto sem nome", status: str(p.status), deleted: p.deleted === true } : null,
    seller: { user_id: str(s.user_id), name: str(s.name) || "Seller sem nome", email: strOrNull(s.email), account_status: strOrNull(s.account_status) },
    stats: {
      modules: num(st.modules), lessons: num(st.lessons), minutes: num(st.minutes), free_lessons: num(st.free_lessons), without_video: num(st.without_video), students: num(st.students),
      revoked: num(st.revoked), with_progress: num(st.with_progress), active_7d: num(st.active_7d), certificates: num(st.certificates), comments: num(st.comments),
    },
    modules: arr(raw.modules).map((m) => ({
      id: str(m.id), title: str(m.title) || "Módulo sem título",
      lessons: arr(m.lessons).map((l) => ({ id: str(l.id), title: str(l.title) || "Aula sem título", minutes: num(l.minutes), is_free: l.is_free === true, video_url: strOrNull(l.video_url), attachments: num(l.attachments) })),
    })),
    history: arr(raw.history).map((h) => {
      const det = isObj(h.details) ? h.details : {};
      return { id: str(h.id), action: str(h.action), created_at: str(h.created_at), admin_name: strOrNull(h.admin_name), reason: strOrNull(det.reason) };
    }),
  };
}

/* ───────── situação e textos ───────── */

export function courseState(c: { is_published: boolean; hold_at: string | null }): { label: string; tone: Tone } {
  if (c.hold_at) return { label: "Tirado do ar", tone: "destructive" };
  return c.is_published ? { label: "No ar", tone: "success" } : { label: "Rascunho", tone: "neutral" };
}

/** O que impede o aluno de usar o curso que está no ar, em português; `null` quando está tudo certo. */
export function courseAttention(c: Pick<CourseItem, "is_published" | "lessons" | "product_id" | "product_status" | "product_deleted" | "hold_at">): string | null {
  if (!c.is_published || c.hold_at) return null;
  if (c.lessons === 0) return "No ar sem nenhuma aula";
  if (c.product_id && (c.product_deleted || c.product_status !== "active")) return "O produto ligado está fora do ar";
  return null;
}

export function productStateLabel(p: { status: string | null; deleted: boolean } | null): string | null {
  if (!p) return null;
  if (p.deleted) return "apagado";
  switch (p.status) {
    case "active": return null;
    case "inactive": return "inativo";
    case "pending_review": return "em revisão";
    case "draft": return "rascunho";
    default: return "fora do ar";
  }
}

/** Só o dia, no fuso de São Paulo, para listas onde a hora não ajuda. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function durationLabel(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export type VideoKind = { kind: "none" | "upload" | "link"; label: string };
export function videoKind(url: string | null): VideoKind {
  if (!url) return { kind: "none", label: "Sem vídeo" };
  if (courseContentPathFromUrl(url)) return { kind: "upload", label: "Vídeo enviado" };
  const safe = safeNavigationUrl(url);
  if (!safe) return { kind: "link", label: "Link inválido" };
  try {
    const host = new URL(safe).hostname.replace(/^www\./, "");
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return { kind: "link", label: "YouTube" };
    if (/(^|\.)vimeo\.com$/.test(host)) return { kind: "link", label: "Vimeo" };
    return { kind: "link", label: host };
  } catch { return { kind: "link", label: "Link" }; }
}

export function historyLabel(action: string): string {
  switch (action) {
    case "course_hold": return "Tirado do ar";
    case "course_release": return "Liberado para o seller publicar";
    default: return "Ação registrada";
  }
}

export const HOLD_PRESETS = ["Promessa irreal de resultado", "Conteúdo ilegal", "Direitos autorais", "Conteúdo diferente do que foi vendido", "Denúncia de aluno"];
export const REASON_MIN = 5;
export const checkReason = (text: string) => (text.trim().length < REASON_MIN ? `Escreva o motivo (mínimo ${REASON_MIN} caracteres).` : null);

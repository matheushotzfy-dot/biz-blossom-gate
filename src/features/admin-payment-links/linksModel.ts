import type { Tables } from "@/integrations/supabase/types";

export type LinkRow = Tables<"payment_links"> & {
  seller_name: string | null;
  seller_email: string | null;
  pending_count: number;
  net_revenue: number;
  last_payment_at: string | null;
};
export type LinkFilter = "all" | "active" | "paused" | "blocked" | "review" | "archived";
export interface LinksSummary { total: number; active: number; paused: number; blocked: number; review: number; archived: number; net_revenue: number }
export interface LinksPage { items: LinkRow[]; total: number; summary: LinksSummary }
export type ModerationAction = "block" | "unblock" | "review" | "clear";

export const PAGE_SIZE = 50;
export const MIN_BLOCK_REASON = 5;

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function parseLinksPage(raw: unknown): LinksPage {
  const r = raw as { items?: unknown; total?: unknown; summary?: Record<string, unknown> } | null;
  if (!r || !Array.isArray(r.items)) throw new Error("Resposta inesperada do servidor.");
  const s = r.summary ?? {};
  return {
    items: (r.items as LinkRow[]).map((l) => ({ ...l, pending_count: num(l.pending_count), net_revenue: num(l.net_revenue) })),
    total: num(r.total),
    summary: { total: num(s.total), active: num(s.active), paused: num(s.paused), blocked: num(s.blocked), review: num(s.review), archived: num(s.archived), net_revenue: num(s.net_revenue) },
  };
}

export type SituationKey = "blocked" | "archived" | "paused" | "expired" | "exhausted" | "active";
export interface Situation { key: SituationKey; label: string; tone: "success" | "warning" | "destructive" | "muted" }

/** O que o link está fazendo agora. Bloqueio da equipe vence tudo; depois arquivado, pausado, vencido e esgotado. */
export function linkSituation(l: Pick<LinkRow, "admin_status" | "archived_at" | "is_active" | "expires_at" | "max_uses" | "current_uses">, now = Date.now()): Situation {
  if (l.admin_status === "blocked") return { key: "blocked", label: "Bloqueado", tone: "destructive" };
  if (l.archived_at) return { key: "archived", label: "Arquivado", tone: "muted" };
  if (!l.is_active) return { key: "paused", label: "Pausado", tone: "warning" };
  if (l.expires_at && Date.parse(l.expires_at) <= now) return { key: "expired", label: "Vencido", tone: "muted" };
  if (l.max_uses != null && l.max_uses > 0 && num(l.current_uses) >= l.max_uses) return { key: "exhausted", label: "Esgotado", tone: "muted" };
  return { key: "active", label: "Ativo", tone: "success" };
}

/** Ações de moderação que fazem sentido para o estado atual do link. */
export function moderationActions(l: Pick<LinkRow, "admin_status">): ModerationAction[] {
  if (l.admin_status === "blocked") return ["unblock"];
  if (l.admin_status === "review") return ["clear", "block"];
  return ["review", "block"];
}

export const ACTION_STATUS: Record<ModerationAction, "blocked" | "clear" | "review"> = { block: "blocked", unblock: "clear", review: "review", clear: "clear" };
export const ACTION_LABEL: Record<ModerationAction, string> = { block: "Bloquear", unblock: "Desbloquear", review: "Marcar para revisão", clear: "Liberar da revisão" };
export const ACTION_DONE: Record<ModerationAction, string> = { block: "Link bloqueado.", unblock: "Link desbloqueado.", review: "Link marcado para revisão.", clear: "Link liberado da revisão." };

export interface LinkEvent { id: string; event_type: string; actor_type: string; created_at: string; metadata: Record<string, unknown> | null }

const EVENT_LABEL: Record<string, string> = {
  created: "Link criado", updated: "Link editado", activated: "Link reativado", paused: "Link pausado", archived: "Link arquivado",
  restored: "Link restaurado", deleted: "Link apagado", admin_status_blocked: "Bloqueado pela equipe", admin_status_review: "Marcado para revisão",
  admin_status_clear: "Liberado pela equipe", admin_status_changed: "Moderação alterada",
};
export const eventLabel = (type: string) => EVENT_LABEL[type] ?? "Evento registrado";
export const actorLabel = (a: string) => (a === "admin" ? "Equipe" : a === "seller" ? "Vendedor" : "Sistema");
export const eventReason = (ev: LinkEvent): string | null => { const r = ev.metadata?.reason; return typeof r === "string" && r.trim() ? r.trim() : null; };

/** A troca de moderação grava dois eventos no mesmo instante (o da regra do banco e o da ação). Fica só o específico. */
export function dedupeEvents(events: LinkEvent[]): LinkEvent[] {
  const specific = new Set(events.filter((e) => e.event_type.startsWith("admin_status_") && e.event_type !== "admin_status_changed").map((e) => e.created_at));
  return events.filter((e) => !(e.event_type === "admin_status_changed" && specific.has(e.created_at)));
}

export const publicLinkUrl = (slug: string, origin = typeof window !== "undefined" ? window.location.origin : "") => `${origin}/pay/${slug}`;

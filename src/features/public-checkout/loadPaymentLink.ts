import { supabase } from "@/integrations/supabase/client";

export type PublicPaymentLink = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  amount: number;
  acceptPix: boolean;
  acceptCard: boolean;
  maxUses: number | null;
  currentUses: number;
  expiresAt: number | null;
};

export type PaymentLinkLoad =
  | { kind: "missing" }
  | { kind: "blocked" }
  | { kind: "expired" }
  | { kind: "exhausted" }
  | { kind: "ready"; link: PublicPaymentLink };

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function normalizePaymentLink(row: Row): PublicPaymentLink {
  const amount = Number(row.amount);
  const maxUses = row.max_uses == null ? null : Number(row.max_uses);
  const expires = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : Number.NaN;
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: text(row.title) ?? "Cobrança",
    description: text(row.description),
    coverUrl: text(row.cover_url),
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    acceptPix: row.accept_pix !== false,
    acceptCard: row.accept_card === true,
    maxUses: maxUses != null && Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
    currentUses: Number.isFinite(Number(row.current_uses)) ? Number(row.current_uses) : 0,
    expiresAt: Number.isFinite(expires) ? expires : null,
  };
}

/** Só informa; quem barra pagamento de link vencido ou esgotado é o servidor, na hora de criar a cobrança. */
export function classifyPaymentLink(link: PublicPaymentLink, now = Date.now()): PaymentLinkLoad {
  if (link.expiresAt !== null && link.expiresAt <= now) return { kind: "expired" };
  if (link.maxUses !== null && link.currentUses >= link.maxUses) return { kind: "exhausted" };
  return { kind: "ready", link };
}

/** Erro de rede/servidor vira exceção (tela de "tentar de novo"); link que não existe é um resultado normal. */
export async function loadPaymentLink(slug: string): Promise<PaymentLinkLoad> {
  const { data, error } = await supabase.rpc("get_public_payment_link", { _slug: slug });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Row | null | undefined;
  if (!row || row.is_active === false) return { kind: "missing" };
  // Bloqueado pela equipe da plataforma: a página não mostra valor nem título, e não diz o motivo.
  if (row.admin_status === "blocked") return { kind: "blocked" };
  return classifyPaymentLink(normalizePaymentLink(row));
}

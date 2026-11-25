import type { Tables } from "@/integrations/supabase/types";
import { toMaskedBRL } from "@/components/seller-ui/money";

export type PaymentLink = Tables<"payment_links">;

export type PaymentLinkStatus = "all" | "active" | "paused" | "blocked" | "review" | "archived" | "expired";

export interface PaymentLinkPermissions {
  accept_pix: boolean;
  accept_card: boolean;
  accept_boleto: boolean;
}

export interface PaymentLinkPage {
  items: PaymentLink[];
  filtered_total: number;
  total: number;
  revenue: number;
  clicks: number;
  uses: number;
  active: number;
}

export interface PaymentLinkDraft {
  title: string;
  description: string;
  amount: string;
  slug: string;
  max_uses: string;
  expires_at: string;
  pix_expiration_minutes: string;
  instructions: string;
  redirect_url: string;
  accept_pix: boolean;
  accept_card: boolean;
  accept_boleto: boolean;
}

export const emptyPaymentLinkDraft = (permissions: PaymentLinkPermissions): PaymentLinkDraft => ({
  title: "",
  description: "",
  amount: "",
  slug: "",
  max_uses: "",
  expires_at: "",
  pix_expiration_minutes: "30",
  instructions: "",
  redirect_url: "",
  accept_pix: permissions.accept_pix,
  accept_card: false,
  accept_boleto: false,
});

/** ISO → valor de <input type="datetime-local"> no horário do navegador (o campo é local; toISOString() daria UTC). */
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const paymentLinkToDraft = (link: PaymentLink, permissions: PaymentLinkPermissions): PaymentLinkDraft => ({
  title: link.title,
  description: link.description ?? "",
  amount: toMaskedBRL(Number(link.amount)),
  slug: link.slug,
  max_uses: link.max_uses ? String(link.max_uses) : "",
  expires_at: toLocalInput(link.expires_at),
  pix_expiration_minutes: String(link.pix_expiration_minutes ?? 30),
  instructions: link.instructions ?? "",
  redirect_url: link.redirect_url ?? "",
  accept_pix: permissions.accept_pix && link.accept_pix,
  accept_card: permissions.accept_card && link.accept_card,
  accept_boleto: permissions.accept_boleto && link.accept_boleto,
});
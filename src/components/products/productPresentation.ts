import type { Tables } from "@/integrations/supabase/types";
import type { TxTone } from "@/components/seller-ui/txMeta";

export type Product = Tables<"products">;
export type ProductStatus = Product["status"];

/** Rótulo e cor do status do produto (lista, cards e editor usam o mesmo). */
export const STATUS_META: Record<string, { label: string; tone: TxTone }> = {
  active: { label: "Ativo", tone: "ok" },
  pending_review: { label: "Em revisão", tone: "wait" },
  draft: { label: "Rascunho", tone: "idle" },
  inactive: { label: "Pausado", tone: "idle" },
};

export const DELIVERY_LABELS: Record<string, string> = {
  digital: "Área de membros",
  email: "Acesso por e-mail",
  link: "Só o pagamento",
  external: "Área externa",
  curso: "Curso online",
  ebook: "E-book",
  mentoria: "Mentoria",
  software: "Software",
  servico: "Serviço",
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export const formatCompactDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export function getCheckoutSlug(checkoutUrl: string): string {
  const raw = checkoutUrl.trim().replace(/\/+$/, "");
  const last = raw.split("/").pop() ?? "";
  return last.replace(/[^a-zA-Z0-9_-]/g, "");
}

export const getCheckoutLink = (checkoutUrl: string) => {
  const slug = getCheckoutSlug(checkoutUrl);
  return slug ? `${window.location.origin}/pay/${slug}` : "";
};

export type AllowedMethods = { pix: boolean; boleto: boolean; card: boolean };

/** Formas que o comprador realmente vê: as ligadas no produto E liberadas na conta (o catálogo público faz a mesma conta). */
export function checkoutMethods(
  p: Pick<Product, "checkout_pix_enabled" | "checkout_boleto_enabled" | "checkout_credit_card_enabled">,
  allowed: AllowedMethods | null,
): string[] {
  const ok = allowed ?? { pix: true, boleto: true, card: true };
  const methods: string[] = [];
  if (p.checkout_pix_enabled && ok.pix) methods.push("Pix");
  if (p.checkout_credit_card_enabled && ok.card) methods.push("Cartão");
  if (p.checkout_boleto_enabled && ok.boleto) methods.push("Boleto");
  return methods;
}

/* ───────────────────────── Draft / completion helpers ───────────────────────── */

export type ProductRequirement = {
  key: string;
  label: string;
  done: boolean;
};

/** Determines which mandatory fields are still missing on a product. */
export function getProductRequirements(product: Product): ProductRequirement[] {
  const hasName =
    !!product.name &&
    product.name.trim().length > 1 &&
    product.name.trim().toLowerCase() !== "novo produto";
  const hasPrice = Number(product.price) >= 1;
  const hasDescription = !!product.description && product.description.trim().length >= 10;
  const hasImage = !!product.image_url;
  const hasCheckout = !!product.checkout_url && product.status === "active";

  return [
    { key: "name", label: "Nome do produto", done: hasName },
    { key: "price", label: "Preço de venda (mínimo R$ 1,00)", done: hasPrice },
    { key: "description", label: "Descrição (mín. 10 caracteres)", done: hasDescription },
    { key: "image", label: "Imagem de capa", done: hasImage },
    { key: "checkout", label: "Checkout publicado", done: hasCheckout },
  ];
}

/** True if the product is missing essential information (treated as draft). */
export function isProductDraft(product: Product): boolean {
  if (product.status === "draft") return true;
  // Auto-classify as draft when admin hasn't touched it yet but core info is missing.
  if (product.status !== "active") return false;
  const reqs = getProductRequirements(product);
  return reqs.some((r) => !r.done);
}

/** Returns the effective status considering auto-draft detection. */
export function getEffectiveStatus(product: Product): "draft" | "active" | "pending_review" | "inactive" {
  if (isProductDraft(product)) return "draft";
  return (product.status as "draft" | "active" | "pending_review" | "inactive") || "active";
}

/** Mirrors the public catalog rule: the buyer page is live when status is active and a checkout URL exists. */
export function isCheckoutLive(product: Product): boolean {
  return product.status === "active" && !!product.checkout_url;
}

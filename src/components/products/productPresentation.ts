import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type ProductStatus = Product["status"];

export const DELIVERY_LABELS: Record<string, string> = {
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

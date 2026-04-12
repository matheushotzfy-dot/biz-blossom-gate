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

export const getCheckoutLink = (checkoutUrl: string) =>
  `${window.location.origin}/pay/${checkoutUrl.split("/").pop()!}`;
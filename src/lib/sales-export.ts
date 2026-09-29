import type { Tables } from "@/integrations/supabase/types";

export type SalesExportFilters = {
  search?: string;
  statuses?: string[];
  productId?: string;
  customerName?: string;
  customerEmail?: string;
};

export function spreadsheetSafe(value: unknown): string | number {
  if (typeof value === "number") return value;
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function filterTransactions(
  rows: Tables<"transactions">[],
  filters: SalesExportFilters,
): Tables<"transactions">[] {
  const search = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const name = filters.customerName?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const email = filters.customerEmail?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const statuses = new Set(filters.statuses ?? []);
  return rows.filter((row) => {
    if (filters.productId && row.product_id !== filters.productId) return false;
    if (statuses.size > 0 && !statuses.has(row.status ?? "")) return false;
    if (name && !(row.customer_name ?? "").toLocaleLowerCase("pt-BR").includes(name)) return false;
    if (email && !(row.customer_email ?? "").toLocaleLowerCase("pt-BR").includes(email)) return false;
    if (!search) return true;
    return [row.id, row.customer_name, row.customer_email, row.customer_document]
      .some((value) => (value ?? "").toLocaleLowerCase("pt-BR").includes(search));
  });
}

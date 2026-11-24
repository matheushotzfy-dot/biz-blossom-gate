import type { FilterOption } from "@/components/seller-ui/FilterPills";
import type { SalesStatusKey } from "@/lib/sales-status-filter";

export const SALES_STATUS_OPTIONS: FilterOption<SalesStatusKey>[] = [
  { value: "all", label: "Todas" },
  { value: "paid", label: "Pagas" },
  { value: "pending", label: "Aguardando" },
  { value: "expired", label: "Expiradas" },
  { value: "refunded", label: "Reembolsos" },
  { value: "disputed", label: "Contestações" },
];


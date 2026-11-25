/** Opções do filtro de status da exportação de vendas e o jeito de reconhecer a opção a partir do filtro guardado. */
export interface ExportStatusOption { id: string; label: string; statuses: string[] }

export const EXPORT_STATUS_OPTIONS: ExportStatusOption[] = [
  { id: "all", label: "Todos os status", statuses: [] },
  { id: "paid", label: "Pagos", statuses: ["approved", "completed", "paid"] },
  { id: "pending", label: "Pendentes", statuses: ["pending"] },
  { id: "expired", label: "Expirados", statuses: ["expired"] },
  { id: "refunded", label: "Reembolsados", statuses: ["refunded"] },
  { id: "chargeback", label: "Chargebacks", statuses: ["chargeback"] },
  { id: "failed", label: "Falhos", statuses: ["failed"] },
  { id: "cancelled", label: "Cancelados", statuses: ["cancelled"] },
];

/** Qual opção da lista representa os status guardados no filtro. */
export function exportStatusId(statuses: string[] | undefined): string {
  if (!statuses || statuses.length === 0) return "all";
  return EXPORT_STATUS_OPTIONS.find((o) => o.statuses.length > 0 && o.statuses.includes(statuses[0]))?.id ?? "all";
}

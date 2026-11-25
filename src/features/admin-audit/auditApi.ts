import { useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/features/admin-errors/errorsApi";
import { downloadCsv } from "@/features/admin-tools/toolsApi";
import { EXPORT_MAX, EXPORT_PAGE, periodDays, parseAuditPage, type AuditFilters, type AuditItem } from "./auditModel";

export { callRpc, downloadCsv };

export const AUDIT_KEY = ["admin-audit"] as const;
export const AUDIT_ENTRY_KEY = ["admin-audit-entry"] as const;

export function useRefreshAudit() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: AUDIT_KEY });
    void qc.invalidateQueries({ queryKey: AUDIT_ENTRY_KEY });
  };
}

/** Argumentos da leitura paginada: o mesmo recorte vale para a lista e para a exportação. */
export function pageArgs(f: AuditFilters): Record<string, unknown> {
  return {
    _source: f.source,
    _days: periodDays(f.period),
    _actor: f.actor,
    _entity: f.entity,
    _search: f.search.trim() || null,
    _only_sensitive: f.sensitive,
  };
}

export class ExportTooBig extends Error {
  constructor(public total: number) {
    super(`Este recorte tem ${total.toLocaleString("pt-BR")} registros e o limite por arquivo é ${EXPORT_MAX.toLocaleString("pt-BR")}. Escolha um período menor ou filtre por origem.`);
  }
}

/**
 * Baixa o recorte inteiro, 1.000 por vez. A primeira chamada grava a exportação na auditoria e cada uma pede a senha
 * recente de novo no servidor. `_until` congela o fim do recorte: a própria linha da exportação não entra no arquivo
 * e o que acontecer durante o download não bagunça as páginas.
 */
export async function runAuditExport(f: AuditFilters, onProgress: (done: number, total: number) => void, isCancelled: () => boolean = () => false): Promise<{ rows: AuditItem[]; total: number }> {
  const until = new Date().toISOString();
  const rows: AuditItem[] = [];
  let total = 0;
  const maxPages = Math.ceil(EXPORT_MAX / EXPORT_PAGE) + 1;
  for (let page = 1; page <= maxPages; page++) {
    if (isCancelled()) throw new Error("Exportação cancelada.");
    const out = parseAuditPage(await callRpc("get_admin_audit_page", { ...pageArgs(f), _page: page, _page_size: EXPORT_PAGE, _export: true, _until: until }));
    if (page === 1) {
      total = out.total;
      if (total > EXPORT_MAX) throw new ExportTooBig(total);
    }
    rows.push(...out.items);
    onProgress(rows.length, total);
    if (rows.length >= total || out.items.length === 0) return { rows, total };
  }
  throw new Error("A exportação passou do limite de páginas. Escolha um período menor.");
}

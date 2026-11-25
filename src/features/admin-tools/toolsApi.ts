import { useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/features/admin-race/raceApi";
import { LIMITS, parsePage, type ExportKind, type Period } from "./toolsModel";

export { callRpc };

export const TOOLS_KEY = ["admin-tools"] as const;
export const OVERVIEW_KEY = [...TOOLS_KEY, "overview"] as const;
export const NOTES_KEY = [...TOOLS_KEY, "notes"] as const;

export function useRefreshTools() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
    void qc.invalidateQueries({ queryKey: NOTES_KEY });
  };
}

export class ExportTooBig extends Error {
  constructor(public total: number) {
    super(`Este recorte tem ${total.toLocaleString("pt-BR")} linhas e o limite por arquivo é ${LIMITS.maxRows.toLocaleString("pt-BR")}. Escolha um período menor.`);
  }
}

export interface ExportResult { rows: Record<string, unknown>[]; total: number }

/**
 * Baixa o recorte inteiro, página por página (1.000 linhas), pelo servidor: cada chamada pede a senha recente de novo
 * e a primeira grava a exportação na auditoria. O servidor devolve o cursor da próxima página; ao fim sem cursor, acabou.
 */
export async function runExport(kind: ExportKind, period: Period | null, onProgress: (done: number, total: number) => void, isCancelled: () => boolean = () => false): Promise<ExportResult> {
  const rows: Record<string, unknown>[] = [];
  let cursor: { at: string; id: string } | null = null;
  let total = 0;
  const maxPages = Math.ceil(LIMITS.maxRows / LIMITS.pageSize) + 2;
  for (let i = 0; i < maxPages; i++) {
    if (isCancelled()) throw new Error("Exportação cancelada.");
    const raw = await callRpc("admin_export_page", {
      _kind: kind,
      _from: period ? period.from.toISOString() : null,
      _to: period ? new Date(period.to.getTime() + 1).toISOString() : null,
      _after_at: cursor?.at ?? null,
      _after_id: cursor?.id ?? null,
      _limit: LIMITS.pageSize,
    });
    const page = parsePage(raw);
    if (i === 0) {
      total = page.total;
      if (total > LIMITS.maxRows) throw new ExportTooBig(total);
    }
    rows.push(...page.rows);
    onProgress(rows.length, total);
    if (!page.next) return { rows, total };
    cursor = page.next;
  }
  throw new Error("A exportação passou do limite de páginas. Escolha um período menor.");
}

/** Baixa o texto como arquivo. O BOM faz o Excel brasileiro ler os acentos certo. */
export function downloadCsv(name: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

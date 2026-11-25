import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { ExportTooBig, downloadCsv, runExport, useRefreshTools } from "./toolsApi";
import { EXPORT_COPY, EXPORT_KINDS, fileName, periodProblem, periodText, plural, toCsv, type ExportKind, type Period } from "./toolsModel";

interface Running { kind: ExportKind; done: number; total: number }

/**
 * Exporta pelo servidor, página por página, com o período escolhido no topo do painel.
 * Pede a senha de novo e cada exportação fica na auditoria; sem CPF nem telefone de cliente.
 */
export function ExportPanel({ period }: { period: Period }) {
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const refresh = useRefreshTools();
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState<{ kind: ExportKind; text: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const problem = periodProblem(period);

  const start = (kind: ExportKind) => {
    setError(null);
    const copy = EXPORT_COPY[kind];
    const what = copy.usesPeriod ? `${copy.plural} de ${periodText(period)}` : copy.plural;
    sensitive.confirm(`Exportar ${what} em CSV. A exportação fica registrada na auditoria.`, async () => {
      setRunning({ kind, done: 0, total: 0 });
      try {
        const { rows, total } = await runExport(kind, copy.usesPeriod ? period : null, (done, tot) => { if (alive.current) setRunning({ kind, done, total: tot }); }, () => !alive.current);
        if (rows.length === 0) { toast.info(`Nenhuma linha para exportar${copy.usesPeriod ? " neste período" : ""}.`); return; }
        downloadCsv(fileName(kind, period.from, period.to), toCsv(kind, rows));
        toast.success(`${plural(rows.length, "linha exportada", "linhas exportadas")}${rows.length !== total ? ` (de ${total.toLocaleString("pt-BR")})` : ""}.`);
      } catch (e) {
        setError({ kind, text: e instanceof ExportTooBig ? e.message : friendlyError(e, "Não foi possível exportar. Nenhum arquivo foi baixado.") });
      } finally {
        setRunning(null);
        refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {problem && <p role="alert" className="rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] font-medium text-warning">{problem}</p>}
      <ul className="space-y-3" aria-label="Exportações">
        {EXPORT_KINDS.map((kind) => {
          const copy = EXPORT_COPY[kind];
          const mine = running?.kind === kind;
          const blocked = !!running || (copy.usesPeriod && !!problem);
          const err = error?.kind === kind ? error.text : null;
          return (
            <li key={kind} className="rounded-[14px] bg-muted/30 px-4 py-3.5">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-foreground">{copy.title}</p>
                  <p className="text-[12.5px] text-muted-foreground">{copy.usesPeriod ? `Período do topo: ${periodText(period)}` : "Todas as contas"}</p>
                </div>
                <button type="button" className="vp-ghost !h-10 shrink-0 gap-1.5 !px-4 !text-[13.5px]" disabled={blocked} onClick={() => start(kind)} aria-label={`Baixar CSV de ${copy.title.toLowerCase()}`}>
                  {mine ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
                  {mine ? "Exportando…" : "Baixar CSV"}
                </button>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{copy.description}</p>
              {mine && (
                <p role="status" className="mt-2 text-[13px] tabular-nums text-foreground/85">
                  {running.total > 0 ? `${running.done.toLocaleString("pt-BR")} de ${running.total.toLocaleString("pt-BR")} linhas` : "Preparando…"}
                </p>
              )}
              {err && <p role="alert" className="mt-2 rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{err}</p>}
            </li>
          );
        })}
      </ul>
      {sensitive.dialog}
    </div>
  );
}

import { FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-disputes/parts";
import { cn } from "@/lib/utils";
import { ACCOUNT_STATUS_LABEL, waitingLabel, type QueueItem } from "@/features/kyc/kycReviewModel";

const toneOf = (status: string) =>
  status === "approved" ? "success" as const
    : status === "rejected" || status === "blocked" ? "destructive" as const
      : status === "pending_review" ? "warning" as const : "neutral" as const;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

function when(r: QueueItem): { main: string; sub: string } {
  if (r.status === "pending_review") return { main: `Enviado ${waitingLabel(r.submittedAt ?? r.createdAt)}`, sub: day(r.submittedAt) };
  if (r.status === "pending") return { main: "Ainda não enviou", sub: `Conta de ${day(r.createdAt)}` };
  if (r.status === "rejected") return { main: "Esperando novo envio", sub: r.submittedAt ? `Último envio em ${day(r.submittedAt)}` : "Sem envio registrado" };
  return { main: ACCOUNT_STATUS_LABEL[r.status] ?? r.status, sub: r.submittedAt ? `Enviado em ${day(r.submittedAt)}` : "" };
}

/** Uma lista só, que vira grade de colunas a partir do `lg` (a mesma marcação para celular e desktop). */
export function KycQueueList({ rows, onOpen }: { rows: QueueItem[]; onOpen: (r: QueueItem) => void }) {
  return (
    <ul className="m-0 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-0" style={{ listStyle: "none" }} aria-label="Contas na fila">
      <li aria-hidden className="hidden px-4 pb-1 text-[12px] font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:gap-4">
        <span>Seller</span><span>Documento</span><span>Quando</span><span>Situação</span><span className="w-[88px]" />
      </li>
      {rows.map((r) => {
        const w = when(r);
        const incomplete = r.uploaded < r.required;
        return (
          <li key={r.userId} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-[14px] px-4 py-3.5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
            style={{ border: "1px solid hsl(var(--border) / .7)" }}>
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold text-foreground">{initials(r.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground" title={r.name}>{r.name}</p>
                <p className="truncate text-[12.5px] text-muted-foreground" title={r.email ?? undefined}>{r.email ?? "Sem e-mail"}</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] tabular-nums text-foreground">{r.documentType === "cnpj" ? "CNPJ" : "CPF"} {r.documentMasked ?? "não informado"}</p>
              <p className={cn("flex items-center gap-1 text-[12.5px]", incomplete ? "font-medium text-warning" : "text-muted-foreground")}>
                {incomplete && <FileWarning className="h-3.5 w-3.5" aria-hidden />}
                {r.uploaded} de {r.required} arquivos
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] text-foreground">{w.main}</p>
              {w.sub && <p className="text-[12.5px] text-muted-foreground">{w.sub}</p>}
            </div>
            <div className="min-w-0 space-y-1">
              <ToneTag tone={toneOf(r.status)}>{ACCOUNT_STATUS_LABEL[r.status] ?? r.status}</ToneTag>
              {r.attempts > 1 && <p className="text-[12.5px] text-muted-foreground">{r.attempts}ª tentativa</p>}
            </div>
            <div className="lg:w-[88px] lg:text-right">
              <Button type="button" size="sm" variant={r.status === "pending_review" ? "default" : "outline"} className="h-9 w-full text-[12.5px] lg:w-auto"
                onClick={() => onOpen(r)} aria-label={`${r.status === "pending_review" ? "Analisar" : "Abrir"} ${r.name}`}>
                {r.status === "pending_review" ? "Analisar" : "Abrir"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

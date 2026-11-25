import { ChevronRight, ShieldAlert, UserRound } from "lucide-react";
import { ToneTag } from "@/features/admin-disputes/parts";
import { cn } from "@/lib/utils";
import { actionLabel, actorName, agoLabel, dayLabel, hintText, roleLabel, sourceLabel, targetLine, type AuditItem } from "./auditModel";

const COLS = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_104px_20px]";

/** Cabeçalho das colunas, só no desktop: a mesma lista vira bloco empilhado no celular. */
export function AuditHead() {
  return (
    <div aria-hidden className={cn("hidden gap-4 border-b border-border bg-muted/25 px-4 py-2.5 text-[12px] font-medium text-muted-foreground lg:grid", COLS)}>
      <span className="pl-[52px]">O que aconteceu</span><span>Em quê</span><span>Quem fez</span><span className="text-right">Quando</span><span />
    </div>
  );
}

function Row({ r, onOpen }: { r: AuditItem; onOpen: (r: AuditItem) => void }) {
  const t = targetLine(r);
  const hint = hintText(r);
  const who = actorName(r.actor);
  const label = actionLabel(r.action, r.entity_type);
  return (
    <li className="border-b border-border/40 last:border-b-0">
      <button type="button" onClick={() => onOpen(r)} aria-label={`Ver detalhes: ${label}, ${who}`}
        className={cn("vp-r12 grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", COLS)}>
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[14px]", r.sensitive ? "bg-warning/10 text-warning" : "bg-muted/60 text-muted-foreground")}>
            {r.sensitive ? <ShieldAlert className="h-[18px] w-[18px]" /> : <UserRound className="h-[18px] w-[18px]" />}
          </span>
          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-[14px] font-semibold leading-snug text-foreground">{label}</p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {hint && <p className="min-w-0 truncate text-[12.5px] text-muted-foreground" title={hint}>{hint}</p>}
              {r.sensitive && <ToneTag tone="warning">Sensível</ToneTag>}
              {r.source !== "admin" && <ToneTag tone="neutral">{sourceLabel(r.source)}</ToneTag>}
            </div>
          </div>
        </div>

        <div className="min-w-0 pl-[52px] lg:pl-0">
          <p className="truncate text-[14px] font-semibold text-foreground" title={t.title}><span className="mr-1.5 text-[12.5px] font-normal text-muted-foreground lg:hidden">Em quê:</span>{t.title}</p>
          {t.sub && <p className="truncate text-[12.5px] text-muted-foreground" title={t.sub}>{t.sub}</p>}
        </div>

        <div className="min-w-0 pl-[52px] lg:pl-0">
          <p className={cn("truncate text-[14px]", r.actor.id && r.actor.name ? "font-semibold text-foreground" : "text-muted-foreground")} title={who}><span className="mr-1.5 text-[12.5px] font-normal text-muted-foreground lg:hidden">Quem fez:</span>{who}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{roleLabel(r.actor.role)}</p>
        </div>

        <div className="whitespace-nowrap pl-[52px] lg:pl-0 lg:text-right">
          <p className="text-[14px] font-semibold text-foreground">{agoLabel(r.at)}</p>
          <p className="text-[12.5px] text-muted-foreground">{dayLabel(r.at)}</p>
        </div>

        <ChevronRight aria-hidden className="hidden h-4 w-4 text-muted-foreground lg:block" />
      </button>
    </li>
  );
}

/** Uma lista só, que muda de forma conforme a largura (assim não existem duas versões da mesma linha na página). */
export function AuditList({ rows, onOpen }: { rows: AuditItem[]; onOpen: (r: AuditItem) => void }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border/60">
      <AuditHead />
      <ul aria-label="Registros da auditoria">
        {rows.map((r) => <Row key={`${r.source}:${r.id}`} r={r} onOpen={onOpen} />)}
      </ul>
    </div>
  );
}

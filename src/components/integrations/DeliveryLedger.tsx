import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { ago, dateTimeLabel } from "./intMeta";
import { DELIVERY_META, MAX_ATTEMPTS, deliveryKind, deliveryOutcome, eventLabel, hostOf, isStuck, type DeliveryRow } from "./webhookMeta";

const COLS = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_130px_minmax(0,1.5fr)_130px_20px]";

export interface DeliveryLedgerProps {
  rows: DeliveryRow[]; hostById: Map<string, string>; onOpen: (d: DeliveryRow) => void; footer?: ReactNode;
  /** Títulos e textos que mudam entre webhooks e apps. */
  targetHeader?: string; targetGone?: string; describe?: (d: DeliveryRow) => string;
}

export function DeliveryLedger({ rows, hostById, onOpen, footer, targetHeader = "Endpoint", targetGone = "Endpoint removido", describe = (d) => deliveryOutcome(d) }: DeliveryLedgerProps) {
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Entregas">
      <div role="table" aria-label="Histórico de entregas">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">Evento</span><span role="columnheader">{targetHeader}</span><span role="columnheader">Situação</span><span role="columnheader">O que aconteceu</span><span role="columnheader">Quando</span><span role="columnheader" className="sr-only">Detalhes</span>
        </div>
        <ul>
          {rows.map((d) => {
            const kind = deliveryKind(d);
            const meta = DELIVERY_META[kind];
            const stuck = isStuck(d);
            return (
              <li key={d.id} role="row" className="border-t border-border first:border-t-0">
                <button type="button" onClick={() => onOpen(d)} aria-label={`Ver detalhes: ${eventLabel(d.event)}, ${meta.label}`}
                  className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-7 md:gap-4", COLS)}>
                  <span role="cell" className="col-start-1 row-start-1 min-w-0">
                    <span className="block truncate text-[14.5px] font-bold text-foreground">{eventLabel(d.event)}</span>
                    <span className="block truncate font-mono text-[12px] text-muted-foreground">{d.event}</span>
                  </span>
                  <span role="cell" className="col-start-2 row-start-1 justify-self-end md:hidden"><ChevronRight className="h-4 w-4 text-muted-foreground" /></span>
                  <span role="cell" className="col-span-2 truncate text-[13.5px] text-foreground/80 md:col-span-1 md:col-start-2 md:row-start-1">{hostById.get(d.webhook_config_id) ?? targetGone}</span>
                  <span role="cell" className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill label={meta.label} tone={meta.tone} />
                      {d.attempt > 1 && <span className="text-[12.5px] text-muted-foreground">{d.attempt} de {MAX_ATTEMPTS}</span>}
                    </span>
                  </span>
                  <span role="cell" className="col-span-2 text-[13.5px] leading-snug text-muted-foreground md:col-span-1 md:col-start-4 md:row-start-1">
                    {stuck ? "Está demorando mais que o normal. Costuma sair em até 1 minuto." : describe(d)}
                  </span>
                  <span role="cell" className="col-span-2 text-[13px] text-muted-foreground md:col-span-1 md:col-start-5 md:row-start-1" title={dateTimeLabel(d.created_at)}>{ago(d.created_at)}</span>
                  <span role="cell" className="hidden md:col-start-6 md:row-start-1 md:block"><ChevronRight className="h-4 w-4 text-muted-foreground" /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {footer}
    </section>
  );
}

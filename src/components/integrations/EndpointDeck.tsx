import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { ago } from "./intMeta";
import { PulseStrip } from "./PulseStrip";
import type { PulseMap } from "./useWebhookFeed";
import { hostOf, pathOf, pulseSummary, type WebhookRow } from "./webhookMeta";

/** Um cartão por endpoint, lado a lado: dá para ver a saúde de todos antes de abrir um. */
export function EndpointDeck({ rows, pulses, selectedId, onSelect }: {
  rows: WebhookRow[]; pulses: PulseMap | undefined; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      <ul aria-label="Endpoints" className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 pt-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(264px,1fr))] sm:overflow-visible sm:px-0 sm:pb-0">
        {rows.map((w) => {
          const list = pulses?.[w.id];
          const last = list?.[0];
          const on = w.id === selectedId;
          return (
            <li key={w.id} className="w-[82%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none">
              <button
                type="button" onClick={() => onSelect(w.id)} aria-pressed={on}
                className={cn("vp-sheet vp-r22 block h-full w-full px-5 py-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none", on && "ring-2 ring-primary", !w.is_active && !on && "opacity-80")}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-bold text-foreground">{hostOf(w.url)}</span>
                  {!w.is_active && <StatusPill label="Pausado" tone="idle" />}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[12.5px] text-muted-foreground" title={w.url}>{pathOf(w.url) || "Raiz do domínio"}</span>
                <PulseStrip rows={list ?? []} className="mt-4" />
                <span className="mt-2.5 flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
                  <span className="min-w-0 truncate">{list ? pulseSummary(list, undefined, false) : "Carregando…"}</span>
                  {last && <span className="shrink-0">{ago(last.created_at)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

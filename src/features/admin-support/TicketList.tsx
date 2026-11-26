import { ToneTag } from "@/features/admin-products/parts";
import { formatAgo } from "@/components/support/supportModel";
import { cn } from "@/lib/utils";
import { STAGE_INFO, priorityInfo, previewLine, sellerName, type TicketRow } from "./supportAdminModel";

/** Um chamado por linha. O que ainda não foi lido fica em negrito e com o contador de mensagens novas. */
export function TicketList({ rows, selectedId, onSelect }: { rows: TicketRow[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border/50" aria-label="Chamados">
      {rows.map((r) => {
        const unread = r.unread_by_staff > 0;
        const selected = r.id === selectedId;
        const stage = STAGE_INFO[r.stage];
        const prio = priorityInfo(r.priority);
        const hot = r.priority === "urgent" || r.priority === "high";
        return (
          <li key={r.id}>
            <button type="button" onClick={() => onSelect(r.id)} aria-current={selected ? "true" : undefined}
              aria-label={`${r.subject}, de ${sellerName(r.user)}${unread ? `, ${r.unread_by_staff} ${r.unread_by_staff === 1 ? "mensagem nova" : "mensagens novas"}` : ""}`}
              className={cn("vp-r12 flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                selected && "bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]")}>
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn("min-w-0 truncate text-[13px]", unread ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{sellerName(r.user)}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{formatAgo(r.last_message_at)}</span>
              </span>
              <span className={cn("block truncate text-[14.5px] leading-snug", unread ? "font-bold text-foreground" : "font-semibold text-foreground")}>{r.subject}</span>
              <span className="block truncate text-[13px] text-muted-foreground">{previewLine(r) || "Sem mensagem"}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <ToneTag tone={stage.tone}>{stage.label}</ToneTag>
                {hot && <ToneTag tone={prio.tone}>{prio.label}</ToneTag>}
                {unread && (
                  <span className="ax-count ml-auto">
                    {r.unread_by_staff}<span className="sr-only"> {r.unread_by_staff === 1 ? "mensagem nova" : "mensagens novas"}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

import { ToneTag } from "@/features/admin-products/parts";
import { cn } from "@/lib/utils";
import { STATUS_INFO, brl0, claimRef, place, sellerLabel, waitLabel, type ClaimRow } from "./rewardsModel";

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

/** O que mais importa saber de cada pedido, conforme a etapa: há quanto tempo espera, o rastreio, quando foi entregue. */
function statusLine(c: ClaimRow, now: number): string {
  switch (c.status) {
    case "pending": return `Espera há ${waitLabel(c.created_at, now)}`;
    case "preparing": return `Em preparo há ${waitLabel(c.updated_at, now)}`;
    case "shipped": return c.tracking_code ? `${c.tracking_carrier ? `${c.tracking_carrier} ` : ""}${c.tracking_code}` : "Sem código de rastreio";
    case "delivered": return `Entregue em ${shortDate(c.delivered_at ?? c.updated_at)}`;
    default: return c.has_message ? "Cancelado, com motivo" : "Cancelado";
  }
}

/** Um pedido por linha. A linha inteira abre a ficha; em tela larga as colunas se alinham, em tela estreita ela empilha. */
export function ClaimList({ rows, selectedId, onSelect, now = Date.now() }: { rows: ClaimRow[]; selectedId: string | null; onSelect: (id: string) => void; now?: number }) {
  return (
    <ul className="divide-y divide-border/50" aria-label="Pedidos de premiação">
      {rows.map((c) => {
        const st = STATUS_INFO[c.status];
        const waiting = c.status === "pending";
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c.id)} aria-current={c.id === selectedId ? "true" : undefined}
              aria-label={`${c.tier_label}, de ${sellerLabel(c.seller)}, ${st.label.toLowerCase()}`}
              className={cn("vp-r12 grid w-full grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_96px] lg:items-center lg:px-5",
                c.id === selectedId && "bg-primary/10")}>
              <span className="block min-w-0">
                <span className="block truncate text-[14.5px] font-bold text-foreground">{c.tier_label}</span>
                <span className="block truncate text-[13px] text-muted-foreground">Meta {brl0(c.tier_value)} · {claimRef(c.id)}</span>
              </span>
              <span className="block min-w-0">
                <span className="block truncate text-[14px] font-semibold text-foreground">{sellerLabel(c.seller)}</span>
                <span className="block truncate text-[13px] text-muted-foreground">Para {c.recipient_name}{place(c) ? `, ${place(c)}` : ""}</span>
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 lg:block lg:space-y-1">
                <ToneTag tone={st.tone}>{st.label}</ToneTag>
                <span className={cn("block min-w-0 truncate text-[13px] tabular-nums", waiting ? "font-semibold text-warning" : "text-muted-foreground")}>{statusLine(c, now)}</span>
              </span>
              <span className="block text-[12.5px] tabular-nums text-muted-foreground lg:text-right">Pedido em {shortDate(c.created_at)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

import { Copy, ListChecks, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Send, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { cn } from "@/lib/utils";
import { ago, dateLabel } from "./intMeta";
import { DELIVERY_META, deliveryKind, eventsSummary, hostOf, pathOf, type DeliveryRow, type WebhookRow } from "./webhookMeta";

export interface EndpointHealth { last: DeliveryRow | null; failed: number }

export interface EndpointListProps {
  rows: WebhookRow[];
  health: Map<string, EndpointHealth>;
  busyId: string | null;
  onTest: (w: WebhookRow) => void;
  onEdit: (w: WebhookRow) => void;
  onToggle: (w: WebhookRow) => void;
  onRotate: (w: WebhookRow) => void;
  onCopyUrl: (w: WebhookRow) => void;
  onDeliveries: (w: WebhookRow) => void;
  onDelete: (w: WebhookRow) => void;
}

const COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_196px]";

export function EndpointList(p: EndpointListProps) {
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Endpoints">
      <div role="table" aria-label="Endpoints de webhook">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">Endpoint</span><span role="columnheader">Eventos</span><span role="columnheader">Última entrega</span><span role="columnheader" className="sr-only">Ações</span>
        </div>
        <ul>
          {p.rows.map((w) => {
            const h = p.health.get(w.id);
            const last = h?.last ?? null;
            const kind = last ? deliveryKind(last) : null;
            return (
              <li key={w.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 md:gap-4", COLS, p.busyId === w.id && "opacity-60", !w.is_active && "bg-muted/30")}>
                <span role="cell" className="col-start-1 row-start-1 min-w-0">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate text-[14.5px] font-bold text-foreground">{hostOf(w.url)}</span>
                    {!w.is_active && <StatusPill label="Pausado" tone="idle" />}
                  </span>
                  <span className="block truncate font-mono text-[12.5px] text-muted-foreground" title={w.url}>{pathOf(w.url) || "Raiz do domínio"}</span>
                </span>
                <span role="cell" className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end md:col-start-4">
                  <button type="button" className="vp-ghost !h-10 !px-4 max-md:hidden" disabled={!w.is_active || p.busyId === w.id} onClick={() => p.onTest(w)} title={w.is_active ? "Envia um evento de teste assinado" : "Reative o endpoint para testar"}>
                    <Send className="h-4 w-4" />Enviar teste
                  </button>
                  <Menu w={w} {...p} />
                </span>
                <span role="cell" className="col-span-2 flex justify-between gap-3 text-[13.5px] md:col-span-1 md:col-start-2 md:row-start-1 md:block">
                  <span className="text-muted-foreground md:hidden">Eventos</span>
                  <span className="font-medium text-foreground">{eventsSummary(w.events)}</span>
                </span>
                <span role="cell" className="col-span-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1">
                  {last && kind ? (
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <StatusPill label={DELIVERY_META[kind].label} tone={DELIVERY_META[kind].tone} />
                      <span className="text-[13px] text-muted-foreground">{ago(last.created_at)}</span>
                      {(h?.failed ?? 0) > 0 && <span className="text-[12.5px] font-medium text-destructive">{h!.failed === 1 ? "1 falha recente" : `${h!.failed} falhas recentes`}</span>}
                    </span>
                  ) : (
                    <span className="text-[13.5px] text-muted-foreground">Nenhuma entrega ainda</span>
                  )}
                </span>
                <span role="cell" className="col-span-2 text-[12.5px] text-muted-foreground md:hidden">Criado em {dateLabel(w.created_at)}</span>
                <span role="cell" className="col-span-2 md:hidden">
                  <button type="button" className="vp-ghost !h-11 w-full justify-center" disabled={!w.is_active || p.busyId === w.id} onClick={() => p.onTest(w)}><Send className="h-4 w-4" />Enviar teste</button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Menu({ w, onEdit, onToggle, onRotate, onCopyUrl, onDeliveries, onDelete, busyId }: { w: WebhookRow } & EndpointListProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações do endpoint ${hostOf(w.url)}`} disabled={busyId === w.id}><MoreHorizontal className="h-[18px] w-[18px]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        <SellerMenuItem icon={ListChecks} label="Ver entregas" onSelect={() => onDeliveries(w)} />
        <SellerMenuItem icon={Copy} label="Copiar URL" onSelect={() => onCopyUrl(w)} />
        <SellerMenuItem icon={Pencil} label="Editar URL e eventos" onSelect={() => onEdit(w)} />
        <SellerMenuItem icon={w.is_active ? Pause : Play} label={w.is_active ? "Pausar endpoint" : "Reativar endpoint"} onSelect={() => onToggle(w)} />
        <SellerMenuItem icon={RefreshCw} label="Gerar nova chave" onSelect={() => onRotate(w)} />
        <DropdownMenuSeparator className="my-1.5" />
        <SellerMenuItem icon={Trash2} destructive label="Excluir endpoint" onSelect={() => onDelete(w)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

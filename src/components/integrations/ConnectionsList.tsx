import { FlaskConical, ListChecks, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { cn } from "@/lib/utils";
import { AppLogo } from "./AppCard";
import { appById, connectionEvents, type AppConnection } from "./appCatalog";
import { ago } from "./intMeta";
import { DELIVERY_META, deliveryKind, type DeliveryRow } from "./webhookMeta";

export interface ConnectionHealth { last: DeliveryRow | null; failed: number }

export interface ConnectionsListProps {
  rows: AppConnection[];
  productName: (id: string | null) => string;
  health: Map<string, ConnectionHealth>;
  busyId: string | null;
  onTest: (c: AppConnection) => void;
  onEdit: (c: AppConnection) => void;
  onToggle: (c: AppConnection) => void;
  onActivity: (c: AppConnection) => void;
  onDelete: (c: AppConnection) => void;
}

const COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_196px]";

export function ConnectionsList(p: ConnectionsListProps) {
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Conexões">
      <div role="table" aria-label="Conexões com apps">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">App</span><span role="columnheader">Produto</span><span role="columnheader">Eventos</span><span role="columnheader">Última atividade</span><span role="columnheader" className="sr-only">Ações</span>
        </div>
        <ul>
          {p.rows.map((c) => {
            const app = appById(c.app_name);
            if (!app) return null;
            const h = p.health.get(c.id);
            const last = h?.last ?? null;
            const kind = last ? deliveryKind(last) : null;
            return (
              <li key={c.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 md:gap-4", COLS, p.busyId === c.id && "opacity-60", !c.is_active && "bg-muted/30")}>
                <span role="cell" className="col-start-1 row-start-1 flex min-w-0 items-center gap-3.5">
                  <AppLogo app={app} className="h-12 w-[4.25rem]" />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold text-foreground">{app.name}</span>
                      {!c.is_active && <StatusPill label="Pausada" tone="idle" />}
                    </span>
                    <span className="block truncate font-mono text-[12px] text-muted-foreground">{c.api_key_masked ? `Chave ${c.api_key_masked}` : app.category}</span>
                  </span>
                </span>
                <span role="cell" className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end md:col-start-5">
                  <button type="button" className="vp-ghost !h-10 !px-4 max-md:hidden" disabled={p.busyId === c.id} onClick={() => p.onTest(c)}><FlaskConical className="h-4 w-4" />Testar</button>
                  <Menu c={c} {...p} />
                </span>
                <span role="cell" className="col-span-2 flex justify-between gap-3 text-[13.5px] md:col-span-1 md:col-start-2 md:row-start-1 md:block">
                  <span className="text-muted-foreground md:hidden">Produto</span>
                  <span className="truncate font-medium text-foreground">{p.productName(c.product_id)}</span>
                </span>
                <span role="cell" className="col-span-2 flex justify-between gap-3 text-[13.5px] md:col-span-1 md:col-start-3 md:row-start-1 md:block">
                  <span className="text-muted-foreground md:hidden">Eventos</span>
                  <span className="font-medium text-foreground">{connectionEvents(c, app)}</span>
                </span>
                <span role="cell" className="col-span-2 min-w-0 md:col-span-1 md:col-start-4 md:row-start-1">
                  {last && kind ? (
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <StatusPill label={DELIVERY_META[kind].label} tone={DELIVERY_META[kind].tone} />
                      <span className="text-[13px] text-muted-foreground">{ago(last.created_at)}</span>
                      {(h?.failed ?? 0) > 0 && <span className="text-[12.5px] font-medium text-destructive">{h!.failed === 1 ? "1 falha recente" : `${h!.failed} falhas recentes`}</span>}
                    </span>
                  ) : <span className="text-[13.5px] text-muted-foreground">Nada enviado ainda</span>}
                </span>
                <span role="cell" className="col-span-2 md:hidden">
                  <button type="button" className="vp-ghost !h-11 w-full justify-center" disabled={p.busyId === c.id} onClick={() => p.onTest(c)}><FlaskConical className="h-4 w-4" />Testar</button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Menu({ c, onEdit, onToggle, onActivity, onDelete, busyId }: { c: AppConnection } & ConnectionsListProps) {
  const name = appById(c.app_name)?.name ?? c.app_name;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações da conexão ${name}`} disabled={busyId === c.id}><MoreHorizontal className="h-[18px] w-[18px]" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        <SellerMenuItem icon={ListChecks} label="Ver atividade" onSelect={() => onActivity(c)} />
        <SellerMenuItem icon={Pencil} label="Editar conexão" onSelect={() => onEdit(c)} />
        <SellerMenuItem icon={c.is_active ? Pause : Play} label={c.is_active ? "Pausar conexão" : "Reativar conexão"} onSelect={() => onToggle(c)} />
        <DropdownMenuSeparator className="my-1.5" />
        <SellerMenuItem icon={Trash2} destructive label="Remover conexão" onSelect={() => onDelete(c)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

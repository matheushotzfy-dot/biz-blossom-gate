import type { ReactNode } from "react";
import { Ban, BadgeCheck, ChevronDown, CircleX, Copy, Landmark, MoreHorizontal, Pencil, Receipt, RefreshCw, Send, ShieldAlert, Timer, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { dateLabel } from "./intMeta";
import { DEFAULT_TEST_EVENT, endpointEventLabels, hostOf, pathOf, testableEvents, type WebhookRow } from "./webhookMeta";

const EVENT_ICON: Record<string, LucideIcon> = {
  "payment.created": Receipt, "payment.approved": BadgeCheck, "payment.failed": CircleX, "payment.expired": Timer,
  "payment.refunded": Undo2, "chargeback.received": ShieldAlert, "payout.approved": Landmark, "payout.rejected": Ban,
};

export interface EndpointPanelProps {
  w: WebhookRow;
  busy: boolean;
  onToggle: () => void;
  onTest: (event: string) => void;
  onEdit: () => void;
  onRotate: () => void;
  onDelete: () => void;
  /** Acompanhamento ao vivo de um teste ou reenvio. */
  tracker?: ReactNode;
  /** Histórico de entregas. */
  children: ReactNode;
}

export function EndpointPanel({ w, busy, onToggle, onTest, onEdit, onRotate, onDelete, tracker, children }: EndpointPanelProps) {
  const ev = endpointEventLabels(w.events);
  const testEvents = testableEvents(w.events);
  const path = pathOf(w.url);

  return (
    <section className="vp-sheet overflow-hidden" aria-label={`Endpoint ${hostOf(w.url)}`}>
      <div className="px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1 basis-[260px]">
            <h2 className="break-all text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">{hostOf(w.url)}</h2>
            <p className="mt-1 flex min-w-0 items-center gap-2">
              <span className="min-w-0 break-all font-mono text-[13px] text-muted-foreground" title={w.url}>{path || "Raiz do domínio"}</span>
              <button type="button" onClick={() => { void copyText(w.url, "URL copiada."); }} className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none" aria-label="Copiar a URL completa">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-3 sm:w-auto">
            <label className="order-1 mr-auto flex cursor-pointer items-center gap-2.5 text-[13.5px] font-semibold text-foreground sm:order-none sm:mr-0">
              <Switch checked={w.is_active} disabled={busy} onCheckedChange={onToggle} aria-label={w.is_active ? "Pausar o endpoint" : "Reativar o endpoint"} />
              {w.is_active ? "Recebendo" : "Pausado"}
            </label>

            <div className="order-3 w-full sm:order-none sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="vp-ghost w-full sm:w-auto" disabled={!w.is_active || busy} title={w.is_active ? "Simula um evento e envia para a sua URL" : "Reative o endpoint para testar"}>
                  <Send className="h-4 w-4" />Enviar teste<ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-80")}>
                <DropdownMenuLabel className="px-2.5 pb-1.5 pt-1 text-[12.5px] font-semibold text-muted-foreground">Qual evento simular?</DropdownMenuLabel>
                {testEvents.map((d) => (
                  <SellerMenuItem key={d.key} icon={EVENT_ICON[d.key] ?? Send} label={d.label + (d.key === DEFAULT_TEST_EVENT ? " (padrão)" : "")} onSelect={() => onTest(d.key)} />
                ))}
                <DropdownMenuSeparator className="my-1.5" />
                <p className="px-2.5 pb-1.5 pt-0.5 text-[12.5px] leading-snug text-muted-foreground">O teste chega igual ao evento real, com <span className="font-mono">"test": true</span> no corpo.</p>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="vp-orb order-2 sm:order-none" aria-label="Mais ações do endpoint"><MoreHorizontal className="h-[18px] w-[18px]" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
                <SellerMenuItem icon={Pencil} label="Editar URL e eventos" onSelect={onEdit} />
                <SellerMenuItem icon={Copy} label="Copiar URL" onSelect={() => { void copyText(w.url, "URL copiada."); }} />
                <SellerMenuItem icon={RefreshCw} label="Gerar nova chave" onSelect={onRotate} />
                <DropdownMenuSeparator className="my-1.5" />
                <SellerMenuItem icon={Trash2} destructive label="Excluir endpoint" onSelect={onDelete} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 border-t border-border pt-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <dt className="text-[12.5px] font-semibold text-muted-foreground">Chave de assinatura</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-[13.5px] font-semibold text-foreground">{w.secret_masked ?? "Guardada com segurança"}</span>
              <button type="button" onClick={onRotate} className="text-[13px] font-semibold text-primary hover:underline">Gerar nova</button>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[12.5px] font-semibold text-muted-foreground">Eventos que chegam aqui</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              {ev.all
                ? <span className="rounded-full bg-accent px-2.5 py-1 text-[12.5px] font-semibold text-accent-foreground">Todos os eventos</span>
                : ev.labels.map((l) => <span key={l} className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-foreground">{l}</span>)}
              <button type="button" onClick={onEdit} className="ml-1 text-[13px] font-semibold text-primary hover:underline">Editar</button>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12.5px] text-muted-foreground">Criado em {dateLabel(w.created_at)}</p>
      </div>

      {tracker && <div className="px-5 pb-5 sm:px-7">{tracker}</div>}

      <div className="border-t border-border">
        <h3 className="px-5 pt-5 text-[16px] font-extrabold tracking-[-0.01em] text-foreground sm:px-7">Entregas</h3>
        {children}
      </div>
    </section>
  );
}

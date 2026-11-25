import { useState } from "react";
import { Check, ChevronDown, Clock, Copy, Lightbulb, Loader2, RefreshCw, Send, X, type LucideIcon } from "lucide-react";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { ago, dateTimeLabel } from "./intMeta";
import { useDeliveryDetail } from "./useWebhookFeed";
import {
  DELIVERY_META, MAX_ATTEMPTS, deliveryHint, deliveryKind, deliveryOutcome, eventLabel, formatJson, isStuck, isTestDelivery, retryIn,
  type DeliveryKind, type DeliveryRow, type WebhookRow,
} from "./webhookMeta";

type StatusFilter = "all" | "failed" | "open" | "success";
const PAGE = 20;

const GLYPH: Record<DeliveryKind, { Icon: LucideIcon; tone: string }> = {
  success: { Icon: Check, tone: "bg-accent text-accent-foreground" },
  queued: { Icon: Clock, tone: "bg-warning/15 text-warning" },
  sending: { Icon: Send, tone: "bg-warning/15 text-warning" },
  retrying: { Icon: RefreshCw, tone: "bg-warning/15 text-warning" },
  exhausted: { Icon: X, tone: "bg-destructive/15 text-destructive" },
};

const isOpenKind = (k: DeliveryKind) => k === "queued" || k === "sending" || k === "retrying";

export interface DeliveryLogProps {
  rows: DeliveryRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  endpoint: WebhookRow;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  trackedId: string | null;
  limit: number;
  onLoadMore: () => void;
  onResend: (d: DeliveryRow) => void;
  resendingId: string | null;
  onResendFailed: () => void;
  bulkBusy: boolean;
  onTest: () => void;
}

/** Histórico do endpoint aberto. Cada linha abre ali mesmo, sem diálogo: o que enviamos, o que o servidor respondeu e o que fazer. */
export function DeliveryLog(p: DeliveryLogProps) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [shown, setShown] = useState(PAGE);

  if (p.error) {
    return (
      <div className="px-5 py-10 text-center sm:px-7">
        <p className="text-[15px] font-bold text-foreground">Não foi possível carregar as entregas</p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Confira sua conexão e tente de novo.</p>
        <button type="button" className="vp-ghost mt-4" onClick={p.onRetry}>Tentar de novo</button>
      </div>
    );
  }
  if (p.loading) {
    return <div className="space-y-2 px-5 py-5 sm:px-7" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="vp-skel h-14 !rounded-[16px]" />)}</div>;
  }
  if (p.rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center sm:px-7">
        <p className="text-[16px] font-bold text-foreground">Nenhuma entrega ainda</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-[14px] leading-relaxed text-muted-foreground">
          Envie um teste para ver, aqui mesmo, o que o seu servidor recebe e o que ele responde. Quando houver uma venda, ela aparece nesta lista.
        </p>
        {p.endpoint.is_active
          ? <button type="button" className="vp-cta mt-5" onClick={p.onTest}><Send className="h-4 w-4" />Enviar teste</button>
          : <p className="mt-4 text-[13.5px] font-medium text-muted-foreground">Reative o endpoint para receber eventos e enviar testes.</p>}
      </div>
    );
  }

  const counts = { all: p.rows.length, failed: 0, open: 0, success: 0 };
  for (const r of p.rows) { const k = deliveryKind(r); if (k === "exhausted") counts.failed++; else if (isOpenKind(k)) counts.open++; else counts.success++; }
  const filtered = p.rows.filter((r) => {
    const k = deliveryKind(r);
    return status === "all" || (status === "failed" && k === "exhausted") || (status === "open" && isOpenKind(k)) || (status === "success" && k === "success");
  });
  const visible = filtered.slice(0, shown);
  const canLoadMore = p.rows.length >= p.limit;
  const hasMore = filtered.length > shown || (status === "all" && canLoadMore);

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pb-3 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <FilterPills<StatusFilter>
          label="Filtrar entregas" value={status} onChange={(v) => { setStatus(v); setShown(PAGE); }}
          options={[
            { value: "all", label: "Todas", count: counts.all },
            { value: "failed", label: "Falharam", count: counts.failed },
            { value: "open", label: "Em andamento", count: counts.open },
            { value: "success", label: "Entregues", count: counts.success },
          ]}
        />
        {counts.failed > 0 && p.endpoint.is_active && (
          <button type="button" className="vp-ghost !h-10 shrink-0 self-start sm:self-auto" disabled={p.bulkBusy} onClick={p.onResendFailed}>
            {p.bulkBusy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}
            Reenviar {counts.failed === 1 ? "a que falhou" : `as ${counts.failed} que falharam`}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 pb-8 pt-4 text-center sm:px-7">
          <p className="text-[14px] text-muted-foreground">Nenhuma entrega nesse filtro.</p>
          <button type="button" className="mt-2 text-[13.5px] font-semibold text-primary hover:underline" onClick={() => setStatus("all")}>Ver todas</button>
        </div>
      ) : (
        <ul className="border-t border-border">
          {visible.map((d) => (
            <Row key={d.id} d={d} endpoint={p.endpoint} open={p.expandedId === d.id} tracked={p.trackedId === d.id}
              onToggle={() => p.onExpand(p.expandedId === d.id ? null : d.id)} onResend={() => p.onResend(d)} resending={p.resendingId === d.id} />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="border-t border-border px-5 py-4 text-center sm:px-7">
          <button type="button" className="vp-ghost !h-10" onClick={() => { if (filtered.length <= shown) p.onLoadMore(); setShown((n) => n + PAGE); }}>Mostrar mais</button>
        </div>
      )}
    </div>
  );
}

function Row({ d, endpoint, open, tracked, onToggle, onResend, resending }: {
  d: DeliveryRow; endpoint: WebhookRow; open: boolean; tracked: boolean; onToggle: () => void; onResend: () => void; resending: boolean;
}) {
  const kind = deliveryKind(d);
  const { Icon, tone } = GLYPH[kind];
  const test = isTestDelivery(d);
  const outcome = isStuck(d) ? "Está demorando mais que o normal. Costuma sair em até 1 minuto." : deliveryOutcome(d);
  return (
    <li className={cn("border-t border-border first:border-t-0", tracked && "bg-accent/40")}>
      <button
        type="button" onClick={onToggle} aria-expanded={open} aria-controls={`dl-${d.id}`}
        className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-7 md:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.7fr)_84px_16px] motion-reduce:transition-none"
      >
        <span className={cn("grid h-7 w-7 place-items-center rounded-full", tone)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.6} />
          <span className="sr-only">{DELIVERY_META[kind].label}</span>
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold text-foreground">{eventLabel(d.event)}</span>
            {test && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-bold text-muted-foreground">Teste</span>}
          </span>
          <span className="block truncate font-mono text-[12px] text-muted-foreground">{d.event}</span>
        </span>
        <span className="col-start-3 row-start-1 flex items-center gap-2 justify-self-end md:col-start-4">
          <span className="text-[12.5px] text-muted-foreground" title={dateTimeLabel(d.created_at)}>{ago(d.created_at)}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform md:hidden motion-reduce:transition-none", open && "rotate-180")} />
        </span>
        <span className="col-span-3 col-start-1 pl-[42px] text-[13.5px] leading-snug text-muted-foreground md:col-span-1 md:col-start-3 md:row-start-1 md:pl-0">{outcome}</span>
        <span className="hidden md:col-start-5 md:row-start-1 md:block"><ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} /></span>
      </button>
      {open && <Detail d={d} endpoint={endpoint} onResend={onResend} resending={resending} id={`dl-${d.id}`} />}
    </li>
  );
}

function Detail({ d, endpoint, onResend, resending, id }: { d: DeliveryRow; endpoint: WebhookRow; onResend: () => void; resending: boolean; id: string }) {
  const q = useDeliveryDetail(d.id, d.status, d.attempt);
  const kind = deliveryKind(d);
  const hint = deliveryHint(d);
  const payload = q.data ? formatJson(q.data.payload) : "";
  const canResend = kind === "success" || kind === "exhausted";
  const when = kind === "success" && d.delivered_at ? `Entregue em ${dateTimeLabel(d.delivered_at)}` : kind === "retrying" ? `Próxima tentativa ${retryIn(d.next_retry_at)}` : `Criada em ${dateTimeLabel(d.created_at)}`;

  return (
    <div id={id} className="space-y-4 bg-muted/30 px-5 pb-5 pt-1 sm:px-7">
      {hint && (
        <p className="flex items-start gap-2.5 rounded-[16px] bg-accent px-4 py-3 text-[13.5px] font-medium leading-snug text-accent-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />{hint}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
        <section className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h4 className="text-[13.5px] font-bold text-foreground">O que enviamos</h4>
            {payload && <button type="button" onClick={() => { void copyText(payload, "Dados copiados."); }} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar</button>}
          </div>
          {q.isError ? <p role="alert" className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">Não foi possível carregar os dados desta entrega.</p>
            : !q.data ? <div className="vp-skel h-32 !rounded-[16px]" aria-busy="true" />
            : <pre tabIndex={0} className="max-h-64 overflow-auto rounded-[16px] bg-card px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">{payload}</pre>}
        </section>
        <section className="min-w-0">
          <h4 className="mb-1.5 text-[13.5px] font-bold text-foreground">O que o seu servidor respondeu</h4>
          <div className="rounded-[16px] bg-card px-4 py-3">
            <p className={cn("text-[22px] font-extrabold leading-none tabular-nums", d.response_status && d.response_status < 300 ? "text-primary" : d.response_status ? "text-destructive" : "text-muted-foreground")}>
              {d.response_status ?? "Sem resposta"}
            </p>
            {q.data?.response_body
              ? <pre tabIndex={0} className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-all font-mono text-[12.5px] leading-relaxed text-foreground/90">{q.data.response_body}</pre>
              : <p className="mt-2 text-[13px] text-muted-foreground">{d.response_status ? "O servidor não devolveu conteúdo." : "O servidor não chegou a responder."}</p>}
          </div>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <p className="min-w-0 text-[12.5px] leading-relaxed text-muted-foreground">
          Tentativa {Math.min(Math.max(d.attempt, 1), MAX_ATTEMPTS)} de {MAX_ATTEMPTS} · {when} ·{" "}
          <button type="button" onClick={() => { void copyText(d.id, "ID copiado."); }} className="font-mono underline-offset-2 hover:underline" title="Copiar o ID da entrega">{d.id.slice(0, 8)}</button>
        </p>
        {canResend && (
          <button type="button" className="vp-ghost !h-10" disabled={resending || !endpoint.is_active} onClick={onResend}
            title={endpoint.is_active ? "Envia de novo, com o mesmo ID de entrega" : "Reative o endpoint para reenviar"}>
            {resending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}Reenviar
          </button>
        )}
      </div>
    </div>
  );
}

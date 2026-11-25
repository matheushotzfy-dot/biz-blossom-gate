import { useEffect, useState } from "react";
import { Copy, ListChecks } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHead, dialogShell } from "@/components/seller-ui/form";
import { StatusPill } from "@/components/seller-ui/tx";
import { copyText } from "@/components/seller-ui/copy";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { dateTimeLabel } from "./intMeta";
import { DELIVERY_META, MAX_ATTEMPTS, deliveryKind, deliveryOutcome, eventLabel, formatJson, type DeliveryRow } from "./webhookMeta";

interface Detail { payload: unknown; response_body: string | null }

export function DeliveryDialog({ delivery, url, onClose }: { delivery: DeliveryRow | null; url: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDetail(null); setFailed(false);
    if (!delivery) return;
    let live = true;
    void supabase.from("webhook_deliveries").select("payload, response_body").eq("id", delivery.id).maybeSingle().then(({ data, error }) => {
      if (!live) return;
      if (error || !data) setFailed(true); else setDetail(data as Detail);
    });
    return () => { live = false; };
  }, [delivery]);

  const kind = delivery ? deliveryKind(delivery) : null;
  const meta = kind ? DELIVERY_META[kind] : null;
  const payload = detail ? formatJson(detail.payload) : "";

  return (
    <Dialog open={!!delivery} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[min(92dvh,820px)] w-[calc(100vw-1rem)] max-w-[680px] flex-col")}>
        <DialogHead icon={<ListChecks className="h-5 w-5" />} title={delivery ? eventLabel(delivery.event) : "Entrega"} subtitle={delivery ? dateTimeLabel(delivery.created_at) : undefined} />
        {delivery && meta && (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={meta.label} tone={meta.tone} />
              <p className="text-[14px] text-foreground/80">{deliveryOutcome(delivery)}</p>
            </div>

            <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 text-[13.5px] sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <Fact label="Endpoint" value={url || "Endpoint removido"} mono />
              <Fact label="Tentativas" value={`${delivery.attempt} de ${MAX_ATTEMPTS}`} />
              <Fact label="Resposta do seu servidor" value={delivery.response_status ? String(delivery.response_status) : "Sem resposta"} />
              <Fact label={kind === "success" ? "Entregue em" : "Próxima tentativa"} value={kind === "success" && delivery.delivered_at ? dateTimeLabel(delivery.delivered_at) : kind === "retrying" && delivery.next_retry_at ? dateTimeLabel(delivery.next_retry_at) : "Nenhuma"} />
              <Fact label="ID da entrega" value={delivery.id} mono wide />
            </dl>

            <Block title="Dados enviados" text={payload} loading={!detail && !failed} failed={failed} onCopy={() => { void copyText(payload, "Dados copiados."); }} />
            {detail?.response_body ? <Block title="Resposta do seu servidor" text={detail.response_body} /> : null}
          </div>
        )}
        <div className="flex justify-end border-t border-border bg-card px-6 py-4 sm:px-8">
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[12.5px] font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-all font-medium text-foreground", mono && "font-mono text-[12.5px]")}>{value}</dd>
    </div>
  );
}

function Block({ title, text, loading, failed, onCopy }: { title: string; text: string; loading?: boolean; failed?: boolean; onCopy?: () => void }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
        {onCopy && text && <button type="button" onClick={onCopy} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar</button>}
      </div>
      {loading ? <div className="vp-skel h-28 !rounded-[16px]" aria-busy="true" />
        : failed ? <p role="alert" className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">Não foi possível carregar os dados desta entrega.</p>
        : <pre tabIndex={0} className="max-h-64 overflow-auto rounded-[16px] bg-muted px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">{text}</pre>}
    </section>
  );
}

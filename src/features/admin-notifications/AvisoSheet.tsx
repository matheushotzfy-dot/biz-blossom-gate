import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Megaphone, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { useConfirm } from "@/components/seller-ui/confirm";
import { agoLabel } from "@/features/admin-errors/errorsModel";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { Info } from "@/features/admin-disputes/parts";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { BATCH_KEY, callRpc, useRefreshNotifications } from "./notificationsApi";
import { parseBatch, readPct, readText, retractedText, sellersText, typeInfo, type AvisoItem, type BatchDetail } from "./notificationsModel";

function Loading() {
  return <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o aviso…</p>;
}
function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
      {friendlyError(error, "Não foi possível carregar o aviso.")} <button type="button" className="underline" onClick={onRetry}>Tentar de novo</button>
    </p>
  );
}

/** Um aviso enviado: o texto, quem recebeu e quem já leu. Daqui dá para recolher o aviso. */
export function AvisoSheet({ batchId, seed, onClose }: { batchId: string | null; seed: AvisoItem | null; onClose: () => void }) {
  // guarda o último aviso para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: AvisoItem | null } | null>(batchId ? { id: batchId, seed } : null);
  useEffect(() => { if (batchId) setLast({ id: batchId, seed }); }, [batchId, seed]);
  const cur = batchId ? { id: batchId, seed } : last;
  return (
    <Dialog open={!!batchId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>{cur && <Body key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ id, seed, onClose }: { id: string; seed: AvisoItem | null; onClose: () => void }) {
  const refresh = useRefreshNotifications();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: [...BATCH_KEY, id],
    queryFn: async () => parseBatch(await callRpc("get_admin_notification_batch", { _batch_id: id })),
  });
  const d = q.data;
  const t = typeInfo(d?.type ?? seed?.type ?? "info");
  const total = d?.recipients ?? seed?.recipients ?? 0;

  const retract = async () => {
    if (!d) return;
    const ok = await confirm.ask({
      title: "Recolher este aviso?", tone: "danger", icon: <Undo2 className="h-5 w-5" />, confirmLabel: "Recolher aviso",
      description: `Ele some da caixa de ${sellersText(d.recipients)}, inclusive de quem já leu. Não dá para desfazer. Fica na auditoria.`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const out = (await callRpc("admin_retract_notification", { _batch_id: id })) as { removed?: number } | null;
      toast.success(retractedText(Number(out?.removed ?? d.recipients)));
      refresh();
      onClose();
    } catch (e) { toast.error(friendlyError(e, "Não foi possível recolher o aviso. Nada mudou.")); }
    finally { setBusy(false); }
  };

  return (
    <>
      <DialogHead icon={<Megaphone className="h-5 w-5" />} title={d?.title ?? seed?.title ?? "Aviso enviado"}
        subtitle={d ? `${sellersText(d.recipients)} · ${agoLabel(d.sent_at)}` : seed ? `${sellersText(seed.recipients)} · ${agoLabel(seed.sent_at)}` : "Aviso enviado"}
        aside={<ToneTag tone={t.tone}>{t.label}</ToneTag>} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading /> : q.isError || !d ? <Failed error={q.error} onRetry={() => void q.refetch()} /> : <Detail d={d} />}
        </DialogBody>
        <DialogFoot lead={d ? <p className="text-[13px] text-muted-foreground">{readText(d.read, d.recipients)}</p> : total ? <p className="text-[13px] text-muted-foreground">{sellersText(total)}</p> : undefined}>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={busy}>Fechar</button>
          <button type="button" className="vp-cta vp-cta-danger !h-12 justify-center gap-2 sm:min-w-[170px]" disabled={!d || busy} onClick={() => void retract()}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Recolhendo…</> : <><Undo2 className="h-4 w-4" /> Recolher aviso</>}
          </button>
        </DialogFoot>
      </div>
      {confirm.dialog}
    </>
  );
}

function Detail({ d }: { d: BatchDetail }) {
  const unread = Math.max(0, d.recipients - d.read);
  const hidden = Math.max(0, d.recipients - d.items.length);
  return (
    <>
      <Block title="Mensagem">
        <p className="whitespace-pre-wrap break-words rounded-[14px] bg-muted/40 px-4 py-3 text-[14px] leading-relaxed text-foreground">{d.message}</p>
      </Block>

      <Block title="Quem leu">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Figure label="Enviado para" value={sellersText(d.recipients)} />
          <Figure label="Já leram" value={d.read.toLocaleString("pt-BR")} sub={`${readPct(d.read, d.recipients)}%`} />
          <Figure label="Ainda não leram" value={unread.toLocaleString("pt-BR")} tone={unread > 0 ? "warning" : undefined} />
        </div>
        {d.items.length > 0 && (
          <ul className="mt-3 max-h-64 divide-y divide-border/50 overflow-y-auto overscroll-contain rounded-[12px] border border-border/60" aria-label="Quem recebeu o aviso">
            {d.items.map((r, i) => (
              <li key={`${r.user_id}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{r.name}</p>
                  {r.email && r.email !== r.name && <p className="truncate text-[12.5px] text-muted-foreground">{r.email}</p>}
                </div>
                <ToneTag tone={r.is_read ? "success" : "warning"}>{r.is_read ? "Leu" : "Não leu"}</ToneTag>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">Mostrando {d.items.length} de {d.recipients.toLocaleString("pt-BR")} sellers; quem ainda não leu vem primeiro.</p>}
      </Block>

      <Block title="Envio">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Enviado em">{dateLabel(d.sent_at)}</Info>
          <Info label="Enviado por">{d.sent_by_name ?? "Equipe"}</Info>
        </div>
      </Block>
    </>
  );
}

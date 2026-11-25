import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, MapPin, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useConfirm, useReason } from "@/components/seller-ui/confirm";
import { copyText } from "@/components/seller-ui/copy";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { Info } from "@/features/admin-disputes/parts";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { safeNavigationUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { AddressDialog } from "./AddressDialog";
import { TrackingDialog } from "./TrackingDialog";
import { DETAIL_KEY, callRpc, setClaim, useRefreshRewards } from "./rewardsApi";
import {
  MESSAGE_MAX, STATUS_INFO, STEP_LABEL, accountStatusLabel, brl0, claimRef, dateLabel, fullAddress, historyEntry, labelText, mapsUrl, noteProblem,
  parseClaimDetail, sellerLabel, stepsFor, type ClaimDetail, type StepKind,
} from "./rewardsModel";

/** Ficha do pedido: quem pediu, para onde vai, o que já foi feito e o que dá para fazer agora. */
export function ClaimSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  // guarda o último id para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<string | null>(id);
  useEffect(() => { if (id) setLast(id); }, [id]);
  const shown = id ?? last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{shown && <Body id={shown} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ id, onClose }: { id: string; onClose: () => void }) {
  const refresh = useRefreshRewards();
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const [serverError, setServerError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [address, setAddress] = useState(false);
  const [note, setNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);

  useEffect(() => { setServerError(null); setNote(""); setNoteTouched(false); }, [id]);

  const q = useQuery({
    queryKey: [...DETAIL_KEY, id],
    queryFn: async () => parseClaimDetail(await callRpc("get_admin_reward_claim_detail", { _id: id })),
  });

  const move = useMutation({
    mutationFn: (a: { status: string; message?: string; ok: string }) => setClaim({ id, status: a.status, message: a.message }),
    onSuccess: (_d, a) => { toast.success(a.ok); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível atualizar o pedido. Nada mudou.")),
  });

  const addNote = useMutation({
    mutationFn: () => callRpc("admin_add_reward_claim_note", { _id: id, _note: note.trim() }),
    onSuccess: () => { toast.success("Anotação salva."); setNote(""); setNoteTouched(false); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar a anotação.")),
  });

  if (q.isPending) {
    return (
      <>
        <DialogHead icon={<Trophy className="h-5 w-5" />} title="Pedido de premiação" subtitle="Carregando…" />
        <DialogBody><p className="flex items-center gap-2 text-[13.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o pedido…</p></DialogBody>
        <DialogFoot><button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button></DialogFoot>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        <DialogHead icon={<Trophy className="h-5 w-5" />} title="Pedido de premiação" subtitle="Não foi possível abrir" />
        <DialogBody><ErrorBlock title="Não foi possível carregar o pedido." error={q.error} onRetry={() => void q.refetch()} /></DialogBody>
        <DialogFoot><button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button></DialogFoot>
      </>
    );
  }

  const c: ClaimDetail = q.data;
  const st = STATUS_INFO[c.status];
  const steps = stepsFor(c.status);
  const addr = fullAddress(c);
  const busy = move.isPending;
  const belowGoal = c.seller.revenue < c.tier_value;
  const trackUrl = c.tracking_url ? safeNavigationUrl(c.tracking_url) : null;
  const noteError = noteTouched ? noteProblem(note) : null;

  const run = async (step: StepKind) => {
    setServerError(null);
    if (step === "ship") { setTracking(true); return; }
    if (step === "prepare") { move.mutate({ status: "preparing", ok: "Pedido em preparo. O seller foi avisado." }); return; }
    if (step === "deliver") {
      const ok = await askConfirm({ title: "Marcar como entregue?", tone: "default", confirmLabel: "Marcar como entregue", icon: <Trophy className="h-5 w-5" />,
        description: "O seller recebe o aviso de entrega e o pedido fica encerrado. Não dá para voltar atrás." });
      if (ok) move.mutate({ status: "delivered", ok: "Pedido entregue. O seller foi avisado." });
      return;
    }
    if (step === "cancel") {
      const reason = await askReason({
        title: "Cancelar o pedido", label: "Motivo do cancelamento", minLength: 5, confirmLabel: "Cancelar pedido", tone: "danger",
        description: c.status === "shipped"
          ? "A peça já foi postada: cancelar aqui não interrompe a entrega. O seller recebe o motivo na notificação e em Premiações. Dá para reabrir depois."
          : "O seller recebe o motivo na notificação e na página de Premiações. Dá para reabrir depois.",
      });
      if (reason) move.mutate({ status: "cancelled", message: reason, ok: "Pedido cancelado. O seller foi avisado do motivo." });
      return;
    }
    const ok = await askConfirm({ title: "Reabrir o pedido?", tone: "default", confirmLabel: "Reabrir pedido",
      description: "Ele volta para Aguardando e o motivo do cancelamento é apagado. O seller é avisado." });
    if (ok) move.mutate({ status: "pending", ok: "Pedido reaberto. O seller foi avisado." });
  };

  return (
    <>
      <DialogHead icon={<Trophy className="h-5 w-5" />} title={c.tier_label} subtitle={`${sellerLabel(c.seller)} · pedido em ${dateLabel(c.created_at)}`} aside={<ToneTag tone={st.tone}>{st.label}</ToneTag>} />
      <DialogBody>
        <section aria-label="Seller">
          <div className="mb-3 sm:hidden"><ToneTag tone={st.tone}>{st.label}</ToneTag></div>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="Seller">{sellerLabel(c.seller)}{c.seller.name && c.seller.email && <span className="block text-[13px] font-normal text-muted-foreground">{c.seller.email}</span>}</Info>
            <Info label="Faturamento líquido">{brl0(c.seller.revenue)} de {brl0(c.tier_value)}
              <span className={cn("block text-[13px] font-normal", belowGoal ? "text-warning" : "text-muted-foreground")}>
                {belowGoal ? "Abaixo da meta agora: houve reembolso ou chargeback depois do pedido" : "Meta batida"}
                {` · ${c.seller.sales.toLocaleString("pt-BR")} ${c.seller.sales === 1 ? "venda paga" : "vendas pagas"}`}
              </span>
            </Info>
            <Info label="Cadastro">{accountStatusLabel(c.seller.account_status)}</Info>
            {c.other_claims.length > 0 && (
              <Info label="Outros pedidos do seller">
                <span className="flex flex-wrap gap-1.5">
                  {c.other_claims.map((o) => <ToneTag key={o.id} tone={STATUS_INFO[o.status].tone}>{o.tier_label}: {STATUS_INFO[o.status].label.toLowerCase()}</ToneTag>)}
                </span>
              </Info>
            )}
          </dl>
        </section>

        <section aria-label="Entrega">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-foreground">Entrega</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" onClick={() => void copyText(labelText(c), "Dados de envio copiados")}><Copy className="h-3.5 w-3.5" aria-hidden /> Copiar para a etiqueta</button>
              <a href={mapsUrl(addr)} target="_blank" rel="noopener noreferrer" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]"><MapPin className="h-3.5 w-3.5" aria-hidden /> Ver no mapa</a>
              {(c.status === "pending" || c.status === "preparing") && <button type="button" className="vp-ghost !h-9 !px-3 !text-[13px]" onClick={() => setAddress(true)}>Corrigir endereço</button>}
            </div>
          </div>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="Quem recebe">{c.recipient_name}<span className="block text-[13px] font-normal text-muted-foreground">{c.phone}{c.document ? ` · ${c.document}` : ""}</span></Info>
            <Info label="Endereço">{addr}</Info>
          </dl>
        </section>

        {(c.tracking_code || c.status === "shipped") && (
          <section aria-label="Rastreio">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-foreground">Rastreio</h3>
              {c.status === "shipped" && <button type="button" className="vp-ghost !h-9 !px-3 !text-[13px]" onClick={() => setTracking(true)}>Corrigir rastreio</button>}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-foreground">
              <span className="tabular-nums font-semibold">{c.tracking_carrier ? `${c.tracking_carrier} ` : ""}{c.tracking_code ?? "Sem código"}</span>
              {c.tracking_code && <button type="button" aria-label="Copiar código de rastreio" className="text-muted-foreground hover:text-foreground" onClick={() => void copyText(c.tracking_code ?? "", "Código copiado")}><Copy className="h-4 w-4" /></button>}
              {trackUrl && <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Rastrear<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
            </p>
          </section>
        )}

        {c.message && (
          <section aria-label="Mensagem para o seller">
            <h3 className="mb-1.5 text-[14px] font-bold text-foreground">{c.status === "cancelled" ? "Motivo do cancelamento" : "Mensagem para o seller"}</h3>
            <p className="whitespace-pre-wrap break-words rounded-[14px] bg-muted/40 px-4 py-3 text-[14px] leading-relaxed text-foreground/90">{c.message}</p>
            <FieldHint className="mt-1.5">O seller lê isto na página de Premiações{c.status === "cancelled" ? " e na notificação" : ""}.</FieldHint>
          </section>
        )}

        <section aria-label="Anotação interna" className="space-y-2">
          <FieldLabel htmlFor="claim-note" hint="Só a equipe vê. O seller não recebe nada.">Anotação interna</FieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <textarea id="claim-note" className="vp-field min-w-0 flex-1 resize-none" rows={2} maxLength={MESSAGE_MAX} placeholder="Ex.: o seller pediu para ligar antes de postar" value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={noteError ? true : undefined} />
            <button type="button" className="vp-ghost !h-12 shrink-0 justify-center" disabled={addNote.isPending} onClick={() => { setNoteTouched(true); setServerError(null); if (!noteProblem(note)) addNote.mutate(); }}>
              {addNote.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar anotação"}
            </button>
          </div>
          {noteError && <p role="alert" className="text-[12.5px] font-medium text-destructive">{noteError}</p>}
        </section>

        <section aria-label="Histórico">
          <h3 className="mb-2 text-[14px] font-bold text-foreground">Histórico</h3>
          {c.history.length === 0 ? <p className="text-[13px] text-muted-foreground">Ainda não há registros da equipe neste pedido.</p> : (
            <ol className="space-y-3 border-l border-border pl-4">
              {c.history.map((h, i) => {
                const e = historyEntry(h);
                return (
                  <li key={`${h.at}-${i}`} className="relative">
                    <span aria-hidden className={cn("absolute -left-[21px] top-[7px] h-2 w-2 rounded-full", e.internal ? "bg-muted-foreground" : "bg-primary")} />
                    <p className="text-[13.5px] font-semibold text-foreground">{e.title}{e.internal && <span className="ml-2 text-[12px] font-medium text-muted-foreground">só a equipe vê</span>}</p>
                    <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.at)}{h.by ? ` · ${h.by}` : ""}</p>
                    {e.text && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{e.text}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </DialogBody>
      {serverError && <DialogError>{serverError}</DialogError>}
      <DialogFoot lead={<p className="text-[12.5px] text-muted-foreground">{claimRef(c.id)}</p>}>
        <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={busy}>Fechar</button>
        {steps.map((s, i) => (
          <button key={s} type="button" disabled={busy} onClick={() => void run(s)}
            className={cn(s === "cancel" ? "vp-ghost !text-destructive" : i === 0 || s === "reopen" ? "vp-cta" : "vp-ghost", "!h-12 justify-center sm:min-w-[150px]")}>
            {busy && (s === "prepare" || s === "deliver") ? <Loader2 className="h-4 w-4 animate-spin" /> : STEP_LABEL[s]}
          </button>
        ))}
      </DialogFoot>
      <TrackingDialog claim={c} open={tracking} onClose={() => setTracking(false)} onDone={refresh} />
      <AddressDialog claim={c} open={address} onClose={() => setAddress(false)} onDone={refresh} />
      {confirmDialog}
      {reasonDialog}
    </>
  );
}

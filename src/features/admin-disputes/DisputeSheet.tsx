import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL } from "@/components/seller-ui/money";
import { useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { brl } from "@/features/admin-finance/types";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { EvidenceLinks, Info, ToneTag } from "./parts";
import { checkDecision, dateLabel, decisionEffect, deadlineInfo, eventLabel, isActive, methodLabel, parseEvents, shortId, statusInfo, typeLabel, type DisputeItem } from "./disputesModel";

type Outcome = "" | "seller" | "buyer";

/** Detalhe da disputa: venda, defesa do seller, histórico e (se ainda aberta) a decisão. */
export function DisputeSheet({ item, onClose }: { item: DisputeItem | null; onClose: () => void }) {
  // guarda o último item para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<DisputeItem | null>(item);
  useEffect(() => { if (item) setLast(item); }, [item]);
  const d = item ?? last;
  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{d && <SheetBody d={d} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SheetBody({ d, onClose }: { d: DisputeItem; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const { ask, dialog: reasonDialog } = useReason();
  const [outcome, setOutcome] = useState<Outcome>("");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => { setOutcome(""); setFee(""); setNote(""); setTouched(false); setServerError(null); }, [d.id]);

  const events = useQuery({
    queryKey: ["admin-dispute-events", d.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_dispute_events" as never, { _id: d.id } as never);
      if (error) throw error;
      return parseEvents(data);
    },
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin-disputes"] }); void qc.invalidateQueries({ queryKey: ["admin-dispute-events", d.id] }); };

  const review = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.rpc("admin_set_dispute_review" as never, { _dispute_id: d.id, _note: text } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Disputa movida para análise."); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mover para análise.")),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_resolve_dispute" as never, { _dispute_id: d.id, _outcome: outcome, _fee: outcome === "buyer" ? parseBRL(fee) : 0, _note: note.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(outcome === "seller" ? "Decidido a favor do seller. O valor voltou para o saldo dele." : "Decidido contra o seller. O valor saiu do saldo dele.");
      refresh(); onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível registrar a decisão. Nada mudou.")),
  });

  const active = isActive(d);
  const st = statusInfo(d);
  const dl = deadlineInfo(d);
  const feeValue = parseBRL(fee);
  const problem = outcome ? checkDecision(outcome, note, feeValue, d.amount) : "Escolha quem ganha a disputa.";
  const busy = resolve.isPending || review.isPending;

  const onReview = async () => {
    setServerError(null);
    const text = await ask({ title: "Mover para análise", label: "O que você vai verificar?", minLength: 3, confirmLabel: "Mover", description: "A anotação fica no histórico da disputa. O valor continua congelado." });
    if (text) review.mutate(text);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem || !outcome) return;
    const who = outcome === "seller" ? "a favor do seller" : "contra o seller";
    sensitive.confirm(`Decidir ${typeLabel(d.type)} ${who}: ${brl(d.amount)} na venda ${shortId(d.transaction_id)}. ${decisionEffect(outcome, d, feeValue, brl)}`, async () => { await resolve.mutateAsync().catch(() => undefined); });
  };

  return (
    <>
      <DialogHead icon={<Scale className="h-5 w-5" />} title={`${typeLabel(d.type)} · ${brl(d.amount)}`}
        subtitle={`${d.seller_name} · aberta em ${dateLabel(d.created_at)}`} aside={<ToneTag tone={st.tone}>{st.label}</ToneTag>} />
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <DialogBody>
          <div className="flex flex-wrap items-center gap-2 sm:hidden"><ToneTag tone={st.tone}>{st.label}</ToneTag></div>
          {dl && <p className={cn("text-[14px] font-semibold", dl.tone === "destructive" ? "text-destructive" : dl.tone === "warning" ? "text-warning" : "text-muted-foreground")}>{dl.label}</p>}

          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="Comprador">{d.buyer_name || "Sem nome"}{d.buyer_email && <span className="block text-[13px] font-normal text-muted-foreground">{d.buyer_email}</span>}</Info>
            <Info label="Seller">{d.seller_name}{d.seller_email && d.seller_email !== d.seller_name && <span className="block text-[13px] font-normal text-muted-foreground">{d.seller_email}</span>}</Info>
            <Info label="Venda">{d.product_name || "Produto"}<span className="block text-[13px] font-normal text-muted-foreground">{brl(d.tx_amount)} no {methodLabel(d.payment_method)} · {shortId(d.transaction_id)}</span></Info>
            <Info label={active ? "Congelado no saldo do seller" : "Ficou congelado"}>{brl(d.held_amount)}</Info>
            {d.external_ref && <Info label="Referência do banco">{d.external_ref}</Info>}
          </dl>

          <section>
            <h3 className="mb-1.5 text-[14px] font-bold text-foreground">Motivo da abertura</h3>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/90">{d.reason || "Sem motivo registrado."}</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[14px] font-bold text-foreground">Defesa do seller</h3>
            {d.seller_response ? (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/90">{d.seller_response}</p>
                {d.seller_responded_at && <p className="text-[12.5px] text-muted-foreground">Enviada em {dateLabel(d.seller_responded_at)}</p>}
                <EvidenceLinks urls={d.evidence} />
              </div>
            ) : <p className="text-[14px] text-muted-foreground">{active ? "O seller ainda não respondeu." : "O seller não enviou defesa."}</p>}
          </section>

          {!active && (
            <section>
              <h3 className="mb-1.5 text-[14px] font-bold text-foreground">Decisão</h3>
              <p className="text-[14px] text-foreground/90">{st.label}{d.resolved_at ? ` em ${dateLabel(d.resolved_at)}` : ""}.{d.fee_amount > 0 && ` Taxa cobrada do seller: ${brl(d.fee_amount)}.`}</p>
              {d.admin_notes && <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted-foreground">{d.admin_notes}</p>}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-[14px] font-bold text-foreground">Histórico</h3>
            {events.isPending ? <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o histórico…</p>
              : events.isError ? <p role="alert" className="text-[13px] font-medium text-destructive">{friendlyError(events.error, "Não foi possível carregar o histórico.")} <button type="button" className="underline" onClick={() => void events.refetch()}>Tentar de novo</button></p>
                : events.data.length === 0 ? <p className="text-[13px] text-muted-foreground">Ainda não há registros.</p>
                  : (
                    <ol className="space-y-3 border-l border-border pl-4">
                      {events.data.map((ev) => (
                        <li key={ev.id} className="relative">
                          <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
                          <p className="text-[13.5px] font-semibold text-foreground">{eventLabel(ev.event)}</p>
                          <p className="text-[12.5px] text-muted-foreground">{dateLabel(ev.created_at)}{ev.actor_name ? ` · ${ev.actor_name}` : ""}</p>
                          {ev.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{ev.note}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
          </section>

          {active && (
            <section className="space-y-4 rounded-[20px] bg-muted/40 p-4 sm:p-5">
              <h3 className="text-[15px] font-bold text-foreground">Decidir a disputa</h3>
              <ChoiceGrid<Outcome> label="Quem ganha" value={outcome} onChange={setOutcome}
                options={[{ value: "seller", label: "Seller ganhou", description: "O valor volta para o saldo dele" }, { value: "buyer", label: "Seller perdeu", description: "O valor sai do saldo dele" }]} />
              {outcome === "buyer" && (
                <div className="max-w-[260px]">
                  <FieldLabel htmlFor="dsp-fee" hint="Opcional. Cobrada do seller além do valor da venda.">Taxa da disputa</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                    <input id="dsp-fee" className="vp-field tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" value={fee} onChange={(e) => setFee(maskBRL(e.target.value))} />
                  </div>
                  {touched && feeValue > d.amount && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">A taxa não pode passar do valor da disputa.</p>}
                </div>
              )}
              {outcome && <p className="text-[13.5px] leading-relaxed text-foreground/85">{decisionEffect(outcome, d, feeValue, brl)}</p>}
              <div>
                <FieldLabel htmlFor="dsp-note" hint="Fica no histórico e é lida pelo seller.">Justificativa</FieldLabel>
                <textarea id="dsp-note" className="vp-field resize-none" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                {touched && note.trim().length < 5 && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">Escreva a justificativa (mínimo 5 caracteres).</p>}
              </div>
              {d.status === "open" && <FieldHint>Precisa de mais tempo? Mova para análise antes de decidir.</FieldHint>}
            </section>
          )}
        </DialogBody>
        {(serverError || (touched && problem)) && <DialogError>{serverError ?? problem}</DialogError>}
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={busy}>Fechar</button>
          {active && d.status === "open" && (
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => void onReview()} disabled={busy}>
              {review.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Movendo…</> : "Mover para análise"}
            </button>
          )}
          {active && (
            <button type="submit" className={cn("vp-cta", outcome === "buyer" && "vp-cta-danger", "!h-12 justify-center sm:min-w-[170px]")} disabled={busy}>
              {resolve.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</> : "Registrar decisão"}
            </button>
          )}
        </DialogFoot>
      </form>
      {reasonDialog}
      {sensitive.dialog}
    </>
  );
}

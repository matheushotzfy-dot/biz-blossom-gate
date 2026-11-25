import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { brl } from "@/features/admin-finance/types";
import { Info } from "@/features/admin-disputes/parts";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { ActionDialog, type ActionTarget } from "./ActionDialog";
import {
  cycleStatus, cyclesLabel, dayLabel, historyLabel, intervalLabel, methodLabel, nextChargeLabel, parsePlanDetail, parseSubDetail, planState, subStatus,
  type HistoryRow, type PlanDetail, type PlanItem, type SubDetail, type SubItem,
} from "./subscriptionsModel";

const int = (v: number) => v.toLocaleString("pt-BR");

function Loading({ what }: { what: string }) {
  return <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando {what}…</p>;
}
function Failed({ error, what, onRetry }: { error: unknown; what: string; onRetry: () => void }) {
  return (
    <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
      {friendlyError(error, `Não foi possível carregar ${what}.`)} <button type="button" className="underline" onClick={onRetry}>Tentar de novo</button>
    </p>
  );
}

function History({ rows, empty }: { rows: HistoryRow[]; empty: string }) {
  return (
    <Block title="Histórico">
      {rows.length === 0 ? <p className="text-[13.5px] text-muted-foreground">{empty}</p> : (
        <ol className="space-y-3 border-l border-border pl-4">
          {rows.map((h) => (
            <li key={h.id} className="relative">
              <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
              <p className="text-[13.5px] font-semibold text-foreground">{historyLabel(h.action)}</p>
              <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.created_at)}{h.admin_name ? ` · ${h.admin_name}` : ""}</p>
              {h.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{h.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Block>
  );
}

/* ───────── raio-X da assinatura ───────── */

/** Uma assinatura: dados, cobranças e a ação de cancelar. */
export function SubscriptionSheet({ id, seed, onClose }: { id: string | null; seed: SubItem | null; onClose: () => void }) {
  // guarda a última assinatura para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: SubItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <SubBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SubBody({ id, seed, onClose }: { id: string; seed: SubItem | null; onClose: () => void }) {
  const [action, setAction] = useState<ActionTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-subscription-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscription_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parseSubDetail(data);
    },
  });
  const d = q.data;
  const status = d?.subscription.status ?? seed?.status ?? "";
  const st = status ? subStatus(status) : null;
  const title = d?.subscription.subscriber_name ?? d?.subscription.subscriber_email ?? seed?.subscriber_name ?? seed?.subscriber_email ?? "Assinatura";
  const canCancel = !!d && d.subscription.status !== "canceled";

  return (
    <>
      <DialogHead icon={<Repeat className="h-5 w-5" />} title={title} subtitle={d ? `${d.plan.name} · ${brl(d.plan.price)} ${intervalLabel(d.plan.interval, d.plan.interval_count)}` : seed?.plan_name ?? "Assinatura"}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading what="a assinatura" /> : q.isError || !d ? <Failed error={q.error} what="a assinatura" onRetry={() => void q.refetch()} /> : <SubDetailView d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {canCancel && d && (
            <button type="button" className="vp-ghost !h-12 justify-center !text-destructive"
              onClick={() => setAction({ kind: "cancel", sub: { id, label: d.subscription.subscriber_name ?? d.subscription.subscriber_email, plan_name: d.plan.name } })}>
              Cancelar assinatura
            </button>
          )}
        </DialogFoot>
      </div>
      <ActionDialog target={action} onClose={() => setAction(null)} />
    </>
  );
}

function SubDetailView({ d }: { d: SubDetail }) {
  const s = d.subscription, x = d.stats;
  const canceled = s.status === "canceled";
  return (
    <>
      {d.plan.hold_at && !canceled && (
        <div className="rounded-[14px] bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          <p className="font-semibold">O plano está pausado pela equipe desde {dateLabel(d.plan.hold_at)}.</p>
          {d.plan.hold_reason && <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">Motivo: {d.plan.hold_reason}</p>}
        </div>
      )}
      {s.cancel_at_period_end && !canceled && (
        <div className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">
          Cancelamento agendado: a assinatura termina {s.current_period_end ? `em ${dayLabel(s.current_period_end)}` : "no fim do período"} e não renova.
        </div>
      )}

      <Block title="Cobranças" aside={x.cycles > 36 ? "36 mais recentes" : undefined}>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(4,minmax(0,1fr))]">
          <Figure label="Recebido" value={brl(x.paid_amount)} sub={`${int(x.paid)} ${x.paid === 1 ? "cobrança paga" : "cobranças pagas"}`} />
          <Figure label="Por mês" value={brl(x.monthly)} sub="estimado pelo plano" />
          <Figure label="Atrasadas" value={int(x.overdue)} sub={x.overdue === 0 ? "nenhuma" : "em aberto"} tone={x.overdue > 0 ? "warning" : undefined} />
          <Figure label="Falharam" value={int(x.failed)} sub={x.failed === 0 ? "nenhuma" : "sem pagamento"} tone={x.failed > 0 ? "destructive" : undefined} />
        </div>
        {d.cycles.length === 0 ? <p className="mt-3 text-[13.5px] text-muted-foreground">Nenhuma cobrança gerada para esta assinatura.</p> : (
          <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
            {d.cycles.map((c) => {
              const cs = cycleStatus(c.status);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">Cobrança {int(c.cycle_number)}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      Vence em {dayLabel(c.due_at)}{c.paid_at ? ` · paga em ${dayLabel(c.paid_at)}` : ""}{c.attempt_count > 0 ? ` · ${int(c.attempt_count)} ${c.attempt_count === 1 ? "tentativa" : "tentativas"}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ToneTag tone={cs.tone}>{cs.label}</ToneTag>
                    <span className="tabular-nums text-foreground">{brl(c.amount)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title="Assinatura">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Assinante">{s.subscriber_name ? `${s.subscriber_name} · ${s.subscriber_email}` : s.subscriber_email}{s.has_account ? "" : " (sem conta no site)"}</Info>
          <Info label="Pagamento">{methodLabel(s.billing_method)}</Info>
          <Info label="Progresso">{cyclesLabel(s.completed_cycles, s.max_cycles)}</Info>
          <Info label="Próxima cobrança">{nextChargeLabel({ status: s.status, next_charge_at: s.next_charge_at, cancel_at_period_end: s.cancel_at_period_end, current_period_end: s.current_period_end })}</Info>
          <Info label="Período atual">{s.current_period_start && s.current_period_end ? `${dayLabel(s.current_period_start)} a ${dayLabel(s.current_period_end)}` : "—"}</Info>
          <Info label="Fim do teste">{s.trial_end ? dayLabel(s.trial_end) : "Sem período de teste"}</Info>
          <Info label="Assinou em">{dateLabel(s.created_at)}</Info>
          <Info label="Cancelada em">{s.canceled_at ? dateLabel(s.canceled_at) : "—"}</Info>
          <Info label="Seller">{d.seller.name}{d.seller.email ? ` · ${d.seller.email}` : ""}</Info>
          <Info label="Plano">{d.plan.name}{d.plan.product_name ? ` · produto ${d.plan.product_name}` : ""}</Info>
        </div>
      </Block>

      <History rows={d.history} empty="Nenhuma ação da equipe registrada nesta assinatura." />
    </>
  );
}

/* ───────── raio-X do plano ───────── */

/** Um plano: dados, assinantes e a ação de pausar ou liberar. */
export function PlanSheet({ id, seed, onClose }: { id: string | null; seed: PlanItem | null; onClose: () => void }) {
  const [last, setLast] = useState<{ id: string; seed: PlanItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <PlanBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function PlanBody({ id, seed, onClose }: { id: string; seed: PlanItem | null; onClose: () => void }) {
  const [action, setAction] = useState<ActionTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-subscription-plan-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscription_plan_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parsePlanDetail(data);
    },
  });
  const d = q.data;
  const st = d ? planState({ is_active: d.plan.is_active, hold_at: d.plan.hold_at }) : seed ? planState(seed) : null;
  const held = !!(d ? d.plan.hold_at : seed?.hold_at);

  return (
    <>
      <DialogHead icon={<Layers className="h-5 w-5" />} title={d?.plan.name ?? seed?.name ?? "Plano"} subtitle={d ? `${brl(d.plan.price)} ${intervalLabel(d.plan.interval, d.plan.interval_count)} · ${d.seller.name}` : seed?.seller_name ?? "Plano de assinatura"}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading what="o plano" /> : q.isError || !d ? <Failed error={q.error} what="o plano" onRetry={() => void q.refetch()} /> : <PlanDetailView d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {d && (held
            ? <button type="button" className="vp-cta !h-12 justify-center sm:min-w-[150px]" onClick={() => setAction({ kind: "plan", plan: { id, name: d.plan.name, seller_name: d.seller.name }, hold: false })}>Liberar plano</button>
            : <button type="button" className="vp-ghost !h-12 justify-center !text-destructive" onClick={() => setAction({ kind: "plan", plan: { id, name: d.plan.name, seller_name: d.seller.name }, hold: true })}>Pausar plano</button>)}
        </DialogFoot>
      </div>
      <ActionDialog target={action} onClose={() => setAction(null)} />
    </>
  );
}

function PlanDetailView({ d }: { d: PlanDetail }) {
  const x = d.stats;
  return (
    <>
      {d.plan.hold_at && (
        <div className="rounded-[14px] bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          <p className="font-semibold">Pausado pela equipe desde {dateLabel(d.plan.hold_at)}. O seller não reativa nem apaga o plano.</p>
          {d.plan.hold_reason && <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">Motivo: {d.plan.hold_reason}</p>}
        </div>
      )}

      <Block title="Assinantes" aside="receita estimada pelo preço do plano">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(4,minmax(0,1fr))]">
          <Figure label="Assinantes" value={int(x.subs)} sub={x.canceled > 0 ? `${int(x.canceled)} ${x.canceled === 1 ? "cancelada" : "canceladas"}` : "nenhuma cancelada"} />
          <Figure label="Ativas" value={int(x.active)} sub={x.trial > 0 ? `${int(x.trial)} em teste` : "nenhuma em teste"} />
          <Figure label="Atrasadas" value={int(x.late)} sub={x.late === 0 ? "nenhuma" : "em aberto"} tone={x.late > 0 ? "warning" : undefined} />
          <Figure label="Por mês" value={brl(x.monthly)} sub={`${brl(x.paid_amount)} pagos`} />
        </div>
        {d.subscriptions.length === 0 ? <p className="mt-3 text-[13.5px] text-muted-foreground">Ninguém assinou este plano ainda.</p> : (
          <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
            {d.subscriptions.map((s) => {
              const ss = subStatus(s.status);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{s.subscriber_name ?? s.subscriber_email}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{s.subscriber_name ? `${s.subscriber_email} · ` : ""}assinou em {dayLabel(s.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <ToneTag tone={ss.tone}>{ss.label}</ToneTag>
                    <span>{cyclesLabel(s.completed_cycles, null)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {x.subs > d.subscriptions.length && <p className="mt-2 text-[12.5px] text-muted-foreground">Mostrando as {int(d.subscriptions.length)} assinaturas mais recentes. Use a aba Assinaturas para ver todas.</p>}
      </Block>

      <Block title="Plano">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Valor">{brl(d.plan.price)} {intervalLabel(d.plan.interval, d.plan.interval_count)}</Info>
          <Info label="Teste grátis">{d.plan.trial_days > 0 ? `${int(d.plan.trial_days)} ${d.plan.trial_days === 1 ? "dia" : "dias"}` : "Sem teste"}</Info>
          <Info label="Seller">{d.seller.name}{d.seller.email ? ` · ${d.seller.email}` : ""}</Info>
          <Info label="Produto">{d.product ? `${d.product.name}${d.product.deleted ? " (apagado)" : ""}` : "Sem produto ligado"}</Info>
          <Info label="Criado em">{dateLabel(d.plan.created_at)}</Info>
          <Info label="Descrição">{d.plan.description ?? "Sem descrição"}</Info>
        </div>
      </Block>

      <History rows={d.history} empty="Nenhuma ação da equipe registrada neste plano." />
    </>
  );
}

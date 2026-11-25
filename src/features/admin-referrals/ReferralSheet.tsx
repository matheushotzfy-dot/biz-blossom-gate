import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { brl } from "@/features/admin-finance/types";
import { Info } from "@/features/admin-disputes/parts";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { ActionDialog, type ActionTarget } from "./ActionDialog";
import { OUTCOME, accountLabel, dayLabel, historyLabel, nextOutcomes, parseRefDetail, refStatus, type RefDetail, type RefItem } from "./referralsModel";

const int = (v: number) => v.toLocaleString("pt-BR");

function Loading() {
  return <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a indicação…</p>;
}
function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
      {friendlyError(error, "Não foi possível carregar a indicação.")} <button type="button" className="underline" onClick={onRetry}>Tentar de novo</button>
    </p>
  );
}

/** Uma indicação: quem indicou, quem foi indicado, sinais de alerta e as ações da equipe. */
export function ReferralSheet({ id, seed, onClose }: { id: string | null; seed: RefItem | null; onClose: () => void }) {
  // guarda a última indicação para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: RefItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <Body key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ id, seed, onClose }: { id: string; seed: RefItem | null; onClose: () => void }) {
  const [action, setAction] = useState<ActionTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-referral-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_referral_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parseRefDetail(data);
    },
  });
  const d = q.data;
  const status = d?.referral.status ?? seed?.status ?? "";
  const st = status ? refStatus(status) : null;
  const outcomes = d ? nextOutcomes(d.referral.status) : [];
  const open = (o: (typeof outcomes)[number]) => d && setAction({ id, outcome: o, referred_email: d.referral.referred_email, referrer_name: d.referrer.name, reward: d.referral.reward_amount });

  return (
    <>
      <DialogHead icon={<Share2 className="h-5 w-5" />} title={d?.referral.referred_email ?? seed?.referred_email ?? "Indicação"}
        subtitle={d ? `Indicada por ${d.referrer.name} · ${brl(d.referral.reward_amount)}` : seed ? `Indicada por ${seed.referrer_name}` : "Indicação"}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading /> : q.isError || !d ? <Failed error={q.error} onRetry={() => void q.refetch()} /> : <DetailView d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {outcomes.map((o, i) => {
            const blocked = o === "qualified" && !d?.referred;
            return (
              <button key={o} type="button" onClick={() => open(o)} disabled={blocked} title={blocked ? "O indicado ainda não tem conta na plataforma." : undefined}
                className={cn(i === 0 ? "vp-cta sm:min-w-[170px]" : "vp-ghost !text-destructive", "!h-12 justify-center")}>
                {OUTCOME[o].cta}
              </button>
            );
          })}
        </DialogFoot>
      </div>
      <ActionDialog target={action} onClose={() => setAction(null)} />
    </>
  );
}

function DetailView({ d }: { d: RefDetail }) {
  const r = d.referral, a = d.referrer, b = d.referred;
  const closed = r.status === "paid" || r.status === "rejected" || r.status === "cancelled";
  const accountBefore = !!(b?.created_at && b.created_at < r.created_at);

  return (
    <>
      {r.status === "qualified" && (
        <div className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">
          Falta pagar a recompensa de {brl(r.reward_amount)}. Depois de pagar por fora, registre o pagamento aqui.
        </div>
      )}
      {!closed && accountBefore && (
        <div className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] text-warning">
          <p className="font-semibold">A conta do indicado já existia antes desta indicação.</p>
          <p className="mt-0.5 font-medium">Ela foi criada em {dateLabel(b!.created_at!)} e a indicação é de {dateLabel(r.created_at)}. Confira antes de qualificar.</p>
        </div>
      )}
      {!closed && !b && (
        <div className="rounded-[14px] bg-muted/50 px-4 py-3 text-[14px] text-muted-foreground">
          O indicado ainda não tem conta na plataforma. Só dá para qualificar depois que ele criar uma.
        </div>
      )}

      <Block title="Recompensa" aside="paga por fora, sem crédito automático no saldo">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Figure label="Valor" value={brl(r.reward_amount)} sub={r.status === "paid" ? "já paga" : r.status === "qualified" ? "a pagar" : r.status === "pending" ? "prevista" : "não vale"} tone={r.status === "qualified" ? "warning" : undefined} />
          <Figure label="Indicada em" value={dayLabel(r.created_at)} sub="data do registro" />
          <Figure label="Paga em" value={r.paid_at ? dayLabel(r.paid_at) : "—"} sub={r.paid_at ? "registrada à mão" : "ainda não paga"} />
        </div>
      </Block>

      <Block title="Quem indicou">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Seller">{a.name}</Info>
          <Info label="E-mail">{a.email ?? "—"}</Info>
          <Info label="Conta criada em">{a.created_at ? dateLabel(a.created_at) : "—"}</Info>
          <Info label="Situação da conta">{accountLabel(a.account_status)}</Info>
          <Info label="Indicações dele">{`${int(a.referrals)} ${a.referrals === 1 ? "indicação" : "indicações"} · ${int(a.paid)} ${a.paid === 1 ? "paga" : "pagas"}`}</Info>
          <Info label="Recusadas ou canceladas">{int(a.rejected)}</Info>
        </div>
      </Block>

      <Block title="Indicado">
        {b ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="Conta">{b.name}</Info>
            <Info label="E-mail">{r.referred_email}</Info>
            <Info label="Conta criada em">{b.created_at ? dateLabel(b.created_at) : "—"}</Info>
            <Info label="Último acesso">{b.last_login_at ? dateLabel(b.last_login_at) : "Nunca entrou"}</Info>
            <Info label="Vendas pagas">{b.sales === 0 ? "Nenhuma venda ainda" : `${int(b.sales)} ${b.sales === 1 ? "venda" : "vendas"} · ${brl(b.volume)}`}</Info>
            <Info label="Situação da conta">{accountLabel(b.account_status)}</Info>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="E-mail">{r.referred_email}</Info>
            <Info label="Conta">Ainda não criou conta</Info>
          </div>
        )}
        {d.others.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Outras indicações para este e-mail</p>
            <ul className="divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
              {d.others.map((o) => {
                const os = refStatus(o.status);
                return (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
                    <span className="min-w-0 flex-1 truncate text-foreground">{o.referrer_name}<span className="text-[12.5px] text-muted-foreground"> · {dayLabel(o.created_at)}</span></span>
                    <ToneTag tone={os.tone}>{os.label}</ToneTag>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Block>

      <Block title="Histórico">
        {d.history.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma ação da equipe registrada nesta indicação.</p> : (
          <ol className="space-y-3 border-l border-border pl-4">
            {d.history.map((h) => (
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
    </>
  );
}

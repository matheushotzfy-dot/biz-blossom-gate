import { Layers, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-products/parts";
import { brl } from "@/features/admin-finance/types";
import { cyclesLabel, dayLabel, intervalLabel, methodLabel, nextChargeLabel, planState, subStatus, type PlanItem, type SubItem } from "./subscriptionsModel";

const int = (v: number) => v.toLocaleString("pt-BR");
const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`;
const TH = "whitespace-nowrap px-3 py-3";

/* ───────── assinaturas ───────── */

const Person = ({ s }: { s: SubItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Repeat className="h-[18px] w-[18px]" /></span>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={s.subscriber_name ?? s.subscriber_email}>{s.subscriber_name ?? s.subscriber_email}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={s.subscriber_email}>{s.subscriber_name ? s.subscriber_email : "Sem nome informado"}</p>
    </div>
  </div>
);

const Plan = ({ s }: { s: SubItem }) => (
  <>
    <p className="truncate text-[14px] font-semibold text-foreground" title={s.plan_name}>{s.plan_name}</p>
    <p className="truncate text-[12.5px] text-muted-foreground" title={s.seller_email ?? undefined}>{s.seller_name}</p>
  </>
);

const Price = ({ s }: { s: SubItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(s.plan_price)}</p>
    <p className="text-[12.5px] text-muted-foreground">{intervalLabel(s.plan_interval, s.plan_interval_count)} · {methodLabel(s.billing_method)}</p>
  </>
);

function SubState({ s }: { s: SubItem }) {
  const st = subStatus(s.status);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      <p className="text-[12.5px] text-muted-foreground">{cyclesLabel(s.completed_cycles, s.max_cycles)}</p>
      {s.plan_held && s.status !== "canceled" && <p className="text-[12.5px] font-medium text-warning">Plano pausado pela equipe</p>}
    </div>
  );
}

const Next = ({ s }: { s: SubItem }) => (
  <>
    <p className="text-[14px] font-medium text-foreground">{nextChargeLabel(s)}</p>
    <p className="text-[12.5px] text-muted-foreground">{s.last_payment_at ? `Último pago em ${dayLabel(s.last_payment_at)}` : "Nenhum pagamento"}</p>
  </>
);

const SubAction = ({ s, onOpen }: { s: SubItem; onOpen: (s: SubItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(s)} aria-label={`Ver assinatura de ${s.subscriber_name ?? s.subscriber_email}`}>Detalhes</Button>
);

export function SubscriptionsTable({ rows, onOpen }: { rows: SubItem[]; onOpen: (s: SubItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Assinante", "Plano e seller", "Valor", "Situação", "Próxima cobrança", ""].map((h, i) => <th key={h + i} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[230px] px-3 py-3"><Person s={s} /></td>
              <td className="max-w-[200px] px-3 py-3"><Plan s={s} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Price s={s} /></td>
              <td className="px-3 py-3"><SubState s={s} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Next s={s} /></td>
              <td className="px-3 py-3 text-right"><SubAction s={s} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SubscriptionsCards({ rows, onOpen }: { rows: SubItem[]; onOpen: (s: SubItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((s) => (
        <li key={s.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <Person s={s} />
          <SubState s={s} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Plano</dt><dd><Plan s={s} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Valor</dt><dd><Price s={s} /></dd></div>
          </dl>
          <div className="min-w-0 border-t border-border/40 pt-3"><p className="text-[12px] text-muted-foreground">Próxima cobrança</p><Next s={s} /></div>
          <div className="flex justify-end"><SubAction s={s} onOpen={onOpen} /></div>
        </li>
      ))}
    </ul>
  );
}

/* ───────── planos ───────── */

const PlanName = ({ p }: { p: PlanItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Layers className="h-[18px] w-[18px]" /></span>
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold text-foreground" title={p.name}>{p.name}</p>
      <p className="truncate text-[13px] text-muted-foreground" title={p.seller_email ?? undefined}>{p.seller_name}</p>
    </div>
  </div>
);

const PlanPrice = ({ p }: { p: PlanItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(p.price)}</p>
    <p className="text-[12.5px] text-muted-foreground">{intervalLabel(p.interval, p.interval_count)}{p.trial_days > 0 ? ` · ${plural(p.trial_days, "dia", "dias")} de teste` : ""}</p>
  </>
);

const PlanSituation = ({ p }: { p: PlanItem }) => {
  const st = planState(p);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      <p className="truncate text-[12.5px] text-muted-foreground" title={p.product_name ?? undefined}>
        {p.product_name ? `${p.product_name}${p.product_deleted ? " (apagado)" : ""}` : "Sem produto ligado"}
      </p>
      {p.hold_reason && <p className="line-clamp-2 max-w-[220px] text-[12.5px] text-muted-foreground">Motivo: {p.hold_reason}</p>}
    </div>
  );
};

const PlanSubs = ({ p }: { p: PlanItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{plural(p.subs, "assinante", "assinantes")}</p>
    <p className="text-[12.5px] text-muted-foreground">{p.subs === 0 ? "Ninguém assinou ainda" : `${int(p.active)} ${p.active === 1 ? "ativa" : "ativas"}${p.late > 0 ? ` · ${int(p.late)} em atraso` : ""}`}</p>
  </>
);

const PlanAction = ({ p, onOpen }: { p: PlanItem; onOpen: (p: PlanItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(p)} aria-label={`Ver plano ${p.name}`}>Detalhes</Button>
);

export function PlansTable({ rows, onOpen }: { rows: PlanItem[]; onOpen: (p: PlanItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Plano e seller", "Valor", "Situação", "Assinantes", "Receita mensal", ""].map((h, i) => <th key={h + i} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[240px] px-3 py-3"><PlanName p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3"><PlanPrice p={p} /></td>
              <td className="px-3 py-3"><PlanSituation p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3"><PlanSubs p={p} /></td>
              <td className="whitespace-nowrap px-3 py-3 text-[14px] font-semibold tabular-nums text-foreground">{brl(p.monthly)}</td>
              <td className="px-3 py-3 text-right"><PlanAction p={p} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlansCards({ rows, onOpen }: { rows: PlanItem[]; onOpen: (p: PlanItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((p) => (
        <li key={p.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <PlanName p={p} />
          <PlanSituation p={p} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Valor</dt><dd><PlanPrice p={p} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Assinantes</dt><dd><PlanSubs p={p} /></dd></div>
          </dl>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">Receita mensal: <span className="font-semibold tabular-nums text-foreground">{brl(p.monthly)}</span></p>
            <PlanAction p={p} onOpen={onOpen} />
          </div>
        </li>
      ))}
    </ul>
  );
}

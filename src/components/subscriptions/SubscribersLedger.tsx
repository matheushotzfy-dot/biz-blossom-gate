import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Avatar, StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { SUB_STATUS, type Plan, type Subscription } from "./types";

const COLS = "md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_150px_120px]";

export interface SubscribersLedgerProps {
  subs: Subscription[];
  plans: Plan[];
  loading: boolean;
  /** Há assinantes, mas a busca não achou nenhum. */
  searching: boolean;
  onSeePlans: () => void;
}

const sinceLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");

/** Assinantes no mesmo formato de livro das vendas. */
export function SubscribersLedger({ subs, plans, loading, searching, onSeePlans }: SubscribersLedgerProps) {
  if (loading && subs.length === 0) return <section className="vp-sheet space-y-3 p-5 sm:p-7">{Array.from({ length: 5 }, (_, i) => <div key={i} className="vp-skel h-14" />)}</section>;
  if (subs.length === 0) {
    return (
      <section className="vp-sheet">
        <EmptyPanel
          title={searching ? "Nenhum assinante encontrado" : "Ainda não há assinantes"}
          text={searching ? "Tente outro nome ou e-mail." : "Quando alguém assinar um dos seus planos, ele aparece aqui com o status de cada cobrança."}
          action={searching ? undefined : <button type="button" className="vp-ghost" onClick={onSeePlans}>Ver meus planos</button>}
        />
      </section>
    );
  }
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Assinantes">
      <div role="table" aria-label="Assinantes">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
          <span role="columnheader">Assinante</span>
          <span role="columnheader">Plano</span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="text-right">Desde</span>
        </div>
        <ul>
          {subs.map((sub) => {
            const plan = plans.find((p) => p.id === sub.plan_id);
            const st = SUB_STATUS[sub.status] ?? { label: sub.status, tone: "idle" as const };
            const name = sub.subscriber_name || sub.subscriber_email;
            return (
              <li key={sub.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-t border-border px-5 py-3.5 first:border-t-0 sm:px-7 md:gap-4", COLS)}>
                <span role="cell" className="flex min-w-0 items-center gap-3.5">
                  <Avatar name={name} ok={sub.status === "active" || sub.status === "trialing"} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-bold text-foreground">{sub.subscriber_name || "Sem nome"}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{sub.subscriber_email}</span>
                  </span>
                </span>
                <span role="cell" className="hidden truncate text-[14px] font-medium text-foreground md:block">{plan?.name ?? "Plano removido"}</span>
                <span role="cell" className="justify-self-end md:justify-self-start"><StatusPill label={st.label} tone={st.tone} /></span>
                <span role="cell" className="col-span-2 flex items-center justify-between text-[12.5px] text-muted-foreground md:col-span-1 md:block md:text-right md:text-[13.5px]">
                  <span className="md:hidden">{plan?.name ?? "Plano removido"}</span>
                  <span className="tabular-nums">{sinceLabel(sub.created_at)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

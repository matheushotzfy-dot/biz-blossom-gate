import { Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/home/Money";
import { cn } from "@/lib/utils";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { INTERVAL_UNIT, type Plan, type Subscription } from "./types";

export interface PlansGridProps {
  plans: Plan[];
  /** Todas as assinaturas, para contar quem está em cada plano. */
  subs: Subscription[];
  loading: boolean;
  /** Existem planos, mas a busca não achou nenhum. */
  searching: boolean;
  onToggle: (plan: Plan) => void;
  onCreate: () => void;
}

/** Planos em cartões: o preço é a informação principal, o resto é apoio. */
export function PlansGrid({ plans, subs, loading, searching, onToggle, onCreate }: PlansGridProps) {
  if (loading && plans.length === 0) {
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-[210px] !rounded-[22px]" />)}</div>;
  }
  if (plans.length === 0) {
    return (
      <section className="vp-sheet">
        <EmptyPanel
          title={searching ? "Nenhum plano encontrado" : "Crie seu primeiro plano"}
          text={searching ? "Tente outro nome na busca." : "Defina preço, periodicidade e dias de teste. Os assinantes pagam sozinhos a cada ciclo."}
          action={searching ? undefined : <button type="button" className="vp-cta" onClick={onCreate}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo plano</button>}
        />
      </section>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const count = subs.filter((s) => s.plan_id === plan.id && (s.status === "active" || s.status === "trialing")).length;
        return (
          <li key={plan.id} className={cn("vp-sheet flex flex-col p-6 transition-opacity", !plan.is_active && "opacity-80")}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 truncate text-[17px] font-extrabold tracking-[-0.025em] text-foreground">{plan.name}</h3>
              <Switch checked={plan.is_active} onCheckedChange={() => onToggle(plan)} aria-label={plan.is_active ? `Pausar ${plan.name}` : `Ativar ${plan.name}`} />
            </div>
            <p className="mt-1 line-clamp-2 min-h-[40px] text-[13.5px] leading-snug text-muted-foreground">{plan.description || "Sem descrição."}</p>

            <p className="mt-4 flex items-baseline gap-1.5">
              <Money value={plan.price} className={cn("text-[34px] font-extrabold leading-none tracking-[-0.045em]", plan.is_active ? "text-foreground" : "text-muted-foreground")} centsClassName="opacity-60" />
              <span className="text-[14px] font-medium text-muted-foreground">por {INTERVAL_UNIT[plan.interval] ?? plan.interval}</span>
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-[12.5px] font-bold", plan.is_active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{plan.is_active ? "Ativo" : "Pausado"}</span>
              {plan.trial_days > 0 && <span className="inline-flex h-7 items-center rounded-full bg-info/15 px-3 text-[12.5px] font-bold text-info">{plan.trial_days} {plan.trial_days === 1 ? "dia" : "dias"} de teste</span>}
              <span className="ml-auto text-[13px] tabular-nums text-muted-foreground">{count} {count === 1 ? "assinante" : "assinantes"}</span>
            </div>
          </li>
        );
      })}
      <li>
        <button type="button" onClick={onCreate} className="grid min-h-[210px] w-full place-items-center rounded-[22px] border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="grid place-items-center gap-2 text-[14px] font-bold"><span className="grid h-11 w-11 place-items-center rounded-full bg-muted"><Plus className="h-5 w-5" /></span>Novo plano</span>
        </button>
      </li>
    </ul>
  );
}

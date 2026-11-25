import { ArrowDownLeft, ArrowUpRight, Minus, Plus } from "lucide-react";
import { brl } from "@/features/admin-finance/types";
import { cn } from "@/lib/utils";
import { fmtDateTime, type Adjustment, type StatementEntry } from "./withdrawalsModel";

/** Lista de lançamentos no estilo extrato: ícone, descrição, data e valor — funciona igual em qualquer largura. */
function LedgerRow({ icon, tone, title, description, meta, amount, sign }: { icon: React.ReactNode; tone: "in" | "out"; title: string; description: string; meta: string; amount: number; sign: "+" | "-" }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", tone === "in" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        <p className="break-words text-[12.5px] text-foreground/80">{description}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{meta}</p>
      </div>
      <p className={cn("shrink-0 text-[14px] font-bold tabular-nums", tone === "in" ? "text-success" : "text-destructive")}>{sign}{brl(amount)}</p>
    </li>
  );
}

export function AdjustmentList({ rows, nameOf }: { rows: Adjustment[]; nameOf: (id: string) => string }) {
  return (
    <ul className="divide-y divide-border/40 rounded-[12px] border border-border/60">
      {rows.map((a) => {
        const credit = a.type === "credit";
        return <LedgerRow key={a.id} tone={credit ? "in" : "out"} icon={credit ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          title={`${credit ? "Crédito" : "Débito"} para ${nameOf(a.user_id)}`} description={a.reason}
          meta={`${fmtDateTime(a.created_at)} · feito por ${nameOf(a.admin_user_id)}`} amount={Number(a.amount)} sign={credit ? "+" : "-"} />;
      })}
    </ul>
  );
}

export function StatementList({ rows }: { rows: StatementEntry[] }) {
  return (
    <ul className="divide-y divide-border/40 rounded-[12px] border border-border/60">
      {rows.map((e) => (
        <LedgerRow key={e.key} tone={e.inflow ? "in" : "out"} icon={e.inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          title={e.label} description={e.description} meta={fmtDateTime(e.date)} amount={e.amount} sign={e.inflow ? "+" : "-"} />
      ))}
    </ul>
  );
}

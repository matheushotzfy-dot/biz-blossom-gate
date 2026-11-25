import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useReason } from "@/components/seller-ui/confirm";
import { copyText } from "@/components/seller-ui/copy";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { callRpc } from "./goalsApi";
import { awardSteps, awardTag, brl, dateLabel, pctOf, plural, reachedText, type AwardStep, type GoalDetail, type RankRow } from "./goalsModel";

const DONE: Record<string, string> = { paid: "Prêmio marcado como entregue.", cancelled: "Prêmio cancelado.", pending: "Prêmio reaberto." };

/** Quem está pontuando na meta, quanto falta e o que foi feito com o prêmio de cada um que bateu. */
export function GoalRanking({ detail, onChanged }: { detail: GoalDetail; onChanged: () => void }) {
  const { goal, ranking } = detail;
  const { ask, dialog: reasonDialog } = useReason();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [serverError, setServerError] = useState<string | null>(null);

  const apply = useMutation({
    mutationFn: (a: { row: RankRow; to: string; note: string }) => callRpc("admin_set_goal_award", { _goal_id: goal.id, _seller_id: a.row.seller_id, _status: a.to, _note: a.note }),
    onSuccess: (_d, a) => { toast.success(DONE[a.to] ?? "Prêmio atualizado."); onChanged(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível registrar. Nada mudou.")),
  });

  const run = async (row: RankRow, step: AwardStep) => {
    setServerError(null);
    const note = await ask({ title: step.title(row.name), description: step.description(goal.reward_title), tone: step.tone, label: step.field, minLength: 5, confirmLabel: step.confirm, placeholder: step.placeholder });
    if (!note) return;
    sensitive.confirm(`Registrar o prêmio “${goal.reward_title}” de ${row.name} na meta “${goal.title}”.`, async () => { await apply.mutateAsync({ row, to: step.to, note }).catch(() => undefined); });
  };

  const reached = ranking.items.filter((r) => r.reached).length;
  const items = ranking.items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          Conta o valor líquido das vendas pagas dentro do período, sem vendas simuladas.
          {` ${plural(reached, "seller bateu", "sellers bateram")} a meta.`}
          {ranking.total > items.length && ` Mostrando os ${items.length.toLocaleString("pt-BR")} primeiros de ${ranking.total.toLocaleString("pt-BR")}.`}
        </p>
        <button type="button" className="vp-ghost !h-10 gap-1.5 !px-4 !text-[13.5px]" onClick={() => void copyText(reachedText(goal, items), "Lista copiada.")}>
          <Copy className="h-4 w-4" aria-hidden /> Copiar quem bateu
        </button>
      </div>

      {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}

      {items.length === 0 ? (
        <PremiumEmpty icon={Trophy} title="Ninguém pontuou ainda" subtitle="Aparece quando houver vendas pagas dentro do período da meta." />
      ) : (
        <ol className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Ranking da meta">
          {items.map((r, i) => {
            const tag = awardTag(r);
            const steps = r.reached || r.award ? awardSteps(r.award?.status ?? null) : [];
            const pct = pctOf(r.revenue, goal.target);
            const a = r.award;
            return (
              <li key={r.seller_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3.5 sm:gap-x-4">
                <span className="w-7 pt-0.5 text-[15px] font-bold tabular-nums text-foreground">{i + 1}º</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">{r.name}</span>
                    {tag && <ToneTag tone={tag.tone}>{tag.label}</ToneTag>}
                  </p>
                  {r.email && <p className="truncate text-[12.5px] text-muted-foreground">{r.email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[14.5px] font-semibold tabular-nums text-foreground">{brl(r.revenue)}</p>
                  <p className="text-[12.5px] text-muted-foreground">{plural(r.sales, "venda", "vendas")}</p>
                </div>

                <div className="col-span-3 space-y-2 sm:col-start-2 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${r.name}: ${pct}% da meta`}>
                      <div className={cn("h-full rounded-full", r.reached ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground">{r.reached ? "Meta batida" : `${pct}% da meta`}</span>
                  </div>
                  {a && (
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      {a.status === "paid" && a.paid_at ? `Entregue em ${dateLabel(a.paid_at)}` : a.status === "cancelled" ? "Cancelado" : "Registrado como a entregar"}
                      {a.note ? `: ${a.note}` : ""}
                    </p>
                  )}
                  {steps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {steps.map((s) => (
                        <button key={s.to} type="button" disabled={apply.isPending} onClick={() => void run(r, s)} aria-label={`${s.label}: ${r.name}`}
                          className={cn(s.to === "paid" ? "vp-cta" : "vp-ghost", "!h-9 !px-3.5 !text-[13px]", s.tone === "danger" && "!text-destructive")}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {reasonDialog}
      {sensitive.dialog}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Gift, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useReason } from "@/components/seller-ui/confirm";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { GoalDialog } from "./GoalDialog";
import { GoalHistory } from "./GoalHistory";
import { GoalRanking } from "./GoalRanking";
import { DETAIL_KEY, callRpc, useRefreshGoals } from "./goalsApi";
import { brl, goalTag, parseGoalDetail, phaseLine, phaseOf, plural, shortDate, type GoalDetail as Detail } from "./goalsModel";

type View = "ranking" | "historico";

/** Uma meta por inteiro: situação, prêmio, ações, quem bateu e o histórico. */
export function GoalDetail({ id, onDeleted, onSaved }: { id: string; onDeleted: () => void; onSaved: (id: string) => void }) {
  const refresh = useRefreshGoals();
  const [view, setView] = useState<View>("ranking");

  const q = useQuery({
    queryKey: [...DETAIL_KEY, id],
    queryFn: async () => parseGoalDetail(await callRpc("get_admin_goal_detail", { _id: id })),
    refetchInterval: 60_000,
  });

  if (q.isError && !q.data) return <PremiumPanel><ErrorBlock title="Não foi possível carregar a meta." error={q.error} onRetry={() => void q.refetch()} /></PremiumPanel>;
  if (!q.data) return <PremiumPanel><p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a meta…</p></PremiumPanel>;

  return <Loaded detail={q.data} view={view} setView={setView} stale={q.isError} onRetry={() => void q.refetch()} refresh={refresh} onDeleted={onDeleted} onSaved={onSaved} />;
}

function Loaded({ detail, view, setView, stale, onRetry, refresh, onDeleted, onSaved }: {
  detail: Detail; view: View; setView: (v: View) => void; stale: boolean; onRetry: () => void; refresh: () => void; onDeleted: () => void; onSaved: (id: string) => void;
}) {
  const { goal, totals, ranking, history } = detail;
  const { ask, dialog: reasonDialog } = useReason();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [editOpen, setEditOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const tag = goalTag(goal);
  const phase = phaseOf(goal);
  const hasAwards = ranking.items.some((r) => r.award);
  const toDeliver = ranking.items.filter((r) => r.reached && (!r.award || r.award.status === "pending")).length;

  const setActive = useMutation({
    mutationFn: (active: boolean) => callRpc("admin_set_goal_active", { _id: goal.id, _active: active }),
    onSuccess: (_d, active) => { toast.success(active ? "Meta no ar." : "Meta ocultada."); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mudar a situação da meta. Nada mudou.")),
  });

  const remove = useMutation({
    mutationFn: (reason: string) => callRpc("admin_delete_goal", { _id: goal.id, _reason: reason }),
    onSuccess: () => { toast.success(`“${goal.title}” foi apagada.`); refresh(); onDeleted(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível apagar a meta. Nada mudou.")),
  });

  const onDelete = async () => {
    setServerError(null);
    const reason = await ask({ title: `Apagar “${goal.title}”?`, tone: "danger", minLength: 5, confirmLabel: "Continuar", placeholder: "Por que está apagando?",
      description: "A meta some de vez. Isso não pode ser desfeito; o motivo fica na auditoria." });
    if (!reason) return;
    sensitive.confirm(`Apagar “${goal.title}” de vez.`, async () => { await remove.mutateAsync(reason).catch(() => undefined); });
  };

  const deleteBlock = goal.is_active ? "Oculte a meta antes de apagar." : hasAwards ? "Tem prêmios registrados: mantenha oculta em vez de apagar." : null;
  const busy = setActive.isPending || remove.isPending;

  return (
    <PremiumPanel>
      <div className="space-y-5">
        <header className="space-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="break-words font-display text-[19px] font-bold leading-tight tracking-tight text-foreground">{goal.title}</h2>
              <ToneTag tone={tag.tone}>{tag.label}</ToneTag>
            </div>
            <p className="mt-1 text-[13.5px] text-muted-foreground">{shortDate(goal.starts_at)} a {shortDate(goal.ends_at)}, horário de Brasília</p>
            <p className="text-[13.5px] text-muted-foreground">{phaseLine(goal)}</p>
            {goal.description && <p className="mt-1.5 max-w-2xl whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/80">{goal.description}</p>}
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {plural(totals.sellers, "seller com venda", "sellers com venda")} · {brl(totals.revenue)} em {plural(totals.sales, "venda", "vendas")}
            </p>
          </div>

          <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
            <div className="rounded-[14px] bg-muted/40 px-4 py-3">
              <dt className="text-[12.5px] text-muted-foreground">Meta de faturamento</dt>
              <dd className="mt-0.5 font-display text-[19px] font-bold tabular-nums text-foreground">{brl(goal.target)}</dd>
            </div>
            <div className="rounded-[14px] bg-muted/40 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Gift className="h-3.5 w-3.5" aria-hidden /> Prêmio</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-foreground">{goal.reward_title}</dd>
              {goal.reward_description && <dd className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{goal.reward_description}</dd>}
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            {goal.is_active
              ? <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px]" disabled={busy} onClick={() => { setServerError(null); setActive.mutate(false); }}><EyeOff className="h-4 w-4" aria-hidden /> Ocultar</button>
              : <button type="button" className="vp-cta !h-10 gap-1.5 !px-4 !text-[13.5px]" disabled={busy} onClick={() => { setServerError(null); setActive.mutate(true); }}>{setActive.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" aria-hidden />} Colocar no ar</button>}
            <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px]" disabled={busy} onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden /> Editar</button>
            <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px] !text-destructive" disabled={busy || deleteBlock !== null} title={deleteBlock ?? undefined} onClick={() => void onDelete()} aria-label={`Apagar ${goal.title}`}><Trash2 className="h-4 w-4" aria-hidden /> Apagar</button>
            {deleteBlock && <span className="text-[12.5px] text-muted-foreground">{deleteBlock}</span>}
          </div>
        </header>

        {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}
        {stale && <p role="status" className="flex flex-wrap items-center gap-3 rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] text-foreground">Não conseguimos atualizar agora; o que está na tela pode estar desatualizado. <button type="button" className="font-semibold underline underline-offset-2" onClick={onRetry}>Tentar de novo</button></p>}

        {toDeliver > 0 && (
          <p role="alert" className="rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
            {plural(toDeliver, "seller bateu a meta e ainda não tem", "sellers bateram a meta e ainda não têm")} o prêmio registrado como entregue.
            {phase === "running" && " A meta ainda está correndo: mais gente pode bater até o fim."}
          </p>
        )}

        <PremiumSegmented<View> value={view} onChange={setView} options={[{ value: "ranking", label: "Quem bateu" }, { value: "historico", label: "Histórico" }]} />

        {view === "ranking" && <GoalRanking detail={detail} onChanged={refresh} />}
        {view === "historico" && <GoalHistory history={history} />}
      </div>

      <GoalDialog goal={goal} locked={hasAwards} open={editOpen} onClose={() => setEditOpen(false)} onDone={onSaved} />
      {reasonDialog}
      {sensitive.dialog}
    </PremiumPanel>
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Pin, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { EntryDialog } from "./EntryDialog";
import { callRpc } from "./raceApi";
import { brl2, dateLabel, plural, type EntryItem, type RaceDetail } from "./raceModel";

/** O ranking como o administrador vê (valores exatos) e os valores fixos que mudam esse ranking. */
export function RankingPanel({ detail, onChanged }: { detail: RaceDetail; onChanged: () => void }) {
  const { race, board, entries } = detail;
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<EntryItem | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const openDialog = (e: EntryItem | null) => { setTarget(e); setDialogOpen(true); setServerError(null); };

  const remove = useMutation({
    mutationFn: (a: { entry: EntryItem; reason: string }) => callRpc("admin_delete_race_entry", { _id: a.entry.id, _reason: a.reason }),
    onSuccess: (_d, a) => { toast.success(a.entry.seller_id ? "Valor fixo removido. O ranking voltou a usar o faturamento real." : "Participante removido do ranking."); onChanged(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível remover. Nada mudou.")),
  });

  const onDelete = async (e: EntryItem) => {
    setServerError(null);
    const reason = await askReason({
      title: e.seller_id ? `Remover o valor fixo de ${e.display_name}?` : `Tirar ${e.display_name} do ranking?`, tone: "danger", minLength: 5, confirmLabel: "Continuar",
      description: e.seller_id ? `O ranking volta a usar o faturamento real dele na corrida (${brl2(e.real_revenue_cents)}).` : "Esta pessoa sai do ranking e deixa de disputar os prêmios.",
      placeholder: "Por que isso está sendo removido?",
    });
    if (!reason) return;
    sensitive.confirm(`Remover “${e.display_name}” do ranking de “${race.title}”. Isso pode mudar quem recebe os prêmios.`, async () => { await remove.mutateAsync({ entry: e, reason }).catch(() => undefined); });
  };

  return (
    <div className="space-y-6">
      <section aria-label="Ranking" className="space-y-3">
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Aqui você vê os valores exatos. Para os sellers, o valor de cada pessoa aparece arredondado para baixo, de mil em mil, e só o próprio valor aparece inteiro.
          {board.length >= 100 && " Mostrando os 100 primeiros."}
        </p>
        {board.length === 0 ? (
          <PremiumEmpty icon={Trophy} title="Ninguém no ranking ainda" subtitle="Aparece quando houver vendas pagas dentro do período ou um valor fixo." />
        ) : (
          <ol className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Ranking da corrida">
            {board.map((b) => (
              <li key={`${b.rank}-${b.seller_id ?? b.name}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 sm:gap-x-4">
                <span className="w-8 text-[15px] font-bold tabular-nums text-foreground">{b.rank}º</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">{b.name}</span>
                    {!b.has_account && <ToneTag tone="warning">Sem conta</ToneTag>}
                    {b.has_account && b.is_manual && <ToneTag tone="info">Valor fixo</ToneTag>}
                  </p>
                  {b.email && <p className="truncate text-[12.5px] text-muted-foreground">{b.email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[14.5px] font-semibold tabular-nums text-foreground">{brl2(b.revenue_cents)}</p>
                  <p className="text-[12.5px] text-muted-foreground">{plural(b.sales_count, "venda", "vendas")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Valores fixos" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h3 className="text-[14px] font-bold text-foreground">Valores fixos</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Trocam o faturamento de um seller no ranking, ou colocam alguém sem conta. Cada mudança pede motivo e sua senha, e fica na auditoria.
            </p>
          </div>
          <button type="button" className="vp-ghost !h-10 gap-1.5 !px-4 !text-[13.5px]" onClick={() => openDialog(null)}><Plus className="h-4 w-4" aria-hidden /> Novo valor fixo</button>
        </div>

        {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}

        {entries.length === 0 ? (
          <p className="rounded-[12px] bg-muted/40 px-4 py-3.5 text-[13.5px] text-muted-foreground">Nenhum valor fixo. O ranking está só com as vendas reais.</p>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Valores fixos da corrida">
            {entries.map((e) => (
              <li key={e.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !e.seller_id && "bg-warning/5")}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Pin className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[14.5px] font-semibold text-foreground">{e.display_name}</span>
                      <ToneTag tone={e.seller_id ? "info" : "warning"}>{e.seller_id ? "Seller" : "Sem conta"}</ToneTag>
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {e.seller ? (e.seller.email ?? e.seller.name ?? "Seller") : "Sem e-mail nem endereço para entregar prêmio."}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      Fixo em <span className="font-semibold tabular-nums text-foreground">{brl2(e.revenue_cents)}</span>, {plural(e.sales_count, "venda", "vendas")}
                      {e.seller_id && <> · real na corrida: <span className="tabular-nums">{brl2(e.real_revenue_cents)}</span></>}
                    </p>
                    <p className="text-[12px] text-muted-foreground/80">Atualizado em {dateLabel(e.updated_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" onClick={() => openDialog(e)} aria-label={`Editar ${e.display_name}`}><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</button>
                  <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px] !text-destructive" disabled={remove.isPending} onClick={() => void onDelete(e)} aria-label={`Remover ${e.display_name}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EntryDialog entry={target} raceId={race.id} raceTitle={race.title} open={dialogOpen} onClose={() => setDialogOpen(false)} onDone={onChanged} />
      {reasonDialog}
      {sensitive.dialog}
    </div>
  );
}

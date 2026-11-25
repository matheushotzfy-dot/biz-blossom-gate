import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/seller-ui/confirm";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag, Thumb } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { TierDialog } from "./TierDialog";
import { TIERS_KEY, callRpc, useRefreshRewards } from "./rewardsApi";
import { brl0, parseTiers, type TierItem } from "./rewardsModel";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/** As peças da página de Premiações dos sellers: ordem, meta, texto e se aparecem. */
export function TiersPanel() {
  const refresh = useRefreshRewards();
  const { ask, dialog: confirmDialog } = useConfirm();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  // `target` fica como estava enquanto o diálogo fecha, para o título não trocar na animação
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<TierItem | null>(null);
  const openDialog = (t: TierItem | null) => { setTarget(t); setDialogOpen(true); };
  const [serverError, setServerError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...TIERS_KEY],
    queryFn: async () => parseTiers(await callRpc("get_admin_award_tiers")),
    placeholderData: keepPreviousData,
  });

  const move = useMutation({
    mutationFn: (a: { id: string; dir: "up" | "down" }) => callRpc("admin_move_award_tier", { _id: a.id, _dir: a.dir }),
    onSuccess: () => refresh(),
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mudar a ordem.")),
  });

  const hide = useMutation({
    mutationFn: (t: TierItem) => callRpc("admin_save_award_tier", {
      _id: t.id, _create: false, _title: t.title, _tier: t.tier, _value: t.value, _description: t.description, _phrase: t.phrase, _rewards: t.rewards, _image_url: t.image_url, _is_active: false,
    }),
    onSuccess: (_d, t) => { toast.success(`“${t.title}” ficou oculta. Os sellers não veem mais esta peça.`); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível ocultar a peça.")),
  });

  const show = useMutation({
    mutationFn: (t: TierItem) => callRpc("admin_save_award_tier", {
      _id: t.id, _create: false, _title: t.title, _tier: t.tier, _value: t.value, _description: t.description, _phrase: t.phrase, _rewards: t.rewards, _image_url: t.image_url, _is_active: true,
    }),
    onSuccess: (_d, t) => { toast.success(`“${t.title}” está no ar para os sellers.`); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mostrar a peça.")),
  });

  const remove = useMutation({
    mutationFn: (t: TierItem) => callRpc("admin_delete_award_tier", { _id: t.id }),
    onSuccess: (_d, t) => { toast.success(`“${t.title}” foi apagada.`); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível apagar a peça.")),
  });

  const onHide = async (t: TierItem) => {
    setServerError(null);
    const ok = await ask({ title: `Ocultar “${t.title}”?`, tone: "warning", confirmLabel: "Ocultar peça", icon: <EyeOff className="h-5 w-5" />,
      description: t.claims.open > 0 ? `${plural(t.claims.open, "pedido em andamento segue", "pedidos em andamento seguem")} normalmente, mas ninguém novo consegue pedir esta peça.` : "Os sellers deixam de ver e de pedir esta peça. Os pedidos já feitos não mudam." });
    if (ok) hide.mutate(t);
  };

  const onShow = (t: TierItem) => {
    setServerError(null);
    sensitive.confirm(`Ligar “${t.title}” (meta ${brl0(t.value)}) para todos os sellers. ${plural(t.reached, "seller já bateu", "sellers já bateram")} esta meta e passa a poder pedir.`, async () => { await show.mutateAsync(t).catch(() => undefined); });
  };

  const onDelete = (t: TierItem) => {
    setServerError(null);
    sensitive.confirm(`Apagar “${t.title}” de vez. Isso não pode ser desfeito.`, async () => { await remove.mutateAsync(t).catch(() => undefined); });
  };

  const items = q.data ?? [];
  const busy = move.isPending || hide.isPending || show.isPending || remove.isPending;
  const noneActive = items.length > 0 && items.every((t) => !t.is_active);

  if (q.isError && !q.isFetching) return <ErrorBlock title="Não foi possível carregar as peças." error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending) return <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as peças…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          {items.length === 0
            ? "Nenhuma peça cadastrada: os sellers veem as sete peças padrão do app. Crie uma peça para passar a controlar a lista."
            : noneActive ? "Todas as peças estão ocultas: os sellers veem a página de Premiações sem nenhuma peça."
              : "A ordem daqui é a ordem que o seller vê. Mudar a meta ou ligar uma peça pede sua senha."}
        </p>
        <button type="button" className="vp-cta !h-10 gap-1.5 !px-4 !text-[13.5px]" onClick={() => openDialog(null)}><Plus className="h-4 w-4" aria-hidden /> Nova peça</button>
      </div>

      {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}

      {items.length === 0 ? <PremiumEmpty icon={Trophy} title="Nenhuma peça cadastrada" subtitle="Use “Nova peça” para criar a primeira." /> : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Peças de premiação">
          {items.map((t, i) => (
            <li key={t.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !t.is_active && "bg-muted/20")}>
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <Thumb url={t.image_url} name={t.title} size={56} icon={Trophy} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[15px] font-bold text-foreground">{t.title}</span>
                    <ToneTag tone={t.is_active ? "success" : "neutral"}>{t.is_active ? "No ar" : "Oculta"}</ToneTag>
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">Meta {brl0(t.value)}{t.tier ? ` · ${t.tier}` : ""}{t.rewards.length > 0 ? ` · ${t.rewards.join(", ")}` : ""}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {plural(t.reached, "seller bateu", "sellers bateram")}
                    {t.waiting_to_claim > 0 && <span className="font-semibold text-warning"> · {plural(t.waiting_to_claim, "ainda não pediu", "ainda não pediram")}</span>}
                    {` · ${plural(t.claims.total, "pedido", "pedidos")}`}{t.claims.open > 0 ? `, ${t.claims.open} em andamento` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <IconBtn label={`Subir ${t.title}`} disabled={busy || i === 0} onClick={() => { setServerError(null); move.mutate({ id: t.id, dir: "up" }); }}><ArrowUp className="h-4 w-4" /></IconBtn>
                <IconBtn label={`Descer ${t.title}`} disabled={busy || i === items.length - 1} onClick={() => { setServerError(null); move.mutate({ id: t.id, dir: "down" }); }}><ArrowDown className="h-4 w-4" /></IconBtn>
                <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" disabled={busy} onClick={() => openDialog(t)} aria-label={`Editar ${t.title}`}><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</button>
                {t.is_active
                  ? <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" disabled={busy} onClick={() => void onHide(t)} aria-label={`Ocultar ${t.title}`}><EyeOff className="h-3.5 w-3.5" aria-hidden /> Ocultar</button>
                  : <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" disabled={busy} onClick={() => onShow(t)} aria-label={`Mostrar ${t.title}`}><Eye className="h-3.5 w-3.5" aria-hidden /> Mostrar</button>}
                <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px] !text-destructive" disabled={busy || t.claims.total > 0} onClick={() => onDelete(t)}
                  aria-label={`Apagar ${t.title}`} title={t.claims.total > 0 ? "Tem pedidos: oculte em vez de apagar" : undefined}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TierDialog tier={target} open={dialogOpen} onClose={() => setDialogOpen(false)} onDone={refresh} />
      {confirmDialog}
      {sensitive.dialog}
    </div>
  );
}

const IconBtn = ({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="vp-ghost !h-9 !w-9 justify-center !p-0 disabled:opacity-40">{children}</button>
);

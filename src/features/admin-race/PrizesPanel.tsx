import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { AssetThumb } from "./AssetField";
import { PrizeDialog } from "./PrizeDialog";
import { callRpc } from "./raceApi";
import { holdersFor, prizeLabel, type PrizeItem, type RaceDetail } from "./raceModel";

/** Prêmios da corrida: por colocação ou por meta, na ordem em que o seller vê. */
export function PrizesPanel({ detail, onChanged }: { detail: RaceDetail; onChanged: () => void }) {
  const { race, prizes, board } = detail;
  const started = Date.parse(race.starts_at) <= Date.now();
  const { ask, dialog: confirmDialog } = useConfirm();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [target, setTarget] = useState<PrizeItem | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const openDialog = (p: PrizeItem | null) => { setTarget(p); setDialogOpen(true); setServerError(null); };

  const taken = prizes.filter((p) => p.kind === "place" && p.id !== target?.id).map((p) => p.position as number);
  let next = 1;
  while (taken.includes(next) || prizes.some((p) => p.kind === "place" && p.position === next)) next += 1;

  const move = useMutation({
    mutationFn: (a: { id: string; dir: "up" | "down" }) => callRpc("admin_move_race_prize", { _id: a.id, _dir: a.dir }),
    onSuccess: () => onChanged(),
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mudar a ordem.")),
  });

  const remove = useMutation({
    mutationFn: (p: PrizeItem) => callRpc("admin_delete_race_prize", { _id: p.id }),
    onSuccess: (_d, p) => { toast.success(`“${p.title}” foi apagado.`); onChanged(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível apagar o prêmio.")),
  });

  const onDelete = async (p: PrizeItem) => {
    setServerError(null);
    if (started) {
      sensitive.confirm(`Apagar o prêmio “${p.title}” de uma corrida que já começou. Os sellers deixam de vê-lo e isso não pode ser desfeito.`, async () => { await remove.mutateAsync(p).catch(() => undefined); });
      return;
    }
    const ok = await ask({ title: `Apagar “${p.title}”?`, tone: "danger", confirmLabel: "Apagar prêmio", icon: <Trash2 className="h-5 w-5" />, description: "O prêmio some da corrida. Isso não pode ser desfeito." });
    if (ok) remove.mutate(p);
  };

  const busy = move.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          {prizes.length === 0 ? "A corrida ainda não tem prêmios: os sellers disputam sem saber o que ganham." : "A ordem daqui é a ordem que o seller vê. Mudar a colocação ou a meta de uma corrida em andamento pede sua senha."}
        </p>
        <button type="button" className="vp-cta !h-10 gap-1.5 !px-4 !text-[13.5px]" onClick={() => openDialog(null)}><Plus className="h-4 w-4" aria-hidden /> Novo prêmio</button>
      </div>

      {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}

      {prizes.length === 0 ? <PremiumEmpty icon={Gift} title="Nenhum prêmio cadastrado" subtitle="Use “Novo prêmio” para criar o primeiro." /> : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Prêmios da corrida">
          {prizes.map((p, i) => {
            const holders = holdersFor(p, board);
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <AssetThumb url={p.image_url} alt={`Imagem de ${p.title}`} className="h-14 w-14" icon={<Gift className="h-5 w-5 text-muted-foreground" aria-hidden />} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[15px] font-bold text-foreground">{p.title}</span>
                      <ToneTag tone="neutral">{prizeLabel(p)}</ToneTag>
                    </p>
                    {p.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>}
                    <p className="text-[13px] text-muted-foreground">
                      {p.kind === "place"
                        ? (holders[0] ? `Hoje: ${holders[0].name}` : "Ninguém nesta posição ainda")
                        : (holders.length === 0 ? "Ninguém bateu a meta ainda" : `${holders.length.toLocaleString("pt-BR")} ${holders.length === 1 ? "participante bateu" : "participantes bateram"}`)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <IconBtn label={`Subir ${p.title}`} disabled={busy || i === 0} onClick={() => { setServerError(null); move.mutate({ id: p.id, dir: "up" }); }}><ArrowUp className="h-4 w-4" /></IconBtn>
                  <IconBtn label={`Descer ${p.title}`} disabled={busy || i === prizes.length - 1} onClick={() => { setServerError(null); move.mutate({ id: p.id, dir: "down" }); }}><ArrowDown className="h-4 w-4" /></IconBtn>
                  <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" disabled={busy} onClick={() => openDialog(p)} aria-label={`Editar ${p.title}`}><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</button>
                  <button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px] !text-destructive" disabled={busy} onClick={() => void onDelete(p)} aria-label={`Apagar ${p.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PrizeDialog prize={target} raceId={race.id} raceStarted={started} taken={taken} nextPosition={next} open={dialogOpen} onClose={() => setDialogOpen(false)} onDone={onChanged} />
      {confirmDialog}
      {sensitive.dialog}
    </div>
  );
}

const IconBtn = ({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="vp-ghost !h-9 !w-9 justify-center !p-0 disabled:opacity-40">{children}</button>
);

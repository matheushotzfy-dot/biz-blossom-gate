import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Gift, Loader2, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { AssetField } from "./AssetField";
import { callRpc } from "./raceApi";
import { LIMITS, prizeErrors, prizeNeedsPassword, reaisToCents, type PrizeForm, type PrizeItem } from "./raceModel";

const EMPTY: PrizeForm = { title: "", description: "", kind: "place", position: "", goal: "", image_url: "" };

const fromPrize = (p: PrizeItem): PrizeForm => ({
  title: p.title, description: p.description, kind: p.kind, position: p.position ? String(p.position) : "", goal: p.kind === "goal" ? toMaskedBRL(p.goal_cents / 100) : "", image_url: p.image_url ?? "",
});

/** Criar ou editar um prêmio da corrida: de uma colocação exata (1º, 2º…) ou de uma meta de faturamento. */
export function PrizeDialog({ prize, raceId, raceStarted, taken, nextPosition, open, onClose, onDone }: {
  prize: PrizeItem | null; raceId: string; raceStarted: boolean; taken: number[]; nextPosition: number; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const creating = prize === null;
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [f, setF] = useState<PrizeForm>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(prize ? fromPrize(prize) : { ...EMPTY, position: String(nextPosition) }); setTouched(false); setServerError(null);
  }, [open, prize, nextPosition]);

  const errors = prizeErrors(f, taken);
  const err = (k: keyof PrizeForm) => (touched ? errors[k] ?? null : null);
  const set = (k: keyof PrizeForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => callRpc("admin_save_race_prize", {
      _id: prize?.id ?? null, _race_id: raceId, _title: f.title.trim(), _description: f.description.trim(), _image_url: f.image_url.trim() || null,
      _kind: f.kind, _position: f.kind === "place" ? Number(f.position) : null, _goal_cents: f.kind === "goal" ? reaisToCents(parseBRL(f.goal)) : null,
    }),
    onSuccess: () => { toast.success(creating ? "Prêmio criado." : "Prêmio salvo."); onDone(); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar o prêmio. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    if (prizeNeedsPassword(raceStarted, prize, f)) {
      sensitive.confirm("A corrida já começou: mudar o que cada prêmio exige muda o que os sellers estão disputando.", async () => { await save.mutateAsync().catch(() => undefined); });
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Gift className="h-5 w-5" />} title={creating ? "Novo prêmio" : "Editar prêmio"} subtitle="Aparece na página da corrida dos sellers." />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <ChoiceGrid<PrizeForm["kind"]> label="Quem leva o prêmio" value={f.kind} onChange={(kind) => setF((p) => ({ ...p, kind }))}
              options={[
                { value: "place", label: "Uma colocação", description: "Só quem fecha naquela posição", icon: Trophy },
                { value: "goal", label: "Uma meta de faturamento", description: "Quem bater a meta leva", icon: Target },
              ]} />
            {f.kind === "place" ? (
              <FormField id="prize-position" label="Colocação" hint="1 é o primeiro lugar." error={err("position")}>
                <input id="prize-position" className="vp-field tabular-nums" inputMode="numeric" autoComplete="off" maxLength={3} value={f.position} onChange={set("position")} aria-invalid={err("position") ? true : undefined} />
              </FormField>
            ) : (
              <FormField id="prize-goal" label="Meta de faturamento" hint="Faturamento líquido de vendas pagas dentro da corrida." error={err("goal")}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                  <input id="prize-goal" className="vp-field tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" value={f.goal}
                    onChange={(e) => setF((p) => ({ ...p, goal: maskBRL(e.target.value) }))} aria-invalid={err("goal") ? true : undefined} />
                </div>
              </FormField>
            )}
            <FormField id="prize-title" label="Nome do prêmio" error={err("title")}>
              <input id="prize-title" className="vp-field" autoComplete="off" maxLength={LIMITS.prizeTitle} value={f.title} onChange={set("title")} aria-invalid={err("title") ? true : undefined} />
            </FormField>
            <FormField id="prize-description" label="Descrição" hint="Opcional." error={err("description")}>
              <textarea id="prize-description" className="vp-field resize-none" rows={2} maxLength={LIMITS.prizeDescription} value={f.description} onChange={set("description")} />
            </FormField>
            <AssetField id="prize-image" label="Imagem" raceId={raceId} kind="prize" value={f.image_url} onChange={(u) => setF((p) => ({ ...p, image_url: u }))} />
            {err("image_url") && <p role="alert" className="text-[12.5px] font-medium text-destructive">{err("image_url")}</p>}
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[150px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : creating ? "Criar prêmio" : "Salvar prêmio"}
            </button>
          </DialogFoot>
        </form>
        {sensitive.dialog}
      </DialogContent>
    </Dialog>
  );
}

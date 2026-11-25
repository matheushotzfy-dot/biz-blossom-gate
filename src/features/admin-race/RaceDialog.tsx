import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { AssetField } from "./AssetField";
import { callRpc } from "./raceApi";
import { LIMITS, fromSpInput, raceErrors, raceNeedsPassword, toSpInput, type RaceForm, type RaceItem } from "./raceModel";

const DAY = 86_400_000;

/** Início amanhã às 0h e fim 30 dias depois, no horário de Brasília. */
function defaultForm(): RaceForm {
  const tomorrow = toSpInput(new Date(Date.now() + DAY).toISOString()).slice(0, 10);
  const starts = `${tomorrow}T00:00`;
  const startIso = fromSpInput(starts) ?? new Date().toISOString();
  return { title: "", description: "", starts, ends: toSpInput(new Date(Date.parse(startIso) + 30 * DAY).toISOString()), banner_url: "", logo_url: "" };
}

const fromRace = (r: RaceItem): RaceForm => ({
  title: r.title, description: r.description, starts: toSpInput(r.starts_at), ends: toSpInput(r.ends_at), banner_url: r.banner_url ?? "", logo_url: r.logo_url ?? "",
});

/** Criar ou editar uma corrida. A corrida nova nasce oculta: os sellers só veem depois de "Colocar no ar". */
export function RaceDialog({ race, open, onClose, onDone }: { race: RaceItem | null; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const creating = race === null;
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [f, setF] = useState<RaceForm>(defaultForm);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(race ? fromRace(race) : defaultForm()); setTouched(false); setServerError(null);
  }, [open, race]);

  const errors = raceErrors(f);
  const err = (k: keyof RaceForm) => (touched ? errors[k] ?? null : null);
  const set = (k: keyof RaceForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const out = await callRpc("admin_save_race", {
        _id: race?.id ?? null, _title: f.title.trim(), _description: f.description.trim(), _starts_at: fromSpInput(f.starts), _ends_at: fromSpInput(f.ends),
        _banner_url: f.banner_url.trim() || null, _logo_url: f.logo_url.trim() || null,
      });
      return (out as { id?: string } | null)?.id ?? race?.id ?? "";
    },
    onSuccess: (id) => { toast.success(creating ? "Corrida criada, oculta. Coloque no ar quando estiver pronta." : "Corrida salva."); onDone(id); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar a corrida. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    if (raceNeedsPassword(race, f)) {
      sensitive.confirm("Mudar o início ou o fim de uma corrida que já começou muda quais vendas contam e, com isso, quem vence.", async () => { await save.mutateAsync().catch(() => undefined); });
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Flag className="h-5 w-5" />} title={creating ? "Nova corrida" : "Editar corrida"}
          subtitle={creating ? "Nasce oculta: os sellers só veem depois que você colocar no ar." : "Início e fim valem no horário de Brasília."} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <FormField id="race-title" label="Nome da corrida" error={err("title")}>
              <input id="race-title" className="vp-field" autoFocus={creating} autoComplete="off" maxLength={LIMITS.title} value={f.title} onChange={set("title")} aria-invalid={err("title") ? true : undefined} />
            </FormField>
            <FormField id="race-description" label="Descrição" hint="Aparece para os sellers no topo da corrida." error={err("description")}>
              <textarea id="race-description" className="vp-field resize-none" rows={3} maxLength={LIMITS.description} value={f.description} onChange={set("description")} />
            </FormField>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <FormField id="race-starts" label="Início" hint="Horário de Brasília." error={err("starts")}>
                <input id="race-starts" type="datetime-local" className="vp-field tabular-nums" value={f.starts} onChange={set("starts")} aria-invalid={err("starts") ? true : undefined} />
              </FormField>
              <FormField id="race-ends" label="Fim" hint="Só vendas até aqui contam." error={err("ends")}>
                <input id="race-ends" type="datetime-local" className="vp-field tabular-nums" value={f.ends} onChange={set("ends")} aria-invalid={err("ends") ? true : undefined} />
              </FormField>
            </div>
            {creating ? (
              <p className="rounded-[12px] bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">Depois de criar a corrida, edite para enviar o banner e o logo.</p>
            ) : (
              <div className="space-y-5">
                <AssetField id="race-banner" label="Banner" raceId={race.id} kind="banner" value={f.banner_url} onChange={(u) => setF((p) => ({ ...p, banner_url: u }))} />
                <AssetField id="race-logo" label="Logo" raceId={race.id} kind="logo" value={f.logo_url} onChange={(u) => setF((p) => ({ ...p, logo_url: u }))} />
              </div>
            )}
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[150px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : creating ? "Criar corrida" : "Salvar corrida"}
            </button>
          </DialogFoot>
        </form>
        {sensitive.dialog}
      </DialogContent>
    </Dialog>
  );
}

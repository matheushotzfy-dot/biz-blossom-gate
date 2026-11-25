import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { callRpc } from "./goalsApi";
import { LIMITS, fromSpInput, goalErrors, goalNeedsPassword, toSpInput, type GoalCore, type GoalForm } from "./goalsModel";

const DAY = 86_400_000;

/** Começa hoje à meia-noite e termina 30 dias depois, no horário de Brasília. */
function defaultForm(): GoalForm {
  const today = toSpInput(new Date().toISOString()).slice(0, 10);
  const starts = `${today}T00:00`;
  const startIso = fromSpInput(starts) ?? new Date().toISOString();
  return { title: "", description: "", target: "", starts, ends: toSpInput(new Date(Date.parse(startIso) + 30 * DAY).toISOString()), reward_title: "", reward_description: "" };
}

const fromGoal = (g: GoalCore): GoalForm => ({
  title: g.title, description: g.description, target: toMaskedBRL(g.target), starts: toSpInput(g.starts_at), ends: toSpInput(g.ends_at),
  reward_title: g.reward_title, reward_description: g.reward_description,
});

/**
 * Criar ou editar uma meta. A meta nova nasce oculta. Com prêmio já registrado, valor e datas ficam travados
 * (o servidor recusa): mudar isso mudaria quem bateu a meta depois de o prêmio ter sido tratado.
 */
export function GoalDialog({ goal, locked, open, onClose, onDone }: { goal: GoalCore | null; locked: boolean; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const creating = goal === null;
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [f, setF] = useState<GoalForm>(defaultForm);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(goal ? fromGoal(goal) : defaultForm()); setTouched(false); setServerError(null);
  }, [open, goal]);

  const errors = goalErrors(f);
  const err = (k: keyof GoalForm) => (touched ? errors[k] ?? null : null);
  const set = (k: keyof GoalForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const out = await callRpc("admin_save_goal", {
        _id: goal?.id ?? null, _title: f.title.trim(), _description: f.description.trim(), _target: parseBRL(f.target),
        _starts_at: fromSpInput(f.starts), _ends_at: fromSpInput(f.ends), _reward_title: f.reward_title.trim(), _reward_description: f.reward_description.trim(),
      });
      return (out as { id?: string } | null)?.id ?? goal?.id ?? "";
    },
    onSuccess: (id) => { toast.success(creating ? "Meta criada, oculta. Coloque no ar quando estiver pronta." : "Meta salva."); onDone(id); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar a meta. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    if (goalNeedsPassword(goal, f)) {
      sensitive.confirm("Mudar o valor, o início ou o fim de uma meta que já começou muda quais vendas contam e quem bateu a meta.", async () => { await save.mutateAsync().catch(() => undefined); });
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Target className="h-5 w-5" />} title={creating ? "Nova meta" : "Editar meta"}
          subtitle={creating ? "Nasce oculta: você coloca no ar quando estiver pronta." : "Início e fim valem no horário de Brasília."} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <FormField id="goal-title" label="Nome da meta" error={err("title")}>
              <input id="goal-title" className="vp-field" autoFocus={creating} autoComplete="off" maxLength={LIMITS.title} value={f.title} onChange={set("title")} aria-invalid={err("title") ? true : undefined} />
            </FormField>
            <FormField id="goal-description" label="Descrição" hint="Regras ou observações da meta. Só a equipe vê por enquanto." error={err("description")}>
              <textarea id="goal-description" className="vp-field resize-none" rows={2} maxLength={LIMITS.description} value={f.description} onChange={set("description")} />
            </FormField>

            {locked && (
              <p role="status" className="rounded-[12px] bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                Esta meta já tem prêmio registrado, então o valor e as datas não mudam mais. Para outra regra, crie uma nova meta.
              </p>
            )}
            <FormField id="goal-target" label="Valor da meta" hint="Soma do valor líquido das vendas pagas do seller dentro do período." error={err("target")}>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                <input id="goal-target" className="vp-field tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" disabled={locked}
                  value={f.target} onChange={(e) => setF((p) => ({ ...p, target: maskBRL(e.target.value) }))} aria-invalid={err("target") ? true : undefined} />
              </div>
            </FormField>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <FormField id="goal-starts" label="Início" hint="Horário de Brasília." error={err("starts")}>
                <input id="goal-starts" type="datetime-local" className="vp-field tabular-nums" disabled={locked} value={f.starts} onChange={set("starts")} aria-invalid={err("starts") ? true : undefined} />
              </FormField>
              <FormField id="goal-ends" label="Fim" hint="Só vendas até aqui contam." error={err("ends")}>
                <input id="goal-ends" type="datetime-local" className="vp-field tabular-nums" disabled={locked} value={f.ends} onChange={set("ends")} aria-invalid={err("ends") ? true : undefined} />
              </FormField>
            </div>

            <FormField id="goal-reward" label="Prêmio" error={err("reward_title")}>
              <input id="goal-reward" className="vp-field" autoComplete="off" maxLength={LIMITS.rewardTitle} value={f.reward_title} onChange={set("reward_title")} aria-invalid={err("reward_title") ? true : undefined} />
            </FormField>
            <FormField id="goal-reward-details" label="Detalhes do prêmio" hint="Como será entregue, prazo, condições." error={err("reward_description")}>
              <textarea id="goal-reward-details" className="vp-field resize-none" rows={2} maxLength={LIMITS.description} value={f.reward_description} onChange={set("reward_description")} />
            </FormField>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[150px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : creating ? "Criar meta" : "Salvar meta"}
            </button>
          </DialogFoot>
        </form>
        {sensitive.dialog}
      </DialogContent>
    </Dialog>
  );
}

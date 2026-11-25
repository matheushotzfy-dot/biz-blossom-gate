import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, ToggleRow, GroupBox, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { safeNavigationUrl } from "@/lib/safeUrl";
import { callRpc } from "./rewardsApi";
import { TIER_LIMITS, brl0, rewardsFromText, rewardsToText, tierErrors, tierImpact, tierNeedsPassword, type TierForm, type TierItem } from "./rewardsModel";

const EMPTY: TierForm = { title: "", tier: "", value: "", description: "", phrase: "", rewards: "", image_url: "" };

const fromTier = (t: TierItem): TierForm => ({
  title: t.title, tier: t.tier, value: toMaskedBRL(t.value), description: t.description, phrase: t.phrase, rewards: rewardsToText(t.rewards), image_url: t.image_url ?? "",
});

/** Criar ou editar uma peça da página de Premiações dos sellers. Peça nova nasce oculta: revise e ligue na lista. */
export function TierDialog({ tier, open, onClose, onDone }: { tier: TierItem | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const creating = tier === null;
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [f, setF] = useState<TierForm>(EMPTY);
  const [active, setActive] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(tier ? fromTier(tier) : EMPTY); setActive(tier?.is_active ?? false); setTouched(false); setServerError(null);
  }, [open, tier]);

  const value = parseBRL(f.value);
  const errors = tierErrors(f, value);
  const set = (k: keyof TierForm) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const err = (k: keyof TierForm) => (touched ? errors[k] ?? null : null);
  const preview = f.image_url.trim() ? safeNavigationUrl(f.image_url) : null;

  const save = useMutation({
    mutationFn: () => callRpc("admin_save_award_tier", {
      _id: tier?.id ?? null, _create: creating, _title: f.title.trim(), _tier: f.tier.trim(), _value: value, _description: f.description.trim(), _phrase: f.phrase.trim(),
      _rewards: rewardsFromText(f.rewards), _image_url: f.image_url.trim() || null, _is_active: creating ? false : active,
    }),
    onSuccess: () => { toast.success(creating ? "Peça criada, oculta. Ligue na lista quando estiver pronta." : "Peça salva."); onDone(); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar a peça. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    if (tierNeedsPassword(tier, value, active)) {
      const parts: string[] = [];
      if (tier && tier.value !== value) parts.push(`A meta muda de ${brl0(tier.value)} para ${brl0(value)}: quem já bateu a meta antiga ou ainda não bateu a nova passa a ver outra coisa.`);
      if (tier && !tier.is_active && active) parts.push("A peça passa a aparecer para todos os sellers.");
      sensitive.confirm(parts.join(" "), async () => { await save.mutateAsync().catch(() => undefined); });
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Package className="h-5 w-5" />} title={creating ? "Nova peça" : "Editar peça"} subtitle={creating ? "Nasce oculta: os sellers só veem depois que você ligar." : tier ? tierImpact(tier) : undefined} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <FormField id="tier-title" label="Nome da peça" error={err("title")} className="sm:col-span-2">
                <input id="tier-title" className="vp-field" autoFocus={creating} autoComplete="off" maxLength={TIER_LIMITS.title} value={f.title} onChange={set("title")} aria-invalid={err("title") ? true : undefined} />
              </FormField>
              <FormField id="tier-value" label="Meta de faturamento" hint="Faturamento líquido de vendas pagas." error={err("value")}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                  <input id="tier-value" className="vp-field tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" value={f.value} onChange={(e) => setF((p) => ({ ...p, value: maskBRL(e.target.value) }))} aria-invalid={err("value") ? true : undefined} />
                </div>
              </FormField>
              <FormField id="tier-tier" label="Nível" hint="Opcional. Ex.: Bronze, Elite." error={err("tier")}>
                <input id="tier-tier" className="vp-field" autoComplete="off" maxLength={TIER_LIMITS.tier} value={f.tier} onChange={set("tier")} />
              </FormField>
            </div>
            <FormField id="tier-rewards" label="O que o seller recebe" hint="Um item por linha. Até 8 itens." error={err("rewards")}>
              <textarea id="tier-rewards" className="vp-field resize-none" rows={3} value={f.rewards} onChange={set("rewards")} aria-invalid={err("rewards") ? true : undefined} />
            </FormField>
            <FormField id="tier-description" label="Descrição" hint="Em branco, o seller vê o texto padrão da peça." error={err("description")}>
              <textarea id="tier-description" className="vp-field resize-none" rows={2} maxLength={TIER_LIMITS.description} value={f.description} onChange={set("description")} />
            </FormField>
            <FormField id="tier-phrase" label="Frase da peça" hint="Em branco, o seller vê a frase padrão." error={err("phrase")}>
              <input id="tier-phrase" className="vp-field" autoComplete="off" maxLength={TIER_LIMITS.phrase} value={f.phrase} onChange={set("phrase")} />
            </FormField>
            <FormField id="tier-image" label="Imagem da peça" hint="Link de uma imagem. Em branco, o seller vê a arte padrão ou uma placa." error={err("image_url")}>
              <input id="tier-image" className="vp-field" inputMode="url" autoComplete="off" placeholder="https://" value={f.image_url} onChange={set("image_url")} aria-invalid={err("image_url") ? true : undefined} />
            </FormField>
            {preview && <img src={preview} alt="Prévia da imagem da peça" referrerPolicy="no-referrer" className="h-28 w-auto max-w-full rounded-[14px] bg-muted/40 object-contain" />}
            {!creating && (
              <GroupBox>
                <ToggleRow icon={<Eye className="h-[18px] w-[18px]" />} title="Aparece para os sellers" description={active ? "Visível na página de Premiações." : "Oculta: ninguém vê nem pede esta peça."}>
                  <Switch checked={active} onCheckedChange={setActive} aria-label="Mostrar a peça para os sellers" />
                </ToggleRow>
              </GroupBox>
            )}
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[150px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : creating ? "Criar peça" : "Salvar peça"}
            </button>
          </DialogFoot>
        </form>
        {sensitive.dialog}
      </DialogContent>
    </Dialog>
  );
}

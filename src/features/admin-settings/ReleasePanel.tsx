import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/seller-ui/form";
import { Chip } from "./Chip";
import type { SellerHit } from "@/features/admin-referrals/referralsModel";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ReasonDialog } from "./ReasonDialog";
import { SellerPicker } from "./SellerPicker";
import { SETTINGS_KEY, callRpc } from "./settingsApi";
import { RELEASE_OPTIONS, REASON_PRESETS, releaseLabel, whenLabel, type ReleaseOverride, type SettingsData } from "./settingsModel";

const ChipRow = ({ value, onPick, label }: { value: number | null; onPick: (d: number) => void; label: string }) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {RELEASE_OPTIONS.map((d) => <Chip key={d} active={d === value} onClick={() => onPick(d)} className="min-w-[72px] tabular-nums">{releaseLabel(d)}</Chip>)}
  </div>
);

export function ReleasePanel({ data }: { data: SettingsData }) {
  const qc = useQueryClient();
  const r = data.release;
  const [pick, setPick] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ seller: SellerHit | null; days: number | null } | null>(null);
  const [remove, setRemove] = useState<ReleaseOverride | null>(null);
  // guardam o último alvo para o texto não sumir durante a animação de fechar
  const [lastPick, setLastPick] = useState<number>(r.globalDays);
  const [lastRemove, setLastRemove] = useState<ReleaseOverride | null>(null);

  return (
    <PremiumPanel title="Liberação do cartão" icon={CalendarClock}>
      <p className="mb-5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        Quanto tempo o valor de uma venda no cartão fica retido antes de virar saldo. A mudança vale só para as vendas feitas depois dela: as anteriores mantêm a data que já tinham.
      </p>

      <FieldLabel hint={r.updatedAt ? `Alterado ${whenLabel(r.updatedAt)}${r.updatedBy ? `, por ${r.updatedBy}` : ""}.` : "Prazo de fábrica, ainda não alterado."}>Prazo padrão</FieldLabel>
      <ChipRow value={r.globalDays} label="Prazo padrão do cartão" onPick={(d) => { if (d !== r.globalDays) { setLastPick(d); setPick(d); } }} />

      <div className="mt-6 border-t border-border/50 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Exceções por seller</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {r.overridesTotal === 0 ? `Todos seguem ${releaseLabel(r.globalDays)}.` : `${r.overridesTotal} ${r.overridesTotal === 1 ? "seller tem" : "sellers têm"} prazo próprio.`}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setEdit({ seller: null, days: null })}><Plus className="h-3.5 w-3.5" /> Adicionar exceção</Button>
        </div>
        {r.overrides.length > 0 && (
          <ul className="divide-y divide-border/50">
            {r.overrides.map((o) => (
              <li key={o.user_id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground">{o.name}</p>
                  {o.email && o.email !== o.name && <p className="truncate text-[12.5px] text-muted-foreground">{o.email}</p>}
                </div>
                <span className="vp-pill !h-8 shrink-0 bg-accent px-3 text-[13px] font-semibold tabular-nums text-accent-foreground" aria-label={`Prazo de ${o.name}: ${releaseLabel(o.days)}`}>{releaseLabel(o.days)}</span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Alterar prazo" aria-label={`Alterar prazo de ${o.name}`} onClick={() => setEdit({ seller: { user_id: o.user_id, name: o.name, email: o.email }, days: o.days })}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" title="Remover prazo próprio" aria-label={`Remover prazo de ${o.name}`} onClick={() => { setLastRemove(o); setRemove(o); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {r.overridesTotal > r.overrides.length && <p className="mt-2 text-[12.5px] text-muted-foreground">Mostrando os {r.overrides.length} mais recentes de {r.overridesTotal}.</p>}
      </div>

      <ReasonDialog open={pick !== null} onClose={() => setPick(null)} icon={<CalendarClock className="h-5 w-5" />} title="Mudar o prazo padrão?"
        subtitle={`${releaseLabel(r.globalDays)} → ${releaseLabel(lastPick)}`} confirmLabel="Mudar prazo" reason="required" presets={REASON_PRESETS.release}
        confirmText={`Prazo padrão do cartão: de ${releaseLabel(r.globalDays)} para ${releaseLabel(lastPick)}. Vale para as vendas feitas daqui para frente, em todos os sellers sem prazo próprio.`}
        onSubmit={async (reason) => {
          await callRpc("admin_set_card_release", { _user_id: null, _days: lastPick, _reason: reason });
          toast.success(`Prazo padrão agora é ${releaseLabel(lastPick)}.`);
          await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
        }}>
        <p className="text-[14px] leading-relaxed text-foreground/90">
          As próximas vendas no cartão ficam retidas por {lastPick === 1 ? "1 dia" : `${lastPick} dias`}. Sellers com prazo próprio não mudam, e as vendas já feitas mantêm a data de liberação que tinham.
        </p>
      </ReasonDialog>

      <SellerDialog state={edit} onClose={() => setEdit(null)} globalDays={r.globalDays} />

      <ReasonDialog open={!!remove} onClose={() => setRemove(null)} icon={<Trash2 className="h-5 w-5" />} title="Remover o prazo próprio?"
        subtitle={lastRemove?.name} confirmLabel="Remover prazo" danger reason="required" presets={REASON_PRESETS.release}
        confirmText={`Remover o prazo próprio de ${lastRemove?.name ?? "este seller"}: ele volta ao padrão, ${releaseLabel(r.globalDays)}.`}
        onSubmit={async (reason) => {
          await callRpc("admin_clear_card_release", { _user_id: lastRemove!.user_id, _reason: reason });
          toast.success("Prazo próprio removido. O seller foi avisado.");
          await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
        }}>
        <p className="text-[14px] leading-relaxed text-foreground/90">
          {lastRemove?.name} volta ao prazo padrão ({releaseLabel(r.globalDays)}) nas próximas vendas e é avisado. As vendas já feitas mantêm a data que tinham.
        </p>
      </ReasonDialog>
    </PremiumPanel>
  );
}

function SellerDialog({ state, onClose, globalDays }: { state: { seller: SellerHit | null; days: number | null } | null; onClose: () => void; globalDays: number }) {
  const qc = useQueryClient();
  const open = !!state;
  const editing = !!state?.seller;
  const [seller, setSeller] = useState<SellerHit | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (state) { setSeller(state.seller); setDays(state.days); setTouched(false); } }, [state]);

  const problem = !seller ? "Escolha o seller." : days === null ? "Escolha o prazo." : null;
  return (
    <ReasonDialog open={open} onClose={onClose} icon={<CalendarClock className="h-5 w-5" />} title={editing ? "Alterar o prazo do seller" : "Adicionar exceção de prazo"}
      subtitle="Vale só para ele, nas próximas vendas no cartão." confirmLabel="Salvar prazo" reason="required" presets={REASON_PRESETS.release}
      extraProblem={problem} onTouched={() => setTouched(true)}
      confirmText={`Prazo do cartão de ${seller?.name ?? "seller"}: ${days === null ? "" : releaseLabel(days)}. Vale para as vendas feitas daqui para frente.`}
      onSubmit={async (reason) => {
        await callRpc("admin_set_card_release", { _user_id: seller!.user_id, _days: days, _reason: reason });
        toast.success(`Prazo de ${seller!.name} agora é ${releaseLabel(days!)}. O seller foi avisado.`);
        await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      }}>
      {editing ? (
        <div>
          <FieldLabel>Seller</FieldLabel>
          <p className="text-[14.5px] font-bold text-foreground">{seller?.name}</p>
          {seller?.email && <p className="text-[13px] text-muted-foreground">{seller.email}</p>}
        </div>
      ) : (
        <SellerPicker id="settings-release-seller" value={seller} onChange={setSeller} error={touched && !seller ? "Escolha o seller." : null} />
      )}
      <div>
        <FieldLabel hint={`O padrão da plataforma é ${releaseLabel(globalDays)}.`}>Prazo</FieldLabel>
        <ChipRow value={days} label="Prazo do seller" onPick={setDays} />
        {touched && days === null && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">Escolha o prazo.</p>}
      </div>
    </ReasonDialog>
  );
}

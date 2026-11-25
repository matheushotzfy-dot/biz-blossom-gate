import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Percent, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ReasonDialog } from "./ReasonDialog";
import { SETTINGS_KEY, callRpc } from "./settingsApi";
import { REASON_PRESETS, checkFee, feeInputText, feeShortName, fmtFee, groupFees, type FeeLine, type SettingsData } from "./settingsModel";

export function FeesPanel({ data }: { data: SettingsData }) {
  const [resetOpen, setResetOpen] = useState(false);
  const groups = groupFees(data.fees);
  const n = data.individualFeeSellers;
  return (
    <PremiumPanel title="Taxas da plataforma" icon={Percent}>
      <p className="mb-5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        Valem para todo seller que não tem taxa própria e aparecem para ele em Taxas e prazos. A taxa de saque já vale nos próximos saques. As taxas de venda passam a ser cobradas quando o checkout tiver adquirente.
      </p>
      {groups.length === 0 ? (
        <p className="py-6 text-[13px] text-muted-foreground">Nenhuma taxa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-6 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          {groups.map((g) => (
            <section key={g.id} aria-label={g.title}>
              <h3 className="mb-1 text-[13px] font-semibold text-foreground">{g.title}</h3>
              <div className="divide-y divide-border/50">
                {g.lines.map((f) => <FeeField key={f.id} fee={f} group={g.title} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {n === 0
              ? "Nenhum seller tem taxa própria: todos pagam as taxas acima."
              : <>{n === 1 ? "1 seller tem taxa própria" : `${n} sellers têm taxa própria`}. Ela vale no lugar das taxas acima, até você tirar.</>}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={n === 0} onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Voltar todos ao padrão
        </Button>
      </div>
      <ResetFeesDialog open={resetOpen} onClose={() => setResetOpen(false)} count={n} />
    </PremiumPanel>
  );
}

function FeeField({ fee, group }: { fee: FeeLine; group: string }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [text, setText] = useState(feeInputText(fee.value));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(feeInputText(fee.value)); setShown(false); }, [fee.value]);

  const res = checkFee(text, fee);
  const dirty = "value" in res ? res.value !== fee.value : text.trim() !== feeInputText(fee.value);
  const error = shown && "error" in res ? res.error : null;
  const id = `fee-${fee.id}`;

  const save = () => {
    setShown(true);
    if (!("value" in res) || res.value === fee.value) return;
    const to = res.value;
    const effect = fee.name === "Taxa de Saque" ? "Vale para os próximos saques." : "Vale para os sellers sem taxa própria.";
    sensitive.confirm(`${feeShortName(fee.name)}: de ${fmtFee(fee.fee_type, fee.value)} para ${fmtFee(fee.fee_type, to)}. ${effect}`, async () => {
      setBusy(true);
      try {
        await callRpc("admin_set_platform_fee", { _id: fee.id, _value: to });
        toast.success("Taxa salva.");
        await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      } catch (e) {
        toast.error(friendlyError(e, "Não foi possível salvar. Nada mudou."));
      } finally { setBusy(false); }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-[170px]">
        <label htmlFor={id} className="text-[14px] font-medium text-foreground">{fee.label}</label>
        {fee.hint && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{fee.hint}</p>}
      </div>
      <form className="flex items-center gap-2" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="relative w-[128px]">
          {fee.fee_type === "fixed" && <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">R$</span>}
          <input id={id} inputMode="decimal" autoComplete="off" aria-label={`${group}: ${fee.label}`} aria-invalid={!!error} aria-describedby={error ? `${id}-msg` : undefined}
            value={text} onChange={(e) => { setText(e.target.value); setShown(false); }} onBlur={() => setShown(true)} disabled={busy}
            style={{ paddingLeft: fee.fee_type === "fixed" ? 36 : 12, paddingRight: fee.fee_type === "percentage" ? 30 : 12 }}
            className="h-10 w-full rounded-xl border border-border bg-muted/30 text-right text-[14px] tabular-nums text-foreground focus:border-primary/40 focus:outline-none" />
          {fee.fee_type === "percentage" && <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>}
        </div>
        <div className="w-[84px]">
          {dirty && (
            <Button type="submit" size="sm" className="h-10 w-full" disabled={busy || ("error" in res)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : "Salvar"}
            </Button>
          )}
        </div>
      </form>
      {error && <p id={`${id}-msg`} role="alert" className="basis-full text-right text-[12.5px] font-medium text-destructive">{error}</p>}
      {sensitive.dialog}
    </div>
  );
}

function ResetFeesDialog({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const qc = useQueryClient();
  return (
    <ReasonDialog open={open} onClose={onClose} icon={<RotateCcw className="h-5 w-5" />} title="Voltar todos ao padrão?"
      subtitle={`${count} ${count === 1 ? "seller com taxa própria" : "sellers com taxa própria"}`}
      confirmLabel="Voltar ao padrão" danger reason="required" presets={REASON_PRESETS.fees}
      confirmText={`Zerar as taxas individuais de ${count} ${count === 1 ? "seller" : "sellers"}: todos passam a pagar as taxas da plataforma.`}
      onSubmit={async (reason) => {
        await callRpc("admin_reset_custom_fees", { _reason: reason });
        toast.success(count === 1 ? "Taxa individual removida. O seller foi avisado." : "Taxas individuais removidas. Os sellers foram avisados.");
        await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      }}>
      <p className="text-[14px] leading-relaxed text-foreground/90">
        {count === 1 ? "O seller" : "Os sellers"} passa{count === 1 ? "" : "m"} a pagar as taxas da plataforma e {count === 1 ? "é avisado" : "são avisados"}. Isso inclui taxas que gerentes definiram. O limite de ticket individual não muda.
      </p>
    </ReasonDialog>
  );
}

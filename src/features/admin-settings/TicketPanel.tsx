import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceGrid, FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { brl } from "@/features/admin-finance/types";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ReasonDialog } from "./ReasonDialog";
import { SETTINGS_KEY, callRpc } from "./settingsApi";
import { REASON_PRESETS, TICKET_SCOPES, checkTicket, whenLabel, type SettingsData, type TicketScope } from "./settingsModel";

export function TicketPanel({ data }: { data: SettingsData }) {
  const [open, setOpen] = useState(false);
  const t = data.maxTicket;
  return (
    <PremiumPanel title="Limite por venda" icon={Ticket}
      action={<Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Alterar limite</Button>}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">{brl(t.value)}</p>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {t.configured && t.updatedAt ? `Alterado ${whenLabel(t.updatedAt)}${t.updatedBy ? `, por ${t.updatedBy}` : ""}.` : "Valor de fábrica, ainda não alterado."}
          </p>
        </div>
        <p className="max-w-xl flex-1 basis-[280px] text-[13px] leading-relaxed text-muted-foreground">
          É o maior valor que uma venda pode ter para quem não tem limite próprio.{" "}
          {t.individual > 0
            ? `${t.individual} ${t.individual === 1 ? "seller tem" : "sellers têm"} limite próprio, definido em Sellers.`
            : "Nenhum seller tem limite próprio."}
        </p>
      </div>
      <TicketDialog open={open} onClose={() => setOpen(false)} data={data} />
    </PremiumPanel>
  );
}

function TicketDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: SettingsData }) {
  const qc = useQueryClient();
  const cur = data.maxTicket;
  const [text, setText] = useState("");
  const [scope, setScope] = useState<TicketScope>("new");
  const [shown, setShown] = useState(false);
  useEffect(() => { if (open) { setText(toMaskedBRL(cur.value)); setScope("new"); setShown(false); } }, [open, cur.value]);

  const value = parseBRL(text);
  const problem = checkTicket(value > 0 ? value : null) ?? (value === cur.value && scope === "new" ? "Esse já é o limite atual." : null);
  const id = "settings-ticket";

  return (
    <ReasonDialog open={open} onClose={onClose} icon={<Ticket className="h-5 w-5" />} title="Alterar o limite por venda"
      subtitle={`Hoje: ${brl(cur.value)}`} confirmLabel="Salvar limite" reason="required" presets={REASON_PRESETS.ticket}
      extraProblem={problem} onTouched={() => setShown(true)}
      confirmText={`Limite por venda: de ${brl(cur.value)} para ${brl(value)}, ${scope === "all" ? "para todos os sellers (limites individuais são apagados)" : "só para quem criar conta depois"}.`}
      onSubmit={async (reason) => {
        const r = await callRpc("admin_set_max_ticket", { _value: value, _scope: scope, _reason: reason }) as { sellers_kept?: number; overrides_cleared?: number } | null;
        const kept = r?.sellers_kept ?? 0;
        toast.success(scope === "all" ? "Limite aplicado a todos os sellers." : kept > 0 ? `Novo limite salvo. ${kept} ${kept === 1 ? "conta existente continua" : "contas existentes continuam"} com ${brl(cur.value)}.` : "Novo limite salvo.");
        await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      }}>
      <div>
        <FieldLabel htmlFor={id}>Novo limite</FieldLabel>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">R$</span>
          <input id={id} inputMode="numeric" autoComplete="off" className="vp-field tabular-nums" style={{ paddingLeft: 44 }} value={text}
            onChange={(e) => { setText(maskBRL(e.target.value)); setShown(false); }} aria-invalid={shown && !!problem} aria-describedby={`${id}-msg`} />
        </div>
        {shown && problem
          ? <p id={`${id}-msg`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>
          : <FieldHint><span id={`${id}-msg`}>Entre {brl(1)} e {brl(1_000_000)}.</span></FieldHint>}
      </div>
      <div>
        <FieldLabel>Para quem vale</FieldLabel>
        <ChoiceGrid<TicketScope> label="Para quem vale" columns={1} value={scope} onChange={setScope}
          options={TICKET_SCOPES.map((s) => ({ value: s.value, label: s.title, description: s.hint(cur.value, cur.individual) }))} />
      </div>
    </ReasonDialog>
  );
}

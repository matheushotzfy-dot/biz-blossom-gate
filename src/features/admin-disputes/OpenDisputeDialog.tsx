import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { brl } from "@/features/admin-finance/types";
import { friendlyError } from "@/lib/friendlyError";
import { SalePicker } from "./SalePicker";
import { TYPES, checkOpen, fitType, shortId, typeLabel, typeProblem, type DisputeType, type SaleHit } from "./disputesModel";

/** Abre uma disputa numa venda paga: o valor do seller fica congelado até a decisão. */
export function OpenDisputeDialog({ open, defaultType, onClose }: { open: boolean; defaultType: DisputeType | "all"; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const [sale, setSale] = useState<SaleHit | null>(null);
  const [type, setType] = useState<DisputeType>("medpix");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSale(null); setType(defaultType === "all" ? "medpix" : defaultType); setReason(""); setDays("7"); setTouched(false); setServerError(null);
  }, [open, defaultType]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_open_dispute" as never, { _transaction_id: sale!.id, _type: type, _reason: reason.trim(), _deadline_days: Number(days) } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${typeLabel(type)} aberto. O valor do seller está congelado.`);
      void qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível abrir. Nada foi congelado.")),
  });

  const problem = checkOpen(sale, type, reason, Number(days));
  const typeIssue = typeProblem(type, sale);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem || !sale) return;
    sensitive.confirm(`Abrir ${typeLabel(type)} na venda ${shortId(sale.id)} (${brl(sale.amount)}). O valor do seller fica congelado até a decisão.`, async () => { await create.mutateAsync().catch(() => undefined); });
  };
  const hint = TYPES.find((t) => t.value === type)?.hint;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !create.isPending) onClose(); }}>
        <DialogContent className={dialogBox("lg")}>
          <DialogHead icon={<Scale className="h-5 w-5" />} title="Abrir disputa" subtitle="Escolha a venda e o tipo. O seller é avisado e o dinheiro fica congelado." />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
            <DialogBody>
              <SalePicker value={sale} mode="dispute" onChange={(s) => { setSale(s); if (s) setType((t) => fitType(t, s)); }} />
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <ChoiceGrid<DisputeType> label="Tipo de disputa" value={type} onChange={setType} options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
                {typeIssue ? <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{typeIssue}</p> : <FieldHint>{hint}</FieldHint>}
              </div>
              <div>
                <FieldLabel htmlFor="od-reason" hint="O seller lê isto para montar a defesa.">Motivo</FieldLabel>
                <textarea id="od-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
                {touched && reason.trim().length < 5 && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">Explique o motivo (mínimo 5 caracteres).</p>}
              </div>
              <div className="max-w-[220px]">
                <FieldLabel htmlFor="od-days">Prazo de defesa do seller</FieldLabel>
                <div className="relative"><input id="od-days" className="vp-field" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))} style={{ paddingRight: 56 }} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">dias</span></div>
                {touched && !(Number(days) >= 1 && Number(days) <= 30) && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">De 1 a 30 dias.</p>}
              </div>
              {touched && !sale && <p role="alert" className="text-[13px] font-medium text-destructive">Escolha a venda.</p>}
            </DialogBody>
            {serverError && <DialogError>{serverError}</DialogError>}
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={create.isPending}>Cancelar</button>
              <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={create.isPending}>
                {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Abrindo…</> : "Abrir e congelar"}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
      {sensitive.dialog}
    </>
  );
}

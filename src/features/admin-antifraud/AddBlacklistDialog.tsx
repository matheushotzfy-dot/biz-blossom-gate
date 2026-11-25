import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import { ENTRY_TYPES, checkBlacklistInput, entryLabel, type EntryType } from "./antifraudModel";

export interface BlacklistPreset { type: EntryType; value: string }

/** Bloquear um CPF, CNPJ, e-mail, IP ou BIN. A validação de verdade é do servidor (`admin_blacklist_add`); aqui só se avisa antes de enviar. */
export function AddBlacklistDialog({ open, preset, onClose }: { open: boolean; preset: BlacklistPreset | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<EntryType>("cpf");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(preset?.type ?? "cpf"); setValue(preset?.value ?? ""); setReason(""); setTouched(false); setServerError(null);
  }, [open, preset]);

  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_blacklist_add" as never, { _type: type, _value: value, _reason: reason } as never);
      if (error) throw error;
      return data as unknown as { entry_value?: string; reactivated?: boolean } | null;
    },
    onSuccess: (data) => {
      toast.success(data?.reactivated ? `${entryLabel(type)} bloqueado de novo.` : `${entryLabel(type)} adicionado à blacklist.`);
      void logAdminAction("add_blacklist_ui", "global_blacklist", data?.entry_value ?? "", { entry_type: type });
      void qc.invalidateQueries({ queryKey: ["admin-blacklist"] });
      void qc.invalidateQueries({ queryKey: ["admin-antifraud-overview"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível adicionar. Nada foi bloqueado.")),
  });

  const meta = ENTRY_TYPES.find((t) => t.value === type)!;
  const problem = checkBlacklistInput(type, value, reason);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    add.mutate();
  };
  const valueError = touched && problem && !problem.startsWith("Explique") ? problem : null;
  const reasonError = touched && problem?.startsWith("Explique") ? problem : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !add.isPending) onClose(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<Ban className="h-5 w-5" />} title="Bloquear um dado" subtitle="Compras com esse dado deixam de ser aceitas assim que a cobrança estiver ativa." />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <DialogBody>
            <div className="space-y-5">
              <ChoiceGrid<EntryType> label="Tipo de dado" columns={3} value={type} onChange={(v) => { setType(v); setServerError(null); }}
                options={ENTRY_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
              <FormField id="bl-value" label="Valor" hint={meta.hint} error={valueError}>
                <input id="bl-value" className="vp-field" autoFocus value={value} placeholder={meta.placeholder} autoComplete="off" spellCheck={false}
                  onChange={(e) => setValue(e.target.value)} aria-invalid={valueError ? true : undefined} aria-describedby="bl-value-msg" />
              </FormField>
              <FormField id="bl-reason" label="Motivo" hint="Fica registrado com seu nome. Mínimo de 3 caracteres." error={reasonError}>
                <textarea id="bl-reason" className="vp-field resize-none" rows={3} maxLength={500} value={reason} placeholder="Ex.: chargeback recorrente, fraude confirmada"
                  onChange={(e) => setReason(e.target.value)} aria-invalid={reasonError ? true : undefined} aria-describedby="bl-reason-msg" />
              </FormField>
            </div>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" disabled={add.isPending} onClick={onClose}>Cancelar</button>
            <button type="submit" className="vp-cta vp-cta-danger !h-12 justify-center sm:min-w-[150px]" disabled={add.isPending}>
              {add.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Bloqueando…</> : "Bloquear"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

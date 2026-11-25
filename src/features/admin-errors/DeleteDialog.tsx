import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/seller-ui/form";
import { Chip } from "@/features/admin-settings/Chip";
import { ReasonDialog } from "@/features/admin-settings/ReasonDialog";
import { callRpc, useRefreshErrors } from "./errorsApi";
import { DELETE_PRESETS, DELETE_SCOPES, type DeleteScope } from "./errorsModel";

/** Apaga erros já resolvidos. Os abertos nunca são apagados: resolva primeiro. Pede motivo e a senha de novo, e fica na auditoria. */
export function DeleteDialog({ open, onClose, resolved }: { open: boolean; onClose: () => void; resolved: number }) {
  const refresh = useRefreshErrors();
  const [scope, setScope] = useState<DeleteScope>("resolved_old");
  useEffect(() => { if (open) setScope("resolved_old"); }, [open]);
  const current = DELETE_SCOPES.find((s) => s.value === scope)!;

  return (
    <ReasonDialog open={open} onClose={onClose} icon={<Trash2 className="h-5 w-5" />} title="Apagar erros resolvidos?"
      subtitle={`${resolved.toLocaleString("pt-BR")} ${resolved === 1 ? "erro resolvido" : "erros resolvidos"} hoje`}
      confirmLabel="Apagar" busyLabel="Apagando…" danger reason="required" presets={DELETE_PRESETS}
      confirmText={`Apagar erros: ${current.label.toLowerCase()}. Não dá para desfazer.`}
      onSubmit={async (reason) => {
        const out = (await callRpc("admin_delete_error_logs", { _scope: scope, _reason: reason })) as { deleted?: number } | null;
        const n = Number(out?.deleted ?? 0);
        toast.success(`${n.toLocaleString("pt-BR")} ${n === 1 ? "registro apagado" : "registros apagados"}.`);
        refresh();
      }}>
      <div>
        <FieldLabel htmlFor="errors-delete-scope">O que apagar</FieldLabel>
        <div id="errors-delete-scope" role="group" aria-label="O que apagar" className="flex flex-wrap gap-2">
          {DELETE_SCOPES.map((s) => <Chip key={s.value} active={scope === s.value} onClick={() => setScope(s.value)}>{s.label}</Chip>)}
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{current.effect} Não dá para desfazer.</p>
      </div>
    </ReasonDialog>
  );
}

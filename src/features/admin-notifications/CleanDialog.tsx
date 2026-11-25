import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FieldLabel } from "@/components/seller-ui/form";
import { Chip } from "@/features/admin-settings/Chip";
import { ReasonDialog } from "@/features/admin-settings/ReasonDialog";
import { friendlyError } from "@/lib/friendlyError";
import { callRpc, useRefreshNotifications } from "./notificationsApi";
import { CLEAN_PRESETS, CLEAN_SCOPES, cleanedText, parseCleanResult, type CleanScope } from "./notificationsModel";

/** Mais de 40 lotes de 20 mil são 800 mil linhas: passou disso, algo está errado e a tela para. */
const MAX_BATCHES = 40;

/**
 * Apaga notificações JÁ LIDAS. As que o seller ainda não abriu nunca são apagadas aqui.
 * O banco apaga em lotes de 20 mil; a tela repete até acabar e mostra o andamento.
 */
export function CleanDialog({ open, onClose, readOld, readAll }: { open: boolean; onClose: () => void; readOld: number; readAll: number }) {
  const refresh = useRefreshNotifications();
  const [scope, setScope] = useState<CleanScope>("read_old");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => { if (open) { setScope("read_old"); setProgress(null); } }, [open]);
  const current = CLEAN_SCOPES.find((s) => s.value === scope)!;
  const n = scope === "read_old" ? readOld : readAll;
  const fmt = (v: number) => v.toLocaleString("pt-BR");

  return (
    <ReasonDialog open={open} onClose={onClose} icon={<Trash2 className="h-5 w-5" />} title="Apagar notificações lidas?"
      subtitle={`${fmt(readAll)} ${readAll === 1 ? "notificação lida" : "notificações lidas"} hoje`}
      confirmLabel="Apagar" busyLabel={progress ? `Apagando… ${fmt(progress.done)}` : "Apagando…"} danger reason="required" presets={CLEAN_PRESETS}
      confirmText={`Apagar notificações: ${current.label.toLowerCase()} (${fmt(n)}). Não dá para desfazer.`}
      extraProblem={n === 0 ? "Não há notificações nesta opção." : null}
      onSubmit={async (reason) => {
        let done = 0;
        let remaining = 1;
        let calls = 0;
        setProgress({ done: 0, total: n });
        try {
          while (remaining > 0 && calls < MAX_BATCHES) {
            const out = parseCleanResult(await callRpc("admin_clean_notifications", { _scope: scope, _reason: reason }));
            done += out.deleted; remaining = out.remaining; calls += 1;
            setProgress({ done, total: Math.max(n, done + remaining) });
            if (out.deleted === 0) break;
          }
        } catch (e) {
          refresh();
          // parou no meio: o que já foi apagado continua apagado, e dá para repetir para continuar
          if (done > 0) throw new Error(`Apagou ${fmt(done)} e parou: ${friendlyError(e, "falha no servidor")}. Tente de novo para continuar.`);
          throw e;
        } finally { setProgress(null); }
        toast.success(cleanedText(done));
        refresh();
      }}>
      <div>
        <FieldLabel htmlFor="notifications-clean-scope">O que apagar</FieldLabel>
        <div id="notifications-clean-scope" role="group" aria-label="O que apagar" className="flex flex-wrap gap-2">
          {CLEAN_SCOPES.map((s) => <Chip key={s.value} active={scope === s.value} onClick={() => setScope(s.value)}>{`${s.label} · ${fmt(s.value === "read_old" ? readOld : readAll)}`}</Chip>)}
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{current.effect} As que o seller ainda não abriu ficam. Não dá para desfazer.</p>
        {n === 0 && <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">Não há notificações nesta opção.</p>}
        {progress && (
          <p role="status" className="mt-3 text-[13.5px] font-medium text-foreground">
            Apagando… {fmt(progress.done)} de {fmt(progress.total)}
          </p>
        )}
      </div>
    </ReasonDialog>
  );
}

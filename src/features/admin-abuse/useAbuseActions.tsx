import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { scopeLabel, shortHash, type Lockout } from "./abuseModel";

/** Liberar um IP em quarentena ou um login travado: motivo escrito, senha de novo e só então a RPC. */
export function useAbuseActions() {
  const qc = useQueryClient();
  const { ask, dialog: reasonDialog } = useReason();
  const sensitive = useSensitiveConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    for (const k of ["admin-abuse-waiting", "admin-abuse-ips", "admin-abuse-overview"]) void qc.invalidateQueries({ queryKey: [k] });
  };

  const releaseBlock = async (id: string, ipHash: string) => {
    const reason = await ask({
      title: "Liberar este IP?", label: "Motivo", minLength: 3, confirmLabel: "Continuar", tone: "warning", placeholder: "Ex.: era uma rede de escritório",
      description: `O IP ${shortHash(ipHash)} volta a poder tentar o login agora. A liberação fica registrada com o seu nome.`,
    });
    if (!reason) return;
    sensitive.confirm(`Liberar o IP ${shortHash(ipHash)} da quarentena.`, async () => {
      setBusy(id);
      const { error } = await supabase.rpc("admin_abuse_release_block" as never, { _id: id, _reason: reason } as never);
      setBusy(null);
      if (error) { toast.error("Não foi possível liberar. O IP continua em quarentena.", { description: friendlyError(error, "Tente de novo em instantes.") }); return; }
      toast.success("IP liberado.");
      refresh();
    });
  };

  const releaseLockout = async (l: Lockout) => {
    const who = l.kind === "email" ? l.email ?? "este e-mail" : `o IP ${shortHash(l.ip_hash ?? "")}`;
    const reason = await ask({
      title: "Liberar este login?", label: "Motivo", minLength: 3, confirmLabel: "Continuar", tone: "warning", placeholder: "Ex.: cliente pediu ajuda pelo suporte",
      description: `${l.kind === "email" ? `${l.email} (${scopeLabel(l.scope)})` : `O IP ${shortHash(l.ip_hash ?? "")}`} volta a poder tentar a senha agora. Se alguém estiver tentando adivinhar, a trava volta depois de mais ${l.kind === "email" ? 5 : 20} erros.`,
    });
    if (!reason) return;
    sensitive.confirm(`Liberar o login travado de ${who}.`, async () => {
      const key = `${l.kind}:${l.email ?? l.ip_hash}`;
      setBusy(key);
      const { error } = await supabase.rpc("admin_release_login_lockout" as never, { _kind: l.kind, _scope: l.scope, _email: l.email, _ip_hash: l.ip_hash, _reason: reason } as never);
      setBusy(null);
      if (error) { toast.error("Não foi possível liberar. A trava continua.", { description: friendlyError(error, "Tente de novo em instantes.") }); return; }
      toast.success("Login liberado.");
      refresh();
    });
  };

  return { busy, releaseBlock, releaseLockout, dialogs: <>{reasonDialog}{sensitive.dialog}</> };
}

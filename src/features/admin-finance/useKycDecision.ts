import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendlyError";

/** Escolha do gerente no menu de aprovação: "default" e "none" não escolhem ninguém, qualquer outro valor é o id. */
export function managerForApproval(choice: string): string | null {
  return choice === "default" || choice === "none" ? null : choice;
}

export const MIN_KYC_REASON = 5;

/**
 * Aprovar ou recusar o cadastro de um seller. As duas ações notificam o seller, então só uma roda por vez:
 * o guarda é um ref (vale já no mesmo clique) e `busy` desliga os botões na tela.
 */
export function useKycDecision({ enabled, onDone }: { enabled: boolean; onDone: (userId: string, kind: "approved" | "rejected") => void }) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const guarded = useCallback(async (job: () => Promise<boolean>): Promise<boolean> => {
    if (!enabled || running.current) return false;
    running.current = true;
    setBusy(true);
    try { return await job(); } finally { running.current = false; setBusy(false); }
  }, [enabled]);

  const approve = useCallback((userId: string, managerChoice: string) => guarded(async () => {
    if (!userId) return false;
    const { error } = await supabase.rpc("admin_approve_seller_with_manager" as never, { _seller: userId, _manager: managerForApproval(managerChoice) } as never);
    if (error) { toast.error(friendlyError(error)); return false; }
    toast.success(managerChoice === "none" ? "KYC aprovado sem gerente." : "KYC aprovado e carteira atribuída.");
    onDone(userId, "approved");
    return true;
  }), [guarded, onDone]);

  const reject = useCallback((userId: string, rawReason: string) => guarded(async () => {
    const reason = rawReason.trim();
    if (!userId) return false;
    if (reason.length < MIN_KYC_REASON) { toast.error(`Explique o motivo da recusa em pelo menos ${MIN_KYC_REASON} caracteres`); return false; }
    const { error } = await supabase.rpc("admin_reject_kyc", { _user_id: userId, _reason: reason });
    if (error) { toast.error(friendlyError(error, "Não foi possível recusar o KYC.")); return false; }
    toast.success("KYC recusado. O seller recebeu o motivo.");
    onDone(userId, "rejected");
    return true;
  }), [guarded, onDone]);

  return { busy, approve, reject };
}

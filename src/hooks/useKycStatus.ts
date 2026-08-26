/**
 * useKycStatus — fonte única de verdade do estado de verificação da conta.
 *
 * Regras (válidas em TODAS as telas):
 *  - `profiles.account_status === "approved"` é a única prova de conta liberada.
 *    Nenhum indicador auxiliar (documentos no storage, dados bancários, cache
 *    local) pode reabrir avisos de KYC para uma conta aprovada.
 *  - Enquanto o perfil não resolveu (`resolved === false`), nada relacionado a
 *    KYC deve ser renderizado. Isso evita o "flash" de aviso em carregamentos
 *    paralelos (perfil + storage + saldo carregando ao mesmo tempo).
 *  - Sem sessão/perfil não assumimos pendência: apenas não resolvido.
 */
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export type KycState = "loading" | "approved" | "pending" | "pending_review" | "rejected" | "blocked";

export interface KycStatus {
  /** Estado normalizado do KYC. */
  state: KycState;
  /** Perfil já carregado e confiável para decisões de UI. */
  resolved: boolean;
  /** Conta liberada — única condição para esconder qualquer aviso de KYC. */
  approved: boolean;
  /** Documentos enviados e aguardando o time. */
  inReview: boolean;
  rejected: boolean;
  blocked: boolean;
  /** Deve exibir avisos/trilha de ativação (nunca durante o carregamento). */
  showOnboarding: boolean;
  /** Status cru do perfil, para telas que exibem o rótulo original. */
  rawStatus: string | null;
}

export function useKycStatus(): KycStatus {
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  return useMemo<KycStatus>(() => {
    const resolved = Boolean(user?.id) && !loading && Boolean(profile);
    const raw = profile?.account_status ?? null;

    if (!resolved) {
      return {
        state: "loading",
        resolved: false,
        approved: false,
        inReview: false,
        rejected: false,
        blocked: false,
        showOnboarding: false,
        rawStatus: raw,
      };
    }

    const approved = raw === "approved";
    const state: KycState = approved
      ? "approved"
      : raw === "pending_review"
        ? "pending_review"
        : raw === "rejected"
          ? "rejected"
          : raw === "blocked"
            ? "blocked"
            : "pending";

    return {
      state,
      resolved: true,
      approved,
      inReview: state === "pending_review",
      rejected: state === "rejected",
      blocked: state === "blocked",
      showOnboarding: !approved,
      rawStatus: raw,
    };
  }, [user?.id, loading, profile]);
}

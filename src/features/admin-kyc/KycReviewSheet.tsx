import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { managerForApproval } from "@/features/admin-finance/useKycDecision";
import { KycReviewPanel, type Decision } from "@/features/kyc/KycReviewPanel";
import { reviewActionError, type QueueItem } from "@/features/kyc/kycReviewModel";

const isRecentAuth = (err: unknown) => /reautentica|recent/i.test((err as { message?: string } | null)?.message ?? "");

/** Gerentes que podem receber o seller na aprovação. */
export function useManagerOptions(enabled = true) {
  return useQuery({
    queryKey: ["admin-manager-options"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: roles, error } = await supabase.from("user_roles").select("user_id").eq("role", "manager");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as { id: string; label: string }[];
      const { data, error: e2 } = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", ids);
      if (e2) throw e2;
      return (data ?? []).map((p) => ({ id: p.user_id, label: p.full_name || p.email || "Gerente sem nome" })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });
}

/**
 * Análise de uma verificação no admin. Aprovar usa `admin_approve_seller_with_manager` (exige senha confirmada nos
 * últimos 10 minutos: a senha só é pedida quando o servidor recusa, então quem analisa em sequência digita uma vez)
 * e reprovar usa `admin_reject_kyc` (motivo que o seller lê).
 */
export function KycReviewSheet({ sellerId, seed, onClose, onDecided }: {
  sellerId: string | null;
  seed: QueueItem | null;
  onClose: () => void;
  onDecided: (kind: "approved" | "rejected") => void;
}) {
  // guarda o último seller para o conteúdo não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: QueueItem | null } | null>(sellerId ? { id: sellerId, seed } : null);
  useEffect(() => { if (sellerId) setLast({ id: sellerId, seed }); }, [sellerId, seed]);
  const cur = sellerId ? { id: sellerId, seed } : last;
  const { confirm, dialog } = useSensitiveConfirm("Confirme sua senha");

  return (
    <>
      <Dialog open={!!sellerId} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className={dialogBox("wide")}>
          {cur && <Body key={cur.id} id={cur.id} seed={cur.seed} confirm={confirm} onDecided={onDecided} />}
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}

function Body({ id, seed, confirm, onDecided }: {
  id: string;
  seed: QueueItem | null;
  confirm: ReturnType<typeof useSensitiveConfirm>["confirm"];
  onDecided: (kind: "approved" | "rejected") => void;
}) {
  const [manager, setManager] = useState("default");
  const managers = useManagerOptions();
  const name = seed?.name ?? "Verificação";

  const onDecide = useCallback(async (kind: Decision, reason: string): Promise<string | null> => {
    if (kind === "reject") {
      const { error } = await supabase.rpc("admin_reject_kyc", { _user_id: id, _reason: reason });
      if (error) return reviewActionError(error);
      onDecided("rejected");
      return null;
    }
    const approve = () => supabase.rpc("admin_approve_seller_with_manager" as never, { _seller: id, _manager: managerForApproval(manager) } as never);
    const { error } = await approve();
    if (!error) { onDecided("approved"); return null; }
    if (!isRecentAuth(error)) return reviewActionError(error);
    return new Promise<string | null>((resolve) => {
      confirm(`Aprovar a verificação de ${name}. O seller é avisado e passa a operar.`, async () => {
        const again = await approve();
        if (again.error) { resolve(reviewActionError(again.error)); return; }
        onDecided("approved");
        resolve(null);
      }, () => resolve(null));
    });
  }, [confirm, id, manager, name, onDecided]);

  return (
    <>
      <DialogHead icon={<IdCard className="h-5 w-5" />} title={name}
        subtitle={seed ? [seed.email, `${seed.documentType === "cnpj" ? "CNPJ" : "CPF"} ${seed.documentMasked ?? "não informado"}`].filter(Boolean).join(" · ") : "Verificação de identidade"} />
      <DialogBody>
        <KycReviewPanel
          sellerId={id}
          onDecide={onDecide}
          stickyDecision
          decideLabel="A aprovação pode pedir sua senha."
          approveSlot={(
            <Select value={manager} onValueChange={setManager}>
              <SelectTrigger className="h-10 w-[220px] text-[13px]" aria-label="Gerente da carteira na aprovação"><SelectValue /></SelectTrigger>
              <SelectContent collisionPadding={16}>
                <SelectItem value="default">Gerente padrão</SelectItem>
                <SelectItem value="none">Sem gerente</SelectItem>
                {(managers.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
      </DialogBody>
    </>
  );
}

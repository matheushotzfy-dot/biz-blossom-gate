import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { newestByType, type StoredFile } from "./accountMeta";
import type { KycDocType } from "@/components/kyc/kycSteps";

/** Vendas aprovadas (reais, sem as simuladas). Só contagem: nada de baixar as linhas. */
export function useSalesCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["account-sales", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const base = () => supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("status", "completed").eq("is_simulated", false);
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [all, recent] = await Promise.all([base(), base().gte("created_at", since)]);
      if (all.error) throw all.error;
      if (recent.error) throw recent.error;
      return { total: all.count ?? 0, last30: recent.count ?? 0 };
    },
  });
}

/** Em quantos dias o dinheiro do cartão cai (ajuste da conta, senão o da plataforma). Falhar aqui não derruba a tela: o prazo some. */
export function useCardReleaseDays(userId: string | undefined) {
  return useQuery({
    queryKey: ["account-card-release", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_card_release_days" as never);
      if (error) throw error;
      return typeof data === "number" ? data : null;
    },
  });
}

export interface CustomFees {
  pix_percentage: number | null; pix_fixed: number | null;
  card_percentage: number | null; card_fixed: number | null;
  boleto_percentage: number | null; boleto_fixed: number | null;
  withdrawal_fee: number | null;
}

/** Taxas combinadas só para esta conta (quando o time ajustou). Sem linha = vale o padrão da plataforma. */
export function useCustomFees(userId: string | undefined) {
  return useQuery({
    queryKey: ["account-custom-fees", userId],
    enabled: !!userId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_user_fees")
        .select("pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as CustomFees | null) ?? null;
    },
  });
}

export interface KycDocFile { type: KycDocType; name: string; path: string; url: string | null; sentAt: string | null }
export interface KycDocsData { docs: Partial<Record<KycDocType, KycDocFile>>; files: StoredFile[] }

export const kycDocsKey = (userId: string | undefined) => ["kyc-docs", userId] as const;

/**
 * Documentos que a conta já enviou (o bucket é privado: as prévias usam link assinado de 1 hora).
 * Erro de leitura é erro, nunca "nada enviado": quem vê a lista vazia por engano reenvia tudo.
 */
export function useKycDocs(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: kycDocsKey(userId),
    enabled: !!userId && enabled,
    staleTime: 0,
    queryFn: async (): Promise<KycDocsData> => {
      const { data, error } = await supabase.storage.from("kyc-documents").list(userId!, { limit: 100 });
      if (error) throw error;
      const files = (data ?? []) as (StoredFile & { id?: string | null })[];
      const picked = newestByType(files.filter((f) => f.id !== null));
      const entries = Object.entries(picked) as [KycDocType, StoredFile][];
      const paths = entries.map(([, f]) => `${userId}/${f.name}`);
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("kyc-documents").createSignedUrls(paths, 3600);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      }
      const docs: KycDocsData["docs"] = {};
      for (const [type, f] of entries) {
        const path = `${userId}/${f.name}`;
        docs[type] = { type, name: f.name, path, url: urls.get(path) ?? null, sentAt: f.created_at ?? f.updated_at ?? null };
      }
      return { docs, files };
    },
  });
}

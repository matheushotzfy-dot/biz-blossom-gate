import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KYC_BUCKET } from "./kycFiles";
import { parseReview, type KycReview } from "./kycReviewModel";

export const kycReviewKey = (sellerId: string | null | undefined) => ["kyc-review", sellerId] as const;

export interface KycReviewData extends KycReview { urls: Record<string, string> }

/**
 * Ficha de análise (`get_kyc_review`) + links assinados dos documentos (15 min; o bucket é privado e a política
 * só libera admin e a equipe atribuída com permissão de KYC). A abertura fica registrada na auditoria.
 */
export function useKycReview(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: kycReviewKey(sellerId),
    enabled: !!sellerId,
    staleTime: 60_000,
    // Cada leitura grava uma abertura na auditoria e conta no limite: nada de reler ao voltar para a aba.
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async (): Promise<KycReviewData> => {
      const { data, error } = await supabase.rpc("get_kyc_review" as never, { _seller: sellerId } as never);
      if (error) throw error;
      const review = parseReview(data);
      const paths = review.documents.map((d) => d.path).filter(Boolean);
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(KYC_BUCKET).createSignedUrls(paths, 900);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
      }
      return { ...review, urls };
    },
  });
}

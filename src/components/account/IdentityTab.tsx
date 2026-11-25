import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { BASE_STEPS, CNPJ_STEP } from "@/components/kyc/kycSteps";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { canEditDocs, kycInfo } from "./accountMeta";
import { DocsSection } from "./DocsSection";
import { KycHero } from "./KycHero";
import { PayoutPanel } from "./PayoutPanel";
import { useKycDocs } from "./useAccountData";

/** Aba Identidade: situação da verificação, documentos e o que falta para sacar. */
export function IdentityTab({ scrollToDocs, onScrolled }: { scrollToDocs: boolean; onScrolled: () => void }) {
  const { user } = useAuth();
  const { profile, loading, error, refresh } = useProfile();
  const docsRef = useRef<HTMLElement>(null);

  const info = kycInfo(profile?.account_status);
  const showDocs = !!profile && info.key !== "approved" && info.key !== "blocked";
  const docs = useKycDocs(user?.id, showDocs);
  const isCnpj = profile?.document_type === "cnpj";
  const steps = isCnpj ? [...BASE_STEPS, CNPJ_STEP] : BASE_STEPS;
  const sent = steps.filter((s) => docs.data?.docs[s.type]).length;

  // Chegou por "enviar documentos": leva até a seção quando ela já está na tela.
  useEffect(() => {
    if (!scrollToDocs || !showDocs || docs.isLoading) return;
    const t = window.setTimeout(() => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      docsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      onScrolled();
    }, 250);
    return () => window.clearTimeout(t);
  }, [scrollToDocs, showDocs, docs.isLoading, onScrolled]);

  if (loading) {
    return <div className="space-y-6" aria-busy="true" aria-label="Carregando a verificação"><div className="vp-sheet h-[240px]" /><div className="vp-sheet h-[380px]" /></div>;
  }
  if (!profile) {
    return (
      <div className="vp-sheet">
        <EmptyPanel
          title={error ? "Não conseguimos carregar a sua conta" : "Perfil não encontrado"}
          text={error ? "Confira a conexão e tente de novo." : "Sua conta não tem um perfil criado. Fale com o suporte para regularizar."}
          action={error ? <button type="button" className="vp-cta" onClick={() => void refresh()}>Tentar de novo</button> : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KycHero info={info} reason={profile.kyc_rejection_reason} sent={sent} required={steps.length} checking={docs.isLoading} />
      {showDocs && <DocsSection ref={docsRef} kyc={info.key} isCnpj={!!isCnpj} docs={docs} editable={canEditDocs(info.key)} />}
      {info.key !== "blocked" && <PayoutPanel kyc={info.key} address={profile} />}
    </div>
  );
}

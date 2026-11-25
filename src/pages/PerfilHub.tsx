/**
 * Minha conta: perfil, identidade (verificação) e segurança numa só página.
 * A aba vive na URL (`?tab=`), então cada uma pode ser linkada e o voltar do navegador funciona.
 * Os links antigos continuam valendo: `?tab=identidade&scrollTo=kyc` e `?focus=address`.
 */
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { StatusPill } from "@/components/seller-ui/tx";
import { useProfile } from "@/hooks/useProfile";
import { kycInfo, parseAccountTab, type AccountTab } from "@/components/account/accountMeta";
import { ProfileTab } from "@/components/account/ProfileTab";
import { IdentityTab } from "@/components/account/IdentityTab";
import { SecurityTab } from "@/components/account/SecurityTab";
import "@/components/account/account.css";

export default function PerfilHub() {
  const [params, setParams] = useSearchParams();
  const { profile } = useProfile();
  const tab = parseAccountTab(params.get("tab"));
  const status = profile ? kycInfo(profile.account_status) : null;

  const go = (next: AccountTab) => setParams(next === "perfil" ? {} : { tab: next }, { replace: true });
  // Os avisos de chegada (?focus, ?scrollTo) valem uma vez: depois de usados saem da URL.
  const clear = useCallback((key: string) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    setParams(next, { replace: true });
  }, [params, setParams]);
  const doneAddress = useCallback(() => clear("focus"), [clear]);
  const doneDocs = useCallback(() => clear("scrollTo"), [clear]);

  return (
    <div className="space-y-5 pb-10 md:space-y-6">
      <Seo title="Minha conta | Vemprapay" description="Seus dados, a verificação da conta e a segurança do acesso." path="/perfil" noindex />
      <PageHead
        title="Minha conta"
        subtitle="Seus dados, a verificação da conta e a segurança do acesso."
        actions={status && <StatusPill tone={status.tone} label={status.label} className="h-9 px-4 text-[13.5px]" />}
      />
      <FilterPills<AccountTab>
        label="Áreas da conta"
        value={tab}
        onChange={go}
        options={[{ value: "perfil", label: "Perfil" }, { value: "identidade", label: "Identidade" }, { value: "seguranca", label: "Segurança" }]}
      />
      {tab === "perfil" && <ProfileTab spotlightAddress={params.get("focus") === "address"} onSpotlightDone={doneAddress} />}
      {tab === "identidade" && <IdentityTab scrollToDocs={params.get("scrollTo") === "kyc"} onScrolled={doneDocs} />}
      {tab === "seguranca" && <SecurityTab />}
    </div>
  );
}

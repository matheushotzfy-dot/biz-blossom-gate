import { useProfile } from "@/hooks/useProfile";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { AddressPanel } from "./AddressPanel";
import { FeesPanel } from "./FeesPanel";
import { IdentityCard } from "./IdentityCard";
import { PersonalPanel } from "./PersonalPanel";

/** Aba Perfil: quem você é, seus dados, o endereço e as taxas da conta. */
export function ProfileTab({ spotlightAddress, onSpotlightDone }: { spotlightAddress: boolean; onSpotlightDone: () => void }) {
  const { profile, loading, error, refresh } = useProfile();

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando o perfil">
        <div className="vp-sheet h-[260px] p-7"><span className="vp-skel block h-24 w-24 rounded-full" /></div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2"><div className="vp-sheet h-[420px]" /><div className="vp-sheet h-[420px]" /></div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="vp-sheet">
        <EmptyPanel
          title={error ? "Não conseguimos carregar o seu perfil" : "Perfil não encontrado"}
          text={error ? "Confira a conexão e tente de novo." : "Sua conta não tem um perfil criado. Fale com o suporte para regularizar."}
          action={error ? <button type="button" className="vp-cta" onClick={() => void refresh()}>Tentar de novo</button> : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IdentityCard />
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 lg:grid-cols-2">
        <PersonalPanel />
        <FeesPanel />
      </div>
      <AddressPanel spotlight={spotlightAddress} onSpotlightDone={onSpotlightDone} />
    </div>
  );
}

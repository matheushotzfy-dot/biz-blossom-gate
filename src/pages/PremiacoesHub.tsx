import { Trophy } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { Seo } from "@/components/Seo";
import Premiacoes from "./Premiacoes";

const TABS: HubTab[] = [
  { id: "premiacoes", label: "Premiações", icon: Trophy },
];

export default function PremiacoesHub() {
  return (
    <>
      <Seo title="Premiações | Hotzfy" description="Conquiste prêmios, troféus e marcos de faturamento na sua jornada de vendas." path="/premiacoes" noindex />
      <HubTabs tabs={TABS} active="premiacoes" onChange={() => {}} />
      <Premiacoes />
    </>
  );
}
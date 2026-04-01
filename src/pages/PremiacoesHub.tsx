import { useState } from "react";
import { Trophy, Gift } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Premiacoes from "./Premiacoes";
import Indicacoes from "./Indicacoes";

const TABS: HubTab[] = [
  { id: "premiacoes", label: "Premiações", icon: Trophy },
  { id: "indicacoes", label: "Indicações", icon: Gift },
];

export default function PremiacoesHub() {
  const [tab, setTab] = useState("premiacoes");

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "premiacoes" ? <Premiacoes /> : <Indicacoes />}
    </>
  );
}

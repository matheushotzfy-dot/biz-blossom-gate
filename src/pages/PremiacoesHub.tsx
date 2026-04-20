import { useState } from "react";
import { Trophy, Gift, Award } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Premiacoes from "./Premiacoes";
import Indicacoes from "./Indicacoes";
import Gamificacao from "./Gamificacao";

const TABS: HubTab[] = [
 { id: "premiacoes", label: "Premiações" },
 { id: "ranking", label: "Ranking & Conquistas" },
 { id: "indicacoes", label: "Indicações" },
];

const COMPONENTS: Record<string, React.FC> = {
 premiacoes: Premiacoes,
 ranking: Gamificacao,
 indicacoes: Indicacoes,
};

export default function PremiacoesHub() {
 const [tab, setTab] = useState("premiacoes");
 const ActiveComponent = COMPONENTS[tab];

 return (
 <>
 <HubTabs tabs={TABS} active={tab} onChange={setTab} />
 <ActiveComponent />
 </>
 );
}

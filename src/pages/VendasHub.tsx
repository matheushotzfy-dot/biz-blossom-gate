import { useState } from "react";
import { FlaskConical, Ticket } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import ABTesting from "./vendas/ABTesting";
import AutoCupons from "./vendas/AutoCupons";

const TABS: HubTab[] = [
  { id: "ab", label: "A/B Testing", icon: FlaskConical },
  { id: "cupons", label: "Cupons Automáticos", icon: Ticket },
];

const COMPONENTS: Record<string, React.FC> = {
  ab: ABTesting,
  cupons: AutoCupons,
};

export default function VendasHub() {
  const [tab, setTab] = useState("ab");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <ActiveComponent />
    </>
  );
}

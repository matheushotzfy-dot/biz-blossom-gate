import { Trophy } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Premiacoes from "./Premiacoes";

const TABS: HubTab[] = [
  { id: "premiacoes", label: "Premiações", icon: Trophy },
];

export default function PremiacoesHub() {
  return (
    <>
      <HubTabs tabs={TABS} active="premiacoes" onChange={() => {}} />
      <Premiacoes />
    </>
  );
}
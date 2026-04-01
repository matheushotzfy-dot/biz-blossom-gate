import { useState } from "react";
import { User, UserCircle } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Perfil from "./Perfil";
import Identidade from "./financeiro/Identidade";

const TABS: HubTab[] = [
  { id: "perfil", label: "Meu Perfil", icon: User },
  { id: "identidade", label: "Identidade & KYC", icon: UserCircle },
];

export default function PerfilHub() {
  const [tab, setTab] = useState("perfil");

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "perfil" ? <Perfil /> : <Identidade />}
    </>
  );
}

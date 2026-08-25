import { useState } from "react";
import { ArrowDownToLine, Bitcoin, PiggyBank, History, LayoutDashboard } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { Seo } from "@/components/Seo";
import Saques from "./Saques";
import SaquesCrypto from "./SaquesCrypto";

const TABS: HubTab[] = [
  { id: "pix", label: "Saques PIX", icon: PiggyBank },
  { id: "crypto", label: "Saques Crypto", icon: Bitcoin },
];

export default function SaquesHub() {
  const [tab, setTab] = useState("pix");

  return (
    <div className="bg-background antialiased selection:bg-primary/20">
      <Seo title="Saques | Venxpay" description="Solicite saques via PIX ou Crypto e acompanhe o histórico das suas retiradas." path="/financeiro/saques" noindex />
      <main className="mx-auto w-full">
        {tab === "pix" ? <Saques /> : <SaquesCrypto />}
      </main>
    </div>
  );
}

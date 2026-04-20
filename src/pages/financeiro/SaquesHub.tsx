import { useState } from "react";
import { ArrowDownToLine, Bitcoin } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Saques from "./Saques";
import SaquesCrypto from "./SaquesCrypto";

const TABS: HubTab[] = [
 { id: "pix", label: "Saques PIX", icon: ArrowDownToLine },
 { id: "crypto", label: "Saques Crypto", icon: Bitcoin },
];

export default function SaquesHub() {
 const [tab, setTab] = useState("pix");

 return (
 <>
 <HubTabs tabs={TABS} active={tab} onChange={setTab} />
 {tab === "pix" ? <Saques /> : <SaquesCrypto />}
 </>
 );
}

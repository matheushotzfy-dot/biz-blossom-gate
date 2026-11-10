import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { User, UserCircle } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { Seo } from "@/components/Seo";
import Perfil from "./Perfil";
import Identidade from "./financeiro/Identidade";

const TABS: HubTab[] = [
 { id: "perfil", label: "Meu Perfil & KYC", icon: User },
 { id: "identidade", label: "Identidade & KYC", icon: UserCircle },
];

const isValidTab = (value: string | null): value is "perfil" | "identidade" => value === "perfil" || value === "identidade";

export default function PerfilHub() {
 const [searchParams, setSearchParams] = useSearchParams();
 const [tab, setTab] = useState<"perfil" | "identidade">(() => {
 const urlTab = searchParams.get("tab");
 return isValidTab(urlTab) ? urlTab : "perfil";
 });

 useEffect(() => {
 const urlTab = searchParams.get("tab");
 setTab(isValidTab(urlTab) ? urlTab : "perfil");
 }, [searchParams]);

 const handleTabChange = (nextTab: string) => {
 if (!isValidTab(nextTab)) return;
 setTab(nextTab);

 const nextParams = new URLSearchParams(searchParams);
 if (nextTab === "perfil") {
 nextParams.delete("tab");
 } else {
 nextParams.set("tab", nextTab);
 }

 setSearchParams(nextParams, { replace: true });
 };

 return (
 <>
 <Seo title="Perfil & KYC | Vemprapay" description="Gerencie seus dados pessoais, identidade e verificação KYC." path="/perfil" noindex />
 <HubTabs tabs={TABS} active={tab} onChange={handleTabChange} />
 {tab === "perfil" ? <Perfil /> : <Identidade />}
 </>
 );
}

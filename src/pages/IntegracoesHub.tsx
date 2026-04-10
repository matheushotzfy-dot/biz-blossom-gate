import { useState, useEffect } from "react";
import { Puzzle, Webhook, BookOpen, KeyRound } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { useSearchParams } from "react-router-dom";
import Apps from "./vendas/Apps";
import Webhooks from "./vendas/Webhooks";
import Documentacao from "./vendas/Documentacao";
import ApiKeys from "./vendas/ApiKeys";

const TABS: HubTab[] = [
 { id: "apps", label: "Integrações", icon: Puzzle },
 { id: "webhooks", label: "Webhooks", icon: Webhook },
 { id: "api", label: "API Docs", icon: BookOpen },
 { id: "keys", label: "Credenciais API", icon: KeyRound },
];

const COMPONENTS: Record<string, React.FC> = {
 apps: Apps,
 webhooks: Webhooks,
 api: Documentacao,
 keys: ApiKeys,
};

export default function IntegracoesHub() {
 const [searchParams, setSearchParams] = useSearchParams();
 const [tab, setTab] = useState(searchParams.get("tab") || "apps");

 useEffect(() => {
 const paramTab = searchParams.get("tab");
 if (paramTab && COMPONENTS[paramTab]) {
 setTab(paramTab);
 setSearchParams({}, { replace: true });
 }
 }, [searchParams]);

 const ActiveComponent = COMPONENTS[tab] || Apps;

 return (
 <>
 <HubTabs tabs={TABS} active={tab} onChange={setTab} />
 <ActiveComponent />
 </>
 );
}

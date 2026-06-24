import { useEffect, useState } from "react";
import { Blocks, Webhook, BookOpen, KeyRound } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { Seo } from "@/components/Seo";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Apps from "./vendas/Apps";
import Webhooks from "./vendas/Webhooks";
import Documentacao from "./vendas/Documentacao";
import ApiKeys from "./vendas/ApiKeys";

const TABS: HubTab[] = [
 { id: "apps", label: "Integrações", icon: Blocks },
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

const PATH_TABS: Record<string, string> = {
 "/integracoes/apps": "apps",
 "/integracoes/webhooks": "webhooks",
 "/integracoes/documentacao": "api",
 "/integracoes/credenciais": "keys",
};

const TAB_PATHS: Record<string, string> = {
 apps: "/integracoes/apps",
 webhooks: "/integracoes/webhooks",
 api: "/integracoes/documentacao",
 keys: "/integracoes/credenciais",
};

export default function IntegracoesHub() {
 const location = useLocation();
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();
 const routeTab = PATH_TABS[location.pathname];
 const initialTab = routeTab || searchParams.get("tab");
 const [tab, setTab] = useState(initialTab && COMPONENTS[initialTab] ? initialTab : "apps");

 useEffect(() => {
  const pathnameTab = PATH_TABS[location.pathname];
  if (pathnameTab) {
   setTab(pathnameTab);
   return;
  }

 const paramTab = searchParams.get("tab");
 if (paramTab && COMPONENTS[paramTab]) {
   setTab(paramTab);
 }
 }, [location.pathname, searchParams]);

 const handleTabChange = (nextTab: string) => {
  setTab(nextTab);
  const nextPath = TAB_PATHS[nextTab];
  if (nextPath) {
   navigate(nextPath, { replace: true });
   return;
  }
  setSearchParams(nextTab === "apps" ? {} : { tab: nextTab }, { replace: true });
 };

 const ActiveComponent = COMPONENTS[tab] || Apps;

 return (
 <>
 <Seo title="Integrações | Hotzfy" description="Conecte apps, webhooks, gerencie chaves de API e consulte a documentação técnica." path="/integracoes" noindex />
 <HubTabs tabs={TABS} active={tab} onChange={handleTabChange} />
 <ActiveComponent />
 </>
 );
}

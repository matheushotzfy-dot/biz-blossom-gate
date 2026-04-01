import { useState } from "react";
import { Puzzle, Webhook, BookOpen, Key } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import Apps from "./vendas/Apps";
import Webhooks from "./vendas/Webhooks";
import Documentacao from "./vendas/Documentacao";
import ApiKeys from "./vendas/ApiKeys";

const TABS: HubTab[] = [
  { id: "apps", label: "Integrações", icon: Puzzle },
  { id: "keys", label: "Chaves API", icon: Key },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "api", label: "API Docs", icon: BookOpen },
];

const COMPONENTS: Record<string, React.FC> = {
  apps: Apps,
  keys: ApiKeys,
  webhooks: Webhooks,
  api: Documentacao,
};

export default function IntegracoesHub() {
  const [tab, setTab] = useState("apps");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <ActiveComponent />
    </>
  );
}

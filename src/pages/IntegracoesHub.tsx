/**
 * Integrações: apps, webhooks, credenciais de API e documentação em um só lugar.
 * A aba vive na URL (`?tab=`), então cada uma pode ser linkada, e o voltar do navegador funciona.
 */
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { parseIntegrationTab, type IntegrationTab } from "@/components/integrations/intMeta";
import Apps from "./vendas/Apps";
import Webhooks from "./vendas/Webhooks";
import Documentacao from "./vendas/Documentacao";
import ApiKeys from "./vendas/ApiKeys";

const PAGES: Record<IntegrationTab, React.FC> = { apps: Apps, webhooks: Webhooks, keys: ApiKeys, api: Documentacao };

export default function IntegracoesHub() {
  const [params, setParams] = useSearchParams();
  const tab = parseIntegrationTab(params.get("tab"));
  const Page = PAGES[tab];

  const go = (next: IntegrationTab) => setParams(next === "apps" ? {} : { tab: next }, { replace: true });

  return (
    <div className="space-y-5 md:space-y-6">
      <Seo title="Integrações | Vemprapay" description="Conecte apps, receba eventos por webhook, gerencie chaves de API e consulte a documentação." path="/integracoes" noindex />
      <SectionTabs section="apps" />
      {/* No celular a navegação já está no SectionTabs acima; as pílulas entram a partir do tablet. */}
      <div className="hidden md:block">
        <FilterPills<IntegrationTab>
          label="Áreas de integrações"
          value={tab}
          onChange={go}
          options={[
            { value: "apps", label: "Apps" },
            { value: "webhooks", label: "Webhooks" },
            { value: "keys", label: "Credenciais de API" },
            { value: "api", label: "Documentação" },
          ]}
        />
      </div>
      <Page />
    </div>
  );
}

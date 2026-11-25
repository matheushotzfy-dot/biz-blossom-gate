/**
 * Premiações: as peças físicas e a corrida de faturamento. A aba vive na URL (`?tab=`),
 * então cada uma pode ser linkada e o voltar do navegador funciona.
 */
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import Premiacoes from "./Premiacoes";
import CorridaFaturamento from "./CorridaFaturamento";

type Tab = "pecas" | "corrida";

export default function PremiacoesHub() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "corrida" ? "corrida" : "pecas";
  const go = (next: Tab) => setParams(next === "pecas" ? {} : { tab: next }, { replace: true });

  return (
    <div className="space-y-5 md:space-y-6">
      <Seo
        title={tab === "corrida" ? "Corrida de faturamento | Vemprapay" : "Premiações | Vemprapay"}
        description="Conquiste peças físicas e prêmios pelo faturamento da sua operação."
        path="/premiacoes"
        noindex
      />
      <FilterPills<Tab>
        label="Áreas de premiações"
        value={tab}
        onChange={go}
        options={[
          { value: "pecas", label: "Peças" },
          { value: "corrida", label: "Corrida de faturamento" },
        ]}
      />
      {tab === "corrida" ? <CorridaFaturamento /> : <Premiacoes />}
    </div>
  );
}

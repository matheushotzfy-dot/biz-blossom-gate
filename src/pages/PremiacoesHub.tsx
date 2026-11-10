import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Trophy, Flag } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { Seo } from "@/components/Seo";
import Premiacoes from "./Premiacoes";
import CorridaFaturamento from "./CorridaFaturamento";

const TABS: HubTab[] = [
  { id: "premiacoes", label: "Premiações", icon: Trophy },
  { id: "corrida", label: "Corrida de Faturamento", icon: Flag },
];

export default function PremiacoesHub() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("tab") === "corrida" ? "corrida" : "premiacoes";
  const [active, setActive] = useState<string>(initial);

  useEffect(() => {
    const t = params.get("tab");
    if (t && t !== active) setActive(t);
  }, [params]);

  const onChange = (id: string) => {
    setActive(id);
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  return (
    <>
      <Seo
        title={active === "corrida" ? "Corrida de Faturamento | Vemprapay" : "Premiações | Vemprapay"}
        description="Conquiste prêmios, troféus e marcos de faturamento na sua jornada de vendas."
        path="/premiacoes"
        noindex
      />
      <HubTabs tabs={TABS} active={active} onChange={onChange} />
      {active === "corrida" ? <CorridaFaturamento /> : <Premiacoes />}
    </>
  );
}

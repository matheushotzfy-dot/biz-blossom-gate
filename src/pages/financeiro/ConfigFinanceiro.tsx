import { useState } from "react";
import { Building2, Zap, PieChart, Banknote, FileText } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import DadosBancarios from "./DadosBancarios";
import Taxas from "./Taxas";
import ControleGastos from "./ControleGastos";
import Antecipacao from "./Antecipacao";
import NotasFiscais from "./NotasFiscais";

const TABS: HubTab[] = [
  { id: "dados", label: "Dados Bancários", icon: Building2 },
  { id: "taxas", label: "Taxas", icon: Zap },
  { id: "gastos", label: "Controle de Gastos", icon: PieChart },
  { id: "antecipacao", label: "Antecipação", icon: Banknote },
  { id: "nfe", label: "Notas Fiscais", icon: FileText },
];

const COMPONENTS: Record<string, React.FC> = {
  dados: DadosBancarios,
  taxas: Taxas,
  gastos: ControleGastos,
  antecipacao: Antecipacao,
  nfe: NotasFiscais,
};

export default function ConfigFinanceiro() {
  const [tab, setTab] = useState("dados");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <ActiveComponent />
    </>
  );
}

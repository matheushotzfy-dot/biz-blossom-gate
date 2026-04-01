import { useState } from "react";
import { Building2, Landmark, Zap, PieChart, Banknote, FileText } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const DadosBancarios = lazy(() => import("./DadosBancarios"));
const Adquirente = lazy(() => import("./Adquirente"));
const Taxas = lazy(() => import("./Taxas"));
const ControleGastos = lazy(() => import("./ControleGastos"));
const Antecipacao = lazy(() => import("./Antecipacao"));
const NotasFiscais = lazy(() => import("./NotasFiscais"));

const TABS: HubTab[] = [
  { id: "dados", label: "Dados Bancários", icon: Building2 },
  { id: "adquirente", label: "Adquirente", icon: Landmark },
  { id: "taxas", label: "Taxas", icon: Zap },
  { id: "gastos", label: "Controle de Gastos", icon: PieChart },
  { id: "antecipacao", label: "Antecipação", icon: Banknote },
  { id: "nfe", label: "Notas Fiscais", icon: FileText },
];

const COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  dados: DadosBancarios,
  adquirente: Adquirente,
  taxas: Taxas,
  gastos: ControleGastos,
  antecipacao: Antecipacao,
  nfe: NotasFiscais,
};

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function ConfigFinanceiro() {
  const [tab, setTab] = useState("dados");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <Suspense fallback={<Loading />}>
        <ActiveComponent />
      </Suspense>
    </>
  );
}

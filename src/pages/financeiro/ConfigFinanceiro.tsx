import { useState, lazy, Suspense, ComponentType } from "react";
import { Building2, Landmark, Zap, PieChart, Banknote, FileText, Loader2 } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";

function lazyRetry(importFn: () => Promise<{ default: ComponentType<any> }>) {
 return lazy(() =>
 importFn().catch(() =>
 new Promise<{ default: ComponentType<any> }>((resolve) => {
 setTimeout(() => resolve(importFn()), 1500);
 })
 )
 );
}

const DadosBancarios = lazyRetry(() => import("./DadosBancarios"));
const Adquirente = lazyRetry(() => import("./Adquirente"));
const Taxas = lazyRetry(() => import("./Taxas"));
const ControleGastos = lazyRetry(() => import("./ControleGastos"));
const Antecipacao = lazyRetry(() => import("./Antecipacao"));
const NotasFiscais = lazyRetry(() => import("./NotasFiscais"));

const TABS: HubTab[] = [
 { id: "dados", label: "Dados Bancários", icon: Building2 },
 { id: "adquirente", label: "Adquirente", icon: Landmark },
 { id: "taxas", label: "Taxas", icon: Zap },
 { id: "gastos", label: "Controle de Gastos", icon: PieChart },
 { id: "antecipacao", label: "Antecipação", icon: Banknote },
 { id: "nfe", label: "Notas Fiscais", icon: FileText },
];

const COMPONENTS: Record<string, ReturnType<typeof lazyRetry>> = {
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

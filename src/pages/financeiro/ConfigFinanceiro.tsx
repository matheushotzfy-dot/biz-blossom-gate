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

const Adquirente = lazyRetry(() => import("./Adquirente"));
const Taxas = lazyRetry(() => import("./Taxas"));
const NotasFiscais = lazyRetry(() => import("./NotasFiscais"));

const TABS: HubTab[] = [
  { id: "adquirente", label: "Adquirente", icon: Landmark },
  { id: "taxas", label: "Taxas", icon: Zap },
  { id: "nfe", label: "Notas Fiscais", icon: FileText },
];

const COMPONENTS: Record<string, ReturnType<typeof lazyRetry>> = {
  adquirente: Adquirente,
  taxas: Taxas,
  nfe: NotasFiscais,
};

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function ConfigFinanceiro() {
  const [tab, setTab] = useState("adquirente");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <div className="space-y-6">
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <Suspense fallback={<Loading />}>
        <ActiveComponent />
      </Suspense>
    </div>
  );
}
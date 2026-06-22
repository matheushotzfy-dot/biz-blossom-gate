import { lazy, Suspense, ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { Seo } from "@/components/Seo";

function lazyRetry(importFn: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch(() =>
      new Promise<{ default: ComponentType<any> }>((resolve) => {
        setTimeout(() => resolve(importFn()), 1500);
      })
    )
  );
}

// NOTE: Aba "Adquirente" temporariamente desativada — voltaremos a ativar.
// const Adquirente = lazyRetry(() => import("./Adquirente"));
const Taxas = lazyRetry(() => import("./Taxas"));

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function ConfigFinanceiro() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Loading />}>
        <Taxas />
      </Suspense>
    </div>
  );
}


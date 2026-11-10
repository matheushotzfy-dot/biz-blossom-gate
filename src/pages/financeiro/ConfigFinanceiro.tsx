import { lazy, Suspense, ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { Seo } from "@/components/Seo";

function lazyRetry<T extends ComponentType<unknown>>(importFn: () => Promise<{ default: T }>) {
  return lazy(() =>
    importFn().catch(() =>
      new Promise<{ default: T }>((resolve) => {
        setTimeout(() => resolve(importFn()), 1500);
      })
    )
  );
}

const Taxas = lazyRetry(() => import("./Taxas"));

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function ConfigFinanceiro() {
  return (
    <div className="space-y-6">
      <Seo title="Configurações Financeiras | Vemprapay" description="Taxas e regras financeiras da sua conta." path="/financeiro/config" noindex />
      <Suspense fallback={<Loading />}>
        <Taxas />
      </Suspense>
    </div>
  );
}


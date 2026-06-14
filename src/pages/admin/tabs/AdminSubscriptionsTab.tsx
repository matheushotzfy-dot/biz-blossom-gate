import { RefreshCw, Hammer } from "lucide-react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";

export default function AdminSubscriptionsTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Receita Recorrente"
        title="Assinaturas"
        subtitle="Módulo em desenvolvimento — em breve com MRR, churn, retenção e gestão de planos."
        status={{ tone: "warning", label: "Em desenvolvimento", pulse: true }}
      />
      <div className="rounded-2xl border border-border bg-card/50 p-10 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
          <Hammer className="h-6 w-6 text-warning" />
        </div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Em construção</h3>
        <p className="text-xs text-muted-foreground max-w-md">
          Estamos reescrevendo o módulo de assinaturas com cohorts, recuperação de inadimplência e dashboard de planos completo.
        </p>
      </div>
    </div>
  );
}

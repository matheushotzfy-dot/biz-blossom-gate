import { UserMinus, TrendingDown, AlertTriangle, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Relatório de Churn — Em desenvolvimento.
 * O cálculo real depende do módulo de assinaturas recorrentes (subscriptions),
 * que precisa acumular pelo menos 30 dias de histórico para gerar métricas
 * confiáveis. Enquanto isso, mostramos estado vazio explícito em vez de mock,
 * para não induzir o vendedor a decisões com base em dados fictícios.
 */
export default function RelatorioChurn() {
  const KPIS = [
    { label: "Churn Mensal", icon: TrendingDown, color: "text-destructive" },
    { label: "Clientes Perdidos", icon: UserMinus, color: "text-amber-500" },
    { label: "Em Risco", icon: AlertTriangle, color: "text-orange-500" },
    { label: "Retenção Média", icon: Users, color: "text-emerald-500" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Churn</h1>
          <p className="text-sm text-muted-foreground">
            Análise de cancelamentos e retenção de assinaturas recorrentes.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Clock className="h-3 w-3" /> Em breve
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {KPIS.map((kpi) => (
          <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] bg-muted/50 ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-black text-muted-foreground/60">—</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Sem dados suficientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            O relatório de churn é ativado automaticamente quando você tem
            assinaturas recorrentes ativas há pelo menos 30 dias. Assim que
            houver histórico, esta página mostrará métricas reais de retenção,
            motivos de cancelamento e clientes em risco.
          </p>
          <p className="text-xs">
            Nenhum dado exibido aqui é fictício — preferimos deixar a página
            vazia a mostrar números que não refletem o seu negócio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

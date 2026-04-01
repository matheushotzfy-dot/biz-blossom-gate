import { useState } from "react";
import { Filter, ArrowDown, Users, Eye, CreditCard, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FUNNEL_DATA = [
  { stage: "Visitantes", icon: Eye, value: 12400, color: "bg-blue-500", pct: 100 },
  { stage: "Iniciaram Checkout", icon: Users, value: 3720, color: "bg-purple-500", pct: 30 },
  { stage: "Preencheram Dados", icon: CreditCard, value: 2232, color: "bg-amber-500", pct: 18 },
  { stage: "Pagamento Pendente", icon: AlertCircle, value: 1488, color: "bg-orange-500", pct: 12 },
  { stage: "Compra Concluída", icon: CheckCircle2, value: 1116, color: "bg-emerald-500", pct: 9 },
];

const PRODUCTS_FUNNEL = [
  { name: "Curso Pro", visitors: 5200, checkouts: 1560, sales: 468, conversion: 9.0 },
  { name: "E-book Master", visitors: 3800, checkouts: 1140, sales: 342, conversion: 9.0 },
  { name: "Mentoria VIP", visitors: 1800, checkouts: 540, sales: 162, conversion: 9.0 },
  { name: "Pack Templates", visitors: 1600, checkouts: 480, sales: 144, conversion: 9.0 },
];

const DROPOFF = [
  { from: "Visitantes → Checkout", rate: 70, suggestion: "Melhore o CTA e adicione prova social na página de vendas" },
  { from: "Checkout → Dados", rate: 40, suggestion: "Simplifique o formulário e reduza campos obrigatórios" },
  { from: "Dados → Pagamento", rate: 33, suggestion: "Adicione mais opções de pagamento (PIX, boleto)" },
  { from: "Pagamento → Compra", rate: 25, suggestion: "Configure recuperação por WhatsApp e cupons automáticos" },
];

export default function FunilVendas() {
  const [period, setPeriod] = useState("30d");

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">Funil de Vendas</h1>
          <p className="text-sm text-muted-foreground">Visualize cada etapa do processo de compra</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Filter className="h-4 w-4 text-primary" /> Funil Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 py-4">
          {FUNNEL_DATA.map((stage, i) => (
            <div key={stage.stage}>
              <div className="flex items-center gap-4 px-2 py-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stage.color}/15`}>
                  <stage.icon className={`h-4 w-4 ${stage.color.replace("bg-", "text-")}`} />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-semibold">{stage.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-black">{stage.value.toLocaleString("pt-BR")}</span>
                      <span className="text-[11px] text-muted-foreground">{stage.pct}%</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-muted/30">
                    <div className={`h-full rounded-full ${stage.color} transition-all duration-700`} style={{ width: `${stage.pct}%` }} />
                  </div>
                </div>
              </div>
              {i < FUNNEL_DATA.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Funil por Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRODUCTS_FUNNEL.map(p => (
              <div key={p.name} className="rounded-xl bg-muted/15 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-bold">{p.name}</span>
                  <span className="text-[12px] font-bold text-emerald-500">{p.conversion}%</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{p.visitors.toLocaleString("pt-BR")} visitas</span>
                  <span>→</span>
                  <span>{p.checkouts.toLocaleString("pt-BR")} checkouts</span>
                  <span>→</span>
                  <span className="font-semibold text-foreground">{p.sales.toLocaleString("pt-BR")} vendas</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Pontos de Abandono
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DROPOFF.map(d => (
              <div key={d.from} className="rounded-xl bg-muted/15 px-4 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-bold">{d.from}</span>
                  <span className="text-[12px] font-black text-destructive">-{d.rate}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">💡 {d.suggestion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

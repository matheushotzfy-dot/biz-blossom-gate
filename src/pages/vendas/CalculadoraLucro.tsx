import { useState, useMemo } from "react";
import { Calculator, DollarSign, TrendingUp, Percent, ArrowRight, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export default function CalculadoraLucro() {
  const [price, setPrice] = useState(197);
  const [monthlySales, setMonthlySales] = useState(50);
  const [adSpend, setAdSpend] = useState(2000);
  const [affiliateCommission, setAffiliateCommission] = useState(30);
  const [affiliatePct, setAffiliatePct] = useState(20);

  const calc = useMemo(() => {
    const grossRevenue = price * monthlySales;
    const platformFee = grossRevenue * 0.0499 + monthlySales * 2.50;
    const affiliateCost = grossRevenue * (affiliatePct / 100) * (affiliateCommission / 100);
    const totalCosts = platformFee + adSpend + affiliateCost;
    const netProfit = grossRevenue - totalCosts;
    const roi = adSpend > 0 ? ((netProfit / adSpend) * 100) : 0;
    const profitMargin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100) : 0;
    const cpa = monthlySales > 0 ? adSpend / monthlySales : 0;

    return { grossRevenue, platformFee, affiliateCost, totalCosts, netProfit, roi, profitMargin, cpa };
  }, [price, monthlySales, adSpend, affiliateCommission, affiliatePct]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="text-center">
        <h1 className="text-2xl font-black">Calculadora de Lucro</h1>
        <p className="mt-1 text-muted-foreground">Simule seus ganhos e otimize sua estratégia</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Calculator className="h-4 w-4 text-primary" /> Parâmetros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold">Preço do Produto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input type="number" value={price} onChange={e => setPrice(+e.target.value)} className="rounded-xl pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[12px] font-semibold">Vendas por Mês</Label>
                <span className="text-[12px] font-bold text-primary">{monthlySales}</span>
              </div>
              <Slider value={[monthlySales]} onValueChange={([v]) => setMonthlySales(v)} min={1} max={500} step={1} />
            </div>

            <div className="space-y-2">
              <Label className="text-[12px] font-semibold">Gasto com Tráfego (mensal)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input type="number" value={adSpend} onChange={e => setAdSpend(+e.target.value)} className="rounded-xl pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[12px] font-semibold">Comissão de Afiliados</Label>
                <span className="text-[12px] font-bold text-primary">{affiliateCommission}%</span>
              </div>
              <Slider value={[affiliateCommission]} onValueChange={([v]) => setAffiliateCommission(v)} min={0} max={70} step={5} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[12px] font-semibold">% Vendas via Afiliado</Label>
                <span className="text-[12px] font-bold text-primary">{affiliatePct}%</span>
              </div>
              <Slider value={[affiliatePct]} onValueChange={([v]) => setAffiliatePct(v)} min={0} max={100} step={5} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Faturamento Bruto", value: `R$ ${fmt(calc.grossRevenue)}`, icon: DollarSign, color: "text-primary" },
              { label: "Lucro Líquido", value: `R$ ${fmt(calc.netProfit)}`, icon: TrendingUp, color: calc.netProfit >= 0 ? "text-emerald-500" : "text-destructive" },
              { label: "ROI do Tráfego", value: `${calc.roi.toFixed(0)}%`, icon: Target, color: calc.roi >= 100 ? "text-emerald-500" : "text-amber-500" },
              { label: "Margem de Lucro", value: `${calc.profitMargin.toFixed(1)}%`, icon: Percent, color: calc.profitMargin >= 30 ? "text-emerald-500" : "text-amber-500" },
            ].map(kpi => (
              <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-black">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Detalhamento de Custos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Taxa da Plataforma (4,99% + R$ 2,50)", value: calc.platformFee },
                { label: "Gasto com Tráfego", value: adSpend },
                { label: "Comissões de Afiliados", value: calc.affiliateCost },
                { label: "CPA (Custo por Aquisição)", value: calc.cpa },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-2.5">
                  <span className="text-[12px] font-medium text-muted-foreground">{item.label}</span>
                  <span className="text-[13px] font-bold">R$ {fmt(item.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
                <span className="text-[13px] font-bold">Total de Custos</span>
                <span className="text-[14px] font-black text-primary">R$ {fmt(calc.totalCosts)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

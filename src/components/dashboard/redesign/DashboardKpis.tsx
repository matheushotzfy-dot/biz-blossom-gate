import { BadgeDollarSign, CircleDollarSign, PackageCheck, ReceiptText, ShieldCheck, ShoppingBag, Target, Wallet } from "lucide-react";
import { StatCard, type StatCardColor } from "@/components/StatCard";

interface DashboardKpisProps {
  balance: number;
  revenue: number;
  approvedCount: number;
  conversion: number;
  averageTicket: number;
  pendingBalance: number;
  disputedAmount: number;
  chargebackRate: number;
  productsCount: number;
  isLoading: boolean;
  privacyHidden: boolean;
  formatCurrency: (value: number) => string;
}

interface KpiItem {
  label: string;
  value: string;
  sub: string;
  color: StatCardColor;
  icon: typeof Wallet;
}

export function DashboardKpis({ balance, revenue, approvedCount, conversion, averageTicket, pendingBalance, disputedAmount, chargebackRate, productsCount, isLoading, privacyHidden, formatCurrency }: DashboardKpisProps) {
  const hidden = "••••••";
  const money = (value: number) => privacyHidden ? hidden : formatCurrency(value);
  const kpis: KpiItem[] = [
    { label: "Receita aprovada", value: money(revenue), sub: "Líquido no período", color: "success", icon: BadgeDollarSign },
    { label: "Pedidos aprovados", value: String(approvedCount), sub: `${productsCount} produtos ativos`, color: "primary", icon: ShoppingBag },
    { label: "Taxa de aprovação", value: `${conversion.toFixed(1)}%`, sub: "Conversão das cobranças", color: "info", icon: Target },
    { label: "Ticket médio", value: money(averageTicket), sub: "Média por venda aprovada", color: "neutral", icon: ReceiptText },
    { label: "Saldo disponível", value: money(Math.max(0, balance)), sub: "Pronto para saque", color: "success", icon: Wallet },
    { label: "Saldo pendente", value: money(pendingBalance), sub: "Aguardando liberação", color: "warning", icon: CircleDollarSign },
    { label: "Reembolsos e MED", value: money(disputedAmount), sub: "Ocorrências financeiras", color: "destructive", icon: ShieldCheck },
    { label: "Taxa de estorno", value: `${chargebackRate.toFixed(1)}%`, sub: chargebackRate < 1 ? "Operação saudável" : "Requer atenção", color: chargebackRate < 1 ? "success" : "destructive", icon: PackageCheck },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, index) => (
        <StatCard key={kpi.label} title={kpi.label} value={isLoading ? "..." : kpi.value} icon={kpi.icon} description={kpi.sub} color={kpi.color} delay={index * 25} className="min-h-[132px]" />
      ))}
    </section>
  );
}

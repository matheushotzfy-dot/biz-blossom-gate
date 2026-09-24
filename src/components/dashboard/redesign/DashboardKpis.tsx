import { Wallet, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";

interface DashboardKpisProps {
  balance: number;
  receivedToday: number;
  disputedAmount: number;
  revenue: number;
  revenueTrend?: number;
  isLoading: boolean;
  privacyHidden: boolean;
  formatCurrency: (v: number) => string;
}

export function DashboardKpis({
  balance,
  receivedToday,
  disputedAmount,
  revenue,
  revenueTrend,
  isLoading,
  privacyHidden,
  formatCurrency,
}: DashboardKpisProps) {
  const CENSORED = "••••••";

  const kpis = [
    { 
      label: "Saldo disponível", 
      value: privacyHidden ? CENSORED : formatCurrency(Math.max(0, balance)), 
      sub: "Pronto para saque", 
      color: "success" as const, 
      icon: Wallet 
    },
    { 
      label: "Recebido hoje", 
      value: privacyHidden ? CENSORED : formatCurrency(receivedToday), 
      sub: "Movimento confirmado", 
      color: "primary" as const, 
      icon: RefreshCw 
    },
    { 
      label: "Reembolsos", 
      value: privacyHidden ? CENSORED : formatCurrency(disputedAmount), 
      sub: "MEDs e Reembolsos", 
      color: "destructive" as const, 
      icon: ShieldCheck 
    },
    { 
      label: "Volume total", 
      value: privacyHidden ? CENSORED : formatCurrency(revenue), 
      sub: "Vendas acumuladas", 
      color: "success" as const, 
      icon: TrendingUp,
      trend: revenueTrend
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <StatCard
          key={k.label}
          title={k.label}
          value={isLoading ? "..." : k.value}
          icon={k.icon}
          description={k.sub}
          color={k.color}
          trend={k.trend}
          changeType={k.trend && k.trend > 0 ? "positive" : k.trend && k.trend < 0 ? "negative" : "neutral"}
          className="min-h-[140px]"
        />
      ))}
    </section>
  );
}

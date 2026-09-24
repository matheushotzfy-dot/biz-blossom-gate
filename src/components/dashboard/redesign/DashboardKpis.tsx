import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, ReceiptText, ShieldCheck, ShoppingBag, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardAction {
  label: string;
  sub: string;
  icon: LucideIcon;
  onClick: () => void;
}

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
  actions: DashboardAction[];
  isLoading: boolean;
  privacyHidden: boolean;
  formatCurrency: (value: number) => string;
}

interface KpiItem {
  label: string;
  value: string;
  sub: string;
  tone?: "success" | "warning" | "destructive";
}

export function DashboardKpis({ balance, revenue, approvedCount, conversion, averageTicket, pendingBalance, disputedAmount, chargebackRate, productsCount, actions, isLoading, privacyHidden, formatCurrency }: DashboardKpisProps) {
  const hidden = "••••••";
  const money = (value: number) => privacyHidden ? hidden : formatCurrency(value);
  const kpis: KpiItem[] = [
    { label: "Receita no período", value: money(revenue), sub: `${approvedCount} pedidos aprovados`, tone: "success" },
    { label: "Taxa de aprovação", value: `${conversion.toFixed(1)}%`, sub: "Das cobranças criadas" },
    { label: "Ticket médio", value: money(averageTicket), sub: `${productsCount} produtos ativos` },
    { label: "Saldo pendente", value: money(pendingBalance), sub: "Aguardando liberação", tone: "warning" },
    { label: "Reembolsos e MED", value: money(disputedAmount), sub: `${chargebackRate.toFixed(1)}% de estorno`, tone: disputedAmount > 0 ? "destructive" : undefined },
  ];

  return (
    <section className="dashboard-summary overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,2.1fr)]">
        <div className="flex min-h-[188px] flex-col justify-between border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Saldo disponível</span>
          </div>
          <div className="py-5">
            <p className="font-numbers text-[clamp(1.75rem,3vw,2.65rem)] font-bold leading-none tabular-nums text-foreground">
              {isLoading ? "..." : money(Math.max(0, balance))}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Pronto para saque via PIX</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Operação disponível
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="min-w-0 border-b border-r border-border p-4 last:border-r-0 sm:p-5">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
              <p className={cn("mt-2 truncate font-numbers text-lg font-bold tabular-nums text-foreground sm:text-xl", kpi.tone === "success" && "text-success", kpi.tone === "warning" && "text-warning", kpi.tone === "destructive" && "text-destructive")}>
                {isLoading ? "..." : kpi.value}
              </p>
              <p className="mt-1 truncate text-[10px] text-muted-foreground/75">{kpi.sub}</p>
            </div>
          ))}
          <div className="flex min-h-[91px] items-center justify-center p-4 sm:p-5">
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.label} type="button" variant="ghost" onClick={action.onClick} className="group h-14 justify-start rounded-none border-b border-r border-border px-4 text-foreground last:border-r-0 sm:border-b-0">
              <Icon className="h-4 w-4 text-primary" />
              <span className="min-w-0 text-left">
                <span className="block truncate text-xs font-semibold">{action.label}</span>
                <span className="hidden truncate text-[10px] font-normal text-muted-foreground lg:block">{action.sub}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

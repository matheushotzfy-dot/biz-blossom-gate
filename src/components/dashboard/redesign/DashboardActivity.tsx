import { ChevronRight, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  payment_method: string | null;
  [key: string]: any;
}

interface DashboardActivityProps {
  activity: any[];
  statusLabel: (s: string) => string;
  statusBg: (s: string) => string;
  statusColor: (s: string) => string;
  formatCurrency: (v: number) => string;
  timeAgo: (d: string) => string;
  privacyHidden: boolean;
  onTxClick: (tx: any) => void;
  onViewAllClick: () => void;
}

export function DashboardActivity({
  activity,
  statusLabel,
  statusBg,
  statusColor,
  formatCurrency,
  timeAgo,
  privacyHidden,
  onTxClick,
  onViewAllClick,
}: DashboardActivityProps) {
  const CENSORED = "••••••";

  return (
    <div className="rounded-[24px] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-5 md:px-8">
        <div>
          <h4 className="font-display font-bold text-xl tracking-[-0.02em]">Últimas Transações</h4>
          <p className="text-[11px] text-muted-foreground/60 mt-1">Atividade em tempo real</p>
        </div>
        <button 
          onClick={onViewAllClick}
          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="divide-y divide-border/30">
        {activity.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhuma transação encontrada</p>
          </div>
        ) : (
          activity.map((item) => (
            <button
              key={item.id}
              onClick={() => onTxClick(item.tx)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30 md:px-8"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", statusBg(item.status))}>
                   <span className={cn("text-[10px] font-bold uppercase", statusColor(item.status))}>
                    {statusLabel(item.status).substring(0, 3)}
                   </span>
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[14px] font-semibold text-foreground">
                    {item.label || "Venda"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {timeAgo(item.createdAt)} • {statusLabel(item.status)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[14px] font-bold text-foreground tabular-nums">
                    {privacyHidden ? CENSORED : formatCurrency(item.amount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ID: {item.id.substring(0, 8)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

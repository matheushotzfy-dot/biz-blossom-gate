import { ChevronRight, ArrowRight } from "lucide-react";
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
  formatCurrency: (v: number) => string;
  privacyHidden: boolean;
  onTxClick: (tx: any) => void;
  onViewAllClick: () => void;
}

export function DashboardActivity({
  activity,
  statusLabel,
  formatCurrency,
  privacyHidden,
  onTxClick,
  onViewAllClick,
}: DashboardActivityProps) {
  const CENSORED = "••••••";

  return (
    <section className="rounded-[24px] border border-border bg-card overflow-hidden">
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

      {activity.length > 0 && (
        <div className="hidden md:grid grid-cols-[1fr_100px_120px_110px_20px] gap-4 px-5 md:px-6 py-2 border-y border-border/40 bg-muted/20 text-[11px] font-medium text-muted-foreground/60">
          <span>Cliente</span>
          <span>Método</span>
          <span className="text-right">Valor</span>
          <span>Status</span>
          <span />
        </div>
      )}

      <ul className="divide-y divide-border/30">
        {activity.length === 0 ? (
          <li className="px-6 py-14 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhuma transação ainda.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Suas vendas aparecerão aqui em tempo real.</p>
          </li>
        ) : (
          activity.map((item) => {
            const method = item.label;
            const methodLabel = method === "pix" ? "PIX" : method === "credit_card" ? "Cartão" : method === "boleto" ? "Boleto" : "—";
            const custName = item.tx.customer_name || item.tx.customer_email || "Cliente";

            const isApproved = item.status === 'approved' || item.status === 'paid' || item.status === 'completed';
            const dot =
              isApproved ? "bg-success"
              : item.status === "pending" ? "bg-warning"
              : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "bg-destructive"
              : "bg-muted-foreground/50";
            const statusColor =
              isApproved ? "text-success"
              : item.status === "pending" ? "text-warning"
              : item.status === "chargeback" || item.status === "med" || item.status === "dispute" || item.status === "disputed" ? "text-destructive"
              : "text-muted-foreground";

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onTxClick(item.tx)}
                  className="group w-full grid md:grid-cols-[1fr_100px_120px_110px_20px] grid-cols-[1fr_auto] gap-4 items-center px-5 md:px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{custName}</p>
                    <p className="text-[11px] text-muted-foreground/70 tabular-nums mt-0.5">
                      {new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="hidden md:inline text-[12px] text-muted-foreground font-medium">{methodLabel}</span>
                  <span className="hidden md:block text-right font-display font-bold text-[14px] tabular-nums text-foreground">
                    {privacyHidden ? CENSORED : formatCurrency(item.amount)}
                  </span>
                  <span className={cn("hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold", statusColor)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                    {statusLabel(item.status)}
                  </span>
                  <div className="md:hidden flex flex-col items-end gap-1">
                    <span className="font-display font-bold text-[14px] tabular-nums text-foreground">
                      {privacyHidden ? CENSORED : formatCurrency(item.amount)}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold", statusColor)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <ChevronRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

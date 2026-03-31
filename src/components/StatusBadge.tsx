import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  approved: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
  active: "bg-success/10 text-success border-success/20",
  paid: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  pending_review: "bg-warning/10 text-warning border-warning/20",
  requested: "bg-warning/10 text-warning border-warning/20",
  under_review: "bg-info/10 text-info border-info/20",
  processing: "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  blocked: "bg-destructive/10 text-destructive border-destructive/20",
  chargeback: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-info/10 text-info border-info/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  completed: "Concluído",
  active: "Ativo",
  paid: "Pago",
  pending: "Pendente",
  pending_review: "Em Análise",
  requested: "Solicitado",
  under_review: "Em Análise",
  processing: "Processando",
  rejected: "Rejeitado",
  failed: "Falhou",
  blocked: "Bloqueado",
  chargeback: "Chargeback",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
  inactive: "Inativo",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.pending;
  const label = statusLabels[status] || status;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", style, className)}>
      {label}
    </span>
  );
}

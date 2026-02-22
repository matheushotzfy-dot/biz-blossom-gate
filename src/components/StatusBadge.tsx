import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  approved: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
  active: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  approved: "Aprovado",
  completed: "Concluído",
  active: "Ativo",
  pending: "Pendente",
  processing: "Processando",
  rejected: "Rejeitado",
  failed: "Falhou",
  cancelled: "Cancelado",
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

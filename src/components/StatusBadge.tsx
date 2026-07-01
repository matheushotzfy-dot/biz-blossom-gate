import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
 approved: "bg-success/8 text-success border-success/15",
 completed: "bg-success/8 text-success border-success/15",
 active: "bg-success/8 text-success border-success/15",
 paid: "bg-success/8 text-success border-success/15",
 pending: "bg-warning/8 text-warning border-warning/15",
 pending_review: "bg-warning/8 text-warning border-warning/15",
 requested: "bg-warning/8 text-warning border-warning/15",
 under_review: "bg-info/8 text-info border-info/15",
 processing: "bg-info/8 text-info border-info/15",
 error: "bg-destructive/8 text-destructive border-destructive/15",
 rejected: "bg-destructive/8 text-destructive border-destructive/15",
 failed: "bg-destructive/8 text-destructive border-destructive/15",
 blocked: "bg-destructive/8 text-destructive border-destructive/15",
 chargeback: "bg-destructive/8 text-destructive border-destructive/15",
 refunded: "bg-info/8 text-info border-info/15",
 partially_refunded: "bg-info/8 text-info border-info/15",
 med: "bg-warning/8 text-warning border-warning/15",
 dispute: "bg-warning/8 text-warning border-warning/15",
 disputed: "bg-warning/8 text-warning border-warning/15",
 expired: "bg-muted/60 text-muted-foreground border-border/40",
 cancelled: "bg-muted/60 text-muted-foreground border-border/40",
 canceled: "bg-muted/60 text-muted-foreground border-border/40",
 inactive: "bg-muted/60 text-muted-foreground border-border/40",
};

const statusLabels: Record<string, string> = {
 approved: "Aprovada",
 completed: "Aprovada",
 active: "Ativo",
 paid: "Pago",
 pending: "Pendente",
 pending_review: "Em Análise",
 requested: "Solicitado",
 under_review: "Em Análise",
 processing: "Processando",
 error: "Erro",
 rejected: "Rejeitado",
 failed: "Falhou",
 blocked: "Bloqueado",
 chargeback: "Chargeback",
 refunded: "Reembolso",
 partially_refunded: "Reemb. Parcial",
 med: "MED",
 dispute: "MED",
 disputed: "MED",
 expired: "Expirada",
 cancelled: "Cancelado",
 canceled: "Cancelado",
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
 <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border tracking-wide", style, className)}>
 {label}
 </span>
 );
}

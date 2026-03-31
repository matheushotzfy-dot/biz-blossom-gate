import { cn } from "@/lib/utils";

const statusStyles: Record<string, { cls: string; dot: string }> = {
  approved:      { cls: "bg-success/8 text-success ring-success/12",        dot: "bg-success shadow-[0_0_6px_hsl(var(--success)/0.5)]" },
  completed:     { cls: "bg-success/8 text-success ring-success/12",        dot: "bg-success shadow-[0_0_6px_hsl(var(--success)/0.5)]" },
  active:        { cls: "bg-success/8 text-success ring-success/12",        dot: "bg-success" },
  paid:          { cls: "bg-success/8 text-success ring-success/12",        dot: "bg-success" },
  pending:       { cls: "bg-warning/8 text-warning ring-warning/12",        dot: "bg-warning animate-pulse shadow-[0_0_6px_hsl(var(--warning)/0.5)]" },
  pending_review:{ cls: "bg-warning/8 text-warning ring-warning/12",        dot: "bg-warning animate-pulse" },
  requested:     { cls: "bg-warning/8 text-warning ring-warning/12",        dot: "bg-warning" },
  under_review:  { cls: "bg-info/8 text-info ring-info/12",                 dot: "bg-info animate-pulse" },
  processing:    { cls: "bg-info/8 text-info ring-info/12",                 dot: "bg-info animate-pulse" },
  rejected:      { cls: "bg-destructive/8 text-destructive ring-destructive/12", dot: "bg-destructive" },
  failed:        { cls: "bg-destructive/8 text-destructive ring-destructive/12", dot: "bg-destructive" },
  blocked:       { cls: "bg-destructive/8 text-destructive ring-destructive/12", dot: "bg-destructive" },
  chargeback:    { cls: "bg-destructive/8 text-destructive ring-destructive/12", dot: "bg-destructive" },
  refunded:      { cls: "bg-info/8 text-info ring-info/12",                 dot: "bg-info" },
  cancelled:     { cls: "bg-muted/20 text-muted-foreground ring-border/15", dot: "bg-muted-foreground/40" },
  inactive:      { cls: "bg-muted/20 text-muted-foreground ring-border/15", dot: "bg-muted-foreground/40" },
};

const statusLabels: Record<string, string> = {
  approved: "Aprovado", completed: "Concluído", active: "Ativo", paid: "Pago",
  pending: "Pendente", pending_review: "Em Análise", requested: "Solicitado",
  under_review: "Em Análise", processing: "Processando", rejected: "Rejeitado",
  failed: "Falhou", blocked: "Bloqueado", chargeback: "Chargeback",
  refunded: "Reembolsado", cancelled: "Cancelado", inactive: "Inativo",
};

interface StatusBadgeProps { status: string; className?: string; }

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = statusStyles[status] || statusStyles.pending;
  const label = statusLabels[status] || status;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-display font-bold uppercase tracking-[0.1em] ring-1",
      s.cls, className
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
      {label}
    </span>
  );
}

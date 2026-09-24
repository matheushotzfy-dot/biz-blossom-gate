import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action { label: string; sub: string; icon: LucideIcon; onClick: () => void; }
interface DashboardQuickActionsProps { actions: Action[]; }

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  return (
    <section aria-label="Ações rápidas" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button key={action.label} type="button" variant="ghost" onClick={action.onClick} className="dashboard-action group h-auto min-h-[64px] justify-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-foreground hover:border-primary/40 hover:bg-card-elevated">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{action.label}</span>
              <span className="hidden truncate text-[10px] font-normal text-muted-foreground sm:block">{action.sub}</span>
            </span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
          </Button>
        );
      })}
    </section>
  );
}

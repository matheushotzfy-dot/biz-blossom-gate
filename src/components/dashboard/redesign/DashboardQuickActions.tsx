import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  sub: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface DashboardQuickActionsProps {
  actions: Action[];
}

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  return (
    <section className="dashboard-actions-band grid grid-cols-1 gap-3 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            type="button"
            variant="ghost"
            key={a.label}
            onClick={a.onClick}
            className="dashboard-action group relative h-auto min-h-[78px] justify-start gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-3 text-left text-foreground transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/55"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-[border-color,background-color,transform] duration-300 group-hover:scale-105 group-hover:border-primary/50 group-hover:bg-primary/15">
              <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-tight text-foreground 2xl:text-[14px]">{a.label}</p>
              <p className="truncate text-[11px] font-normal text-muted-foreground">{a.sub}</p>
            </div>
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground/60 transition-colors duration-200 group-hover:text-primary">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </Button>
        );
      })}
    </section>
  );
}

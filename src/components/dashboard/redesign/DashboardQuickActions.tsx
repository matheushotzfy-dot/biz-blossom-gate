import { QrCode, ArrowDownRight, Receipt, KeyRound, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  sub: string;
  icon: any;
  onClick: () => void;
}

interface DashboardQuickActionsProps {
  actions: Action[];
}

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            type="button"
            variant="ghost"
            key={a.label}
            onClick={a.onClick}
            className="group relative h-auto min-h-[82px] justify-start gap-3 overflow-hidden rounded-[18px] border border-border bg-card px-4 py-3 text-left text-foreground transition-colors duration-300 hover:border-primary/30 hover:bg-accent/55"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-primary/20 bg-primary/8 text-primary transition-colors duration-200 group-hover:border-primary/35 group-hover:bg-primary/12">
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight text-foreground 2xl:text-[14px]">{a.label}</p>
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

import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardColor = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
  trend?: number;
  color?: StatCardColor;
  description?: string;
  delay?: number;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeType = "neutral", 
  className,
  trend,
  color = "primary",
  description,
  delay = 0,
}: StatCardProps) {
  
  const colors: Record<StatCardColor, {
    text: string;
    iconBg: string;
    border: string;
    accent: string;
    glow: string;
  }> = {
    primary: {
      text: "text-primary",
      iconBg: "bg-primary/10 text-primary border-primary/20",
      border: "border-primary/30",
      accent: "bg-primary",
      glow: "bg-primary/[0.07]",
    },
    success: {
      text: "text-success",
      iconBg: "bg-success/10 text-success border-success/20",
      border: "border-success/30",
      accent: "bg-primary",
      glow: "bg-success/[0.07]",
    },
    warning: {
      text: "text-warning",
      iconBg: "bg-warning/10 text-warning border-warning/20",
      border: "border-warning/30",
      accent: "bg-primary",
      glow: "bg-warning/[0.07]",
    },
    destructive: {
      text: "text-destructive",
      iconBg: "bg-destructive/10 text-destructive border-destructive/20",
      border: "border-destructive/30",
      accent: "bg-primary",
      glow: "bg-destructive/[0.06]",
    },
    info: {
      text: "text-info",
      iconBg: "bg-info/10 text-info border-info/20",
      border: "border-info/30",
      accent: "bg-primary",
      glow: "bg-info/[0.07]",
    },
    neutral: {
      text: "text-foreground",
      iconBg: "bg-muted/50 text-muted-foreground border-border/60",
      border: "border-border/60",
      accent: "bg-primary/80",
      glow: "bg-primary/[0.05]",
    }
  };

  const c = colors[color];

  return (
    <div 
      className={cn(
        "seller-hover-card dashboard-stat-card platform-card group relative flex h-full min-h-[108px] flex-col justify-between overflow-hidden rounded-[16px] border border-border bg-card p-3.5 animate-in fade-in slide-in-from-bottom-2 active:scale-[0.985] sm:min-h-[148px] sm:rounded-2xl sm:p-5",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={cn("pointer-events-none absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-80 transition-all duration-500 group-hover:top-2 group-hover:bottom-2 group-hover:w-1", c.accent)} />
      <span className={cn("pointer-events-none absolute inset-y-0 left-0 w-24 opacity-0 transition-opacity duration-500 group-hover:opacity-100", c.glow)} />
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-3">
          <div className="space-y-1">
            <p className="truncate text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-muted-foreground/70 sm:text-[10px] sm:tracking-[0.18em]">
              {title}
            </p>
            <h3 className={cn("truncate text-[18px] font-display font-bold leading-tight tracking-[-0.02em] tabular-nums min-[380px]:text-[20px] sm:text-2xl", c.text)}>
              {value}
            </h3>
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {(change || trend !== undefined) && (
              <span className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums border",
                changeType === "positive" ? "bg-success/10 text-success border-success/20" : 
                changeType === "negative" ? "bg-destructive/10 text-destructive border-destructive/20" : 
                "bg-muted/50 text-muted-foreground border-border/60"
              )}>
                {changeType === "positive" ? <TrendingUp className="h-2.5 w-2.5" /> : changeType === "negative" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
              </span>
            )}
            {description && (
              <p className="min-w-0 truncate text-[10px] font-semibold leading-tight text-muted-foreground/70 sm:text-[11px]">
                {description}
              </p>
            )}
          </div>
        </div>

        {Icon && (
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:scale-110 sm:h-10 sm:w-10",
            c.iconBg
          )}>
            <Icon className="h-[15px] w-[15px] sm:h-[17px] sm:w-[17px]" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </div>
  );
}
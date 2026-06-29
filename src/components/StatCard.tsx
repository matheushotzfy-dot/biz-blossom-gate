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
        "seller-hover-card dashboard-stat-card platform-card group relative flex h-full min-h-[120px] flex-col overflow-hidden rounded-[14px] border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 transition-all duration-300 ease-out hover:-translate-y-[2px] hover:border-info/60 active:scale-[0.99] sm:min-h-[152px] sm:p-5",
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
        borderLeft: "3px solid hsl(var(--info))",
      }}
    >
      <span className={cn("pointer-events-none absolute inset-y-0 left-0 w-32 opacity-0 transition-opacity duration-500 group-hover:opacity-100", c.glow)} />

      {/* Header: title + icon */}
      <div className="relative flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground/80 sm:text-[11px]">
          {title}
        </p>
        {Icon && (
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border transition-all duration-300 ease-out group-hover:scale-[1.08] sm:h-9 sm:w-9",
            c.iconBg
          )}>
            <Icon className="h-[14px] w-[14px] sm:h-[15px] sm:w-[15px]" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative mt-3 sm:mt-4">
        <h3 className={cn("truncate text-[22px] font-display font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-[28px]", c.text)}>
          {value}
        </h3>
      </div>

      {/* Footer: trend + description */}
      <div className="relative mt-auto flex items-center gap-2 pt-3 sm:pt-4">
        {(change || trend !== undefined) && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums border",
            changeType === "positive" ? "bg-success/10 text-success border-success/25" :
            changeType === "negative" ? "bg-destructive/10 text-destructive border-destructive/25" :
            "bg-muted/50 text-muted-foreground border-border/60"
          )}>
            {changeType === "positive" ? <TrendingUp className="h-2.5 w-2.5" /> : changeType === "negative" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
            {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
          </span>
        )}
        {description && (
          <p className="min-w-0 truncate text-[11px] font-medium leading-tight text-muted-foreground/75">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
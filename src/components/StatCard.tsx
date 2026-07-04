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
    iconGlow: string;
    border: string;
    accent: string;
    glow: string;
  }> = {
    primary: {
      text: "text-primary",
      iconBg: "bg-gradient-to-br from-primary/[0.18] to-primary/[0.05] text-primary border-primary/25 shadow-[inset_0_1px_0_hsl(var(--primary)/0.25),inset_0_0_0_1px_hsl(var(--primary)/0.10)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--primary)/0.55)]",
      border: "border-primary/30",
      accent: "bg-primary",
      glow: "bg-primary/[0.07]",
    },
    success: {
      text: "text-success",
      iconBg: "bg-gradient-to-br from-success/[0.20] to-success/[0.05] text-success border-success/25 shadow-[inset_0_1px_0_hsl(var(--success)/0.28),inset_0_0_0_1px_hsl(var(--success)/0.10)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--success)/0.55)]",
      border: "border-success/30",
      accent: "bg-primary",
      glow: "bg-success/[0.07]",
    },
    warning: {
      text: "text-warning",
      iconBg: "bg-gradient-to-br from-warning/[0.22] to-warning/[0.05] text-warning border-warning/25 shadow-[inset_0_1px_0_hsl(var(--warning)/0.30),inset_0_0_0_1px_hsl(var(--warning)/0.12)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--warning)/0.55)]",
      border: "border-warning/30",
      accent: "bg-primary",
      glow: "bg-warning/[0.07]",
    },
    destructive: {
      text: "text-destructive",
      iconBg: "bg-gradient-to-br from-destructive/[0.20] to-destructive/[0.05] text-destructive border-destructive/25 shadow-[inset_0_1px_0_hsl(var(--destructive)/0.28),inset_0_0_0_1px_hsl(var(--destructive)/0.10)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--destructive)/0.55)]",
      border: "border-destructive/30",
      accent: "bg-primary",
      glow: "bg-destructive/[0.06]",
    },
    info: {
      text: "text-info",
      iconBg: "bg-gradient-to-br from-info/[0.20] to-info/[0.05] text-info border-info/25 shadow-[inset_0_1px_0_hsl(var(--info)/0.28),inset_0_0_0_1px_hsl(var(--info)/0.10)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--info)/0.55)]",
      border: "border-info/30",
      accent: "bg-primary",
      glow: "bg-info/[0.07]",
    },
    neutral: {
      text: "text-foreground",
      iconBg: "bg-gradient-to-br from-foreground/[0.10] to-foreground/[0.02] text-foreground border-border shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),inset_0_0_0_1px_hsl(var(--border)/0.4)]",
      iconGlow: "shadow-[0_6px_18px_-6px_hsl(var(--foreground)/0.35)]",
      border: "border-border/60",
      accent: "bg-primary/80",
      glow: "bg-primary/[0.05]",
    }
  };

  const c = colors[color];

  return (
    <div
      className={cn(
        "seller-hover-card dashboard-stat-card platform-card group relative flex h-full min-h-[120px] flex-col overflow-hidden rounded-[14px] border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 transition-[transform,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/70 hover:bg-primary/[0.045] active:translate-y-0 active:scale-[0.99] sm:min-h-[152px] sm:p-5",
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Left primary accent bar on hover — matches integration cards */}
      <span className="pointer-events-none absolute left-0 top-3 bottom-3 z-0 w-[3px] origin-center scale-y-50 rounded-r-full bg-primary opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100 group-hover:opacity-100" />
      {/* Sheen sweep */}
      <span className="pointer-events-none absolute inset-0 z-0 -translate-x-[120%] bg-[linear-gradient(115deg,transparent_0%,hsl(var(--primary)/0.10)_44%,transparent_72%)] opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[120%] group-hover:opacity-100" />
      {/* Faint primary wash */}
      <span className="pointer-events-none absolute inset-0 z-0 bg-primary/[0.025] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />



      {/* Header: title + icon */}
      <div className="relative flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground/80 sm:text-[11px]">
          {title}
        </p>
        {Icon && (
          <div className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-all duration-300 ease-out group-hover:scale-[1.08] group-hover:-rotate-3 sm:h-10 sm:w-10",
            c.iconBg,
            "group-hover:" + c.iconGlow.replace("shadow-", "shadow-")
          )}>
            {/* Inner highlight — glassy */}
            <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[8px] bg-gradient-to-b from-white/10 to-transparent opacity-70" />
            <Icon className="relative h-[15px] w-[15px] sm:h-4 sm:w-4" strokeWidth={2.5} />
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
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
  }> = {
    primary: {
      text: "text-primary",
      iconBg: "bg-primary/10 text-primary border-primary/20",
      border: "border-primary/30"
    },
    success: {
      text: "text-emerald-500",
      iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      border: "border-emerald-500/30"
    },
    warning: {
      text: "text-amber-500",
      iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      border: "border-amber-500/30"
    },
    destructive: {
      text: "text-red-500",
      iconBg: "bg-red-500/10 text-red-500 border-red-500/20",
      border: "border-red-500/30"
    },
    info: {
      text: "text-blue-500",
      iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      border: "border-blue-500/30"
    },
    neutral: {
      text: "text-foreground",
      iconBg: "bg-muted/50 text-muted-foreground border-border/60",
      border: "border-border/60"
    }
  };

  const c = colors[color];

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-black/5 animate-in fade-in slide-in-from-bottom-2",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 leading-none truncate">
              {title}
            </p>
            <h3 className="text-2xl font-display font-bold text-foreground tracking-[-0.02em] tabular-nums truncate">
              {value}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {(change || trend !== undefined) && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums border",
                changeType === "positive" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                changeType === "negative" ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                "bg-muted/50 text-muted-foreground border-border/60"
              )}>
                {changeType === "positive" ? <TrendingUp className="h-2.5 w-2.5" /> : changeType === "negative" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
              </span>
            )}
            {description && (
              <p className="text-[11px] font-medium text-muted-foreground/70 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        {Icon && (
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm shrink-0",
            c.iconBg
          )}>
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </div>
  );
}
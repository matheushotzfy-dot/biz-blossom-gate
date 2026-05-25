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
  variant?: "default" | "glass" | "gradient";
  showLine?: boolean;
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
  variant = "default",
  showLine = false
}: StatCardProps) {
  
  const colors: Record<StatCardColor, {
    bg: string;
    text: string;
    border: string;
    iconBg: string;
    line: string;
    glow: string;
  }> = {
    primary: {
      bg: "from-primary/10 to-transparent",
      text: "text-primary",
      border: "border-primary/20",
      iconBg: "bg-primary/10 text-primary",
      line: "bg-primary",
      glow: "shadow-primary/5"
    },
    success: {
      bg: "from-success/10 to-transparent",
      text: "text-success",
      border: "border-success/20",
      iconBg: "bg-success/10 text-success",
      line: "bg-success",
      glow: "shadow-success/5"
    },
    warning: {
      bg: "from-warning/10 to-transparent",
      text: "text-warning",
      border: "border-warning/20",
      iconBg: "bg-warning/10 text-warning",
      line: "bg-warning",
      glow: "shadow-warning/5"
    },
    destructive: {
      bg: "from-destructive/10 to-transparent",
      text: "text-destructive",
      border: "border-destructive/20",
      iconBg: "bg-destructive/10 text-destructive",
      line: "bg-destructive",
      glow: "shadow-destructive/5"
    },
    info: {
      bg: "from-info/10 to-transparent",
      text: "text-info",
      border: "border-info/20",
      iconBg: "bg-info/10 text-info",
      line: "bg-info",
      glow: "shadow-info/5"
    },
    neutral: {
      bg: "from-foreground/5 to-transparent",
      text: "text-foreground",
      border: "border-border/50",
      iconBg: "bg-muted text-muted-foreground",
      line: "bg-border",
      glow: "shadow-black/5"
    }
  };

  const c = colors[color];

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-4",
        variant === "glass" ? "bg-card/40 backdrop-blur-xl border-border/40" : "bg-card border-border/40",
        "hover:border-primary/30",
        c.glow,
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Inner reflection layer */}
      <div className="absolute inset-px rounded-[1.45rem] bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

      {/* Accent line */}
      {showLine && <div className={cn("absolute inset-x-0 top-0 h-1", c.line)} />}

      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-[0.12]",
        c.bg
      )} />

      <div className="relative p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          {Icon && (
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110 shadow-sm shadow-black/5",
              c.iconBg,
              "border border-border/5"
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          
          {(change || trend !== undefined) && (
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider",
              changeType === "positive" ? "bg-success/10 text-success border border-success/10" : 
              changeType === "negative" ? "bg-destructive/10 text-destructive border border-destructive/10" : 
              "bg-muted/50 text-muted-foreground border border-border/50"
            )}>
              {changeType === "positive" ? <TrendingUp className="h-2.5 w-2.5" /> : changeType === "negative" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
              {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className={cn(
              "text-2xl md:text-3xl font-black tracking-tight transition-all duration-500",
              variant === "gradient" ? "bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent" : "text-foreground"
            )}>
              {value}
            </h3>
          </div>
          {description && (
            <p className="text-[10px] font-medium text-muted-foreground/40 leading-relaxed group-hover:text-muted-foreground/60 transition-colors">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {/* Bottom subtle glow */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-current to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-20",
        c.text
      )} />
    </div>
  );
}
}

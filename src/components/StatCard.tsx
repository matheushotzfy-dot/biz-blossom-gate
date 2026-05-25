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
        "group relative overflow-hidden rounded-[2.5rem] border transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-4",
        variant === "glass" ? "bg-card/40 backdrop-blur-2xl border-border/40" : "bg-card border-border/40",
        "hover:border-primary/20",
        c.glow,
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Inner reflection layer */}
      <div className="absolute inset-px rounded-[2.45rem] bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

      {/* Accent line */}
      {showLine && <div className={cn("absolute inset-x-0 top-0 h-1", c.line)} />}

      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-[0.15]",
        c.bg
      )} />

      <div className="relative p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          {Icon && (
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-black/5",
              c.iconBg,
              "border border-border/10"
            )}>
              <Icon className="h-6 w-6" />
            </div>
          )}
          
          {(change || trend !== undefined) && (
            <div className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]",
              changeType === "positive" ? "bg-success/10 text-success border border-success/15" : 
              changeType === "negative" ? "bg-destructive/10 text-destructive border border-destructive/15" : 
              "bg-muted/50 text-muted-foreground border border-border/50"
            )}>
              {changeType === "positive" ? <TrendingUp className="h-3 w-3" /> : changeType === "negative" ? <TrendingDown className="h-3 w-3" /> : null}
              {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/60">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className={cn(
              "text-3xl md:text-[34px] font-black tracking-tighter transition-all duration-500 group-hover:tracking-tight",
              variant === "gradient" ? "bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent" : "text-foreground"
            )}>
              {value}
            </h3>
          </div>
          {description && (
            <p className="text-[10px] font-bold text-muted-foreground/30 leading-relaxed group-hover:text-muted-foreground/50 transition-colors tracking-wide">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {/* Bottom subtle glow */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-30",
        c.text
      )} />
    </div>
  );
}

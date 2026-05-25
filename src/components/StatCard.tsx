import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
  trend?: number; // percentage trend
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  description?: string;
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
  description
}: StatCardProps) {
  const colorMap = {
    primary: "from-primary/20 to-primary/5 text-primary border-primary/20",
    success: "from-success/20 to-success/5 text-success border-success/20",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/20",
    destructive: "from-destructive/20 to-destructive/5 text-destructive border-destructive/20",
    info: "from-info/20 to-info/5 text-info border-info/20",
  };

  const iconBgMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-3xl border border-border/50 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5",
      className
    )}>
      {/* Decorative background gradient */}
      <div className={cn(
        "absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.03] blur-2xl transition-opacity group-hover:opacity-[0.08]",
        colorMap[color].split(" ")[0],
        colorMap[color].split(" ")[1]
      )} />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110",
            iconBgMap[color]
          )}>
            <Icon className="h-6 w-6" />
          </div>
          
          {(change || trend !== undefined) && (
            <div className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider",
              changeType === "positive" ? "bg-success/10 text-success" : 
              changeType === "negative" ? "bg-destructive/10 text-destructive" : 
              "bg-muted text-muted-foreground"
            )}>
              {changeType === "positive" ? <TrendingUp className="h-3 w-3" /> : changeType === "negative" ? <TrendingDown className="h-3 w-3" /> : null}
              {change || (trend !== undefined ? `${trend > 0 ? "+" : ""}${trend}%` : "")}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black tracking-tighter text-foreground">
              {value}
            </h3>
          </div>
          {description && (
            <p className="text-[10px] font-bold text-muted-foreground/40">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


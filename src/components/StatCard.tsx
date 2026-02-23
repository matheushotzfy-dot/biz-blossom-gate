import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
}

export function StatCard({ title, value, icon: Icon, change, changeType = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("glass-card-hover rounded-2xl p-5 animate-slide-up", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-extrabold mt-2 tracking-tight text-foreground font-display">{value}</p>
          {change && (
            <p className={cn(
              "text-xs font-semibold mt-2",
              changeType === "positive" && "text-primary",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-foreground/40"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

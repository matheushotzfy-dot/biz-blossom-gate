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
    <div className={cn("glass-card-hover rounded-2xl p-5 md:p-6 animate-slide-up", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.18em]">{title}</p>
          <p className="text-[26px] md:text-[30px] font-black mt-2.5 tracking-[-0.03em] text-foreground font-display tabular-nums leading-none">{value}</p>
          {change && (
            <p className={cn(
              "text-[12px] font-semibold mt-2.5",
              changeType === "positive" && "text-primary",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-foreground/40"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

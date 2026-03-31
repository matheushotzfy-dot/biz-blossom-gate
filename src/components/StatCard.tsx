import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
  tone?: "primary" | "info" | "warning" | "success" | "destructive";
}

const TONE_MAP: Record<string, { bg: string; text: string; ring: string; accent: string }> = {
  primary:     { bg: "bg-primary/10",     text: "text-primary",     ring: "ring-primary/15",     accent: "bg-primary" },
  info:        { bg: "bg-info/10",        text: "text-info",        ring: "ring-info/15",        accent: "bg-info" },
  warning:     { bg: "bg-warning/10",     text: "text-warning",     ring: "ring-warning/15",     accent: "bg-warning" },
  success:     { bg: "bg-success/10",     text: "text-success",     ring: "ring-success/15",     accent: "bg-success" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/15", accent: "bg-destructive" },
};

export function StatCard({ title, value, icon: Icon, change, changeType = "neutral", className, tone = "primary" }: StatCardProps) {
  const t = TONE_MAP[tone] || TONE_MAP.primary;

  return (
    <div className={cn(
      "group relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 overflow-hidden p-4 md:p-5",
      "hover:border-border/60 hover:shadow-[0_8px_24px_hsl(var(--foreground)/0.06)] transition-all duration-300",
      className
    )}>
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", t.accent)} />
      
      <div className="pl-1.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em]">{title}</p>
            <p className="text-[22px] md:text-2xl font-display font-black mt-2 tracking-[-0.03em] text-foreground tabular-nums">{value}</p>
            {change && (
              <p className={cn(
                "text-[11px] font-display font-bold mt-1.5",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground/40"
              )}>
                {change}
              </p>
            )}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1 shadow-sm shrink-0", t.bg, t.ring)}>
            <Icon className={cn("h-[18px] w-[18px]", t.text)} />
          </div>
        </div>
      </div>
    </div>
  );
}

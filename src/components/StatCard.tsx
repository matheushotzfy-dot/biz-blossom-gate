import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  className?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("glass-card-hover rounded-2xl p-5 md:p-6 animate-slide-up bg-card/40 backdrop-blur-xl border border-border/50", className)}>
      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">{title}</p>
      <p className="text-[26px] md:text-[32px] font-black mt-3 tracking-[-0.04em] text-foreground font-display tabular-nums leading-none">{value}</p>
      {change && (
        <p className={cn(
          "text-[11px] font-semibold mt-3 flex items-center gap-1.5",
          changeType === "positive" && "text-primary",
          changeType === "negative" && "text-destructive",
          changeType === "neutral" && "text-muted-foreground/60"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}

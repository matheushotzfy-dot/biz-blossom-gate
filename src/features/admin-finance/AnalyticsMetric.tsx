import { cn } from "@/lib/utils";

interface AnalyticsMetricProps { label: string; value: string; subtitle?: string; tone?: "neutral" | "primary" | "success" | "warning" | "destructive" }
const tones = { neutral: "text-foreground", primary: "text-primary", success: "text-success", warning: "text-warning", destructive: "text-destructive" };
export function AnalyticsMetric({ label, value, subtitle, tone = "neutral" }: AnalyticsMetricProps) {
  return <div className="min-w-0 rounded-lg border border-border bg-card p-3.5 sm:p-4">
    <p className="text-xs font-medium leading-relaxed text-muted-foreground">{label}</p>
    <p className={cn("my-3 break-words font-display text-xl font-semibold tabular-nums sm:text-2xl", tones[tone])}>{value}</p>
    {subtitle && <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
  </div>;
}
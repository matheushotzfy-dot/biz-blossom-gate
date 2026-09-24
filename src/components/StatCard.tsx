import { LucideIcon, TrendingUp, TrendingDown, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
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
  hideable?: boolean;
  hiddenPlaceholder?: string;
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
  hideable = false,
  hiddenPlaceholder = "••••••",
}: StatCardProps) {
  const storageKey = `statcard_hidden::${title}`;
  const [selfHidden, setSelfHidden] = useState<boolean>(() => {
    if (!hideable) return false;
    try { return localStorage.getItem(storageKey) === "true"; } catch { return false; }
  });
  useEffect(() => {
    if (!hideable) return;
    try { localStorage.setItem(storageKey, String(selfHidden)); } catch { /* noop */ }
  }, [selfHidden, hideable, storageKey]);
  const displayValue = hideable && selfHidden ? hiddenPlaceholder : value;
  const displayDescription = hideable && selfHidden ? "•••" : description;
  
  
  const colors: Record<StatCardColor, {
    text: string;
    iconVariant: string;
  }> = {
    primary: {
      text: "text-primary",
      iconVariant: "",
    },
    success: {
      text: "text-success",
      iconVariant: "success",
    },
    warning: {
      text: "text-warning",
      iconVariant: "warning",
    },
    destructive: {
      text: "text-destructive",
      iconVariant: "destructive",
    },
    info: {
      text: "text-info",
      iconVariant: "info",
    },
    neutral: {
      text: "text-foreground",
      iconVariant: "",
    }
  };

  const c = colors[color];

  return (
    <div
      className={cn(
 "stat-hero-card group relative flex h-full min-h-[116px] flex-col overflow-hidden rounded-xl border border-border/90 bg-card p-4 shadow-[0_1px_0_hsl(var(--foreground)/0.025)] animate-in fade-in slide-in-from-bottom-2 transition-[border-color,background-color,box-shadow] duration-200 hover:border-foreground/15 sm:min-h-[136px] sm:p-5",
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Header: title + icon */}
      <div className="relative z-[2] flex items-center justify-between gap-3">
         <p className="truncate text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground/80 transition-colors duration-200 sm:text-[10.5px]">
          {title}
        </p>
        <div className="flex items-center gap-1.5">
          {hideable && (
            <button
              type="button"
              onClick={() => setSelfHidden((v) => !v)}
              aria-label={selfHidden ? "Mostrar valor" : "Ocultar valor"}
               className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground/70 transition-[background-color,border-color,color,transform] duration-200 hover:border-border hover:bg-accent/50 hover:text-foreground active:scale-[0.96]"
            >
              {selfHidden ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />}
            </button>
          )}
          {Icon && (
            <div className={cn(
 "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card-inset transition-colors duration-200 sm:h-10 sm:w-10",
              c.text,
            )}>
              <Icon className="relative h-4 w-4 sm:h-[17px] sm:w-[17px]" strokeWidth={2} />
            </div>
          )}
        </div>
      </div>


      {/* Value */}
      <div className="relative mt-3 sm:mt-4">
         <h3 className={cn("truncate font-numbers text-[22px] font-semibold leading-none tabular-nums sm:text-[27px]", c.text)}>
          {displayValue}
        </h3>
      </div>

      {/* Footer: trend + description */}
      <div className="relative mt-auto flex items-center gap-2 pt-3 sm:pt-4">
        {(change || trend !== undefined) && !(hideable && selfHidden) && (
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
        {displayDescription && (
          <p className="min-w-0 truncate text-[11px] font-medium leading-tight text-muted-foreground/75">
            {displayDescription}
          </p>
        )}
      </div>
    </div>
  );
}
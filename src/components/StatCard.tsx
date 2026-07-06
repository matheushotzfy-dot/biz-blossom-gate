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
        "stat-hero-card group relative flex h-full min-h-[120px] flex-col overflow-hidden rounded-[1.35rem] border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 sm:min-h-[152px] sm:rounded-3xl sm:p-5",
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Header: title + icon */}
      <div className="relative z-[2] flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground/80 transition-colors duration-300 sm:text-[11px]">
          {title}
        </p>
        {Icon && (
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-border/60 bg-background/40 transition-colors duration-300 sm:h-11 sm:w-11",
            c.text,
          )}>
            <Icon className="relative h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]" strokeWidth={2.5} />
          </div>
        )}
      </div>


      {/* Value */}
      <div className="relative mt-3 sm:mt-4">
        <h3 className={cn("truncate text-[22px] font-display font-bold leading-none tracking-[-0.025em] tabular-nums sm:text-[28px]", c.text)}>
          {value}
        </h3>
      </div>

      {/* Footer: trend + description */}
      <div className="relative mt-auto flex items-center gap-2 pt-3 sm:pt-4">
        {(change || trend !== undefined) && (
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
        {description && (
          <p className="min-w-0 truncate text-[11px] font-medium leading-tight text-muted-foreground/75">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
import * as React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedChoiceOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  badge?: string;
  disabled?: boolean;
};

type SegmentedChoiceProps<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedChoiceOption<T>[];
  columns?: 1 | 2 | 3 | 4;
  size?: "sm" | "md";
  className?: string;
  name?: string;
};

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

export function SegmentedChoice<T extends string = string>({
  value,
  onValueChange,
  options,
  columns = 2,
  size = "md",
  className,
  name,
}: SegmentedChoiceProps<T>) {
  return (
    <div role="radiogroup" className={cn("grid gap-2.5", COLS[columns], className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            name={name}
            aria-checked={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onValueChange(opt.value)}
            className={cn(
              "group relative flex items-start gap-3 overflow-hidden rounded-2xl border bg-card text-left transition-all duration-200",
              size === "md" ? "p-3.5" : "px-3 py-2.5",
              active
                ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                : "border-border/60 hover:border-primary/35 hover:bg-primary/[0.03]",
              opt.disabled && "cursor-not-allowed opacity-50",
              !opt.disabled && "active:scale-[0.985] cursor-pointer",
            )}
          >
            {active && (
              <span className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />
            )}

            {Icon && (
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl border transition-all",
                  size === "md" ? "h-9 w-9" : "h-8 w-8",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/30 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary",
                )}
              >
                <Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.25} />
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "block truncate font-heading font-black tracking-tight",
                    size === "md" ? "text-[13px]" : "text-[12px]",
                    active ? "text-foreground" : "text-foreground/85",
                  )}
                >
                  {opt.label}
                </span>
                {opt.badge && (
                  <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-warning">
                    {opt.badge}
                  </span>
                )}
              </span>
              {opt.description && (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground/80">
                  {opt.description}
                </span>
              )}
            </span>

            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-transparent text-transparent",
              )}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

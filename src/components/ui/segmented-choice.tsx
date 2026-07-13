import * as React from "react";
import { type LucideIcon, Check } from "lucide-react";
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
    <div role="radiogroup" className={cn("grid gap-2", COLS[columns], className)}>
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
              "group relative flex items-center gap-3 overflow-hidden rounded-xl border text-left transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              size === "md" ? "px-3.5 py-3" : "px-3 py-2.5",
              active
                ? "border-primary/60 bg-primary/[0.08] text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35)_inset]"
                : "border-border/60 bg-card/40 text-muted-foreground hover:-translate-y-[1px] hover:border-primary/35 hover:bg-card hover:text-foreground hover:shadow-sm",
              opt.disabled && "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border/60 hover:bg-card/40",
              !opt.disabled && "cursor-pointer active:translate-y-0 active:scale-[0.99]",
            )}
          >
            {/* subtle glow on active */}
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
              />
            )}

            {Icon && (
              <span
                className={cn(
                  "relative z-10 flex shrink-0 items-center justify-center rounded-lg border transition-all",
                  size === "md" ? "h-8 w-8" : "h-7 w-7",
                  active
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 bg-muted/40 text-muted-foreground/80 group-hover:border-primary/30 group-hover:text-primary",
                )}
              >
                <Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2.25} />
              </span>
            )}

            <span className="relative z-10 flex min-w-0 flex-1 flex-col leading-tight">
              <span
                className={cn(
                  "flex items-center gap-1.5 truncate font-heading font-black tracking-tight",
                  size === "md" ? "text-[13px]" : "text-[12px]",
                  active ? "text-foreground" : "text-foreground/85",
                )}
              >
                {opt.label}
                {opt.badge && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                      active
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {opt.badge}
                  </span>
                )}
              </span>
              {opt.description && (
                <span
                  className={cn(
                    "truncate text-[10.5px] font-semibold mt-0.5",
                    active ? "text-primary/80" : "text-muted-foreground/70",
                  )}
                >
                  {opt.description}
                </span>
              )}
            </span>

            {active && (
              <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Check className="h-3 w-3" strokeWidth={3.25} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

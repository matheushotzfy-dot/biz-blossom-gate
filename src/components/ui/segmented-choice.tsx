import * as React from "react";
import { type LucideIcon } from "lucide-react";
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
    <div
      role="radiogroup"
      className={cn(
        "grid gap-1 rounded-xl border border-border/60 bg-background/40 p-1",
        COLS[columns],
        className,
      )}
    >
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
              "relative flex items-center justify-center gap-2 rounded-lg text-center transition-all duration-150",
              size === "md" ? "h-11 px-3" : "h-9 px-2.5",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              opt.disabled && "cursor-not-allowed opacity-50",
              !opt.disabled && "cursor-pointer",
            )}
          >
            {Icon && (
              <Icon
                className={cn(size === "md" ? "h-4 w-4" : "h-3.5 w-3.5", "shrink-0")}
                strokeWidth={2.25}
              />
            )}
            <span className="flex flex-col items-start leading-tight min-w-0">
              <span
                className={cn(
                  "truncate font-semibold tracking-tight",
                  size === "md" ? "text-[13px]" : "text-[12px]",
                )}
              >
                {opt.label}
              </span>
              {opt.description && size === "md" && (
                <span
                  className={cn(
                    "truncate text-[10px] font-medium",
                    active ? "text-primary-foreground/75" : "text-muted-foreground/70",
                  )}
                >
                  {opt.description}
                </span>
              )}
            </span>
            {opt.badge && (
              <span
                className={cn(
                  "ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

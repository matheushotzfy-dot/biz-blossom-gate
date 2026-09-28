import { useId } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HubTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional counter badge (e.g. pending items). */
  count?: number;
};

type HubTabsProps = {
  tabs: HubTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

/** Segmented tab rail: hairline track, sliding yellow indicator, icon lights up on hover. */
export function HubTabs({ tabs, active, onChange, className }: HubTabsProps) {
  const group = useId();
  return (
    <div className={cn("w-full pt-2 pb-5", className)}>
      <div
        role="tablist"
        className="relative flex w-full overflow-x-auto border-b border-border scrollbar-none [mask-image:linear-gradient(90deg,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => { onChange(tab.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 pb-3 pt-2 text-[13px] font-semibold outline-none transition-colors duration-200 focus-visible:text-foreground",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-[color,transform] duration-200",
                  isActive ? "text-primary" : "text-muted-foreground/60 group-hover:-translate-y-px group-hover:text-primary",
                )}
                strokeWidth={2}
              />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className={cn(
                  "min-w-[18px] rounded-full px-1.5 text-center font-mono text-[10px] leading-[18px] tabular-nums",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>{tab.count}</span>
              )}
              {isActive && (
                <motion.span
                  layoutId={`hubtab-${group}`}
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary"
                />
              )}
              <span aria-hidden className="pointer-events-none absolute inset-x-2 -bottom-px h-px scale-x-0 bg-foreground/30 transition-transform duration-300 group-hover:scale-x-100" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

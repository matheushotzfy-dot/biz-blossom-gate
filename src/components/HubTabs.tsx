import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type HubTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type HubTabsProps = {
  tabs: HubTab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function HubTabs({ tabs, active, onChange, className }: HubTabsProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] pt-4 pb-0", className)}>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/30 bg-card/55 p-1.5 backdrop-blur-xl scrollbar-none w-full sm:w-fit shadow-[0_4px_24px_-12px_hsl(var(--foreground)/0.15)]">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onChange(tab.id);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={cn(
                "group relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11.5px] sm:text-[13px] font-bold border overflow-hidden transition-[transform,border-color,background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]",
                isActive
                  ? "bg-primary/15 text-foreground border-primary/45 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_8px_28px_-10px_hsl(var(--primary)/0.45)] ring-1 ring-primary/25"
                  : "text-muted-foreground/70 border-transparent hover:text-foreground hover:-translate-y-px hover:bg-primary/[0.06] hover:border-primary/25 hover:shadow-[0_6px_20px_-12px_hsl(var(--primary)/0.4)]",
              )}
            >
              {/* sheen */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(115deg,transparent_0%,hsl(var(--primary)/0.10)_45%,transparent_75%)] opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-full group-hover:opacity-100" />
              <tab.icon
                className={cn(
                  "h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-[color,transform] duration-300",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground/45 group-hover:text-primary group-hover:scale-110 group-hover:-rotate-3",
                )}
              />
              <span className="relative">{tab.label}</span>
              {isActive && (
                <span className="absolute left-3 right-3 -bottom-[5px] h-[3px] rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.65)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
};

export function HubTabs({ tabs, active, onChange }: HubTabsProps) {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-4 pb-0">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/25 bg-card/45 p-1.5 backdrop-blur-xl scrollbar-none w-fit shadow-sm">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { onChange(tab.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_8px_24px_hsl(var(--primary)/0.08)] ring-1 ring-primary/30"
                  : "opacity-60 text-muted-foreground hover:opacity-90 hover:text-foreground hover:-translate-y-px hover:bg-muted/15",
              )}
            >
              <tab.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/50")} />
              {tab.label}
              {isActive && (
                <span className="absolute left-3 right-3 -bottom-1 h-[3px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

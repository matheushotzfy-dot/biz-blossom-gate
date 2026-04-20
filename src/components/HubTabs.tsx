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
                "relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-200 border",
                isActive
                  ? "bg-primary/15 text-foreground border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_4px_20px_hsl(var(--primary)/0.12)] ring-1 ring-primary/25"
                  : "opacity-55 text-muted-foreground border-transparent hover:opacity-85 hover:text-foreground hover:-translate-y-px hover:bg-muted/10 hover:border-border/30",
              )}
            >
              <tab.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/40")} />
              {tab.label}
              {isActive && (
                <span className="absolute left-3 right-3 -bottom-[5px] h-[3px] rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

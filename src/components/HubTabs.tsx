import { cn } from "@/lib/utils";

export type HubTab = {
  id: string;
  label: string;
};

type HubTabsProps = {
  tabs: HubTab[];
  active: string;
  onChange: (id: string) => void;
};

export function HubTabs({ tabs, active, onChange }: HubTabsProps) {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-4 pb-0">
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border/20 bg-card/40 p-2 backdrop-blur-xl scrollbar-none w-fit shadow-sm">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { onChange(tab.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
              className={cn(
                "relative flex items-center justify-center whitespace-nowrap rounded-xl px-5 py-3 text-[13px] font-bold transition-all duration-200 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground/60 border-transparent hover:text-foreground hover:bg-muted/30",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
 "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-200",
 isActive
 ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/12"
 : "text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground",
 )}
 >
 <tab.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/50")} />
 {tab.label}
 </button>
 );
 })}
 </div>
 </div>
 );
}

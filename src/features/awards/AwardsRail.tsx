import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AWARDS } from "./awards-data";

interface AwardsRailProps {
  activeIndex: number;
  revenue: number;
  onSelect: (index: number) => void;
}

export function AwardsRail({ activeIndex, revenue, onSelect }: AwardsRailProps) {
  return (
    <nav aria-label="Marcos de faturamento" className="border-t border-awards-steel/15 bg-awards-surface/70">
      <div className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none">
        {AWARDS.map((award, index) => {
          const unlocked = revenue >= award.value;
          const active = activeIndex === index;
          return (
            <Button
              key={award.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect(index)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative h-[78px] min-w-[126px] flex-1 snap-start rounded-none border-r border-awards-steel/10 px-4 text-left hover:bg-awards-accent/5",
                active && "bg-awards-accent/10 text-awards-ink",
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-px", active ? "bg-awards-accent" : "bg-transparent")} />
              <span className="flex w-full items-center justify-between gap-3">
                <span>
                  <span className="block font-mono text-[9px] font-medium text-awards-steel">{award.roman} · {award.tier}</span>
                  <span className="mt-1 block font-display text-sm font-bold tabular-nums">{award.label}</span>
                </span>
                <span className={cn("flex h-6 w-6 items-center justify-center border", unlocked ? "border-awards-accent/40 text-awards-accent" : "border-awards-steel/15 text-awards-steel/40")}>
                  {unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
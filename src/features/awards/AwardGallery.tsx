import { Check, Lock } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AWARDS } from "./awards-data";

interface AwardGalleryProps {
  activeIndex: number;
  revenue: number;
  onSelect: (index: number) => void;
}

export function AwardGallery({ activeIndex, revenue, onSelect }: AwardGalleryProps) {
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Galeria de premiações" className="awards-gallery overflow-x-auto pb-2">
      <div className="grid min-w-[850px] grid-cols-7 gap-2.5 lg:min-w-0">
        {AWARDS.map((award, index) => {
          const unlocked = revenue >= award.value;
          const active = activeIndex === index;

          return (
            <motion.div
              key={award.id}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.3 }}
            >
              <Button
                type="button"
                variant="ghost"
                aria-current={active ? "true" : undefined}
                aria-label={`Ver ${award.title}`}
                onClick={() => onSelect(index)}
                className={cn(
                  "group relative h-[154px] w-full flex-col justify-end overflow-hidden rounded-md border px-2 pb-2 pt-1 transition-colors duration-200",
                  active
                    ? "border-awards-accent bg-awards-accent/10 before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-full before:bg-awards-accent"
                    : "border-awards-steel/15 bg-awards-surface/80 hover:-translate-y-0.5 hover:border-awards-accent/40 hover:bg-awards-surface",
                )}
              >
                <img
                  src={award.image}
                  alt=""
                  width={150}
                  height={115}
                  loading="lazy"
                  className={cn(
                    "absolute inset-x-0 top-0 mx-auto h-[112px] w-full object-contain px-1 transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-[1.03]",
                    !unlocked && "grayscale",
                  )}
                />
                <span className="relative z-10 flex w-full items-center justify-between gap-1 border-t border-awards-steel/15 pt-2">
                  <span className="font-display text-[11px] font-bold text-awards-ink">{award.label}</span>
                  {unlocked ? <Check className="h-3 w-3 text-awards-accent" /> : <Lock className="h-3 w-3 text-awards-steel" />}
                </span>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
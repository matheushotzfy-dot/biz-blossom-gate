import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Billion-Dollar SaaS Calendar.
 * Sharp 1px borders, no shadows/glow. Emerald accents for selection.
 * Used across the platform for any date selection.
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex justify-center pt-1 pb-2 relative items-center",
        caption_label:
          "font-display font-black text-[13px] tracking-tight text-foreground capitalize",
        caption_dropdowns: "flex items-center justify-center gap-2",
        dropdown_month: "relative",
        dropdown_year: "relative",
        dropdown: cn(
          "h-8 rounded-md border border-border bg-background px-2 pr-7",
          "font-display text-[11px] font-black capitalize text-foreground",
          "outline-none transition-colors hover:bg-secondary/60 focus:border-primary/50"
        ),
        dropdown_icon: "ml-1 text-muted-foreground/70",
        nav: "flex items-center",
        nav_button: cn(
          "h-7 w-7 rounded-md border border-border bg-card text-muted-foreground/80",
          "hover:text-foreground hover:bg-secondary/60 hover:border-border",
          "transition-colors duration-200 flex items-center justify-center"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "text-muted-foreground/50 w-10 h-7 font-display font-black text-[9px] uppercase tracking-[0.16em] flex items-center justify-center",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-10 w-10 text-center text-[12px] p-0 tabular-nums",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-primary/[0.04]",
          "[&:has([aria-selected])]:bg-primary/[0.06]",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-10 w-10 p-0 font-display font-bold tabular-nums rounded-md",
          "text-foreground/85 hover:bg-secondary/60 hover:text-foreground",
          "transition-colors duration-150",
          "aria-selected:opacity-100 focus-visible:outline-none"
        ),
        day_range_start:
          "day-range-start !bg-primary !text-primary-foreground hover:!bg-primary rounded-r-none",
        day_range_end:
          "day-range-end !bg-primary !text-primary-foreground hover:!bg-primary rounded-l-none",
        day_selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary focus:!bg-primary",
        day_today:
          "ring-1 ring-inset ring-primary/40 text-primary font-black",
        day_outside:
          "day-outside text-muted-foreground/30 aria-selected:text-muted-foreground/40",
        day_disabled: "text-muted-foreground/30 cursor-not-allowed",
        day_range_middle:
          "!bg-primary/10 !text-foreground rounded-none hover:!bg-primary/15",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

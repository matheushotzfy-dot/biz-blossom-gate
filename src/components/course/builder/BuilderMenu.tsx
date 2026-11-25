import type { LucideIcon } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Painel dos menus ⋯ do construtor (mesmo desenho do menu da lista de áreas). */
export const builderMenuContent = "max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 overflow-y-auto rounded-[22px] border border-border bg-popover p-2";

interface Props {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function BuilderMenuItem({ icon: Icon, label, onSelect, destructive, disabled }: Props) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "group flex h-12 cursor-pointer items-center gap-3 rounded-[16px] px-2.5 text-[14.5px] font-semibold outline-none transition-colors",
        destructive ? "text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10" : "text-foreground/85 focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors", destructive ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground group-data-[highlighted]:bg-primary group-data-[highlighted]:text-primary-foreground")}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="truncate">{label}</span>
    </DropdownMenuItem>
  );
}

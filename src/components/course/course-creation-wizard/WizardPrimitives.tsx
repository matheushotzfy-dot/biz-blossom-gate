import type { HTMLAttributes } from "react";
import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AccentTone = "primary" | "info" | "success" | "warning";

const ACCENT_STYLES: Record<AccentTone, { soft: string; solid: string; text: string; border: string }> = {
  primary: {
    soft: "border-primary/20 bg-primary/10 text-primary",
    solid: "border-primary/20 bg-primary text-primary-foreground",
    text: "text-primary",
    border: "border-primary/20",
  },
  info: {
    soft: "border-info/20 bg-info/10 text-info",
    solid: "border-info/20 bg-info text-info-foreground",
    text: "text-info",
    border: "border-info/20",
  },
  success: {
    soft: "border-success/20 bg-success/10 text-success",
    solid: "border-success/20 bg-success text-success-foreground",
    text: "text-success",
    border: "border-success/20",
  },
  warning: {
    soft: "border-warning/20 bg-warning/10 text-warning",
    solid: "border-warning/20 bg-warning text-warning-foreground",
    text: "text-warning",
    border: "border-warning/20",
  },
};

export function WizardPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-[1.5rem] border border-border bg-background", className)} {...props} />;
}

export function WizardPanelHeader({
  icon: Icon,
  title,
  description,
  accent = "primary",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: AccentTone;
  className?: string;
}) {
  const tone = ACCENT_STYLES[accent];

  return (
    <div className={cn("mb-5 flex items-start gap-3", className)}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", tone.soft, tone.border)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-display font-black tracking-[-0.02em] text-foreground">{title}</p>
        <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function WizardMiniStat({
  label,
  value,
  accent = "primary",
  className,
}: {
  label: string;
  value: string;
  accent?: AccentTone;
  className?: string;
}) {
  const tone = ACCENT_STYLES[accent];

  return (
    <div className={cn("rounded-2xl border border-border bg-background px-3 py-3", className)}>
      <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-lg font-display font-black tracking-[-0.03em]", tone.text)}>{value}</p>
    </div>
  );
}

export function WizardInfoTile({
  icon: Icon,
  title,
  description,
  accent = "primary",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: AccentTone;
  className?: string;
}) {
  const tone = ACCENT_STYLES[accent];

  return (
    <div className={cn("rounded-2xl border border-border bg-card px-4 py-3", className)}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border", tone.soft, tone.border)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-display font-black tracking-[-0.02em] text-foreground">{title}</p>
          <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function WizardStepButton({
  index,
  label,
  caption,
  icon: Icon,
  active,
  done,
  onClick,
}: {
  index: number;
  label: string;
  caption: string;
  icon: LucideIcon;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[1.25rem] border px-4 py-4 text-left transition-colors",
        active
          ? "border-primary/20 bg-primary/10"
          : done
            ? "border-success/20 bg-success/10"
            : "border-border bg-card hover:border-primary/15 hover:bg-background",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
            active
              ? "border-primary/20 bg-primary text-primary-foreground"
              : done
                ? "border-success/20 bg-success text-success-foreground"
                : "border-border bg-background text-muted-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Etapa {index + 1}</span>
            {done && !active ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-display font-bold uppercase tracking-[0.14em] text-success">
                ok
              </span>
            ) : null}
          </div>
          <p className={cn("mt-1 text-sm font-display font-black tracking-[-0.02em]", active ? "text-primary" : "text-foreground")}>{label}</p>
          <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{caption}</p>
        </div>
      </div>
    </button>
  );
}

export function WizardEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center", className)}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-display font-black text-foreground">{title}</p>
      <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

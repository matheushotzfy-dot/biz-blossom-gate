import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "High-density display" kit.
 *
 * Shared primitives that mirror the Dashboard visual language:
 * ambient backdrop, oversized display headings, micro-caps labels,
 * tabular numerals and solid 2rem cards. Used to keep Vendas, Produtos,
 * Taxas, Perfil and KYC visually consistent with /dashboard.
 */

export type HDTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_TEXT: Record<HDTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
};

const TONE_SHELL: Record<HDTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted/50 text-muted-foreground",
};

/** Full-bleed page shell with the dashboard ambient gradient backdrop. */
export function HDShell({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full text-foreground animate-in fade-in duration-500 overflow-hidden",
        className,
      )}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 80% 0%, hsl(var(--primary)/0.12), transparent 70%), radial-gradient(50% 40% at 10% 100%, hsl(var(--primary)/0.08), transparent 70%)",
        }}
      />
      <div className="relative z-10 px-2 sm:px-4 md:px-6 pt-4 pb-24 max-w-[1600px] mx-auto space-y-5">
        {children}
      </div>
    </div>
  );
}

export interface HDHeaderProps {
  /** Small kicker rendered above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions / status chips. */
  actions?: ReactNode;
  className?: string;
}

/** Display heading row, matching the dashboard greeting. */
export function HDHeader({ eyebrow, title, subtitle, actions, className }: HDHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <span className="block text-[12px] font-medium text-muted-foreground/70 mb-1">{eyebrow}</span>
        ) : null}
        <h1 className="font-display font-bold tracking-[-0.03em] text-[22px] sm:text-[26px] md:text-[34px] leading-[1.05]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground/60 text-[12.5px] sm:text-[13px] mt-1.5 max-w-[68ch]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:justify-end lg:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}


export interface HDStatProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ElementType;
  tone?: HDTone;
  className?: string;
}

/**
 * Dense KPI card, dashboard language:
 * sentence-case label, large white numerals, oversized ghost icon on the right.
 */
export function HDStat({ label, value, sub, icon: Icon, tone = "neutral", className }: HDStatProps) {
  const isDanger = tone === "danger";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card px-5 pt-5 pb-6 transition-colors hover:border-border",
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden
          strokeWidth={1.5}
          className={cn(
            "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-16 w-16 transition-opacity group-hover:opacity-80",
            isDanger ? "text-destructive/15" : "text-foreground/[0.07]",
          )}
        />
      ) : null}
      <p className={cn("relative text-[13px] font-medium", isDanger ? "text-destructive/90" : "text-muted-foreground")}>
        {label}
      </p>
      <p
        className={cn(
          "relative mt-4 font-display font-bold tabular-nums tracking-[-0.03em] text-[30px] leading-none truncate",
          isDanger ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="relative mt-2 truncate text-[12px] text-muted-foreground/55">{sub}</p> : null}
    </div>
  );
}

/** Responsive grid for HDStat cards. */
export function HDStatGrid({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4", className)} {...rest}>
      {children}
    </div>
  );
}

/** Solid section card with optional header. */
export function HDCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-5">
          <div className="min-w-0">
            {title ? (
              <h4 className="font-display font-bold text-[17px] tracking-[-0.02em] text-foreground truncate">{title}</h4>
            ) : null}
            {description ? (
              <p className="mt-1 truncate text-[12px] text-muted-foreground/60">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}


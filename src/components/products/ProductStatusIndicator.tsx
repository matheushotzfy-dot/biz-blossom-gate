import { cn } from "@/lib/utils";

import type { ProductStatus } from "./productPresentation";

type StatusMeta = {
  label: string;
  text: string;
  dot: string;
  soft: string;
  pulse?: boolean;
};

const STATUS: Record<string, StatusMeta> = {
  active: {
    label: "Ativo",
    text: "text-success",
    dot: "bg-success",
    soft: "border-success/25 bg-success/[0.08]",
    pulse: true,
  },
  inactive: {
    label: "Inativo",
    text: "text-muted-foreground/80",
    dot: "bg-muted-foreground/50",
    soft: "border-border/40 bg-muted/20",
  },
  pending_review: {
    label: "Revisão",
    text: "text-warning",
    dot: "bg-warning",
    soft: "border-warning/25 bg-warning/[0.08]",
  },
};

export function ProductStatusIndicator({
  status,
  tone = "plain",
}: {
  status: ProductStatus;
  tone?: "plain" | "soft";
}) {
  const meta = STATUS[status] || STATUS.inactive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "soft"
          ? ["rounded-full border px-2 py-[3px] text-[11px] font-semibold ", meta.soft, meta.text]
          : ["text-[11px] font-semibold ", meta.text]
      )}
    >
      <span className="relative flex h-[5px] w-[5px]">
        {meta.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping opacity-50", meta.dot)} />
        )}
        <span className={cn("relative inline-flex h-[5px] w-[5px] rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}
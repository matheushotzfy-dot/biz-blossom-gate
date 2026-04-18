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
    soft: "border-success/20 bg-success/10",
    pulse: true,
  },
  inactive: {
    label: "Inativo",
    text: "text-muted-foreground/70",
    dot: "bg-muted-foreground/45",
    soft: "border-border/25 bg-muted/15",
  },
  pending_review: {
    label: "Revisão",
    text: "text-warning",
    dot: "bg-warning",
    soft: "border-warning/20 bg-warning/10",
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
          ? ["rounded-full border px-2.5 py-1 text-[10px] font-medium", meta.soft, meta.text]
          : ["text-[10px] font-medium", meta.text]
      )}
    >
      <span className="relative flex h-[6px] w-[6px]">
        {meta.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping opacity-45", meta.dot)} />
        )}
        <span className={cn("relative inline-flex h-[6px] w-[6px] rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}
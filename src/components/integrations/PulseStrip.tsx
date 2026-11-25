import { cn } from "@/lib/utils";
import { pulseSummary, pulseTicks, type DeliveryRow, type PulseKind } from "./webhookMeta";

/** A altura carrega o significado (não só a cor): falha é o pico, entregue é o degrau baixo, vazio é um ponto. */
const TICK: Record<PulseKind, string> = {
  ok: "h-3.5 bg-primary",
  bad: "h-6 bg-destructive",
  wait: "h-[18px] bg-warning motion-safe:animate-pulse",
  none: "h-1.5 bg-muted-foreground/20",
};

/** Últimas 30 entregas de um endpoint, da mais antiga (esquerda) para a mais nova (direita). */
export function PulseStrip({ rows, className }: { rows: Array<Pick<DeliveryRow, "status" | "attempt">>; className?: string }) {
  const ticks = pulseTicks(rows);
  return (
    <div role="img" aria-label={`Últimas entregas: ${pulseSummary(rows)}`} className={cn("flex h-6 items-end gap-[2px]", className)}>
      {ticks.map((k, i) => <span key={i} aria-hidden className={cn("min-w-0 flex-1 rounded-full", TICK[k])} />)}
    </div>
  );
}

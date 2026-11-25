import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deliveryKind, deliveryOutcome, eventLabel, isStuck, retryIn, type DeliveryRow } from "./webhookMeta";

type Step = "todo" | "now" | "done" | "bad";

/** Mostra o caminho de um teste ou reenvio ao vivo (fila, envio, resposta), sem sair da tela do endpoint. */
export function TestTracker({ row, event, verb, onOpen, onDismiss }: {
  row: DeliveryRow | null; event: string; verb: "Teste" | "Reenvio"; onOpen: () => void; onDismiss: () => void;
}) {
  const kind = row ? deliveryKind(row) : "queued";
  const steps: [Step, Step, Step] =
    kind === "queued" ? ["now", "todo", "todo"]
    : kind === "sending" ? ["done", "now", "todo"]
    : kind === "success" ? ["done", "done", "done"]
    : ["done", "done", "bad"]; // retrying e exhausted: o servidor respondeu, mas não com sucesso

  let message: string;
  if (kind === "queued") message = row && isStuck(row) ? "Está demorando mais que o normal. Costuma sair em até 1 minuto." : "Na fila. O envio sai em até 1 minuto.";
  else if (kind === "sending") message = "Enviando para o seu servidor…";
  else if (kind === "success") message = `Chegou. ${deliveryOutcome(row!)}.`;
  else if (kind === "retrying") message = `${deliveryOutcome(row!).replace(/\. Vamos tentar de novo\.$/, "")}. Nova tentativa ${retryIn(row!.next_retry_at)}.`;
  else message = `Não chegou. ${deliveryOutcome(row!)}.`;

  const tone = kind === "success" ? "text-primary" : kind === "exhausted" ? "text-destructive" : "text-foreground";
  const labels = ["Na fila", "Enviando", kind === "success" ? "Respondeu" : kind === "exhausted" || kind === "retrying" ? "Falhou" : "Resposta"];

  return (
    <div role="status" aria-live="polite" className="rounded-[20px] bg-muted/50 px-5 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-foreground">{verb}: {eventLabel(event)}</p>
          <p className={cn("mt-0.5 text-[13.5px] font-medium leading-snug", tone)}>{message}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Fechar acompanhamento" className="vp-orb !h-9 !w-9"><X className="h-4 w-4" /></button>
      </div>
      <ol className="mt-4 flex items-start" aria-label="Etapas">
        {steps.map((st, i) => (
          <li key={i} className={cn("relative flex-1 text-[12.5px]", i === 2 && "flex-none")}>
            <span className="flex items-center">
              <span aria-hidden className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full",
                st === "done" && "bg-primary text-primary-foreground", st === "bad" && "bg-destructive text-destructive-foreground",
                st === "now" && "bg-warning/25 ring-2 ring-warning motion-safe:animate-pulse", st === "todo" && "bg-muted-foreground/20")}>
                {st === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
                {st === "bad" && <X className="h-3 w-3" strokeWidth={3} />}
              </span>
              {i < 2 && <span aria-hidden className={cn("mx-2 h-0.5 flex-1 rounded-full", steps[i + 1] === "todo" ? "bg-muted-foreground/20" : "bg-primary")} />}
            </span>
            <span className={cn("mt-1.5 block font-semibold", st === "todo" ? "text-muted-foreground" : "text-foreground")}>{labels[i]}</span>
          </li>
        ))}
      </ol>
      {row && kind !== "queued" && kind !== "sending" && (
        <button type="button" onClick={onOpen} className="mt-3 text-[13px] font-semibold text-primary hover:underline">Ver o que enviamos e a resposta</button>
      )}
    </div>
  );
}

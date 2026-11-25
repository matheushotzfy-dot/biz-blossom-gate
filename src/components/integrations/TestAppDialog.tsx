import { useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHead, dialogShell } from "@/components/seller-ui/form";
import { cn } from "@/lib/utils";
import type { AppDef, TestResult } from "./appCatalog";

export interface TestTarget { app: AppDef; connectionId: string; productLabel: string }

/** Confirma o que o teste faz, roda e mostra o resultado no mesmo lugar. */
export function TestAppDialog({ target, onClose, onRun }: { target: TestTarget | null; onClose: () => void; onRun: (connectionId: string) => Promise<TestResult> }) {
  const [phase, setPhase] = useState<"ask" | "run" | "done">("ask");
  const [result, setResult] = useState<TestResult | null>(null);
  useEffect(() => { if (target) { setPhase("ask"); setResult(null); } }, [target]);

  const run = async () => {
    if (!target) return;
    setPhase("run");
    setResult(await onRun(target.connectionId));
    setPhase("done");
  };
  const note = target?.app.test?.note;
  const safe = target?.app.test?.mode === "safe";
  const blocked = target?.app.test?.mode === "blocked";

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o && phase !== "run") onClose(); }}>
      <DialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[520px]")}>
        <DialogHead icon={<FlaskConical className="h-5 w-5" />} title={blocked ? `Teste do ${target?.app.name ?? ""}` : `Testar ${target?.app.name ?? ""}`} subtitle={target?.productLabel} />
        <div className="space-y-4 px-6 py-6 sm:px-8" aria-live="polite">
          {phase === "ask" && blocked && (
            <p className="rounded-[16px] bg-muted px-4 py-3 text-[14px] font-medium leading-snug text-foreground/90">{note}</p>
          )}
          {phase === "ask" && !blocked && (
            <>
              <p className="text-[14.5px] leading-relaxed text-foreground/90">{safe ? "Vamos mandar um pedido de teste agora, com cliente fictício e valor de R$ 99,90." : "Vamos mandar uma venda de teste de verdade, com cliente fictício e valor de R$ 99,90."}</p>
              <p className={cn("rounded-[16px] px-4 py-3 text-[13.5px] font-medium leading-snug", safe ? "bg-accent text-accent-foreground" : "bg-warning/15 text-warning")}>{note}</p>
            </>
          )}
          {phase === "run" && <p className="flex items-center gap-3 text-[14.5px] text-foreground/90"><Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />Enviando o teste. Pode levar até 10 segundos.</p>}
          {phase === "done" && result && (
            <>
              <p className={cn("flex items-start gap-3 text-[14.5px] font-semibold leading-snug", result.ok ? "text-primary" : "text-destructive")}>
                {result.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}{result.message}
              </p>
              {result.detail && <pre tabIndex={0} className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-[16px] bg-muted px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/80">{result.detail}</pre>}
            </>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          {phase === "ask" && blocked ? (
            <button type="button" className="vp-cta !h-12 justify-center" onClick={onClose}>Entendi</button>
          ) : phase === "ask" ? (<>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Cancelar</button>
            <button type="button" className="vp-cta !h-12 justify-center" onClick={() => { void run(); }}>Enviar teste</button>
          </>) : (
            <button type="button" className="vp-cta !h-12 justify-center" onClick={onClose} disabled={phase === "run"}>Fechar</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

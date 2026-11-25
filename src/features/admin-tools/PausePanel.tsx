import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CreditCard, Landmark, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { callRpc } from "./toolsApi";
import { LIMITS, SWITCH_COPY, SWITCH_KEYS, sinceLine, type SwitchKey, type SwitchState, type ToolsData } from "./toolsModel";

const ICON = { payments: CreditCard, withdrawals: Landmark } as const;

/** As duas pausas de emergência. Cada uma pede o motivo e a senha de novo, e vale no banco (não só na tela). */
export function PausePanel({ data, onChanged }: { data: ToolsData; onChanged: () => void }) {
  const { ask, dialog: reasonDialog } = useReason();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [error, setError] = useState<{ key: SwitchKey; text: string } | null>(null);

  const apply = useMutation({
    mutationFn: (a: { key: SwitchKey; paused: boolean; reason: string }) => callRpc("admin_set_kill_switch", { _key: a.key, _paused: a.paused, _reason: a.reason }),
    onSuccess: (_d, a) => { toast.success(a.paused ? `${SWITCH_COPY[a.key].title} pausados.` : `${SWITCH_COPY[a.key].title} liberados.`); onChanged(); },
    onError: (e, a) => setError({ key: a.key, text: friendlyError(e, "Não foi possível mudar. Nada mudou.") }),
  });

  const run = async (key: SwitchKey, paused: boolean) => {
    setError(null);
    const copy = SWITCH_COPY[key];
    const step = paused ? copy.pause : copy.resume;
    const reason = await ask({
      title: step.title, description: step.description, tone: paused ? "danger" : "default", label: "Motivo", minLength: LIMITS.reasonMin,
      confirmLabel: step.label, placeholder: paused ? "Ex.: instabilidade na adquirente, aguardando contato" : "Ex.: problema resolvido, tudo normalizado",
    });
    if (!reason) return;
    sensitive.confirm(`${step.label}: ${reason}`, async () => { await apply.mutateAsync({ key, paused, reason }).catch(() => undefined); });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
      {SWITCH_KEYS.map((key) => (
        <SwitchCard key={key} k={key} state={data.switches[key]} busy={apply.isPending && apply.variables?.key === key}
          disabled={apply.isPending} error={error?.key === key ? error.text : null} onToggle={() => void run(key, !data.switches[key].paused)} />
      ))}
      {reasonDialog}
      {sensitive.dialog}
    </div>
  );
}

function SwitchCard({ k, state, busy, disabled, error, onToggle }: { k: SwitchKey; state: SwitchState; busy: boolean; disabled: boolean; error: string | null; onToggle: () => void }) {
  const copy = SWITCH_COPY[k];
  const Icon = ICON[k];
  const since = sinceLine(state);
  const paused = state.paused;
  return (
    <div role="group" aria-label={copy.title} className="flex flex-col gap-3 rounded-[16px] bg-card p-5"
      style={{ border: paused ? "1.5px solid hsl(var(--destructive) / .55)" : "1px solid hsl(var(--border))" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", paused ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-foreground">{copy.title}</h3>
            <p className={cn("text-[13.5px] font-semibold", paused ? "text-destructive" : "text-success")}>{paused ? copy.pausedWord : copy.openWord}</p>
          </div>
        </div>
        <button type="button" onClick={onToggle} disabled={disabled} aria-label={paused ? copy.resume.label : copy.pause.label}
          className={cn(paused ? "vp-cta" : "vp-ghost", "!h-10 shrink-0 gap-1.5 !px-4 !text-[13.5px]", !paused && "!text-destructive")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
          {paused ? copy.resume.label : copy.pause.label}
        </button>
      </div>

      <p className="text-[13.5px] leading-relaxed text-muted-foreground">{copy.effect}</p>

      {(since || state.reason) && (
        <div className="rounded-[12px] bg-muted/40 px-4 py-3 text-[13.5px] leading-relaxed text-foreground/85">
          {since && <p>{since}</p>}
          {state.reason && <p className="mt-0.5 break-words">Motivo: {state.reason}</p>}
        </div>
      )}
      {!since && !paused && <p className="text-[13px] text-muted-foreground">Nunca foi pausado por aqui.</p>}

      {error && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{error}</p>}
    </div>
  );
}

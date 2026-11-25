import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ErrorBlock } from "./BlacklistPanel";
import { draftDirty, draftFromRule, fmtWindow, hasThreshold, parseRules, ruleSentence, ruleTitle, validateDraft, type RuleAction, type RuleDraft, type RuleValue, type VelocityRule } from "./antifraudModel";

export function VelocityPanel() {
  const q = useQuery({
    queryKey: ["admin-velocity-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("velocity_rules").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return parseRules(data);
    },
  });
  const rules = q.data ?? [];

  return (
    <PremiumPanel title="Regras de velocidade" icon={Zap}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
        Pegam ataques que se repetem em pouco tempo: testar cartões em sequência, disparar compras do mesmo IP ou do mesmo e-mail. A contagem olha só compras reais, nunca as de teste.
        Qualquer mudança aqui pede a sua senha de novo e fica registrada.
      </p>
      {q.isError ? (
        <ErrorBlock title="Não foi possível carregar as regras." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as regras…</p>
      ) : rules.length === 0 ? (
        <PremiumEmpty icon={Zap} title="Nenhuma regra cadastrada" subtitle="As regras de velocidade são criadas pelo banco de dados; hoje não há nenhuma." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          {rules.map((r) => <RuleCard key={r.id} rule={r} />)}
        </div>
      )}
    </PremiumPanel>
  );
}

const ACTIONS: { value: RuleAction; label: string; hint: string }[] = [
  { value: "block", label: "Barrar a compra", hint: "O comprador não consegue pagar." },
  { value: "flag", label: "Só registrar", hint: "A compra passa; fica na trilha para você olhar." },
];

function RuleCard({ rule }: { rule: VelocityRule }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const [draft, setDraft] = useState<RuleDraft>(() => draftFromRule(rule));
  const [touched, setTouched] = useState(false);
  useEffect(() => { setDraft(draftFromRule(rule)); setTouched(false); }, [rule.is_enabled, rule.max_attempts, rule.time_window_minutes, rule.threshold_amount, rule.action]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = draftDirty(rule, draft);
  const check = validateDraft(rule, draft);
  const preview = check.value ? ruleSentence({ rule_type: rule.rule_type, max_attempts: check.value.max, time_window_minutes: check.value.window, threshold_amount: check.value.threshold, action: check.value.action }) : ruleSentence(rule);

  const save = useMutation({
    mutationFn: async (v: RuleValue) => {
      const { error } = await supabase.rpc("admin_update_velocity_rule" as never, { _id: rule.id, _enabled: v.enabled, _max_attempts: v.max, _window_minutes: v.window, _threshold: v.threshold, _action: v.action } as never);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.enabled ? "Regra salva e ligada." : "Regra salva e desligada.");
      void logAdminAction("update_velocity_rule_ui", "velocity_rules", rule.id, { rule_type: rule.rule_type });
      void qc.invalidateQueries({ queryKey: ["admin-velocity-rules"] });
      void qc.invalidateQueries({ queryKey: ["admin-antifraud-overview"] });
    },
    onError: (e) => toast.error("Não foi possível salvar. A regra continua como estava.", { description: friendlyError(e, "Tente de novo em instantes.") }),
  });

  const onSave = () => {
    setTouched(true);
    if (!check.value) return;
    const v = check.value;
    const lines = [`${ruleTitle(rule)}: ${v.enabled ? "ligada" : "desligada"}.`, ruleSentence({ rule_type: rule.rule_type, max_attempts: v.max, time_window_minutes: v.window, threshold_amount: v.threshold, action: v.action })];
    sensitive.confirm(lines.join(" "), async () => { await save.mutateAsync(v).catch(() => undefined); });
  };

  const error = touched ? check.error : null;
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-[12px] border p-5", draft.enabled ? "border-primary/30 bg-primary/[0.03]" : "border-border/60 bg-muted/20")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground">{ruleTitle(rule)}</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{preview}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
          {draft.enabled ? "Ligada" : "Desligada"}
          <Switch checked={draft.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label={`${ruleTitle(rule)}: ligar ou desligar`} />
        </label>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <Field id={`${rule.id}-max`} label="Tentativas permitidas" hint="A tentativa seguinte é a que cai na regra." value={draft.max} onChange={(v) => set({ max: v })} inputMode="numeric" />
        <Field id={`${rule.id}-win`} label="Janela, em minutos" hint={/^\d+$/.test(draft.window.trim()) ? `= ${fmtWindow(Number(draft.window))}` : "Só números."} value={draft.window} onChange={(v) => set({ window: v })} inputMode="numeric" />
        {hasThreshold(rule) && (
          <Field id={`${rule.id}-thr`} label="Valor mínimo por compra (R$)" hint="Vazio conta todas as compras, de qualquer valor." value={draft.threshold} onChange={(v) => set({ threshold: v })} inputMode="decimal" className="sm:col-span-2" />
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-foreground">Quando a regra dispara</legend>
        <div role="radiogroup" aria-label="Quando a regra dispara" className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          {ACTIONS.map((a) => {
            const on = draft.action === a.value;
            return (
              <button key={a.value} type="button" role="radio" aria-checked={on} onClick={() => set({ action: a.value })}
                className={cn("vp-r12 min-w-0 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  on ? "bg-accent shadow-[inset_0_0_0_1.5px_hsl(var(--primary)/.6)]" : "bg-background shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:bg-muted/50")}>
                <span className="block text-[13px] font-semibold text-foreground">{a.label}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{a.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
        {dirty && <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => { setDraft(draftFromRule(rule)); setTouched(false); }}>Descartar</Button>}
        <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={onSave}>
          {save.isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Salvando…</> : "Salvar alterações"}
        </Button>
      </div>
      {sensitive.dialog}
    </section>
  );
}

function Field({ id, label, hint, value, onChange, inputMode, className }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void; inputMode: "numeric" | "decimal"; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</label>
      <input id={id} className="vp-field" inputMode={inputMode} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}

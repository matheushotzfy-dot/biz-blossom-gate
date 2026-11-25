/**
 * Popup de verificação de conta (KYC) — lista de etapas + área de envio.
 * "Fazer depois" fica salvo na conta (3 dias), nunca no navegador.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BASE_STEPS, CNPJ_STEP, validateKycFile, type KycDocType } from "./kyc/kycSteps";
import { KycUploadZone } from "./kyc/KycUploadZone";

const ease = [0.22, 1, 0.36, 1] as const;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function KycOnboardingPopup() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const kyc = useKycStatus();
  const isCnpj = profile?.document_type === "cnpj";
  const steps = useMemo(() => (isCnpj ? [...BASE_STEPS, CNPJ_STEP] : [...BASE_STEPS]), [isCnpj]);
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Partial<Record<KycDocType, boolean>>>({});
  const [current, setCurrent] = useState(0);
  const [uploading, setUploading] = useState<KycDocType | null>(null);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const snoozedUntil = profile?.kyc_popup_snoozed_until ?? null;

  useEffect(() => {
    if (!user?.id || !profile || !kyc.resolved) return;
    // Só pede documentos de quem ainda precisa enviar (nova ou reprovada).
    // Conta aprovada, em análise ou bloqueada não recebe o popup.
    if (kyc.state !== "pending" && kyc.state !== "rejected") { setOpen(false); return; }
    if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) return;
    const t = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [user?.id, profile, kyc.state, kyc.resolved, snoozedUntil]);

  // Descobre o que já foi enviado para retomar de onde parou.
  useEffect(() => {
    if (!open || !user?.id) return;
    let alive = true;
    (async () => {
      const results = await Promise.all(steps.map((s) => supabase.storage.from("kyc-documents").list(user.id, { search: s.type })));
      if (!alive) return;
      const next: Partial<Record<KycDocType, boolean>> = {};
      steps.forEach((s, i) => { next[s.type] = (results[i].data?.length ?? 0) > 0; });
      setDocs(next);
      const firstMissing = steps.findIndex((s) => !next[s.type]);
      if (firstMissing >= 0) setCurrent(firstMissing);
    })();
    return () => { alive = false; };
  }, [open, user?.id, steps]);

  const doneCount = steps.filter((s) => docs[s.type]).length;
  const allDone = doneCount === steps.length;
  const step = steps[current];

  // Só entra em análise quando TODOS os documentos estão enviados.
  const submit = useCallback(async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("mark_kyc_submitted");
    setSubmitting(false);
    if (error) { toast.error("Os documentos foram salvos, mas não conseguimos enviar para análise. Toque em Concluir para tentar de novo."); return; }
    setFinished(true);
  }, []);

  const upload = useCallback(async (file: File) => {
    if (!user || !step) return;
    const err = validateKycFile(file);
    if (err) { toast.error(err); return; }
    setUploading(step.type);
    const path = `${user.id}/${step.type}.${EXT[file.type] ?? "jpg"}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true, contentType: file.type });
    setUploading(null);
    if (error) { toast.error("Não foi possível enviar. Verifique a conexão e tente de novo."); return; }
    const next = { ...docs, [step.type]: true };
    setDocs(next);
    const nextMissing = steps.findIndex((s) => !next[s.type]);
    if (nextMissing >= 0) window.setTimeout(() => setCurrent(nextMissing), 450);
    else void submit();
  }, [user, step, steps, docs, submit]);

  const later = useCallback(async () => {
    setOpen(false);
    const { error } = await supabase.rpc("snooze_my_kyc_popup");
    if (error) console.warn("[kyc] snooze failed", error.message);
  }, []);

  if (!open || !step) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="kyc-title">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-foreground/40" onClick={later} />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl"
        >
          <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40"><ShieldCheck className="h-[18px] w-[18px] text-primary" /></span>
              <div>
                <h2 id="kyc-title" className="font-heading text-[15px] font-semibold text-foreground">Verificação da conta</h2>
                <p className="text-xs text-muted-foreground">Libera saques e todos os recursos · leva cerca de 2 minutos</p>
              </div>
            </div>
            <button onClick={later} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </header>
          <div className="h-[2px] bg-muted"><motion.div className="h-full bg-primary" animate={{ width: `${(doneCount / steps.length) * 100}%` }} transition={{ duration: 0.5, ease }} /></div>

          {finished ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={1.5} />
              <h3 className="mt-4 font-heading text-xl font-semibold text-foreground">Documentos enviados</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">Nossa equipe analisa em até 24 horas úteis. Você recebe uma notificação assim que a conta for aprovada.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {steps.map((s) => <span key={s.type} className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" />{s.short}</span>)}
              </div>
              <Button onClick={() => setOpen(false)} className="mt-8 w-full max-w-xs">Ir para o painel</Button>
            </div>
          ) : (
            <div className="grid flex-1 overflow-y-auto sm:grid-cols-[220px_1fr]">
              <ol className="flex gap-2 overflow-x-auto border-b border-border p-4 sm:flex-col sm:gap-1 sm:border-b-0 sm:border-r">
                {steps.map((s, i) => {
                  const ok = !!docs[s.type];
                  return (
                    <li key={s.type} className="shrink-0">
                      <button onClick={() => setCurrent(i)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors", i === current ? "bg-muted" : "hover:bg-muted/50")}>
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums", ok ? "border-success bg-success text-success-foreground" : i === current ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className="text-[13px] font-medium text-foreground">{s.short}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Etapa {current + 1} de {steps.length}</p>
                    <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">{step.label}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{doneCount}/{steps.length}</span>
                </div>
                <KycUploadZone step={step} done={!!docs[step.type]} uploading={uploading === step.type} onFile={upload} />
                <p className="mt-3 text-xs text-muted-foreground">Dica: {step.tip}</p>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <button onClick={later} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><Clock className="h-3.5 w-3.5" /> Fazer depois</button>
                  {allDone ? (
                    <Button onClick={() => void submit()} disabled={submitting}>{submitting ? "Enviando…" : "Concluir"}</Button>
                  ) : (
                    <Button variant="outline" disabled={current >= steps.length - 1} onClick={() => setCurrent((c) => Math.min(c + 1, steps.length - 1))}>Próxima etapa</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

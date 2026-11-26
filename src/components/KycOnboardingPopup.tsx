/**
 * Popup de verificação de conta (KYC): um documento por vez, com as mesmas regras da aba Identidade
 * (`features/kyc/kycFiles.ts`): prepara a foto, sobe com nome versionado, apaga a anterior e só envia para análise
 * com tudo enviado. Fechar ou "Fazer depois" adia por 3 dias, gravado na conta (nunca no navegador).
 * Não abre em Minha conta (a aba Identidade já é a tela completa disso).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { cn } from "@/lib/utils";
import { BASE_STEPS, CNPJ_STEP, type KycDocType } from "./kyc/kycSteps";
import { DocSlot } from "./account/DocSlot";
import { useKycDocs } from "./account/useAccountData";
import { prepareKycFile, submitKyc, uploadKycDoc } from "@/features/kyc/kycFiles";

export function KycOnboardingPopup() {
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const kyc = useKycStatus();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCnpj = profile?.document_type === "cnpj";
  const steps = useMemo(() => (isCnpj ? [...BASE_STEPS, CNPJ_STEP] : [...BASE_STEPS]), [isCnpj]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState<KycDocType | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const snoozedUntil = profile?.kyc_popup_snoozed_until ?? null;
  const docs = useKycDocs(user?.id, open);
  const sent = (t: KycDocType) => !!docs.data?.docs[t];
  const doneCount = steps.filter((s) => sent(s.type)).length;
  const allDone = doneCount === steps.length;
  const step = steps[Math.min(current, steps.length - 1)];

  useEffect(() => {
    if (!user?.id || !profile || !kyc.resolved) return undefined;
    // Só pede documentos de quem ainda precisa enviar (nova ou reprovada).
    if (kyc.state !== "pending" && kyc.state !== "rejected") { if (!finished) setOpen(false); return undefined; }
    if (pathname.startsWith("/perfil")) return undefined;
    if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) return undefined;
    const t = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [user?.id, profile, kyc.state, kyc.resolved, snoozedUntil, pathname, finished]);

  // Ao abrir, começa pelo primeiro documento que falta.
  useEffect(() => {
    if (!open || !docs.data) return;
    const first = steps.findIndex((s) => !docs.data.docs[s.type]);
    if (first >= 0) setCurrent(first);
    // só na primeira leitura de cada abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docs.isSuccess]);

  const later = useCallback(async () => {
    setOpen(false);
    if (finished) return;
    const { error } = await supabase.rpc("snooze_my_kyc_popup");
    if (error) console.warn("[kyc] snooze failed", error.message);
    else void refresh();
  }, [finished, refresh]);

  const upload = useCallback(async (raw: File) => {
    if (!user?.id || busy) return;
    const type = step.type;
    setBusy(type); setProblem(null);
    try {
      const prepared = await prepareKycFile(raw, type);
      if (!prepared.file) { setProblem(prepared.error); return; }
      const res = await uploadKycDoc(user.id, type, prepared.file);
      if (!res.ok) { setProblem(res.error); return; }
      const fresh = (await docs.refetch()).data;
      const nextMissing = steps.findIndex((s) => s.type !== type && !fresh?.docs[s.type]);
      if (nextMissing >= 0) window.setTimeout(() => setCurrent(nextMissing), 350);
    } catch {
      setProblem("Não foi possível enviar. Confira a conexão e tente de novo.");
    } finally {
      setBusy(null);
    }
  }, [user?.id, busy, step, steps, docs]);

  const submit = useCallback(async () => {
    if (sending) return;
    setSending(true); setSendError(null);
    const res = await submitKyc();
    setSending(false);
    if (!res.ok) { setSendError(res.error); return; }
    setFinished(true);
    void refresh();
  }, [sending, refresh]);

  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy && !sending) void later(); }}>
      <DialogContent className={dialogBox("lg")} onInteractOutside={(e) => { if (busy || sending) e.preventDefault(); }}>
        <DialogHead
          icon={finished ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          title={finished ? "Documentos enviados" : kyc.state === "rejected" ? "Envie os documentos de novo" : "Verifique sua conta"}
          subtitle={finished ? "Agora é com a nossa equipe." : "A verificação libera os saques. Leva poucos minutos."}
        />

        {finished ? (
          <DialogBody>
            <p className="text-[15px] leading-relaxed text-foreground">
              A equipe vai conferir os {steps.length} documentos. Quando a análise terminar, você recebe um aviso no painel e a situação aparece em Minha conta, na aba Identidade.
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Documentos enviados">
              {steps.map((s) => (
                <li key={s.type} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden />{s.short}</li>
              ))}
            </ul>
          </DialogBody>
        ) : (
          <DialogBody>
            {kyc.state === "rejected" && profile?.kyc_rejection_reason && (
              <p className="rounded-[16px] bg-destructive/10 px-4 py-3 text-[14px] leading-relaxed text-destructive"><span className="font-bold">Motivo da reprovação: </span>{profile.kyc_rejection_reason}</p>
            )}
            <div>
              <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                <span>{doneCount} de {steps.length} enviados</span>
                <span className="tabular-nums">Etapa {current + 1} de {steps.length}</span>
              </div>
              <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Documentos enviados">
                {steps.map((s) => <span key={s.type} className={cn("h-1.5 flex-1 rounded-full", sent(s.type) ? "bg-primary" : "bg-muted")} />)}
              </div>
              <ol className="mt-4 flex flex-wrap gap-2 p-0" style={{ listStyle: "none" }}>
                {steps.map((s, i) => (
                  <li key={s.type}>
                    <button
                      type="button"
                      onClick={() => { setProblem(null); setCurrent(i); }}
                      aria-current={i === current ? "step" : undefined}
                      className={cn("vp-pill !h-9 gap-1.5 px-3.5 text-[13px]", i === current ? "bg-accent text-accent-foreground" : "")}
                    >
                      {sent(s.type) ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> : <span className="tabular-nums text-muted-foreground">{i + 1}</span>}
                      {s.short}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {docs.isError ? (
              <p role="alert" className="text-[14px] text-destructive">Não conseguimos conferir o que já foi enviado. <button type="button" className="font-semibold underline" onClick={() => void docs.refetch()}>Tentar de novo</button></p>
            ) : (
              <div className="mx-auto w-full max-w-[360px]">
                <DocSlot step={step} doc={docs.data?.docs[step.type]} editable={!docs.isLoading} busy={busy === step.type} problem={problem} onFile={(f) => void upload(f)} />
              </div>
            )}
          </DialogBody>
        )}

        {sendError && <DialogError>{sendError}</DialogError>}

        <DialogFoot
          lead={finished ? undefined : (
            <button type="button" onClick={() => void later()} disabled={!!busy || sending} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
              <Clock className="h-4 w-4" aria-hidden />Fazer depois
            </button>
          )}
        >
          {finished ? (
            <>
              <button type="button" className="vp-ghost h-11 px-5" onClick={() => { setOpen(false); navigate("/perfil?tab=identidade"); }}>Ver a verificação</button>
              <button type="button" className="vp-cta h-11 px-6" onClick={() => setOpen(false)}>Fechar</button>
            </>
          ) : allDone ? (
            <button type="button" className="vp-cta h-11 px-6" onClick={() => void submit()} disabled={sending || !!busy}>
              <Send className="h-4 w-4" aria-hidden />{sending ? "Enviando…" : "Enviar para análise"}
            </button>
          ) : (
            <>
              <button type="button" className="vp-ghost h-11 px-4" onClick={() => { setProblem(null); setCurrent((c) => Math.max(0, c - 1)); }} disabled={current === 0 || !!busy} aria-label="Documento anterior"><ArrowLeft className="h-4 w-4" aria-hidden /></button>
              <button type="button" className="vp-cta h-11 px-6" onClick={() => { setProblem(null); setCurrent((c) => Math.min(steps.length - 1, c + 1)); }} disabled={current >= steps.length - 1 || !!busy}>
                Próximo documento<ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

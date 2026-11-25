import { forwardRef, useState } from "react";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { BASE_STEPS, CNPJ_STEP, validateKycFile, type KycDocType } from "@/components/kyc/kycSteps";
import { Notice } from "@/components/seller-ui/studio";
import { docObjectName, kycSubmitError, staleNames, type KycKey } from "./accountMeta";
import { DocSlot } from "./DocSlot";
import { PanelHead } from "./parts";
import { kycDocsKey, type KycDocsData } from "./useAccountData";
import { ConfirmDialog } from "@/components/seller-ui/confirm";

type Problems = Partial<Record<KycDocType, string | null>>;

/**
 * Documentos da verificação. Enviar a foto não manda a conta para análise: isso é um passo à parte,
 * só liberado com tudo enviado, para a equipe nunca receber uma verificação pela metade.
 */
export const DocsSection = forwardRef<HTMLElement, { kyc: KycKey; isCnpj: boolean; docs: UseQueryResult<KycDocsData>; editable: boolean }>(function DocsSection({ kyc, isCnpj, docs, editable }, ref) {
  const { user } = useAuth();
  const { refresh } = useProfile();
  const qc = useQueryClient();
  const steps = isCnpj ? [...BASE_STEPS, CNPJ_STEP] : BASE_STEPS;
  const [busy, setBusy] = useState<Partial<Record<KycDocType, boolean>>>({});
  const [problems, setProblems] = useState<Problems>({});
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const sent = steps.filter((s) => docs.data?.docs[s.type]).length;
  const all = sent === steps.length;
  const mark = (t: KycDocType, v: boolean) => setBusy((b) => ({ ...b, [t]: v }));
  const fail = (t: KycDocType, m: string | null) => setProblems((p) => ({ ...p, [t]: m }));

  const upload = async (type: KycDocType, file: File) => {
    if (!user?.id || busy[type]) return;
    const bad = validateKycFile(file);
    if (bad) { fail(type, bad); return; }
    mark(type, true); fail(type, null);
    try {
      const name = docObjectName(type, crypto.randomUUID().slice(0, 8), file.type);
      const up = await supabase.storage.from("kyc-documents").upload(`${user.id}/${name}`, file, { contentType: file.type });
      if (up.error) throw up.error;
      // Só depois que o novo arquivo subiu é que os antigos do mesmo tipo saem: nunca fica sem documento.
      const { data: now } = await supabase.storage.from("kyc-documents").list(user.id, { limit: 100 });
      const old = staleNames(now ?? [], type, name).map((n) => `${user.id}/${n}`);
      if (old.length) await supabase.storage.from("kyc-documents").remove(old);
      await qc.invalidateQueries({ queryKey: kycDocsKey(user.id) });
    } catch {
      fail(type, "Não foi possível enviar. Confira a conexão e tente de novo.");
    } finally {
      mark(type, false);
    }
  };

  const submit = async () => {
    if (sending) return;
    setSending(true); setSendError(null);
    const { error } = await supabase.rpc("mark_kyc_submitted");
    if (error) { setSending(false); setSendError(kycSubmitError(error)); setConfirm(false); return; }
    await refresh();
    setSending(false); setConfirm(false);
    toast.success("Documentos enviados para análise");
  };

  return (
    <section ref={ref} className="vp-sheet p-5 sm:p-7" aria-labelledby="account-docs">
      <PanelHead
        id="account-docs"
        title="Documentos"
        subtitle={editable ? "Fotos nítidas, sem cortes e sem reflexo. JPG, PNG ou WebP de até 10 MB." : kyc === "pending_review" ? "Estes são os documentos que a equipe está analisando." : "Documentos enviados."}
        aside={<span className="rounded-full bg-muted px-3 py-1 text-[13px] font-bold tabular-nums text-muted-foreground">{sent} de {steps.length}</span>}
      />

      {docs.isError ? (
        <Notice tone="warn" title="Não conseguimos conferir seus documentos">
          <div className="flex flex-wrap items-center gap-3">
            <span>Sem essa leitura não dá para saber o que já foi enviado.</span>
            <button type="button" className="vp-ghost h-9 text-[13px]" onClick={() => void docs.refetch()}>Tentar de novo</button>
          </div>
        </Notice>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {docs.isLoading
            ? steps.map((s) => <div key={s.type} className="space-y-3.5" aria-hidden><span className="vp-skel block aspect-[4/3] w-full rounded-[16px]" /><span className="vp-skel block h-5 w-2/3" /></div>)
            : steps.map((s) => <DocSlot key={s.type} step={s} doc={docs.data?.docs[s.type]} editable={editable} busy={!!busy[s.type]} problem={problems[s.type] ?? null} onFile={(f) => void upload(s.type, f)} />)}
        </div>
      )}

      {editable && all && !docs.isError && (
        <div className="mt-6 flex flex-col gap-4 rounded-[16px] bg-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-[15.5px] font-bold text-foreground">Tudo enviado. Falta só enviar para análise.</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">Confira se as fotos estão legíveis. Depois do envio, os documentos ficam travados até a análise terminar.</p>
          </div>
          <button type="button" className="vp-cta h-12 shrink-0 px-6" onClick={() => { setSendError(null); setConfirm(true); }}><Send className="h-4 w-4" aria-hidden />Enviar para análise</button>
        </div>
      )}
      {sendError && <p role="alert" className="mt-4 rounded-[16px] bg-destructive/10 px-4 py-3 text-[14px] font-medium text-destructive">{sendError}</p>}

      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} busy={sending} tone="default" icon={<Send className="h-5 w-5" />}
        title="Enviar para análise?" confirmLabel="Enviar para análise" cancelLabel="Revisar fotos"
        description={`Nossa equipe vai conferir os ${steps.length} documentos. Enquanto isso você não consegue trocar as fotos.`}
        onConfirm={submit}
      />
    </section>
  );
});

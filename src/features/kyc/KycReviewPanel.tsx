import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Copy, History, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KycDocViewer } from "./KycDocViewer";
import {
  ACCOUNT_STATUS_LABEL, KYC_DOC_LABEL, MAX_REASON, REJECT_PRESETS, SUBMISSION_STATUS_LABEL,
  formatDocNumber, formatPhone, missingTypes, reasonProblem, waitingLabel,
} from "./kycReviewModel";
import { useKycReview } from "./useKycReview";

export type Decision = "approve" | "reject";

/** O que conferir, na ordem em que quem analisa costuma olhar. */
const CHECKLIST = [
  "Nome e número na foto batem com o cadastro.",
  "Frente e verso são do mesmo documento e estão legíveis, sem cortes nem reflexo.",
  "Na selfie aparecem o rosto e o documento, e o rosto é o da foto do documento.",
  "Documento dentro da validade.",
];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Ficha de análise da verificação: dados do cadastro para comparar, documentos, histórico de envios e decisão.
 * Quem decide (admin ou equipe) chega por `onDecide`, que devolve a mensagem de erro ou `null` quando deu certo.
 */
export function KycReviewPanel({ sellerId, onDecide, decideLabel, approveSlot, stickyDecision = false }: {
  sellerId: string;
  onDecide: (kind: Decision, reason: string) => Promise<string | null>;
  /** Texto curto ao lado dos botões (ex.: "A aprovação pode pedir sua senha"). */
  decideLabel?: ReactNode;
  /** Escolha extra antes de aprovar (ex.: gerente da carteira, no admin). */
  approveSlot?: ReactNode;
  /** Dentro de `DialogBody`: a decisão fica presa no rodapé enquanto se rola a ficha. */
  stickyDecision?: boolean;
}) {
  const q = useKycReview(sellerId);
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (q.isPending) return <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo a verificação…</p>;
  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col items-start gap-3 py-8" role="alert">
        <p className="text-[14px] font-semibold text-foreground">Não foi possível abrir esta verificação.</p>
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold text-foreground" style={{ border: "1px solid hsl(var(--border))" }} onClick={() => void q.refetch()}><RefreshCw className="h-3.5 w-3.5" />Tentar de novo</button>
      </div>
    );
  }

  const r = q.data;
  const s = r.seller;
  const missing = missingTypes(r);
  const decidable = s.status === "pending_review";
  const latest = r.submissions[0] ?? null;
  const problem = mode === "reject" ? reasonProblem(reason) : null;

  const run = async (kind: Decision) => {
    if (busy) return;
    if (kind === "reject" && reasonProblem(reason)) { setError(reasonProblem(reason)); return; }
    setBusy(kind); setError(null);
    try {
      const err = await onDecide(kind, reason.trim());
      if (err) { setError(err); return; }
      setMode("idle"); setReason("");
    } finally {
      setBusy(null);
    }
  };

  const copy = (v: string | null) => {
    if (!v) return;
    void navigator.clipboard?.writeText(v).then(() => toast.success("Copiado"), () => toast.error("Não foi possível copiar"));
  };

  const address = [
    [s.address.street, s.address.number].filter(Boolean).join(", "),
    s.address.complement, s.address.neighborhood,
    [s.address.city, s.address.state].filter(Boolean).join("/"), s.address.zip,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={s.status === "approved" ? "success" : s.status === "rejected" || s.status === "blocked" ? "danger" : s.status === "pending_review" ? "warning" : "neutral"}>{ACCOUNT_STATUS_LABEL[s.status] ?? s.status}</Tag>
        {latest?.status === "pending" && <span className="text-[13px] text-muted-foreground">Enviado {waitingLabel(latest.submittedAt)} ({when(latest.submittedAt)})</span>}
        {r.submissions.filter((x) => x.status !== "superseded").length > 1 && <span className="text-[13px] text-muted-foreground">{r.submissions.filter((x) => x.status !== "superseded").length}ª tentativa</span>}
      </div>

      <section aria-labelledby="kyc-data">
        <h3 id="kyc-data" className="mb-2.5 text-[14px] font-semibold text-foreground">Cadastro para comparar</h3>
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5 sm:grid-cols-2">
          <Field label="Nome completo" value={s.fullName} onCopy={copy} />
          <Field label={s.documentType === "cnpj" ? "CNPJ" : "CPF"} value={formatDocNumber(s.documentType, s.documentNumber)} mono onCopy={() => copy(s.documentNumber)} />
          {s.documentType === "cnpj" && <Field label="Razão social" value={s.companyName} />}
          <Field label="E-mail" value={s.email} onCopy={copy} />
          <Field label="Telefone" value={formatPhone(s.phone)} />
          <Field label="Endereço" value={address || null} wide />
          <Field label="Conta criada" value={when(s.createdAt)} />
          <Field label="Último acesso" value={when(s.lastLoginAt)} />
        </dl>
      </section>

      <section aria-labelledby="kyc-docs">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h3 id="kyc-docs" className="text-[14px] font-semibold text-foreground">Documentos</h3>
          <span className="text-[12.5px] text-muted-foreground">{r.documents.filter((d) => r.required.includes(d.type)).length} de {r.required.length}</span>
        </div>
        {missing.length > 0 && (
          <p className="mb-3 flex items-start gap-2 rounded-[12px] bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Falta: {missing.map((t) => KYC_DOC_LABEL[t].toLowerCase()).join(", ")}.
          </p>
        )}
        <KycDocViewer documents={r.documents} required={r.required} urls={r.urls} />
      </section>

      <section aria-labelledby="kyc-check" className="rounded-[14px] bg-muted/40 px-4 py-3.5">
        <h3 id="kyc-check" className="text-[13.5px] font-semibold text-foreground">O que conferir</h3>
        <ul className="mt-2 space-y-1.5 p-0" style={{ listStyle: "none" }}>
          {CHECKLIST.map((c) => <li key={c} className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />{c}</li>)}
        </ul>
      </section>

      {r.submissions.length > 0 && (
        <section aria-labelledby="kyc-history">
          <h3 id="kyc-history" className="mb-2.5 flex items-center gap-1.5 text-[14px] font-semibold text-foreground"><History className="h-4 w-4" aria-hidden />Envios</h3>
          <ol className="space-y-2 p-0" style={{ listStyle: "none" }}>
            {r.submissions.map((k) => (
              <li key={k.id} className="rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ border: "1px solid hsl(var(--border))" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{when(k.submittedAt)}</span>
                  <Tag tone={k.status === "approved" ? "success" : k.status === "rejected" ? "danger" : k.status === "pending" ? "warning" : "neutral"}>{SUBMISSION_STATUS_LABEL[k.status] ?? k.status}</Tag>
                </div>
                {k.reviewedAt && <p className="mt-1 text-muted-foreground">{k.status === "approved" ? "Aprovado" : "Reprovado"} em {when(k.reviewedAt)}{k.reviewer ? ` por ${k.reviewer}` : ""}.</p>}
                {k.reason && <p className="mt-1 text-foreground">Motivo: {k.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.status === "rejected" && s.rejectionReason && r.submissions.every((k) => !k.reason) && (
        <p className="rounded-[12px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">Última reprovação: {s.rejectionReason}</p>
      )}

      <section aria-labelledby="kyc-decide"
        className={cn("space-y-3 pt-1", stickyDecision && "bottom-[-1.5rem] z-10 sm:sticky -mx-6 -mb-6 bg-card px-6 pb-5 sm:-mx-8 sm:px-8")}
        style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <h3 id="kyc-decide" className="pt-3 text-[14px] font-semibold text-foreground">Decisão</h3>
        {!decidable ? (
          <p className="text-[13px] text-muted-foreground">
            {s.status === "pending" ? "O seller ainda não enviou os documentos para análise. A decisão fica liberada quando ele enviar."
              : s.status === "approved" ? "Conta já aprovada."
                : s.status === "rejected" ? "Reprovada. Espera o seller trocar os documentos e enviar de novo."
                  : "Conta bloqueada. A verificação não está em análise."}
          </p>
        ) : mode === "reject" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">O seller lê exatamente este texto. Diga o que está errado e o que enviar.</p>
            <div className="flex flex-wrap gap-1.5">
              {REJECT_PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={reason === p} title={p} onClick={() => { setReason(p); setError(null); }} className={cn("rounded-full px-3 py-1.5 text-left text-[12.5px] font-medium", reason === p ? "bg-accent text-accent-foreground" : "bg-muted/60 text-foreground hover:bg-muted")}>
                  {p.split(".")[0]}
                </button>
              ))}
            </div>
            <label htmlFor={`kyc-reason-${sellerId}`} className="sr-only">Motivo da reprovação</label>
            <textarea
              id={`kyc-reason-${sellerId}`}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null); }}
              maxLength={MAX_REASON}
              rows={4}
              placeholder="Escreva o motivo ou escolha um acima"
              aria-invalid={!!(error && problem) || undefined}
              aria-describedby={error ? `kyc-reason-err-${sellerId}` : undefined}
              autoFocus
              className="max-h-[30dvh] w-full resize-y rounded-[12px] bg-background px-3.5 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ border: `1px solid hsl(var(--${error && problem ? "destructive" : "border"}))` }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] tabular-nums text-muted-foreground">{reason.trim().length}/{MAX_REASON}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex h-10 items-center rounded-[10px] px-4 text-[13.5px] font-semibold text-foreground" style={{ border: "1px solid hsl(var(--border))" }} onClick={() => { setMode("idle"); setError(null); }} disabled={!!busy}>Voltar</button>
                <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-destructive px-4 text-[13.5px] font-semibold text-destructive-foreground disabled:opacity-60" onClick={() => void run("reject")} disabled={!!busy || !r.canReject}>
                  {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Reprovar e avisar o seller
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {approveSlot}
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60" onClick={() => void run("approve")} disabled={!!busy || !r.canApprove || missing.length > 0}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Aprovar verificação
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-[13.5px] font-semibold text-destructive disabled:opacity-60" style={{ border: "1px solid hsl(var(--destructive) / .4)" }} onClick={() => { setMode("reject"); setError(null); }} disabled={!!busy || !r.canReject}>
              <XCircle className="h-4 w-4" />Reprovar
            </button>
            {decideLabel && <span className="text-[12.5px] text-muted-foreground">{decideLabel}</span>}
            {missing.length > 0 && <span className="text-[12.5px] text-muted-foreground">Aprovar fica liberado com todos os documentos.</span>}
            {(!r.canApprove || !r.canReject) && <span className="text-[12.5px] text-muted-foreground">Sua conta não tem permissão para {!r.canApprove && !r.canReject ? "decidir" : !r.canApprove ? "aprovar" : "reprovar"}.</span>}
          </div>
        )}
        {error && <p id={`kyc-reason-err-${sellerId}`} role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      </section>
    </div>
  );
}

/** Etiqueta própria (o painel também abre fora do admin, onde `.ax-tag` não tem cor). */
const TAG_TONE = { success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", danger: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" } as const;
function Tag({ tone, children }: { tone: keyof typeof TAG_TONE; children: ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold leading-none", TAG_TONE[tone])}>{children}</span>;
}

function Field({ label, value, mono, wide, onCopy }: { label: string; value: string | null; mono?: boolean; wide?: boolean; onCopy?: (v: string | null) => void }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5">
        <span className={cn("min-w-0 break-words text-[14px] text-foreground", mono && "tabular-nums", !value && "text-muted-foreground")}>{value || "Não informado"}</span>
        {onCopy && value && <button type="button" onClick={() => onCopy(value)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Copiar ${label}`}><Copy className="h-3.5 w-3.5" /></button>}
      </dd>
    </div>
  );
}

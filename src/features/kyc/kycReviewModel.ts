/**
 * Regras puras da análise de verificação (fila do admin e ficha de quem analisa). Lê o JSON das RPCs
 * `get_admin_kyc_queue` e `get_kyc_review` com cuidado: campo ausente vira valor neutro, nunca quebra a tela.
 */
import type { KycDocType } from "@/components/kyc/kycSteps";

export const KYC_DOC_LABEL: Record<KycDocType, string> = {
  front: "Documento (frente)",
  back: "Documento (verso)",
  selfie: "Selfie com documento",
  cnpj_card: "Cartão CNPJ",
};

export type QueueFilter = "pending_review" | "pending" | "rejected" | "approved" | "all";

export const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "pending_review", label: "Em análise" },
  { value: "pending", label: "Sem envio" },
  { value: "rejected", label: "Reprovadas" },
  { value: "approved", label: "Aprovadas" },
  { value: "all", label: "Todas" },
];

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  pending: "Ainda não enviou",
  pending_review: "Em análise",
  rejected: "Reprovada",
  approved: "Aprovada",
  blocked: "Bloqueada",
};

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  pending: "Esperando análise",
  approved: "Aprovado",
  rejected: "Reprovado",
  superseded: "Substituído por um envio novo",
};

/** Motivos prontos: o texto vai inteiro para o seller, então cada um diz o que fazer. */
export const REJECT_PRESETS: string[] = [
  "A foto do documento está ilegível ou cortada. Envie uma foto nítida, com o documento inteiro e sem reflexo.",
  "O nome ou o número do documento não confere com o cadastro. Envie o documento do titular da conta.",
  "A selfie não mostra o seu rosto e o documento juntos. Tire uma selfie segurando o documento ao lado do rosto.",
  "O documento enviado está vencido. Envie um documento dentro da validade.",
  "O cartão CNPJ não foi enviado ou não está ativo. Envie o comprovante atualizado da Receita Federal.",
];

export const MIN_REASON = 5;
export const MAX_REASON = 500;

export function reasonProblem(raw: string): string | null {
  const r = raw.trim();
  if (r.length < MIN_REASON) return `Explique o motivo em pelo menos ${MIN_REASON} caracteres. O seller lê esse texto.`;
  if (r.length > MAX_REASON) return `Use no máximo ${MAX_REASON} caracteres.`;
  return null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : 0);
const isDocType = (v: unknown): v is KycDocType => v === "front" || v === "back" || v === "selfie" || v === "cnpj_card";

export interface KycDocument { type: KycDocType; name: string; path: string; size: number; mime: string | null; etag: string | null; uploadedAt: string | null }

export function parseDocuments(raw: unknown): KycDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    const o = (d ?? {}) as Record<string, unknown>;
    if (!isDocType(o.type) || !str(o.name)) return [];
    return [{ type: o.type, name: String(o.name), path: str(o.path) ?? "", size: num(o.size), mime: str(o.mime), etag: str(o.etag), uploadedAt: str(o.uploaded_at) }];
  });
}

export interface QueueItem {
  userId: string;
  name: string;
  email: string | null;
  documentType: "cpf" | "cnpj";
  documentMasked: string | null;
  status: string;
  submittedAt: string | null;
  createdAt: string | null;
  attempts: number;
  uploaded: number;
  required: number;
  rejectionReason: string | null;
}

export interface QueueSummary { pendingReview: number; pending: number; rejected: number; approved: number; oldestWaitingAt: string | null; decided7d: number; approved7d: number }
export interface QueuePage { items: QueueItem[]; total: number; summary: QueueSummary }

export function parseQueue(raw: unknown): QueuePage {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (o.summary ?? {}) as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    total: num(o.total),
    summary: {
      pendingReview: num(s.pending_review), pending: num(s.pending), rejected: num(s.rejected), approved: num(s.approved),
      oldestWaitingAt: str(s.oldest_waiting_at), decided7d: num(s.decided_7d), approved7d: num(s.approved_7d),
    },
    items: items.flatMap((it) => {
      const r = (it ?? {}) as Record<string, unknown>;
      if (!str(r.user_id)) return [];
      return [{
        userId: String(r.user_id),
        name: str(r.full_name) ?? str(r.nickname) ?? str(r.email) ?? "Sem nome",
        email: str(r.email),
        documentType: r.document_type === "cnpj" ? "cnpj" as const : "cpf" as const,
        documentMasked: str(r.document_number_masked),
        status: str(r.account_status) ?? "pending",
        submittedAt: str(r.submitted_at),
        createdAt: str(r.created_at),
        attempts: num(r.attempts),
        uploaded: num(r.documents_uploaded),
        required: num(r.documents_required) || (r.document_type === "cnpj" ? 4 : 3),
        rejectionReason: str(r.kyc_rejection_reason),
      }];
    }),
  };
}

export interface Submission { id: string; submittedAt: string | null; status: string; documents: KycDocument[]; reviewedAt: string | null; reason: string | null; reviewer: string | null }

export interface ReviewSeller {
  userId: string; fullName: string | null; nickname: string | null; email: string | null; phone: string | null;
  documentType: "cpf" | "cnpj"; documentNumber: string | null; status: string; rejectionReason: string | null;
  createdAt: string | null; lastLoginAt: string | null; companyName: string | null;
  address: { street: string | null; number: string | null; complement: string | null; neighborhood: string | null; city: string | null; state: string | null; zip: string | null };
}

export interface KycReview { seller: ReviewSeller; documents: KycDocument[]; required: KycDocType[]; submissions: Submission[]; canApprove: boolean; canReject: boolean; isAdmin: boolean }

export function parseReview(raw: unknown): KycReview {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (o.seller ?? {}) as Record<string, unknown>;
  const required = Array.isArray(o.required) ? o.required.filter(isDocType) : [];
  return {
    seller: {
      userId: str(s.user_id) ?? "",
      fullName: str(s.full_name), nickname: str(s.nickname), email: str(s.email), phone: str(s.phone),
      documentType: s.document_type === "cnpj" ? "cnpj" : "cpf",
      documentNumber: str(s.document_number), status: str(s.account_status) ?? "pending", rejectionReason: str(s.kyc_rejection_reason),
      createdAt: str(s.created_at), lastLoginAt: str(s.last_login_at), companyName: str(s.company_name),
      address: { street: str(s.street), number: str(s.street_number), complement: str(s.complement), neighborhood: str(s.neighborhood), city: str(s.city), state: str(s.state), zip: str(s.zip_code) },
    },
    documents: parseDocuments(o.documents),
    required: required.length ? required : ["front", "back", "selfie"],
    submissions: (Array.isArray(o.submissions) ? o.submissions : []).flatMap((x) => {
      const k = (x ?? {}) as Record<string, unknown>;
      if (!str(k.id)) return [];
      return [{ id: String(k.id), submittedAt: str(k.submitted_at), status: str(k.status) ?? "pending", documents: parseDocuments(k.documents), reviewedAt: str(k.reviewed_at), reason: str(k.review_reason), reviewer: str(k.reviewer) }];
    }),
    canApprove: o.can_approve === true,
    canReject: o.can_reject === true,
    isAdmin: o.is_admin === true,
  };
}

/** Mesmo arquivo (mesma impressão digital) enviado como documentos diferentes: sinal de envio errado ou fraude. */
export function duplicateGroups(docs: KycDocument[]): KycDocType[][] {
  const byTag = new Map<string, KycDocType[]>();
  for (const d of docs) {
    if (!d.etag) continue;
    byTag.set(d.etag, [...(byTag.get(d.etag) ?? []), d.type]);
  }
  return [...byTag.values()].filter((g) => g.length > 1);
}

export const missingTypes = (review: Pick<KycReview, "documents" | "required">): KycDocType[] =>
  review.required.filter((t) => !review.documents.some((d) => d.type === t));

/** "há 40 min", "há 5 h", "há 3 dias". */
export function waitingLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

export function formatDocNumber(type: "cpf" | "cnpj", value: string | null): string {
  const d = (value ?? "").replace(/\D/g, "");
  if (type === "cpf" && d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (type === "cnpj" && d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return value ?? "—";
}

/** (44) 99888-7766; número fora do padrão brasileiro volta como veio. */
export function formatPhone(value: string | null): string | null {
  const d = (value ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value && value.trim() ? value : null;
}

export function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Erros das ações de análise em português. */
export function reviewActionError(err: unknown): string {
  const raw = (err as { message?: string } | null)?.message ?? "";
  if (/reautentica|recent/i.test(raw)) return "Confirme sua senha para continuar.";
  if (/reason required/i.test(raw)) return "Explique o motivo em pelo menos 5 caracteres.";
  if (/not pending/i.test(raw)) return "Esta conta não está mais esperando análise. Atualize a fila.";
  if (/access denied|admin only|not authorized/i.test(raw)) return "Você não tem permissão para analisar esta conta.";
  if (/not applied/i.test(raw)) return "A decisão não foi aplicada. Atualize e tente de novo.";
  if (/rate limit/i.test(raw)) return "Muitas aberturas seguidas. Espere alguns minutos.";
  if (/fetch|network/i.test(raw)) return "Sem conexão. Tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
}

/**
 * Regras puras da página "Minha conta": status da verificação, validação de telefone, apelido,
 * endereço e senha, mensagens de erro e textos. Nada aqui toca em rede ou em React, para ser testável.
 * Os testes ficam em `src/test/account.test.ts`.
 */
import { friendlyError } from "@/lib/friendlyError";
import type { TxTone } from "@/components/seller-ui/txMeta";
import type { KycDocType } from "@/components/kyc/kycSteps";

/* ───────────── Abas ───────────── */

export type AccountTab = "perfil" | "identidade" | "seguranca";

/** `?tab=` da URL. Qualquer valor desconhecido abre o Perfil (os links antigos continuam valendo). */
export function parseAccountTab(value: string | null | undefined): AccountTab {
  return value === "identidade" || value === "seguranca" ? value : "perfil";
}

/* ───────────── Verificação da conta (KYC) ───────────── */

/** Círculo de ícone por tom (o mesmo no cartão de verificação e na tela de conta bloqueada). */
export const TONE_SHELL: Record<"ok" | "wait" | "alert" | "idle" | "info", string> = {
  ok: "bg-primary text-primary-foreground",
  wait: "bg-warning/20 text-warning",
  alert: "bg-destructive/15 text-destructive",
  idle: "bg-muted text-muted-foreground",
  info: "bg-info/15 text-info",
};

export type KycKey = "approved" | "pending" | "pending_review" | "rejected" | "blocked";

export interface KycInfo {
  key: KycKey;
  /** Rótulo curto, para pílulas. */
  label: string;
  tone: TxTone;
  /** Frase do painel de status. */
  title: string;
  text: string;
}

const KYC_INFO: Record<KycKey, Omit<KycInfo, "key">> = {
  approved: { label: "Conta verificada", tone: "ok", title: "Sua conta está verificada", text: "A sua identidade foi confirmada e os saques estão liberados." },
  pending: { label: "Verificação pendente", tone: "idle", title: "Falta confirmar a sua identidade", text: "Envie os documentos abaixo para liberar os saques da sua conta." },
  pending_review: { label: "Em análise", tone: "wait", title: "Seus documentos estão em análise", text: "Nossa equipe está conferindo o que você enviou. Quando terminar, o status muda aqui." },
  rejected: { label: "Reprovada", tone: "alert", title: "A verificação foi reprovada", text: "Corrija o que foi apontado, troque os documentos e envie de novo para análise." },
  blocked: { label: "Conta bloqueada", tone: "alert", title: "Sua conta está bloqueada", text: "Fale com o suporte para entender o motivo e como regularizar." },
};

export function kycInfo(raw: string | null | undefined): KycInfo {
  const key: KycKey = raw === "approved" || raw === "pending_review" || raw === "rejected" || raw === "blocked" ? raw : "pending";
  return { key, ...KYC_INFO[key] };
}

/** Texto e cor do selo ao lado do avatar, no topo do painel. */
export function topbarKyc(key: KycKey): { label: string; tone: "ok" | "warn" | "alert" } {
  switch (key) {
    case "approved": return { label: "Conta verificada", tone: "ok" };
    case "pending_review": return { label: "Em análise", tone: "warn" };
    case "rejected": return { label: "Verificação reprovada", tone: "alert" };
    case "blocked": return { label: "Conta bloqueada", tone: "alert" };
    default: return { label: "Verificação pendente", tone: "warn" };
  }
}

export interface KycBanner { text: string; tone: "warn" | "alert"; to: string }

/** Faixa no topo do painel enquanto a conta não está verificada. Conta verificada não tem faixa. */
export function kycBanner(key: KycKey): KycBanner | null {
  switch (key) {
    case "approved": return null;
    case "pending_review": return { text: "Seus documentos estão em análise. Os saques saem assim que a equipe aprovar.", tone: "warn", to: "/perfil?tab=identidade" };
    case "rejected": return { text: "A verificação foi reprovada. Corrija os documentos e envie de novo.", tone: "alert", to: "/perfil?tab=identidade&scrollTo=kyc" };
    case "blocked": return { text: "Sua conta está bloqueada. Fale com o suporte.", tone: "alert", to: "/suporte" };
    default: return { text: "Envie seus documentos para liberar os saques da conta.", tone: "warn", to: "/perfil?tab=identidade&scrollTo=kyc" };
  }
}

/** Só dá para trocar documentos antes de enviar para análise (ou depois de uma reprovação). */
export const canEditDocs = (key: KycKey) => key === "pending" || key === "rejected";

export type StepState = "done" | "current" | "todo" | "alert";
export interface KycStepView { key: string; label: string; note: string; state: StepState }

/** Três etapas da verificação, na ordem em que acontecem. */
export function kycSteps(key: KycKey, sent: number, required: number): KycStepView[] {
  const all = sent >= required;
  const docs: KycStepView =
    key === "pending_review" || key === "approved" ? { key: "docs", label: "Enviar documentos", note: "Enviados", state: "done" }
    : key === "rejected" ? { key: "docs", label: "Enviar documentos", note: "Troque o que foi apontado", state: "alert" }
    : { key: "docs", label: "Enviar documentos", note: all ? "Falta enviar para análise" : `${sent} de ${required} enviados`, state: "current" };
  const review: KycStepView =
    key === "approved" ? { key: "review", label: "Análise da equipe", note: "Concluída", state: "done" }
    : key === "pending_review" ? { key: "review", label: "Análise da equipe", note: "Em andamento", state: "current" }
    : { key: "review", label: "Análise da equipe", note: "Depois do envio", state: "todo" };
  const payout: KycStepView =
    key === "approved" ? { key: "payout", label: "Saques liberados", note: "Pronto", state: "done" }
    : { key: "payout", label: "Saques liberados", note: "Depois da aprovação", state: "todo" };
  return [docs, review, payout];
}

export interface PayoutItem { key: string; label: string; done: boolean; text: string; to: string; /** `null` = a linha só informa, não leva a lugar nenhum. */ cta: string | null; optional?: boolean }

/** O que falta para conseguir sacar: verificação, endereço e uma chave Pix. */
export function payoutChecklist(a: { approved: boolean; kyc?: KycKey; hasAddress: boolean; pixCount: number; bankCount: number }): { items: PayoutItem[]; ready: boolean } {
  const kyc: KycKey = a.approved ? "approved" : a.kyc && a.kyc !== "approved" ? a.kyc : "pending";
  const kycText: Record<KycKey, string> = {
    approved: "Identidade confirmada.",
    pending: "Envie os documentos acima.",
    pending_review: "Em análise. Os saques saem assim que a equipe aprovar.",
    rejected: "Reprovada. Troque o que foi apontado e envie de novo.",
    blocked: "Conta bloqueada. Fale com o suporte.",
  };
  const items: PayoutItem[] = [
    { key: "kyc", label: "Conta verificada", done: a.approved, text: kycText[kyc], to: kyc === "blocked" ? "/suporte" : "/perfil?tab=identidade", cta: kyc === "blocked" ? "Falar com o suporte" : null },
    { key: "address", label: "Endereço", done: a.hasAddress, text: a.hasAddress ? "Endereço cadastrado." : "O saque pede o endereço do titular.", to: "/perfil?focus=address", cta: a.hasAddress ? "Ver endereço" : "Preencher" },
    { key: "pix", label: "Chave Pix", done: a.pixCount > 0, text: a.pixCount > 0 ? `${a.pixCount} ${a.pixCount === 1 ? "chave cadastrada" : "chaves cadastradas"}.` : "Os saques saem para uma chave Pix sua.", to: "/financeiro/config", cta: a.pixCount > 0 ? "Gerenciar" : "Cadastrar" },
    { key: "bank", label: "Conta bancária", done: a.bankCount > 0, optional: true, text: a.bankCount > 0 ? `${a.bankCount} ${a.bankCount === 1 ? "conta vinculada" : "contas vinculadas"}.` : "Opcional. Ajuda a conferir o titular.", to: "/financeiro/config", cta: a.bankCount > 0 ? "Gerenciar" : "Cadastrar" },
  ];
  return { items, ready: items.filter((i) => !i.optional).every((i) => i.done) };
}

/* ───────────── Documentos enviados ───────────── */

const DOC_NAME = /^(front|back|selfie|cnpj_card)[._]/;

/** Descobre o tipo pelo nome do arquivo no bucket (`front_ab12cd34.jpg` ou o antigo `front.jpg`). */
export function docTypeOf(fileName: string): KycDocType | null {
  const m = DOC_NAME.exec(fileName);
  return m ? (m[1] as KycDocType) : null;
}

export interface StoredFile { name: string; created_at?: string | null; updated_at?: string | null }

/** Para cada tipo, o arquivo mais recente. Arquivos que não são documentos são ignorados. */
export function newestByType<T extends StoredFile>(files: readonly T[]): Partial<Record<KycDocType, T>> {
  const out: Partial<Record<KycDocType, T>> = {};
  const stamp = (f: T) => f.created_at || f.updated_at || "";
  for (const f of files) {
    const t = docTypeOf(f.name);
    if (!t) continue;
    const cur = out[t];
    if (!cur || stamp(f) > stamp(cur)) out[t] = f;
  }
  return out;
}

/** Nomes antigos do mesmo tipo, para apagar depois que o novo arquivo subiu. */
export function staleNames(files: readonly StoredFile[], type: KycDocType, keep: string): string[] {
  return files.filter((f) => docTypeOf(f.name) === type && f.name !== keep).map((f) => f.name);
}

export const DOC_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export function docObjectName(type: KycDocType, token: string, mime: string): string {
  return `${type}_${token}.${DOC_EXT[mime] ?? "jpg"}`;
}

/* ───────────── Texto e datas ───────────── */

const TZ = "America/Sao_Paulo";

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function formatDayTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("pt-BR", { timeZone: TZ });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

/** "hoje", "12 dias", "3 meses", "1 ano e 2 meses". */
export function memberFor(createdAt: string | null | undefined, now: number = Date.now()): string {
  if (!createdAt) return "—";
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.max(0, Math.floor((now - t) / 86_400_000));
  if (days < 1) return "hoje";
  if (days < 30) return days === 1 ? "1 dia" : `${days} dias`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? "1 ano" : `${years} anos`;
  return rest ? `${y} e ${rest === 1 ? "1 mês" : `${rest} meses`}` : y;
}

/** "CPF 123.456.789-00" já mascarado pelo banco, ou "CPF final 1234". */
export function documentLabel(p: { document_type?: string | null; document_number?: string | null; document_number_masked?: string | null } | null | undefined): string {
  if (!p) return "—";
  const kind = (p.document_type || "cpf").toUpperCase();
  const digits = (p.document_number || "").replace(/\D/g, "");
  if (digits.length >= 4) return `${kind} final ${digits.slice(-4)}`;
  if (p.document_number_masked) return `${kind} ${p.document_number_masked}`;
  return "Não informado";
}

export const sellerTypeLabel = (t: string | null | undefined, doc: string | null | undefined) =>
  t === "empresa" || doc === "cnpj" ? "Pessoa jurídica" : "Pessoa física";

/* ───────────── Campos pessoais ───────────── */

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Telefone guardado só com números (como no cadastro); aqui só para mostrar e digitar. */
export function formatPhone(v: string): string {
  let d = onlyDigits(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validatePhone(v: string): string | null {
  const d = onlyDigits(v);
  if (!d) return "Informe o telefone com DDD.";
  if (d.length < 10 || d.length > 11) return "Informe o telefone com DDD, por exemplo (44) 99999-0000.";
  if (Number(d.slice(0, 2)) < 11) return "O DDD não existe. Confira os dois primeiros números.";
  if (d.length === 11 && d[2] !== "9") return "Celular com 11 números começa com 9 depois do DDD.";
  return null;
}

export function validateFullName(v: string): string | null {
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length < 3) return "Informe o seu nome completo.";
  if (t.length > 120) return "Use no máximo 120 caracteres.";
  if (!/[\p{L}]/u.test(t)) return "O nome precisa ter letras.";
  return null;
}

export function validateNickname(v: string): string | null {
  const t = v.trim();
  if (!t) return "Escreva como você quer ser chamado.";
  if (t.length < 2) return "Use pelo menos 2 caracteres.";
  if (t.length > 30) return "Use no máximo 30 caracteres.";
  if (!/[\p{L}\p{N}]/u.test(t)) return "Use letras ou números.";
  return null;
}

/* ───────────── Endereço ───────────── */

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export interface AddressForm {
  zip_code: string; street: string; street_number: string; complement: string; neighborhood: string; city: string; state: string;
}
export const EMPTY_ADDRESS: AddressForm = { zip_code: "", street: "", street_number: "", complement: "", neighborhood: "", city: "", state: "" };
export type AddressErrors = Partial<Record<keyof AddressForm, string>>;

export const cepDigits = (v: string) => onlyDigits(v).slice(0, 8);
export function formatCep(v: string): string {
  const d = cepDigits(v);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function addressFrom(p: Partial<Record<keyof AddressForm, string | null>> | null | undefined): AddressForm {
  return {
    zip_code: formatCep(p?.zip_code ?? ""), street: p?.street ?? "", street_number: p?.street_number ?? "",
    complement: p?.complement ?? "", neighborhood: p?.neighborhood ?? "", city: p?.city ?? "", state: (p?.state ?? "").toUpperCase(),
  };
}

export function validateAddress(a: AddressForm): AddressErrors {
  const e: AddressErrors = {};
  if (cepDigits(a.zip_code).length !== 8) e.zip_code = "Informe o CEP com 8 números.";
  if (a.street.trim().length < 3) e.street = "Informe a rua ou avenida.";
  if (!a.street_number.trim()) e.street_number = "Informe o número ou marque “Sem número”.";
  else if (a.street_number.trim().length > 10) e.street_number = "Use no máximo 10 caracteres.";
  if (a.city.trim().length < 2) e.city = "Informe a cidade.";
  if (!(UFS as readonly string[]).includes(a.state)) e.state = "Escolha o estado.";
  if (a.complement.trim().length > 60) e.complement = "Use no máximo 60 caracteres.";
  return e;
}

export function normalizeAddress(a: AddressForm): AddressForm {
  const t = (v: string) => v.trim().replace(/\s+/g, " ");
  return { zip_code: formatCep(a.zip_code), street: t(a.street), street_number: t(a.street_number), complement: t(a.complement), neighborhood: t(a.neighborhood), city: t(a.city), state: a.state.trim().toUpperCase() };
}

export const sameAddress = (a: AddressForm, b: AddressForm) =>
  (Object.keys(a) as (keyof AddressForm)[]).every((k) => normalizeAddress(a)[k] === normalizeAddress(b)[k]);

/** Igual à regra que a tela de saques usa para liberar o pedido. */
export function hasAddress(p: Partial<Record<keyof AddressForm, string | null>> | null | undefined): boolean {
  return !!p?.zip_code && !!p?.street && !!p?.street_number && !!p?.city && !!p?.state;
}

export const SEM_NUMERO = "S/N";

/* ───────────── Senha ───────────── */

export interface PasswordChecks { length: boolean; lower: boolean; upper: boolean; digit: boolean }

export function passwordChecks(pw: string): PasswordChecks {
  return { length: pw.length >= 8, lower: /[a-z]/.test(pw), upper: /[A-Z]/.test(pw), digit: /\d/.test(pw) };
}

/** Primeiro problema que impede a troca, ou null. Mesmas regras do cadastro. */
export function passwordProblem(current: string, next: string, confirm: string): string | null {
  if (!current) return "Digite a senha atual.";
  const c = passwordChecks(next);
  if (!c.length) return "A nova senha precisa de 8 caracteres ou mais.";
  if (next.length > 72) return "Use no máximo 72 caracteres.";
  if (!c.lower || !c.upper || !c.digit) return "Use letra maiúscula, letra minúscula e número.";
  if (next === current) return "A nova senha precisa ser diferente da atual.";
  if (confirm !== next) return "As duas senhas não são iguais.";
  return null;
}

export function passwordChangeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof (err as { message?: unknown })?.message === "string" ? String((err as { message: string }).message) : "";
  if (/invalid login credentials|invalid_credentials/i.test(raw)) return "A senha atual não confere.";
  if (/same.*password|different from the old/i.test(raw)) return "A nova senha precisa ser diferente da atual.";
  if (/weak|pwned|leaked|easy to guess/i.test(raw)) return "Essa senha é fácil de adivinhar ou já vazou em algum site. Escolha outra.";
  if (/rate limit|too many|429/i.test(raw)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/reauth|recently/i.test(raw)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
  return friendlyError(err, "Não foi possível trocar a senha agora.");
}

/* ───────────── Foto de perfil ───────────── */

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_INPUT = 10 * 1024 * 1024;
/** Sem conseguir reduzir a foto no navegador, o arquivo original precisa caber no limite do bucket. */
export const MAX_AVATAR_RAW = 4 * 1024 * 1024;

export function validateAvatarFile(file: Pick<File, "type" | "size">): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "Use uma foto JPG, PNG ou WebP.";
  if (file.size > MAX_AVATAR_INPUT) return "A foto passou de 10 MB. Escolha uma menor.";
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

const AVATAR_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
/** O bucket só aceita nomes simples em minúsculas; a extensão vem do tipo, nunca do nome do arquivo. */
export const avatarPath = (userId: string, mime: string) => `${userId}/avatar.${AVATAR_EXT[mime] ?? "jpg"}`;

/** Mesmo caminho a cada troca: o `?v=` obriga navegador e CDN a buscar a foto nova. */
export const versionedUrl = (url: string, stamp: number) => `${url.split("?")[0]}?v=${stamp}`;

/* ───────────── Erros de gravação ───────────── */

type DbError = { message?: string; details?: string | null; hint?: string | null; code?: string | null };

export function profileSaveError(err: unknown, fallback = "Não foi possível salvar agora."): string {
  const e = (err ?? {}) as DbError;
  const text = `${e.message ?? ""} ${e.details ?? ""}`;
  if (e.hint === "address_locked" || /endere[cç]o travado/i.test(text)) return "O seu endereço está travado. Fale com o suporte para alterar.";
  if (e.hint === "document_locked" || /documento j[aá] cadastrado/i.test(text)) return "O documento não pode ser alterado. Fale com o suporte.";
  if (e.code === "23505" || /duplicate key|unique constraint/i.test(text)) {
    if (/phone|telefone/i.test(text)) return "Este telefone já está em uso em outra conta.";
    return "Esse dado já está em uso em outra conta.";
  }
  if (e.hint === "profile_restricted_field") return "Este dado só o suporte pode alterar.";
  return friendlyError(err, fallback);
}

const KYC_DOC_LABEL: Record<string, string> = { front: "documento (frente)", back: "documento (verso)", selfie: "selfie com o documento", cnpj_card: "cartão CNPJ" };

/** Erro do "Enviar para análise" (`mark_kyc_submitted`) em português, dizendo o que falta quando falta documento. */
export function kycSubmitError(err: unknown): string {
  const raw = (err as DbError | null)?.message ?? "";
  const missing = /missing_documents:([a-z_,]+)/i.exec(raw);
  if (missing) {
    const names = missing[1].split(",").filter(Boolean).map((t) => KYC_DOC_LABEL[t] ?? t);
    const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
    return `Ainda falta enviar: ${list}.`;
  }
  if (/no_documents_uploaded/i.test(raw)) return "Ainda não encontramos documentos enviados. Envie as fotos e tente de novo.";
  if (/kyc_not_editable/i.test(raw)) return "A sua verificação já foi enviada ou concluída. Atualize a página para ver a situação.";
  if (/kyc_unchanged/i.test(raw)) return "Troque o documento apontado na reprovação antes de enviar de novo. Os arquivos são os mesmos do envio reprovado.";
  if (/not_authenticated/i.test(raw)) return "Sua sessão expirou. Entre de novo para continuar.";
  return friendlyError(err, "Não foi possível enviar para análise agora. Tente de novo.");
}

/**
 * Regras puras de entrada e cadastro (sem React, sem rede).
 * A tela só chama estas funções; o servidor (`secure-signup`, `gated-login`) repete as mesmas
 * conferências, então qualquer regra daqui que ficar mais rígida que a de lá é só orientação a quem digita.
 */
import { isValidCNPJ, isValidCPF } from "@/lib/validation";

export type AccountType = "cpf" | "cnpj";

export interface SignupForm {
  accountType: AccountType;
  fullName: string;
  nickname: string;
  email: string;
  phone: string;
  document: string;
  companyName: string;
  segment: string;
  monthlyRevenue: string;
  referralSource: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export type SignupField = keyof SignupForm;
export type FieldErrors = Partial<Record<SignupField, string>>;

export const EMPTY_SIGNUP: SignupForm = {
  accountType: "cpf",
  fullName: "",
  nickname: "",
  email: "",
  phone: "",
  document: "",
  companyName: "",
  segment: "",
  monthlyRevenue: "",
  referralSource: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

/* ───────────────────────── opções do formulário ───────────────────────── */
/* Os valores são os mesmos aceitos pelo banco (CHECKs de `seller_signup_info`). */

export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string; hint: string }> = [
  { value: "cpf", label: "Pessoa física", hint: "Recebo com meu CPF" },
  { value: "cnpj", label: "Pessoa jurídica", hint: "Tenho empresa aberta" },
];

export const SEGMENT_OPTIONS = [
  { value: "infoproduto", label: "Curso / Infoproduto" },
  { value: "mentoria", label: "Mentoria ou consultoria" },
  { value: "comunidade", label: "Comunidade / Assinatura" },
  { value: "ebook", label: "E-book e materiais digitais" },
  { value: "software", label: "Software ou SaaS" },
  { value: "servico", label: "Prestação de serviço" },
  { value: "fisico", label: "Produto físico" },
  { value: "outro", label: "Outro" },
] as const;

export const REVENUE_OPTIONS = [
  { value: "ate_10k", label: "Até R$ 10 mil" },
  { value: "10k_50k", label: "R$ 10 a 50 mil" },
  { value: "50k_200k", label: "R$ 50 a 200 mil" },
  { value: "acima_200k", label: "Acima de R$ 200 mil" },
] as const;

export const REFERRAL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "indicacao", label: "Indicação de amigo" },
  { value: "youtube", label: "YouTube" },
  { value: "pesquisa", label: "Pesquisa (Google)" },
  { value: "tiktok", label: "TikTok" },
  { value: "outro", label: "Outro" },
] as const;

export const SIGNUP_STEPS = [
  { tag: "Identificação", title: "Vamos começar", sub: "Escolha como você vai receber e diga seu nome." },
  { tag: "Contato", title: "Como falamos com você", sub: "O e-mail é o seu login. O WhatsApp é o contato da conta." },
  { tag: "Documento", title: "Confirme seu documento", sub: "Necessário para liberar seus recebimentos." },
  { tag: "Negócio", title: "Sobre o seu negócio", sub: "Ajuda a equipe a entender o que você vende." },
  { tag: "Segurança", title: "Proteja sua conta", sub: "Uma senha forte e você está pronto." },
  { tag: "Revisão", title: "Tudo certo?", sub: "Confira os dados antes de criar a conta." },
] as const;

/** Por que cada passo do cadastro pede o que pede. A ordem segue `SIGNUP_STEPS`. */
export const STEP_REASONS = [
  { title: "Seu nome precisa bater com o documento.", text: "A verificação de identidade compara este nome com os documentos que você envia antes de liberar o saque." },
  { title: "O e-mail é a chave da sua conta.", text: "É com ele que você entra e recupera a senha. O WhatsApp fica no cadastro como contato da conta." },
  { title: "A conta fica em nome deste documento.", text: "O CPF ou CNPJ fica criptografado, nunca aparece para os seus clientes e não muda depois do cadastro sem passar pela equipe." },
  { title: "Só a equipe vê estas respostas.", text: "Elas ajudam a revisar a sua conta e os seus produtos. Nada daqui aparece para quem compra de você." },
  { title: "A senha protege o seu dinheiro.", text: "Pedir saque, trocar a chave Pix ou ligar o saque automático pedem a sua senha de novo, na hora." },
  { title: "Confira antes de criar.", text: "Dá para voltar e corrigir qualquer passo. Os termos e a política de privacidade abrem numa aba nova." },
] as const;

/**
 * O que acontece depois de criar a conta (mostrado na revisão). Só o que é verdade hoje: produto novo e saque
 * exigem o cadastro aprovado (`enforce_account_status_on_product`, `enforce_kyc_on_withdrawal`).
 */
export const AFTER_SIGNUP = [
  { title: "Você entra no painel", text: "com o e-mail e a senha que criou." },
  { title: "Envia os documentos", text: "de identidade pelo painel." },
  { title: "A equipe confere o cadastro.", text: "Aprovado, você cria produtos e saca." },
] as const;

/* ───────────────────────── prévia da conta (painel ao lado) ───────────────────────── */

/**
 * O que o painel ao lado mostra enquanto a pessoa preenche: a conta "se montando" com os dados dela.
 * Nada aqui sai do navegador; o documento aparece mascarado (só os últimos números) e a senha só como força.
 */
export interface AccountPreview {
  step: number;
  typeLabel: string;
  initials: string;
  greetingName: string;
  fullName: string;
  email: string;
  phone: string;
  documentLabel: "CPF" | "CNPJ";
  documentMasked: string;
  companyName: string;
  segmentLabel: string;
  passwordLevel: 0 | 1 | 2 | 3;
  passwordLabel: string;
  /** Todos os dados preenchidos (pronta para criar). */
  ready: boolean;
  /** A conta já foi criada (tela de confirmar o e-mail). */
  created: boolean;
}

/** CPF/CNPJ completo mostrado só com o fim: •••.•••.247-25 e ••.•••.678/0001-90. Incompleto não aparece. */
export function maskDocumentPreview(value: string, type: AccountType): string {
  const d = onlyDigits(value);
  if (type === "cpf") return d.length === 11 ? `•••.•••.${d.slice(6, 9)}-${d.slice(9)}` : "";
  return d.length === 14 ? `••.•••.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : "";
}

export function buildAccountPreview(form: SignupForm, step: number, created = false): AccountPreview {
  const fullName = form.fullName.replace(/\s+/g, " ").trim();
  const words = fullName.split(" ").filter(Boolean);
  const initials = ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  const nickname = form.nickname.trim();
  const email = form.email.trim();
  const strength = passwordStrength(form.password);
  const preview: AccountPreview = {
    step,
    typeLabel: form.accountType === "cnpj" ? "Pessoa jurídica" : "Pessoa física",
    initials,
    greetingName: nickname || words[0] || "",
    fullName,
    email: /.+@.+/.test(email) ? email.toLowerCase() : "",
    phone: phoneDigits(form.phone).length >= 10 ? formatPhone(form.phone) : "",
    documentLabel: form.accountType === "cnpj" ? "CNPJ" : "CPF",
    documentMasked: maskDocumentPreview(form.document, form.accountType),
    companyName: form.accountType === "cnpj" ? form.companyName.replace(/\s+/g, " ").trim() : "",
    segmentLabel: SEGMENT_OPTIONS.find((o) => o.value === form.segment)?.label ?? "",
    passwordLevel: strength.level,
    passwordLabel: strength.label,
    ready: false,
    created,
  };
  preview.ready = !!(preview.fullName && preview.email && preview.phone && preview.documentMasked
    && (form.accountType === "cpf" || preview.companyName) && preview.segmentLabel && strength.level >= 2);
  return preview;
}

export const TOTAL_STEPS = SIGNUP_STEPS.length;

/** Campos que cada passo valida (o passo 6 só tem o aceite). */
export function fieldsOfStep(step: number, accountType: AccountType): SignupField[] {
  switch (step) {
    case 1: return ["fullName", "nickname"];
    case 2: return ["email", "phone"];
    case 3: return accountType === "cnpj" ? ["document", "companyName"] : ["document"];
    case 4: return ["segment", "monthlyRevenue", "referralSource"];
    case 5: return ["password", "confirmPassword"];
    default: return ["acceptTerms"];
  }
}

/* ───────────────────────── texto e máscaras ───────────────────────── */

export const onlyDigits = (value: string): string => value.replace(/\D/g, "");

/** Tira espaços das pontas e junta espaços repetidos. */
export const squeeze = (value: string): string => value.replace(/\s+/g, " ").trim();

export function formatDocument(value: string, type: AccountType): string {
  const digits = onlyDigits(value).slice(0, type === "cnpj" ? 14 : 11);
  if (type === "cpf") {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Telefone brasileiro com DDD. Aceita colagem com +55 e devolve no máximo 11 dígitos formatados. */
export function phoneDigits(value: string): string {
  let digits = onlyDigits(value);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
}

export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* ───────────────────────── validações de campo ───────────────────────── */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export function validateEmail(value: string): string {
  const email = normalizeEmail(value);
  if (!email) return "Informe seu e-mail.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email) || email.includes("..")) {
    return "Esse e-mail não parece certo. Confira, por exemplo: nome@email.com.";
  }
  return "";
}

const COMMON_DOMAINS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br", "icloud.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "live.com", "msn.com", "proton.me", "protonmail.com",
  "mail.com", "aol.com", "me.com", "gmx.com", "zoho.com", "yandex.com", "ig.com.br", "globo.com", "r7.com",
];

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

/** "maria@gmial.com" → "maria@gmail.com". Só sugere quando o domínio está a no máximo 2 letras de um provedor comum. */
export function suggestEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (validateEmail(email)) return null;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (COMMON_DOMAINS.includes(domain)) return null;
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

export function validatePhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return "Informe seu WhatsApp com DDD.";
  if (d.length < 10) return "Faltam números. Informe o DDD e o número, por exemplo (11) 91234-5678.";
  if (!/^[1-9][1-9]/.test(d)) return "O DDD não existe. Confira os dois primeiros números.";
  if (d.length === 11 && d[2] !== "9") return "Celular com DDD tem 9 na frente do número. Confira.";
  if (d.length === 10 && !/[2-9]/.test(d[2])) return "Esse número não parece certo. Confira.";
  return "";
}

export function validateFullName(value: string): string {
  const name = squeeze(value);
  if (!name) return "Informe seu nome completo.";
  if (name.length > 120) return "O nome é longo demais. Use no máximo 120 caracteres.";
  if (!/^\p{L}[\p{L}'’.\-\s]*$/u.test(name)) return "Use só letras no nome, como está no documento.";
  const parts = name.split(" ").filter((p) => p.replace(/[^\p{L}]/gu, "").length >= 1);
  if (parts.length < 2) return "Informe nome e sobrenome, como estão no documento.";
  if (name.replace(/[^\p{L}]/gu, "").length < 4) return "Informe nome e sobrenome, como estão no documento.";
  return "";
}

export function validateNickname(value: string): string {
  const nick = squeeze(value);
  if (nick.length < 2) return "Diga como quer ser chamado (mínimo 2 letras).";
  if (nick.length > 30) return "Use no máximo 30 caracteres.";
  return "";
}

export function validateDocument(type: AccountType, value: string): string {
  const digits = onlyDigits(value);
  const label = type === "cnpj" ? "CNPJ" : "CPF";
  const size = type === "cnpj" ? 14 : 11;
  if (!digits) return `Informe o ${label}.`;
  if (digits.length < size) return `O ${label} tem ${size} números. Faltam ${size - digits.length}.`;
  const valid = type === "cnpj" ? isValidCNPJ(digits) : isValidCPF(digits);
  return valid ? "" : `${label} inválido. Confira os números.`;
}

export function validateCompanyName(value: string): string {
  const name = squeeze(value);
  if (name.length < 2) return "Informe a razão social, como está no CNPJ.";
  if (name.length > 160) return "A razão social é longa demais. Use no máximo 160 caracteres.";
  return "";
}

/* ───────────────────────── senha ───────────────────────── */

export const PASSWORD_MAX = 128;

export interface PasswordRule { id: "length" | "upper" | "lower" | "digit"; label: string; ok: boolean }

export function passwordRules(password: string): PasswordRule[] {
  return [
    { id: "length", label: "8 ou mais caracteres", ok: password.length >= 8 },
    { id: "upper", label: "1 letra maiúscula", ok: /[A-Z]/.test(password) },
    { id: "lower", label: "1 letra minúscula", ok: /[a-z]/.test(password) },
    { id: "digit", label: "1 número", ok: /\d/.test(password) },
  ];
}

const COMMON_PASSWORDS = new Set([
  "senha123", "senha1234", "password1", "password123", "abc12345", "abcd1234", "qwerty123", "qwer1234",
  "brasil123", "brasil2024", "mudar123", "12345678", "123456789", "1234567890", "a1234567", "teste123",
  "admin123", "welcome1", "iloveyou1", "senha@123", "senha#123", "mudar@123",
]);

export const isCommonPassword = (password: string): boolean => COMMON_PASSWORDS.has(password.toLowerCase());

/** Mesma regra do servidor (`secure-signup`): 8 a 128 caracteres com maiúscula, minúscula e número. */
export function validatePassword(password: string): string {
  if (!password) return "Crie uma senha.";
  if (password.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`;
  const missing = passwordRules(password).filter((r) => !r.ok);
  if (missing.length) return "A senha precisa ter 8 ou mais caracteres, com maiúscula, minúscula e número.";
  if (isCommonPassword(password)) return "Essa senha é muito comum. Escolha outra.";
  return "";
}

export function validatePasswordConfirmation(password: string, confirmation: string): string {
  if (!confirmation) return "Digite a senha de novo para confirmar.";
  return password === confirmation ? "" : "As senhas não são iguais.";
}

export interface PasswordStrength { level: 0 | 1 | 2 | 3; label: string }

/** 0 = vazia · 1 = fraca (não cumpre a regra ou é comum) · 2 = boa · 3 = forte (longa ou com símbolo). */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: "" };
  const meets = passwordRules(password).every((r) => r.ok);
  if (!meets || isCommonPassword(password)) return { level: 1, label: "Fraca" };
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) return { level: 3, label: "Forte" };
  return { level: 2, label: "Boa" };
}

/* ───────────────────────── validação por campo e por passo ───────────────────────── */

export function validateField(field: SignupField, form: SignupForm): string {
  switch (field) {
    case "fullName": return validateFullName(form.fullName);
    case "nickname": return validateNickname(form.nickname);
    case "email": return validateEmail(form.email);
    case "phone": return validatePhone(form.phone);
    case "document": return validateDocument(form.accountType, form.document);
    case "companyName": return form.accountType === "cnpj" ? validateCompanyName(form.companyName) : "";
    case "segment": return form.segment ? "" : "Escolha o que você vende.";
    case "monthlyRevenue": return form.monthlyRevenue ? "" : "Escolha uma faixa de faturamento.";
    case "referralSource": return form.referralSource ? "" : "Diga onde conheceu a Vemprapay.";
    case "password": return validatePassword(form.password);
    case "confirmPassword": return validatePasswordConfirmation(form.password, form.confirmPassword);
    case "acceptTerms": return form.acceptTerms ? "" : "Aceite os Termos de Uso e a Política de Privacidade para criar a conta.";
    default: return "";
  }
}

export function stepErrors(step: number, form: SignupForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fieldsOfStep(step, form.accountType)) {
    const message = validateField(field, form);
    if (message) errors[field] = message;
  }
  return errors;
}

/** Primeiro passo (1 a 6) com algum erro, ou null se o formulário inteiro está certo. */
export function firstInvalidStep(form: SignupForm): number | null {
  for (let step = 1; step <= TOTAL_STEPS; step++) {
    if (Object.keys(stepErrors(step, form)).length) return step;
  }
  return null;
}

/* ───────────────────────── envio ───────────────────────── */

export interface SignupRequest {
  email: string;
  password: string;
  metadata: Record<string, string | null>;
}

/** Corpo enviado à função `secure-signup`: tudo limpo, só dígitos no documento e no telefone. */
export function buildSignupRequest(form: SignupForm): SignupRequest {
  const documentDigits = onlyDigits(form.document);
  const isCompany = form.accountType === "cnpj";
  return {
    email: normalizeEmail(form.email),
    password: form.password,
    metadata: {
      full_name: squeeze(form.fullName),
      nickname: squeeze(form.nickname),
      document_number: documentDigits,
      document_type: isCompany ? "cnpj" : "cpf",
      phone: phoneDigits(form.phone),
      referral_source: form.referralSource,
      company_name: isCompany ? squeeze(form.companyName) : null,
      segment: form.segment,
      monthly_revenue_band: form.monthlyRevenue,
    },
  };
}

const labelOf = (list: ReadonlyArray<{ value: string; label: string }>, value: string): string =>
  list.find((o) => o.value === value)?.label ?? "";

export interface SummarySection { title: string; step: number; rows: Array<{ label: string; value: string }> }

/** Resumo da revisão, agrupado pelo passo em que cada dado foi preenchido (para "Editar" voltar ao passo certo). */
export function summarySections(form: SignupForm): SummarySection[] {
  const isCompany = form.accountType === "cnpj";
  return [
    {
      title: "Você",
      step: 1,
      rows: [
        { label: "Tipo de conta", value: isCompany ? "Pessoa jurídica" : "Pessoa física" },
        { label: isCompany ? "Responsável" : "Nome", value: squeeze(form.fullName) },
        { label: "Apelido", value: squeeze(form.nickname) },
      ],
    },
    {
      title: "Contato",
      step: 2,
      rows: [
        { label: "E-mail", value: normalizeEmail(form.email) },
        { label: "WhatsApp", value: formatPhone(form.phone) },
      ],
    },
    {
      title: "Documento",
      step: 3,
      rows: [
        ...(isCompany ? [{ label: "Razão social", value: squeeze(form.companyName) }] : []),
        { label: isCompany ? "CNPJ" : "CPF", value: formatDocument(form.document, form.accountType) },
      ],
    },
    {
      title: "Negócio",
      step: 4,
      rows: [
        { label: "O que vende", value: labelOf(SEGMENT_OPTIONS, form.segment) },
        { label: "Faturamento", value: labelOf(REVENUE_OPTIONS, form.monthlyRevenue) ? `${labelOf(REVENUE_OPTIONS, form.monthlyRevenue)} por mês` : "" },
        { label: "Conheceu por", value: labelOf(REFERRAL_OPTIONS, form.referralSource) },
      ],
    },
  ];
}

/** Segundos que faltam até `until` (ms), nunca negativo. */
export function secondsLeft(until: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

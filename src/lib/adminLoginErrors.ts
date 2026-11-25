/**
 * Textos de erro do login do admin.
 *
 * As funções `admin-login` e `admin-2fa-verify` respondem com status 4xx/5xx e um corpo
 * `{ success: false, error, locked? }`. O supabase-js entrega isso como `FunctionsHttpError`
 * (sem `data`), com a resposta crua em `error.context`. Se só olharmos `data`, o bloqueio de
 * 15 minutos nunca aparece e qualquer falha vira "credenciais inválidas".
 */

export interface LoginFailure {
  message: string;
  /** Conta temporariamente bloqueada por excesso de tentativas. */
  locked: boolean;
  /** O desafio acabou (código expirado/esgotado): volte para a etapa da senha. */
  restart: boolean;
}

export const LOGIN_GENERIC = "E-mail ou senha incorretos, ou esta conta não tem acesso ao painel.";
export const LOGIN_OFFLINE = "Não foi possível conectar. Verifique sua internet e tente de novo.";
export const LOGIN_UNAVAILABLE = "O login está indisponível agora. Tente de novo em instantes.";

const MAX_SERVER_MESSAGE = 160;

interface ErrorBody {
  error?: unknown;
  locked?: unknown;
}

interface ResponseLike {
  status?: number;
  json: () => Promise<unknown>;
  clone?: () => ResponseLike;
}

function asResponseLike(value: unknown): ResponseLike | null {
  if (!value || typeof value !== "object") return null;
  return typeof (value as { json?: unknown }).json === "function" ? (value as ResponseLike) : null;
}

async function readBody(res: ResponseLike): Promise<ErrorBody | null> {
  try {
    const source = typeof res.clone === "function" ? res.clone() : res;
    const body = await source.json();
    return body && typeof body === "object" ? (body as ErrorBody) : null;
  } catch {
    return null;
  }
}

function serverMessage(body: ErrorBody | null): string | null {
  const text = typeof body?.error === "string" ? body.error.trim() : "";
  return text && text.length <= MAX_SERVER_MESSAGE ? text : null;
}

/** Converte o erro de `supabase.functions.invoke` em texto para a tela. */
export async function describeLoginFailure(fnError: unknown, fallback: string = LOGIN_GENERIC): Promise<LoginFailure> {
  const name = (fnError as { name?: unknown } | null)?.name;
  // Sem resposta do servidor: rede caiu, CORS ou função fora do ar.
  if (name === "FunctionsFetchError" || name === "FunctionsRelayError") {
    return { message: LOGIN_OFFLINE, locked: false, restart: false };
  }

  const res = asResponseLike((fnError as { context?: unknown } | null)?.context);
  if (!res) return { message: fallback, locked: false, restart: false };

  if (typeof res.status === "number" && res.status >= 500) {
    return { message: LOGIN_UNAVAILABLE, locked: false, restart: false };
  }

  const body = await readBody(res);
  const text = serverMessage(body);
  const locked = body?.locked === true || res.status === 429;
  const message = text ?? (locked ? "Muitas tentativas. Aguarde 15 minutos." : fallback);
  return { message, locked, restart: /novamente/i.test(message) };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

/** Validação antes de chamar o servidor (o servidor valida de novo). */
export function validateLoginFields(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!EMAIL_SHAPE.test(email.trim())) errors.email = "Digite um e-mail válido.";
  if (!password) errors.password = "Digite a senha.";
  else if (password.length < 6) errors.password = "A senha tem pelo menos 6 caracteres.";
  return errors;
}

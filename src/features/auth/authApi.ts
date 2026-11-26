/**
 * Chamadas de rede do login, do cadastro e da recuperação de senha.
 * Cada função devolve um resultado tipado com a mensagem pronta para mostrar: a tela não precisa
 * conhecer o formato de resposta de `gated-login`, `secure-signup` e `password-reset-request`.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendlyError";
import { functionErrorMessage } from "@/lib/functionError";
import { normalizeEmail, type SignupRequest } from "./authModel";

export const LOGIN_TIMEOUT_MS = 25_000;

const httpStatus = (error: unknown): number | null => {
  const status = (error as { context?: { status?: unknown } } | null)?.context?.status;
  return typeof status === "number" ? status : null;
};

const isNetworkFailure = (error: unknown): boolean => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "FunctionsFetchError" || name === "FunctionsRelayError";
};

/* ───────────────────────── login ───────────────────────── */

export type LoginFailureKind = "invalid" | "locked" | "blocked" | "timeout" | "network" | "error";
/** `ok` verdadeiro: sessão aberta. Falso: `kind` e `message` dizem o que mostrar. */
export interface LoginResult { ok: boolean; kind: LoginFailureKind | null; message: string }
const LOGIN_OK: LoginResult = { ok: true, kind: null, message: "" };

interface LoginPayload {
  success?: boolean;
  error?: string;
  code?: string;
  access_token?: string;
  refresh_token?: string;
}

const LOCKED_CODES = new Set(["temporarily_blocked", "rate_limited"]);
const BLOCKED_CODES = new Set(["account_blocked", "account_frozen"]);

/** Entra pela função `gated-login` (limite de tentativas e conta bloqueada) e só então abre a sessão no navegador. */
export async function signInSeller(email: string, password: string): Promise<LoginResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke("gated-login", { body: { email: normalizeEmail(email), password, scope: "seller" } }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("login_timeout")), LOGIN_TIMEOUT_MS); }),
    ]);
    const payload = (data ?? null) as LoginPayload | null;

    if (payload && payload.success !== true) {
      const code = String(payload.code ?? "");
      const message = payload.error?.trim() || "E-mail ou senha incorretos.";
      if (LOCKED_CODES.has(code)) return { ok: false, kind: "locked", message };
      if (BLOCKED_CODES.has(code)) return { ok: false, kind: "blocked", message };
      return { ok: false, kind: "invalid", message };
    }
    if (error || !payload?.access_token || !payload.refresh_token) {
      if (isNetworkFailure(error)) return { ok: false, kind: "network", message: "Sem conexão com o servidor. Confira sua internet e tente de novo." };
      const message = await functionErrorMessage(error, data, "Não foi possível entrar agora. Tente de novo em instantes.");
      return { ok: false, kind: "error", message };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });
    if (sessionError) return { ok: false, kind: "error", message: friendlyError(sessionError, "Não foi possível abrir sua sessão. Tente de novo.") };
    return LOGIN_OK;
  } catch (error) {
    if (error instanceof Error && error.message === "login_timeout") {
      return { ok: false, kind: "timeout", message: "O servidor demorou para responder. Tente de novo." };
    }
    return { ok: false, kind: "network", message: "Sem conexão com o servidor. Confira sua internet e tente de novo." };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ───────────────────────── cadastro ───────────────────────── */

export type SignupFailureKind = "rate_limited" | "rejected" | "network" | "error";
export interface SignupResult { ok: boolean; kind: SignupFailureKind | null; message: string; requireVerification: boolean }

export const SIGNUP_REJECTED_MESSAGE =
  "Não foi possível criar a conta com esses dados. Se você já tem cadastro com este e-mail, CPF/CNPJ ou telefone, entre na sua conta ou recupere a senha.";

interface SignupPayload { success?: boolean; requireVerification?: boolean; error?: string }

export async function requestSignup(request: SignupRequest): Promise<SignupResult> {
  try {
    const { data, error } = await supabase.functions.invoke("secure-signup", { body: request });
    const payload = (data ?? null) as SignupPayload | null;
    if (!error && payload?.success) return { ok: true, kind: null, message: "", requireVerification: payload.requireVerification !== false };

    if (isNetworkFailure(error)) return { ok: false, kind: "network", message: "Sem conexão com o servidor. Confira sua internet e tente de novo.", requireVerification: false };
    const message = await functionErrorMessage(error, data, "Não foi possível criar a conta agora. Tente de novo em instantes.");
    // A conta já existe, só falta confirmar o e-mail: não é uma falha para quem se cadastrou.
    if (/^Conta criada/i.test(message)) return { ok: true, kind: null, message: "", requireVerification: true };

    const status = httpStatus(error);
    if (status === 429) return { ok: false, kind: "rate_limited", message, requireVerification: false };
    if (status === 400) return { ok: false, kind: "rejected", message: SIGNUP_REJECTED_MESSAGE, requireVerification: false };
    return { ok: false, kind: "error", message, requireVerification: false };
  } catch {
    return { ok: false, kind: "network", message: "Sem conexão com o servidor. Confira sua internet e tente de novo.", requireVerification: false };
  }
}

export interface ResendResult { ok: boolean; message: string }

/** Pede de novo o e-mail de confirmação (usado só quando a confirmação de e-mail está ligada). */
export async function resendSignupEmail(email: string): Promise<ResendResult> {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (!error) return { ok: true, message: "" };
    if ((error as { status?: number }).status === 429 || /rate limit|too many|only request this after/i.test(error.message)) {
      return { ok: false, message: "Aguarde um pouco antes de pedir outro e-mail." };
    }
    return { ok: false, message: friendlyError(error, "Não foi possível reenviar agora. Tente de novo em instantes.") };
  } catch {
    return { ok: false, message: "Sem conexão. Tente de novo." };
  }
}

/* ───────────────────────── recuperação de senha ───────────────────────── */

export interface RecoveryRequestResult { ok: boolean; kind: "rate_limited" | "network" | "error" | null; message: string }

/**
 * Pede o código por e-mail. A função responde igual para conta que existe e que não existe
 * (anti-enumeração), então sucesso aqui nunca confirma que o e-mail tem conta.
 */
export async function requestRecoveryCode(email: string): Promise<RecoveryRequestResult> {
  try {
    const { error } = await supabase.functions.invoke("password-reset-request", {
      body: { email: normalizeEmail(email), redirectTo: `${window.location.origin}/auth` },
    });
    if (!error) return { ok: true, kind: null, message: "" };
    if (isNetworkFailure(error)) return { ok: false, kind: "network", message: "Sem conexão com o servidor. Confira sua internet e tente de novo." };
    if (httpStatus(error) === 429) {
      return { ok: false, kind: "rate_limited", message: "Você já pediu códigos demais. Espere alguns minutos e tente de novo." };
    }
    return { ok: false, kind: "error", message: "Não foi possível enviar o código agora. Tente de novo em instantes." };
  } catch {
    return { ok: false, kind: "network", message: "Sem conexão. Tente de novo." };
  }
}

export interface ResetResult { ok: boolean; kind: "code" | "password" | "error" | null; message: string }

const authCode = (error: unknown): string => String((error as { code?: unknown } | null)?.code ?? "");

/**
 * Confere o código, troca a senha e encerra TODAS as sessões (inclusive a que o código acabou de abrir).
 * Quem recupera a senha volta pelo login normal, que passa pelo limite de tentativas e pela checagem de conta bloqueada.
 */
export async function completePasswordReset(input: { email: string; code: string; password: string }): Promise<ResetResult> {
  try {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizeEmail(input.email),
      token: input.code.trim(),
      type: "recovery",
    });
    if (verifyError) {
      if (/fetch|network|timeout/i.test(verifyError.message)) {
        return { ok: false, kind: "error", message: "Sem conexão. Tente de novo." };
      }
      return { ok: false, kind: "code", message: "Código inválido ou expirado. Confira os 6 números ou peça um novo código." };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: input.password });
    if (updateError) {
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* sem sessão para encerrar */ }
      const code = authCode(updateError);
      if (code === "same_password") return { ok: false, kind: "password", message: "Escolha uma senha diferente da anterior." };
      if (code === "weak_password") return { ok: false, kind: "password", message: "Essa senha é fraca demais. Escolha outra." };
      return { ok: false, kind: "error", message: friendlyError(updateError, "Não foi possível trocar a senha. Tente de novo.") };
    }

    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) await supabase.auth.signOut({ scope: "local" });
    } catch { /* a senha já foi trocada; a sessão local expira sozinha */ }
    return { ok: true, kind: null, message: "" };
  } catch {
    return { ok: false, kind: "error", message: "Sem conexão. Tente de novo." };
  }
}

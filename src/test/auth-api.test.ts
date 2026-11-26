import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  invoke: vi.fn(),
  setSession: vi.fn(),
  resend: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mock.invoke },
    auth: { setSession: mock.setSession, resend: mock.resend, verifyOtp: mock.verifyOtp, updateUser: mock.updateUser, signOut: mock.signOut },
  },
}));

import {
  LOGIN_TIMEOUT_MS, SIGNUP_REJECTED_MESSAGE, completePasswordReset, requestRecoveryCode, requestSignup, resendSignupEmail, signInSeller,
} from "@/features/auth/authApi";
import { buildSignupRequest, EMPTY_SIGNUP } from "@/features/auth/authModel";

/** Erro como o supabase-js devolve quando a função responde 4xx/5xx: texto genérico + a resposta crua em `context`. */
const httpError = (status: number, body: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: { status, json: async () => body },
});
const fetchError = { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" };
const sessionTokens = { success: true, access_token: "a-token", refresh_token: "r-token" };

beforeEach(() => {
  Object.values(mock).forEach((fn) => fn.mockReset());
  mock.setSession.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); });

describe("signInSeller", () => {
  it("entra pela função, normaliza o e-mail e abre a sessão com os tokens recebidos", async () => {
    mock.invoke.mockResolvedValue({ data: sessionTokens, error: null });
    const result = await signInSeller("  Lucker@Example.COM ", "Abcdef12");
    expect(result.ok).toBe(true);
    expect(mock.invoke).toHaveBeenCalledWith("gated-login", { body: { email: "lucker@example.com", password: "Abcdef12", scope: "seller" } });
    expect(mock.setSession).toHaveBeenCalledWith({ access_token: "a-token", refresh_token: "r-token" });
  });

  it("senha errada volta como 'invalid' com a mensagem do servidor e não abre sessão", async () => {
    mock.invoke.mockResolvedValue({ data: { success: false, error: "E-mail ou senha incorretos.", code: "invalid_credentials" }, error: null });
    const result = await signInSeller("a@b.com", "x");
    expect(result).toMatchObject({ ok: false, kind: "invalid", message: "E-mail ou senha incorretos." });
    expect(mock.setSession).not.toHaveBeenCalled();
  });

  it("resposta de erro sem texto cai na mensagem padrão de credenciais", async () => {
    mock.invoke.mockResolvedValue({ data: { success: false }, error: null });
    expect((await signInSeller("a@b.com", "x")).message).toBe("E-mail ou senha incorretos.");
  });

  it.each(["temporarily_blocked", "rate_limited"])("código %s vira 'locked'", async (code) => {
    mock.invoke.mockResolvedValue({ data: { success: false, error: "Muitas tentativas.", code }, error: null });
    expect((await signInSeller("a@b.com", "x")).kind).toBe("locked");
  });

  it.each(["account_blocked", "account_frozen"])("código %s vira 'blocked'", async (code) => {
    mock.invoke.mockResolvedValue({ data: { success: false, error: "Conta bloqueada.", code }, error: null });
    expect((await signInSeller("a@b.com", "x")).kind).toBe("blocked");
  });

  it("falha de rede da função vira 'network' com orientação clara", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: fetchError });
    const result = await signInSeller("a@b.com", "x");
    expect(result.kind).toBe("network");
    expect(result.message).toMatch(/internet/);
  });

  it("erro 500 mostra o texto que a função mandou, não o genérico do supabase-js", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(500, { error: "Erro interno." }) });
    expect(await signInSeller("a@b.com", "x")).toMatchObject({ ok: false, kind: "error", message: "Erro interno." });
  });

  it("resposta de sucesso sem tokens não é tratada como login", async () => {
    mock.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const result = await signInSeller("a@b.com", "x");
    expect(result.ok).toBe(false);
    expect(mock.setSession).not.toHaveBeenCalled();
  });

  it("não deixa a sessão aberta pela metade: erro ao gravar a sessão é falha", async () => {
    mock.invoke.mockResolvedValue({ data: sessionTokens, error: null });
    mock.setSession.mockResolvedValue({ error: { message: "invalid jwt" } });
    expect((await signInSeller("a@b.com", "x")).ok).toBe(false);
  });

  it("servidor que não responde vira 'timeout' depois de 25 s", async () => {
    vi.useFakeTimers();
    mock.invoke.mockReturnValue(new Promise(() => {}));
    const pending = signInSeller("a@b.com", "x");
    await vi.advanceTimersByTimeAsync(LOGIN_TIMEOUT_MS + 10);
    expect(await pending).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("exceção inesperada vira 'network', sem derrubar a tela", async () => {
    mock.invoke.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await signInSeller("a@b.com", "x")).kind).toBe("network");
  });
});

describe("requestSignup", () => {
  const request = buildSignupRequest({
    ...EMPTY_SIGNUP, accountType: "cpf", fullName: "Maria da Silva", nickname: "Mari", email: "maria@gmail.com", phone: "(11) 91234-5678",
    document: "529.982.247-25", segment: "infoproduto", monthlyRevenue: "10k_50k", referralSource: "instagram", password: "Abcdef12!", confirmPassword: "Abcdef12!", acceptTerms: true,
  });

  it("manda o pedido pronto para a função e informa se falta confirmar o e-mail", async () => {
    mock.invoke.mockResolvedValue({ data: { success: true, requireVerification: false }, error: null });
    const result = await requestSignup(request);
    expect(mock.invoke).toHaveBeenCalledWith("secure-signup", { body: request });
    expect(result).toMatchObject({ ok: true, requireVerification: false });
  });

  it("sem o campo na resposta, assume que o e-mail precisa ser confirmado (lado seguro)", async () => {
    mock.invoke.mockResolvedValue({ data: { success: true }, error: null });
    expect((await requestSignup(request)).requireVerification).toBe(true);
  });

  it("conta já existente (400) usa a mensagem genérica, sem dizer qual dado repetiu", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(400, { error: "Este CPF já está cadastrado." }) });
    const result = await requestSignup(request);
    expect(result).toMatchObject({ ok: false, kind: "rejected", message: SIGNUP_REJECTED_MESSAGE });
    expect(result.message).not.toMatch(/Este CPF/);
  });

  it("limite de tentativas (429) mostra o aviso do servidor", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(429, { error: "Muitas tentativas. Aguarde alguns minutos." }) });
    expect(await requestSignup(request)).toMatchObject({ ok: false, kind: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos." });
  });

  it("'Conta criada, mas…' é tratado como sucesso que pede confirmação de e-mail, não como falha", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(500, { error: "Conta criada, mas a ativação está pendente. Verifique seu e-mail." }) });
    expect(await requestSignup(request)).toMatchObject({ ok: true, requireVerification: true });
  });

  it("serviço fora do ar mostra o texto do servidor e fica como erro", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(503, { error: "Serviço indisponível." }) });
    expect(await requestSignup(request)).toMatchObject({ ok: false, kind: "error", message: "Serviço indisponível." });
  });

  it("sem rede e exceção viram 'network'", async () => {
    mock.invoke.mockResolvedValueOnce({ data: null, error: fetchError });
    expect((await requestSignup(request)).kind).toBe("network");
    mock.invoke.mockRejectedValueOnce(new Error("boom"));
    expect((await requestSignup(request)).kind).toBe("network");
  });
});

describe("resendSignupEmail", () => {
  it("pede o e-mail de confirmação de novo, com o retorno para /auth/callback", async () => {
    mock.resend.mockResolvedValue({ error: null });
    const result = await resendSignupEmail(" Maria@Gmail.com ");
    expect(result.ok).toBe(true);
    expect(mock.resend).toHaveBeenCalledWith({ type: "signup", email: "maria@gmail.com", options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
  });

  it("pedido em excesso (429 ou texto de rate limit) pede para esperar", async () => {
    mock.resend.mockResolvedValueOnce({ error: { message: "x", status: 429 } });
    expect((await resendSignupEmail("a@b.com")).message).toMatch(/Aguarde/);
    mock.resend.mockResolvedValueOnce({ error: { message: "For security purposes, you can only request this after 60 seconds." } });
    expect((await resendSignupEmail("a@b.com")).message).toMatch(/Aguarde/);
  });

  it("outro erro ou exceção não quebra", async () => {
    mock.resend.mockResolvedValueOnce({ error: { message: "algo deu errado" } });
    expect((await resendSignupEmail("a@b.com")).ok).toBe(false);
    mock.resend.mockRejectedValueOnce(new Error("offline"));
    expect(await resendSignupEmail("a@b.com")).toMatchObject({ ok: false, message: "Sem conexão. Tente de novo." });
  });
});

describe("requestRecoveryCode", () => {
  it("sucesso não diz se o e-mail tem conta", async () => {
    mock.invoke.mockResolvedValue({ data: { success: true }, error: null });
    const result = await requestRecoveryCode(" Lucker@Example.com ");
    expect(result).toEqual({ ok: true, kind: null, message: "" });
    expect(mock.invoke).toHaveBeenCalledWith("password-reset-request", { body: { email: "lucker@example.com", redirectTo: `${window.location.origin}/auth` } });
  });

  it("429 NÃO é sucesso: avisa o limite (o cliente antigo mostrava 'código enviado')", async () => {
    mock.invoke.mockResolvedValue({ data: null, error: httpError(429, { success: true }) });
    const result = await requestRecoveryCode("a@b.com");
    expect(result).toMatchObject({ ok: false, kind: "rate_limited" });
    expect(result.message).toMatch(/códigos demais/);
  });

  it("rede e erro do servidor têm mensagens próprias", async () => {
    mock.invoke.mockResolvedValueOnce({ data: null, error: fetchError });
    expect((await requestRecoveryCode("a@b.com")).kind).toBe("network");
    mock.invoke.mockResolvedValueOnce({ data: null, error: httpError(500, {}) });
    expect((await requestRecoveryCode("a@b.com")).kind).toBe("error");
    mock.invoke.mockRejectedValueOnce(new Error("boom"));
    expect((await requestRecoveryCode("a@b.com")).kind).toBe("network");
  });
});

describe("completePasswordReset", () => {
  const input = { email: " Lucker@Example.com ", code: " 123456 ", password: "Abcdef12!" };

  it("confere o código, troca a senha e encerra as sessões de todos os aparelhos, nessa ordem", async () => {
    const order: string[] = [];
    mock.verifyOtp.mockImplementation(async () => { order.push("verify"); return { error: null }; });
    mock.updateUser.mockImplementation(async () => { order.push("update"); return { error: null }; });
    mock.signOut.mockImplementation(async () => { order.push("signout"); return { error: null }; });
    expect((await completePasswordReset(input)).ok).toBe(true);
    expect(order).toEqual(["verify", "update", "signout"]);
    expect(mock.verifyOtp).toHaveBeenCalledWith({ email: "lucker@example.com", token: "123456", type: "recovery" });
    expect(mock.updateUser).toHaveBeenCalledWith({ password: "Abcdef12!" });
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("código errado ou vencido para ali: a senha não é trocada", async () => {
    mock.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    expect(await completePasswordReset(input)).toMatchObject({ ok: false, kind: "code" });
    expect(mock.updateUser).not.toHaveBeenCalled();
    expect(mock.signOut).not.toHaveBeenCalled();
  });

  it("queda de rede na conferência é erro de conexão, não 'código inválido'", async () => {
    mock.verifyOtp.mockResolvedValue({ error: { message: "Failed to fetch" } });
    expect(await completePasswordReset(input)).toMatchObject({ ok: false, kind: "error", message: "Sem conexão. Tente de novo." });
  });

  it("senha igual à anterior e senha fraca têm mensagem própria e a sessão aberta pelo código é encerrada", async () => {
    mock.verifyOtp.mockResolvedValue({ error: null });
    mock.updateUser.mockResolvedValueOnce({ error: { message: "x", code: "same_password" } });
    expect(await completePasswordReset(input)).toMatchObject({ ok: false, kind: "password", message: "Escolha uma senha diferente da anterior." });
    mock.updateUser.mockResolvedValueOnce({ error: { message: "x", code: "weak_password" } });
    expect((await completePasswordReset(input)).message).toMatch(/fraca demais/);
    expect(mock.signOut).toHaveBeenCalledTimes(2);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("se o encerramento global falhar, cai para o encerramento local e a troca continua valendo", async () => {
    mock.verifyOtp.mockResolvedValue({ error: null });
    mock.updateUser.mockResolvedValue({ error: null });
    mock.signOut.mockResolvedValueOnce({ error: { message: "x" } }).mockResolvedValueOnce({ error: null });
    expect((await completePasswordReset(input)).ok).toBe(true);
    expect(mock.signOut.mock.calls.map((c) => c[0].scope)).toEqual(["global", "local"]);
  });

  it("exceção inesperada vira erro de conexão", async () => {
    mock.verifyOtp.mockRejectedValue(new Error("boom"));
    expect(await completePasswordReset(input)).toMatchObject({ ok: false, kind: "error" });
  });
});

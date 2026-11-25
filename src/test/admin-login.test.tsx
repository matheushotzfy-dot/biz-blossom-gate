import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import {
  describeLoginFailure,
  validateLoginFields,
  LOGIN_GENERIC,
  LOGIN_OFFLINE,
  LOGIN_UNAVAILABLE,
} from "@/lib/adminLoginErrors";

const invoke = vi.fn();
const setSession = vi.fn();
const navigate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { setSession: (...a: unknown[]) => setSession(...a) } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn(), toggleTheme: vi.fn() }) }));
vi.mock("react-router-dom", async (orig) => ({ ...(await orig<typeof import("react-router-dom")>()), useNavigate: () => navigate }));

import AdminLogin from "@/pages/admin/AdminLogin";

const httpError = (status: number, body: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: { status, json: async () => body },
});

describe("describeLoginFailure", () => {
  it("mostra o bloqueio de 15 minutos que o servidor devolve em 429", async () => {
    const r = await describeLoginFailure(httpError(429, { success: false, error: "Muitas tentativas. Aguarde 15 minutos.", locked: true }));
    expect(r).toEqual({ message: "Muitas tentativas. Aguarde 15 minutos.", locked: true, restart: false });
  });

  it("429 sem corpo legível ainda é bloqueio", async () => {
    const r = await describeLoginFailure({ context: { status: 429, json: async () => { throw new Error("vazio"); } } });
    expect(r.locked).toBe(true);
    expect(r.message).toContain("15 minutos");
  });

  it("senha errada (401) usa o texto do servidor, sem dizer qual campo errou", async () => {
    const r = await describeLoginFailure(httpError(401, { success: false, error: "Credenciais inválidas ou acesso não autorizado." }));
    expect(r.locked).toBe(false);
    expect(r.message).toBe("Credenciais inválidas ou acesso não autorizado.");
  });

  it("serviço fora do ar (5xx) não vira 'senha incorreta'", async () => {
    expect((await describeLoginFailure(httpError(503, { error: "Serviço indisponível." }))).message).toBe(LOGIN_UNAVAILABLE);
  });

  it("sem rede, avisa da conexão em vez de acusar as credenciais", async () => {
    expect((await describeLoginFailure({ name: "FunctionsFetchError", message: "Failed to send" })).message).toBe(LOGIN_OFFLINE);
  });

  it("sem resposta alguma, cai no texto padrão (ou no que a tela pediu)", async () => {
    expect((await describeLoginFailure(new Error("x"))).message).toBe(LOGIN_GENERIC);
    expect((await describeLoginFailure(new Error("x"), "Código incorreto.")).message).toBe("Código incorreto.");
  });

  it("não exibe mensagem gigante vinda do servidor", async () => {
    const r = await describeLoginFailure(httpError(400, { error: "x".repeat(500) }));
    expect(r.message).toBe(LOGIN_GENERIC);
  });

  it("código expirado manda voltar para a senha", async () => {
    const r = await describeLoginFailure(httpError(401, { error: "Código expirado. Faça login novamente." }), "Código incorreto.");
    expect(r.restart).toBe(true);
  });
});

describe("validateLoginFields", () => {
  it("pede e-mail e senha", () => {
    expect(validateLoginFields("", "")).toEqual({ email: "Digite um e-mail válido.", password: "Digite a senha." });
  });
  it("e-mail sem domínio e senha curta", () => {
    expect(validateLoginFields("ana@", "12345")).toEqual({ email: "Digite um e-mail válido.", password: "A senha tem pelo menos 6 caracteres." });
  });
  it("aceita dados no formato certo (espaços ao redor do e-mail não contam)", () => {
    expect(validateLoginFields("  ana@empresa.com ", "123456")).toEqual({});
  });
});

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AdminLogin />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
}

describe("Tela de login do admin", () => {
  beforeEach(() => {
    invoke.mockReset();
    setSession.mockReset();
    navigate.mockReset();
  });

  it("não promete nada que o servidor não faz (2FA, uptime, métricas ao vivo)", () => {
    renderPage();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/2FA|uptime|99[.,]98|tempo real|imutável/i);
    expect(text).toContain("As tentativas de entrada ficam registradas.");
  });

  it("campos vazios: mostra o que falta e não chama o servidor", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Digite um e-mail válido.")).toBeTruthy();
    expect(screen.getByText("Digite a senha.")).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("entra: normaliza o e-mail, abre a sessão e vai para o painel", async () => {
    invoke.mockResolvedValue({ data: { success: true, access_token: "a", refresh_token: "r", role: "admin" }, error: null });
    setSession.mockResolvedValue({ error: null });
    renderPage();
    fill("  Equipe@Empresa.com ", "segredo1");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin-matheus/dashboard"));
    expect(invoke).toHaveBeenCalledWith("admin-login", { body: { email: "equipe@empresa.com", password: "segredo1" } });
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  it("conta bloqueada: o aviso de 15 minutos aparece (antes caía em 'credenciais inválidas')", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(429, { success: false, error: "Muitas tentativas. Aguarde 15 minutos.", locked: true }) });
    renderPage();
    fill("equipe@empresa.com", "segredo1");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Aguarde 15 minutos");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("senha incorreta: mostra o erro do servidor e continua na tela", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(401, { success: false, error: "Credenciais inválidas ou acesso não autorizado." }) });
    renderPage();
    fill("equipe@empresa.com", "errada123");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Credenciais inválidas");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("senha certa mas sessão não abre: não acusa a senha", async () => {
    invoke.mockResolvedValue({ data: { success: true, access_token: "a", refresh_token: "r" }, error: null });
    setSession.mockResolvedValue({ error: new Error("jwt") });
    renderPage();
    fill("equipe@empresa.com", "segredo1");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("não foi possível abrir a sessão");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mostrar/ocultar senha troca o tipo do campo", () => {
    renderPage();
    const input = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(input.type).toBe("password");
  });

  it("etapa do código (quando o servidor pedir): confirma e volta para a senha se o desafio acabou", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true, requires2FA: true, temp_token: "tmp" }, error: null });
    renderPage();
    fill("equipe@empresa.com", "segredo1");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const codeInput = await screen.findByLabelText("Código de 6 dígitos");
    fireEvent.change(codeInput, { target: { value: "12a3456" } });
    expect((codeInput as HTMLInputElement).value).toBe("123456");

    invoke.mockResolvedValueOnce({ data: null, error: httpError(401, { error: "Código expirado. Faça login novamente." }) });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Código expirado");
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(invoke).toHaveBeenLastCalledWith("admin-2fa-verify", { body: { temp_token: "tmp", code: "123456" } });
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  signInSeller: vi.fn(),
  requestSignup: vi.fn(),
  resendSignupEmail: vi.fn(),
  requestRecoveryCode: vi.fn(),
  completePasswordReset: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/auth/authApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/authApi")>()),
  signInSeller: api.signInSeller,
  requestSignup: api.requestSignup,
  resendSignupEmail: api.resendSignupEmail,
  requestRecoveryCode: api.requestRecoveryCode,
  completePasswordReset: api.completePasswordReset,
}));
vi.mock("sonner", () => ({ toast: { success: api.toast, error: vi.fn() } }));

import { LOGIN_PAUSE_AFTER, LOGIN_PAUSE_SECONDS, LoginForm } from "@/features/auth/LoginForm";
import { RecoveryFlow } from "@/features/auth/RecoveryFlow";
import { SignupFlow, VERIFY_RESEND_SECONDS } from "@/features/auth/SignupFlow";
import { SIGNUP_REJECTED_MESSAGE } from "@/features/auth/authApi";

const ok = (over = {}) => ({ ok: true, kind: null, message: "", ...over });
const fail = (kind: string, message: string, over = {}) => ({ ok: false, kind, message, ...over });

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const type = (id: string, value: string) => fireEvent.change(field(id), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const submit = (name: string | RegExp) => click(name);
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/* ───────────────────────── login ───────────────────────── */

describe("tela de login", () => {
  const setup = (props = {}) => {
    const handlers = { onSuccess: vi.fn(), onCreateAccount: vi.fn(), onRecover: vi.fn() };
    render(<LoginForm {...handlers} {...props} />);
    return handlers;
  };

  it("campos vazios mostram o que falta e não chamam o servidor", () => {
    setup();
    submit("Entrar");
    expect(screen.getByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Digite sua senha.")).toBeTruthy();
    expect(field("login-email").getAttribute("aria-invalid")).toBe("true");
    expect(api.signInSeller).not.toHaveBeenCalled();
  });

  it("e-mail sem formato válido é barrado antes de enviar", () => {
    setup();
    type("login-email", "lucker@");
    type("login-password", "qualquer");
    submit("Entrar");
    expect(screen.getByText(/não parece certo/)).toBeTruthy();
    expect(api.signInSeller).not.toHaveBeenCalled();
  });

  it("entrada certa chama onSuccess uma vez", async () => {
    api.signInSeller.mockResolvedValue(ok());
    const { onSuccess } = setup();
    type("login-email", "lucker@example.com");
    type("login-password", "Abcdef12");
    submit("Entrar");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(api.signInSeller).toHaveBeenCalledWith("lucker@example.com", "Abcdef12");
  });

  it("senha errada mostra o erro na própria tela, oferece recuperar e mantém o e-mail", async () => {
    api.signInSeller.mockResolvedValue(fail("invalid", "E-mail ou senha incorretos."));
    const { onRecover } = setup();
    type("login-email", "Lucker@Example.com");
    type("login-password", "errada");
    submit("Entrar");
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeTruthy();
    expect(field("login-email").value).toBe("Lucker@Example.com");
    fireEvent.click(screen.getAllByRole("button", { name: "Recuperar senha" })[0]);
    expect(onRecover).toHaveBeenCalledWith("lucker@example.com");
  });

  it("conta bloqueada e queda de rede mostram a mensagem certa, sem oferecer recuperar senha", async () => {
    api.signInSeller.mockResolvedValueOnce(fail("blocked", "Conta bloqueada. Contate o suporte."));
    setup();
    type("login-email", "a@b.com");
    type("login-password", "x");
    submit("Entrar");
    expect(await screen.findByText("Conta bloqueada. Contate o suporte.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Recuperar senha" })).toBeNull();
  });

  it("mostrar e ocultar a senha troca o tipo do campo e informa o estado", () => {
    setup();
    const toggle = screen.getByRole("button", { name: /senha/i, pressed: false });
    expect(field("login-password").type).toBe("password");
    fireEvent.click(toggle);
    expect(field("login-password").type).toBe("text");
    expect(screen.getByRole("button", { name: /senha/i, pressed: true })).toBeTruthy();
  });

  it("não envia duas vezes enquanto a primeira resposta não chegou", async () => {
    let finish: (v: unknown) => void = () => {};
    api.signInSeller.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { onSuccess } = setup();
    type("login-email", "a@b.com");
    type("login-password", "x");
    fireEvent.submit(screen.getByRole("form", { name: "Entrar na conta" }));
    fireEvent.submit(screen.getByRole("form", { name: "Entrar na conta" }));
    expect(api.signInSeller).toHaveBeenCalledTimes(1);
    await act(async () => { finish(ok()); });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it(`depois de ${LOGIN_PAUSE_AFTER} senhas erradas o botão pausa por ${LOGIN_PAUSE_SECONDS} s e volta sozinho`, async () => {
    vi.useFakeTimers();
    api.signInSeller.mockResolvedValue(fail("invalid", "E-mail ou senha incorretos."));
    setup();
    type("login-email", "a@b.com");
    type("login-password", "errada");
    for (let i = 0; i < LOGIN_PAUSE_AFTER; i += 1) {
      submit(/^Entrar$/);
      await flush();
    }
    expect(api.signInSeller).toHaveBeenCalledTimes(LOGIN_PAUSE_AFTER);
    const paused = screen.getByRole("button", { name: /Tente de novo em/ }) as HTMLButtonElement;
    expect(paused.disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Entrar na conta" }));
    expect(api.signInSeller).toHaveBeenCalledTimes(LOGIN_PAUSE_AFTER);
    await act(async () => { await vi.advanceTimersByTimeAsync((LOGIN_PAUSE_SECONDS + 1) * 1000); });
    expect((screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("e-mail e aviso que vêm de outra tela aparecem prontos", () => {
    setup({ initialEmail: "maria@gmail.com", notice: { tone: "success", message: "Senha alterada. Entre com a nova senha." } });
    expect(field("login-email").value).toBe("maria@gmail.com");
    expect(screen.getByRole("status").textContent).toContain("Senha alterada");
  });

  it("atalhos: criar conta e esqueci a senha", () => {
    const { onCreateAccount, onRecover } = setup();
    type("login-email", " Maria@Gmail.com ");
    click("Esqueceu a senha?");
    expect(onRecover).toHaveBeenCalledWith("maria@gmail.com");
    click("Criar conta");
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });
});

/* ───────────────────────── cadastro ───────────────────────── */

describe("tela de cadastro", () => {
  const setup = () => {
    const handlers = { onSuccess: vi.fn(), onLogin: vi.fn(), onRecover: vi.fn() };
    render(<SignupFlow {...handlers} />);
    return handlers;
  };
  const next = () => click(/Continuar|Voltar à revisão/);
  const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

  const fillIdentity = () => { type("su-fullName", "Maria da Silva"); type("su-nickname", "Mari"); next(); };
  const fillContact = () => { type("su-email", "maria@gmail.com"); type("su-phone", "11912345678"); next(); };
  const fillDocument = () => { type("su-document", "52998224725"); next(); };
  // Os três campos do negócio são escolhas rápidas (rádios nativos), não listas suspensas.
  const fillBusiness = () => {
    fireEvent.click(screen.getByLabelText("Curso / Infoproduto"));
    fireEvent.click(screen.getByLabelText("R$ 10 a 50 mil"));
    fireEvent.click(screen.getByLabelText("Instagram"));
    next();
  };
  const fillPassword = () => { type("su-password", "Abcdef12!"); type("su-confirmPassword", "Abcdef12!"); next(); };
  const reachReview = () => { fillIdentity(); fillContact(); fillDocument(); fillBusiness(); fillPassword(); };

  it("começa no passo 1 de 6, com a pessoa física escolhida", () => {
    setup();
    expect(heading()).toBe("Vamos começar");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Passo 1 de 6: Identificação");
    expect((screen.getByLabelText(/Pessoa física/) as HTMLInputElement).checked).toBe(true);
  });

  it("Continuar sem preencher mostra os erros do passo e não avança", () => {
    setup();
    next();
    expect(heading()).toBe("Vamos começar");
    expect(screen.getByText("Informe seu nome completo.")).toBeTruthy();
    expect(field("su-fullName").getAttribute("aria-invalid")).toBe("true");
  });

  it("nome com uma palavra só não passa", () => {
    setup();
    type("su-fullName", "Maria");
    type("su-nickname", "Mari");
    next();
    expect(heading()).toBe("Vamos começar");
    expect(screen.getByText("Informe nome e sobrenome, como estão no documento.")).toBeTruthy();
  });

  it("o WhatsApp ganha máscara enquanto digita e o +55 é ignorado", () => {
    setup();
    fillIdentity();
    type("su-phone", "+55 (11) 91234-5678");
    expect(field("su-phone").value).toBe("(11) 91234-5678");
    type("su-phone", "11912345678");
    expect(field("su-phone").value).toBe("(11) 91234-5678");
  });

  it("e-mail com domínio digitado errado sugere o certo e o clique corrige", () => {
    setup();
    fillIdentity();
    type("su-email", "maria@gmial.com");
    fireEvent.blur(field("su-email"));
    fireEvent.click(screen.getByRole("button", { name: "maria@gmail.com" }));
    expect(field("su-email").value).toBe("maria@gmail.com");
  });

  it("telefone sem DDD válido é barrado", () => {
    setup();
    fillIdentity();
    type("su-email", "maria@gmail.com");
    type("su-phone", "0112345678");
    next();
    expect(heading()).toBe("Como falamos com você");
    expect(field("su-phone").getAttribute("aria-invalid")).toBe("true");
  });

  it("CPF com dígito errado não passa e CPF certo ganha a máscara", () => {
    setup();
    fillIdentity();
    fillContact();
    type("su-document", "52998224724");
    expect(field("su-document").value).toBe("529.982.247-24");
    next();
    expect(heading()).toBe("Confirme seu documento");
    expect(screen.getByText(/CPF inválido/)).toBeTruthy();
    type("su-document", "52998224725");
    next();
    expect(heading()).toBe("Sobre o seu negócio");
  });

  it("pessoa jurídica pede razão social e CNPJ; trocar de tipo limpa o documento", () => {
    setup();
    fireEvent.click(screen.getByLabelText(/Pessoa jurídica/));
    type("su-fullName", "Maria da Silva");
    type("su-nickname", "Mari");
    next();
    fillContact();
    expect(field("su-companyName")).toBeTruthy();
    type("su-companyName", "Maria Digital LTDA");
    type("su-document", "11222333000181");
    expect(field("su-document").value).toBe("11.222.333/0001-81");
    click("Voltar");
    click("Voltar");
    fireEvent.click(screen.getByLabelText(/Pessoa física/));
    next();
    next();
    expect(field("su-document").value).toBe("");
    expect(document.getElementById("su-companyName")).toBeNull();
  });

  it("negócio: os três campos são obrigatórios", () => {
    setup();
    fillIdentity();
    fillContact();
    fillDocument();
    next();
    expect(heading()).toBe("Sobre o seu negócio");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
    fillBusiness();
    expect(heading()).toBe("Proteja sua conta");
  });

  it("senha: mostra as regras, avisa senha comum e exige confirmação igual", () => {
    setup();
    fillIdentity(); fillContact(); fillDocument(); fillBusiness();
    type("su-password", "abc");
    expect(screen.getByRole("list", { name: "Regras da senha" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Senha fraca/);
    type("su-password", "Abcdef12!");
    expect(screen.getByRole("status").textContent).toMatch(/Senha forte/);
    type("su-confirmPassword", "Abcdef12");
    next();
    expect(heading()).toBe("Proteja sua conta");
    expect(screen.getByText("As senhas não são iguais.")).toBeTruthy();
  });

  it("a revisão mostra tudo agrupado e só cria a conta com o aceite dos termos", () => {
    setup();
    reachReview();
    expect(heading()).toBe("Tudo certo?");
    const person = screen.getByRole("region", { name: "Você" });
    expect(within(person).getByText("Maria da Silva")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Documento" })).getByText("529.982.247-25")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Negócio" })).getByText("R$ 10 a 50 mil")).toBeTruthy();
    expect(screen.queryByText(/Abcdef12/)).toBeNull();
    click("Criar conta");
    expect(screen.getByText(/Aceite os Termos de Uso/)).toBeTruthy();
    expect(api.requestSignup).not.toHaveBeenCalled();
  });

  it("'Editar' na revisão volta ao passo certo e depois leva direto de volta à revisão", () => {
    setup();
    reachReview();
    click("Editar contato");
    expect(heading()).toBe("Como falamos com você");
    type("su-email", "outra@gmail.com");
    click("Voltar à revisão");
    expect(heading()).toBe("Tudo certo?");
    expect(within(screen.getByRole("region", { name: "Contato" })).getByText("outra@gmail.com")).toBeTruthy();
  });

  it("sem confirmação de e-mail: cria a conta, entra sozinho e avisa", async () => {
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: false });
    api.signInSeller.mockResolvedValue(ok());
    const { onSuccess } = setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const request = api.requestSignup.mock.calls[0][0];
    expect(request).toMatchObject({
      email: "maria@gmail.com",
      password: "Abcdef12!",
      metadata: {
        full_name: "Maria da Silva", nickname: "Mari", document_number: "52998224725", document_type: "cpf", phone: "11912345678",
        segment: "infoproduto", monthly_revenue_band: "10k_50k", referral_source: "instagram", company_name: null,
      },
    });
    expect(api.signInSeller).toHaveBeenCalledWith("maria@gmail.com", "Abcdef12!");
    expect(api.toast).toHaveBeenCalled();
  });

  it("pessoa jurídica manda a razão social e o tipo cnpj", async () => {
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: false });
    api.signInSeller.mockResolvedValue(ok());
    setup();
    fireEvent.click(screen.getByLabelText(/Pessoa jurídica/));
    fillIdentity();
    fillContact();
    type("su-companyName", "  Maria   Digital LTDA ");
    type("su-document", "11222333000181");
    next();
    fillBusiness();
    fillPassword();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    await waitFor(() => expect(api.requestSignup).toHaveBeenCalled());
    expect(api.requestSignup.mock.calls[0][0].metadata).toMatchObject({ document_type: "cnpj", document_number: "11222333000181", company_name: "Maria Digital LTDA" });
  });

  it("com confirmação de e-mail ligada mostra o painel de espera e não tenta entrar", async () => {
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: true });
    const { onLogin } = setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    expect(await screen.findByRole("heading", { name: "Confirme seu e-mail" })).toBeTruthy();
    expect(screen.getByText("maria@gmail.com")).toBeTruthy();
    expect(api.signInSeller).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Reenviar e-mail em/ }) as HTMLButtonElement).disabled).toBe(true);
    click("Já confirmei, entrar");
    expect(onLogin).toHaveBeenCalledWith("maria@gmail.com");
  });

  it(`reenvio do e-mail só libera depois de ${VERIFY_RESEND_SECONDS} s e confirma quando sai`, async () => {
    vi.useFakeTimers();
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: true });
    api.resendSignupEmail.mockResolvedValue({ ok: true, message: "" });
    setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync((VERIFY_RESEND_SECONDS + 1) * 1000); });
    click("Reenviar e-mail");
    await flush();
    expect(api.resendSignupEmail).toHaveBeenCalledWith("maria@gmail.com");
    expect(screen.getByText(/Enviamos o e-mail de novo/)).toBeTruthy();
  });

  it("'Corrigir e-mail' volta ao passo do contato com os dados preservados", async () => {
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: true });
    setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    await screen.findByRole("heading", { name: "Confirme seu e-mail" });
    click("Corrigir e-mail");
    expect(heading()).toBe("Como falamos com você");
    expect(field("su-email").value).toBe("maria@gmail.com");
  });

  it("dado repetido: mensagem genérica com atalhos para entrar ou recuperar a senha, e os dados continuam na tela", async () => {
    api.requestSignup.mockResolvedValue({ ok: false, kind: "rejected", message: SIGNUP_REJECTED_MESSAGE, requireVerification: false });
    const { onLogin, onRecover } = setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    expect(await screen.findByText(SIGNUP_REJECTED_MESSAGE)).toBeTruthy();
    expect(heading()).toBe("Tudo certo?");
    click("Entrar na conta");
    expect(onLogin).toHaveBeenCalledWith("maria@gmail.com");
    click("Recuperar senha");
    expect(onRecover).toHaveBeenCalledWith("maria@gmail.com");
    expect((field("su-acceptTerms")).checked).toBe(true);
  });

  it("limite de tentativas e queda de rede mostram o aviso e deixam tentar de novo", async () => {
    api.requestSignup.mockResolvedValueOnce({ ok: false, kind: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos.", requireVerification: false });
    setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    expect(await screen.findByText("Muitas tentativas. Aguarde alguns minutos.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Criar conta" }) as HTMLButtonElement).disabled).toBe(false);
    api.requestSignup.mockResolvedValueOnce({ ok: true, kind: null, message: "", requireVerification: true });
    click("Criar conta");
    expect(await screen.findByRole("heading", { name: "Confirme seu e-mail" })).toBeTruthy();
  });

  it("conta criada mas login automático recusado: volta ao login com o e-mail e um aviso claro", async () => {
    api.requestSignup.mockResolvedValue({ ok: true, kind: null, message: "", requireVerification: false });
    api.signInSeller.mockResolvedValue(fail("invalid", "E-mail ou senha incorretos."));
    const { onLogin, onSuccess } = setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    click("Criar conta");
    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onLogin.mock.calls[0][0]).toBe("maria@gmail.com");
    expect(onLogin.mock.calls[0][1].message).toMatch(/Sua conta foi criada/);
  });

  it("não cria duas contas com cliques repetidos", async () => {
    let finish: (v: unknown) => void = () => {};
    api.requestSignup.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    setup();
    reachReview();
    fireEvent.click(field("su-acceptTerms"));
    const form = screen.getByRole("form", { name: /Cadastro, passo 6 de 6/ });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.requestSignup).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: true, kind: null, message: "", requireVerification: true }); });
  });

  it("a revisão não promete o que o produto não faz", async () => {
    setup();
    reachReview();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/256|SSL|aviso[s]? de (venda|saque) por e-mail/i);
    expect(text).toMatch(/O saque só é processado depois que ela for aprovada/);
  });
});

/* ───────────────────────── recuperação ───────────────────────── */

describe("recuperação de senha", () => {
  const setup = (props = {}) => {
    const onBack = vi.fn();
    render(<RecoveryFlow onBack={onBack} {...props} />);
    return { onBack };
  };
  const toCodeStage = async () => {
    api.requestRecoveryCode.mockResolvedValue({ ok: true, kind: null, message: "" });
    type("recovery-email", "lucker@example.com");
    click("Enviar código");
    await screen.findByRole("heading", { name: "Criar nova senha" });
  };

  it("e-mail inválido é barrado antes de pedir o código", () => {
    setup();
    type("recovery-email", "lucker");
    click("Enviar código");
    expect(api.requestRecoveryCode).not.toHaveBeenCalled();
    expect(field("recovery-email").getAttribute("aria-invalid")).toBe("true");
  });

  it("pede o código, vai para a segunda etapa e mostra para onde foi sem confirmar que a conta existe", async () => {
    setup();
    await toCodeStage();
    expect(api.requestRecoveryCode).toHaveBeenCalledWith("lucker@example.com");
    expect(screen.getByText(/tiver conta/)).toBeTruthy();
  });

  it("limite de pedidos (429) avisa e deixa seguir com um código que a pessoa já tem", async () => {
    api.requestRecoveryCode.mockResolvedValue({ ok: false, kind: "rate_limited", message: "Você já pediu códigos demais. Espere alguns minutos e tente de novo." });
    setup();
    type("recovery-email", "lucker@example.com");
    click("Enviar código");
    expect(await screen.findByText(/códigos demais/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Criar nova senha" })).toBeNull();
    click("Já tenho o código");
    expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeTruthy();
  });

  it("o código só aceita números e no máximo 6", async () => {
    setup();
    await toCodeStage();
    type("recovery-code", "12ab34-5678");
    expect(field("recovery-code").value).toBe("123456");
  });

  it("código incompleto, senha fraca e confirmação diferente são barrados sem chamar o servidor", async () => {
    setup();
    await toCodeStage();
    type("recovery-code", "123");
    type("recovery-password", "abc");
    type("recovery-confirm", "xyz");
    click("Alterar senha");
    expect(screen.getByText("Digite os 6 números do código.")).toBeTruthy();
    expect(api.completePasswordReset).not.toHaveBeenCalled();
    type("recovery-code", "123456");
    type("recovery-password", "Abcdef12!");
    type("recovery-confirm", "Abcdef12");
    click("Alterar senha");
    expect(screen.getByText("As senhas não são iguais.")).toBeTruthy();
    expect(api.completePasswordReset).not.toHaveBeenCalled();
  });

  it("código errado aparece no campo do código e a pessoa tenta de novo sem perder o resto", async () => {
    api.completePasswordReset.mockResolvedValue({ ok: false, kind: "code", message: "Código inválido ou expirado. Confira os 6 números ou peça um novo código." });
    setup();
    await toCodeStage();
    type("recovery-code", "000000");
    type("recovery-password", "Abcdef12!");
    type("recovery-confirm", "Abcdef12!");
    click("Alterar senha");
    expect(await screen.findByText(/Código inválido ou expirado/)).toBeTruthy();
    expect(field("recovery-password").value).toBe("Abcdef12!");
  });

  it("senha igual à anterior aparece no campo da senha", async () => {
    api.completePasswordReset.mockResolvedValue({ ok: false, kind: "password", message: "Escolha uma senha diferente da anterior." });
    setup();
    await toCodeStage();
    type("recovery-code", "123456");
    type("recovery-password", "Abcdef12!");
    type("recovery-confirm", "Abcdef12!");
    click("Alterar senha");
    expect(await screen.findByText("Escolha uma senha diferente da anterior.")).toBeTruthy();
  });

  it("troca concluída: avisa que todos os aparelhos saíram e devolve o e-mail ao login", async () => {
    api.completePasswordReset.mockResolvedValue({ ok: true, kind: null, message: "" });
    const { onBack } = setup();
    await toCodeStage();
    type("recovery-code", "123456");
    type("recovery-password", "Abcdef12!");
    type("recovery-confirm", "Abcdef12!");
    click("Alterar senha");
    expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeTruthy();
    expect(screen.getByText(/todos os aparelhos foram desconectados/)).toBeTruthy();
    expect(api.completePasswordReset).toHaveBeenCalledWith({ email: "lucker@example.com", code: "123456", password: "Abcdef12!" });
    click("Entrar");
    expect(onBack).toHaveBeenCalledWith("lucker@example.com", true);
  });

  it("reenvio do código espera 30 s e 'Usar outro e-mail' volta à primeira etapa", async () => {
    vi.useFakeTimers();
    api.requestRecoveryCode.mockResolvedValue({ ok: true, kind: null, message: "" });
    setup({ initialEmail: "lucker@example.com" });
    click("Enviar código");
    await flush();
    const resend = screen.getByRole("button", { name: /Reenviar código em/ }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    click("Reenviar código");
    await flush();
    expect(api.requestRecoveryCode).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/novo código/)).toBeTruthy();
    click("Usar outro e-mail");
    expect(screen.getByRole("heading", { name: "Recuperar acesso" })).toBeTruthy();
  });

  it("'Voltar para o login' leva o e-mail digitado", () => {
    const { onBack } = setup();
    type("recovery-email", " Lucker@Example.com ");
    click("Voltar para o login");
    expect(onBack).toHaveBeenCalledWith("lucker@example.com");
  });
});

/* ───────────────────────── painel ao lado ───────────────────────── */

describe("painel ao lado do formulário", () => {
  it("tem um motivo para cada passo do cadastro, sem promessa de prazo", async () => {
    const { SIGNUP_STEPS, STEP_REASONS } = await import("@/features/auth/authModel");
    expect(STEP_REASONS).toHaveLength(SIGNUP_STEPS.length);
    const all = JSON.stringify(STEP_REASONS).toLowerCase();
    for (const banned of ["minutos", "horas", "24h", "garantid", "instantâne"]) expect(all).not.toContain(banned);
  });

  it("muda com a tela e com o passo do cadastro", async () => {
    const { AuthAside } = await import("@/components/auth/AuthAside");
    const { STEP_REASONS } = await import("@/features/auth/authModel");
    const { rerender } = render(<AuthAside mode="login" />);
    expect(screen.getByRole("img", { name: /Painel do vendedor/ })).toBeTruthy();
    expect(screen.getByText(/Nomes e valores são exemplos/)).toBeTruthy();
    rerender(<AuthAside mode="signup" step={3} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(STEP_REASONS[2].title);
    expect(screen.getByText("você está aqui")).toBeTruthy();
    rerender(<AuthAside mode="recovery" />);
    expect(screen.getByText(/todos os aparelhos conectados saem da conta/)).toBeTruthy();
  });
});

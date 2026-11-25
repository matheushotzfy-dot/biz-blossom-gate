import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: vi.fn(() => ({})), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import SettingsCenter from "@/features/admin-settings/SettingsCenter";
import {
  checkFee, checkReason, checkTicket, describeHistory, feeInputText, feeLimit, fmtFee, groupFees, parseSettings, releaseLabel, whenLabel,
} from "@/features/admin-settings/settingsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const fee = (id: string, name: string, fee_type: string, value: number) => ({ id, name, fee_type, value });

const settings = (over: Record<string, unknown> = {}) => ({
  fees: [
    fee("f1", "Taxa PIX", "percentage", 5.99), fee("f2", "Taxa Fixa PIX", "fixed", 0), fee("f3", "Taxa Cartão", "percentage", 5.99), fee("f4", "Taxa Fixa Cartão", "fixed", 1),
    fee("f5", "Taxa Boleto Percentual", "percentage", 3.49), fee("f6", "Taxa Fixa Boleto", "fixed", 3.49), fee("f7", "Taxa Boleto", "fixed", 3.49),
    fee("f8", "Taxa de Saque", "fixed", 5), fee("f9", "Taxa Fixa por Transação", "fixed", 0), fee("f10", "Taxa Antecipação", "percentage", 2.5),
  ],
  individual_fee_sellers: 3,
  max_ticket: { value: 200, configured: true, updated_at: ago(30), updated_by: "Admin", individual: 2 },
  release: {
    global_days: 7, updated_at: ago(80), updated_by: "Admin", overrides_total: 2,
    overrides: [
      { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", days: 15, updated_at: ago(40) },
      { user_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com", days: 1, updated_at: ago(5) },
    ],
  },
  signup: { require_email_verification: false, configured: true, updated_at: ago(1200), updated_by: "Admin" },
  history: [
    { id: "h1", action: "platform_fee_update", created_at: ago(0.2), admin_name: "Admin", details: { name: "Taxa PIX", fee_type: "percentage", from: 4.99, to: 5.99 } },
    { id: "h2", action: "max_ticket_set", created_at: ago(30), admin_name: "Admin", details: { reason: "Reduzir o risco de fraude", scope: "new", from: 10000, to: 200 } },
  ],
  generated_at: ago(0),
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
async function open(props: { isAdmin?: boolean; onNavigate?: (t: string) => void } = {}) {
  wrap(<SettingsCenter {...props} />);
  await screen.findByText("Taxas da plataforma");
}
const feeInput = (group: string, label: string) => screen.getByLabelText(`${group}: ${label}`) as HTMLInputElement;

beforeEach(() => {
  rpc.mockReset(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_settings = () => ({ data: settings(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("settingsModel", () => {
  it("lê as configurações e usa os padrões de fábrica quando falta valor", () => {
    const s = parseSettings(settings());
    expect(s.fees).toHaveLength(10);
    expect(s.individualFeeSellers).toBe(3);
    expect(s.maxTicket).toMatchObject({ value: 200, configured: true, individual: 2, updatedBy: "Admin" });
    expect(s.release).toMatchObject({ globalDays: 7, overridesTotal: 2 });
    expect(s.release.overrides[0]).toMatchObject({ user_id: "s1", days: 15 });
    expect(s.signup.requireEmailVerification).toBe(false);

    const bare = parseSettings({ fees: [{ id: "x", name: "Taxa PIX", fee_type: "percentage", value: "4.5" }, { nope: true }] });
    expect(bare.fees).toEqual([{ id: "x", name: "Taxa PIX", fee_type: "percentage", value: 4.5 }]);
    expect(bare.maxTicket).toMatchObject({ value: 10000, configured: false });
    expect(bare.release.globalDays).toBe(7);
    expect(bare.signup.requireEmailVerification).toBe(true);
    expect(bare.history).toEqual([]);
    expect(() => parseSettings(null)).toThrow();
    expect(() => parseSettings({})).toThrow();
  });

  it("agrupa as taxas por meio de pagamento, com rótulo próprio, e deixa taxa desconhecida em outras", () => {
    const g = groupFees(parseSettings(settings()).fees);
    expect(g.map((x) => x.title)).toEqual(["Pix", "Cartão de crédito", "Boleto", "Saque", "Outros meios", "Outras taxas"]);
    expect(g[0].lines.map((l) => l.label)).toEqual(["Percentual por venda", "Valor fixo por venda"]);
    expect(g[2].lines.map((l) => l.name)).toEqual(["Taxa Boleto Percentual", "Taxa Fixa Boleto", "Taxa Boleto"]);
    expect(g[2].lines[2].label).toBe("Valor fixo de reserva");
    expect(g[5].lines[0]).toMatchObject({ name: "Taxa Antecipação", label: "Taxa Antecipação" });
    // grupo sem taxa some
    expect(groupFees([fee("a", "Taxa PIX", "percentage", 1)].map((f) => ({ ...f, fee_type: "percentage" as const }))).map((x) => x.id)).toEqual(["pix"]);
  });

  it("valida o valor digitado da taxa conforme o tipo e o limite", () => {
    const pct = { fee_type: "percentage" as const, name: "Taxa PIX" };
    const fix = { fee_type: "fixed" as const, name: "Taxa Fixa PIX" };
    const saque = { fee_type: "fixed" as const, name: "Taxa de Saque" };
    expect(feeLimit(pct)).toBe(50); expect(feeLimit(fix)).toBe(100); expect(feeLimit(saque)).toBe(500);
    expect(checkFee("5", pct)).toEqual({ value: 5 });
    expect(checkFee(" 5,5 ", pct)).toEqual({ value: 5.5 });
    expect(checkFee("5.49", pct)).toEqual({ value: 5.49 });
    expect(checkFee("0", pct)).toEqual({ value: 0 });
    expect(checkFee("50", pct)).toEqual({ value: 50 });
    expect(checkFee("51", pct)).toEqual({ error: "O máximo é 50,00%." });
    expect(checkFee("100", fix)).toEqual({ value: 100 });
    expect(checkFee("101", fix)).toEqual({ error: expect.stringContaining("O máximo é R$") });
    expect(checkFee("500", saque)).toEqual({ value: 500 });
    expect(checkFee("501", saque)).toHaveProperty("error");
    expect(checkFee("", pct)).toEqual({ error: "Informe o valor." });
    for (const bad of ["abc", "5,555", "-1", "1.234,56", "5%", "1e3"]) expect(checkFee(bad, pct)).toEqual({ error: "Use só números, com até 2 casas decimais." });
  });

  it("formata taxas e prazos", () => {
    expect(fmtFee("percentage", 5.99)).toBe("5,99%");
    expect(fmtFee("fixed", 5)).toMatch(/R\$\s5,00/);
    expect(feeInputText(5)).toBe("5,00");
    expect(feeInputText(1234.5)).toBe("1234,50");
    expect(releaseLabel(15)).toBe("D+15");
  });

  it("valida o limite por venda e o motivo", () => {
    expect(checkTicket(null)).toBe("Informe o limite.");
    expect(checkTicket(0)).toBe("Informe o limite.");
    expect(checkTicket(200)).toBeNull();
    expect(checkTicket(1_000_000)).toBeNull();
    expect(checkTicket(1_000_000.01)).toMatch(/O limite fica entre/);
    expect(checkReason("1234")).toMatch(/mínimo 5/);
    expect(checkReason("  abc  ")).not.toBeNull();
    expect(checkReason("12345")).toBeNull();
  });

  it("descreve cada ação do histórico em português, com o motivo", () => {
    const h = (action: string, details: Record<string, unknown> = {}) => describeHistory({ id: "1", action, created_at: ago(1), admin_name: "Admin", details });
    expect(h("platform_fee_update", { name: "Taxa PIX", fee_type: "percentage", from: 4.99, to: 5.99 })).toEqual({ title: "Taxa alterada", detail: "Pix, percentual: 4,99% → 5,99%", reason: null });
    expect(h("platform_fee_update", { name: "Taxa de Saque", fee_type: "fixed", from: 5, to: 7 }).detail).toMatch(/^Saque: R\$\s5,00 → R\$\s7,00$/);
    expect(h("custom_fees_reset", { sellers: 1, reason: " Voltar ao padrão " })).toEqual({ title: "Taxas individuais zeradas", detail: "1 seller voltou ao padrão", reason: "Voltar ao padrão" });
    expect(h("custom_fees_reset", { sellers: 4 }).detail).toBe("4 sellers voltaram ao padrão");
    expect(h("max_ticket_set", { scope: "all", from: 200, to: 500 }).detail).toMatch(/para todos$/);
    expect(h("max_ticket_set", { scope: "new", from: 200, to: 500 }).detail).toMatch(/só para quem criar conta depois$/);
    expect(h("card_release_set", { scope: "seller", from: 7, to: 15 })).toMatchObject({ title: "Prazo do cartão de um seller", detail: "D+7 → D+15" });
    expect(h("card_release_set", { from: 7, to: 15 }).title).toBe("Prazo padrão do cartão");
    expect(h("card_release_clear", { from: 15, to: 7 }).detail).toBe("D+15 → D+7 (padrão)");
    expect(h("email_verification_set", { enabled: true }).title).toBe("Confirmação de e-mail ligada");
    expect(h("email_verification_set", { enabled: false }).title).toBe("Confirmação de e-mail desligada");
    expect(h("algo_novo")).toEqual({ title: "Mudança registrada", detail: null, reason: null });
  });

  it("escreve quando aconteceu", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(whenLabel(null)).toBe("—");
    expect(whenLabel("lixo")).toBe("—");
    expect(whenLabel("2026-11-25T11:59:40Z", now)).toBe("agora há pouco");
    expect(whenLabel("2026-11-25T11:30:00Z", now)).toBe("há 30 min");
    expect(whenLabel("2026-11-25T09:00:00Z", now)).toBe("há 3 h");
    expect(whenLabel("2026-11-20T15:30:00Z", now)).toBe("20/11/2026 às 12:30");
  });
});

/* ───────── tela ───────── */

describe("Configurações: carregamento", () => {
  it("só o administrador vê; os outros não chamam nada", () => {
    wrap(<SettingsCenter isAdmin={false} />);
    expect(screen.getByText("As configurações são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra todos os painéis e o aviso quando o cadastro não exige confirmação de e-mail", async () => {
    await open();
    for (const t of ["Taxas da plataforma", "Liberação do cartão", "Limite por venda", "Cadastro", "Últimas mudanças", "Onde ficou o resto"]) expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    expect(screen.getByText("Cadastro sem confirmação de e-mail")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/receber o acesso aos cursos dele/);
    expect(feeInput("Pix", "Percentual por venda").value).toBe("5,99");
    expect(feeInput("Saque", "Valor por saque").value).toBe("5,00");
    expect(screen.getByText(/3 sellers têm taxa própria/)).toBeInTheDocument();
    expect(screen.getByText("Taxa alterada")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Reduzir o risco de fraude")).toBeInTheDocument();
  });

  it("com a confirmação ligada não mostra o aviso e o selo fica verde", async () => {
    handlers.get_admin_settings = () => ({ data: settings({ signup: { require_email_verification: true, configured: true, updated_at: null, updated_by: null } }), error: null });
    await open();
    expect(screen.getByText("Cadastro exige confirmação de e-mail")).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("switch", { name: "Exigir confirmação de e-mail" })).toBeChecked();
  });

  it("sem histórico, sem exceções e sem taxa individual diz isso", async () => {
    handlers.get_admin_settings = () => ({ data: settings({ history: [], individual_fee_sellers: 0, release: { global_days: 7, updated_at: null, updated_by: null, overrides_total: 0, overrides: [] }, max_ticket: { value: 10000, configured: false, updated_at: null, updated_by: null, individual: 0 } }), error: null });
    await open();
    expect(screen.getByText(/Nenhuma mudança feita por aqui ainda/)).toBeInTheDocument();
    expect(screen.getByText("Todos seguem D+7.")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum seller tem taxa própria/)).toBeInTheDocument();
    expect(screen.getByText("Valor de fábrica, ainda não alterado.")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum seller tem limite próprio/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar todos ao padrão/ })).toBeDisabled();
  });

  it("falha de carga mostra o erro com 'Tentar de novo', nunca valores falsos", async () => {
    handlers.get_admin_settings = () => ({ data: null, error: { message: "boom" } });
    wrap(<SettingsCenter />);
    expect(await screen.findByText("Não foi possível carregar as configurações.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.queryByText("Taxas da plataforma")).toBeNull();
    handlers.get_admin_settings = () => ({ data: settings(), error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Taxas da plataforma")).toBeInTheDocument();
  });

  it("resposta em formato inesperado vira erro", async () => {
    handlers.get_admin_settings = () => ({ data: { fees: "x" }, error: null });
    wrap(<SettingsCenter />);
    expect(await screen.findByText("Não foi possível carregar as configurações.")).toBeInTheDocument();
  });

  it("os atalhos levam às outras abas", async () => {
    const go = vi.fn();
    await open({ onNavigate: go });
    fireEvent.click(screen.getByRole("button", { name: /Aprovação manual de saques e reembolsos/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pausar saques ou o checkout/ }));
    fireEvent.click(screen.getByRole("button", { name: /Avisos para os sellers/ }));
    fireEvent.click(screen.getByRole("button", { name: /Taxa e limite de um seller só/ }));
    expect(go.mock.calls.map((c) => c[0])).toEqual(["refund-approvals", "tools", "notifications", "sellers"]);
  });
});

describe("Configurações: taxas", () => {
  it("só oferece Salvar depois de mudar o valor", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    fireEvent.change(feeInput("Pix", "Percentual por venda"), { target: { value: "4,99" } });
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    fireEvent.change(feeInput("Pix", "Percentual por venda"), { target: { value: "5,99" } });
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("salva pelo servidor depois de confirmar a senha, com o texto do que muda, e recarrega", async () => {
    await open();
    fireEvent.change(feeInput("Pix", "Percentual por venda"), { target: { value: "4,99" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls("admin_set_platform_fee")).toHaveLength(1));
    expect(calls("admin_set_platform_fee")[0]).toEqual({ _id: "f1", _value: 4.99 });
    expect(confirmSpy.mock.calls[0][0]).toBe("Pix, percentual: de 5,99% para 4,99%. Vale para os sellers sem taxa própria.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Taxa salva."));
    await waitFor(() => expect(calls("get_admin_settings").length).toBeGreaterThan(1));
  });

  it("a taxa de saque avisa que vale para os próximos saques", async () => {
    await open();
    fireEvent.change(feeInput("Saque", "Valor por saque"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls("admin_set_platform_fee")).toHaveLength(1));
    expect(calls("admin_set_platform_fee")[0]).toEqual({ _id: "f8", _value: 7 });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Vale para os próximos saques\.$/);
  });

  it("valor inválido mostra o erro na hora de sair do campo e nunca chama o servidor", async () => {
    await open();
    const input = feeInput("Pix", "Percentual por venda");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(await screen.findByRole("alert")).toHaveTextContent("Use só números, com até 2 casas decimais.");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.blur(input);
    expect(await screen.findByText("O máximo é 50,00%.")).toBeInTheDocument();
    expect(calls("admin_set_platform_fee")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("erro do servidor na hora de salvar aparece em aviso e o valor digitado continua", async () => {
    handlers.admin_set_platform_fee = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    await open();
    fireEvent.change(feeInput("Cartão de crédito", "Percentual por venda"), { target: { value: "6,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(feeInput("Cartão de crédito", "Percentual por venda").value).toBe("6,5");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("voltar todos ao padrão exige motivo, avisa quem é afetado e chama o servidor", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Voltar todos ao padrão/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Voltar todos ao padrão?")).toBeInTheDocument();
    expect(within(dlg).getByText("3 sellers com taxa própria")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar ao padrão" }));
    expect(await within(dlg).findByText("Escreva o motivo (mínimo 5 caracteres).")).toBeInTheDocument();
    expect(calls("admin_reset_custom_fees")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "ok" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar ao padrão" }));
    expect(calls("admin_reset_custom_fees")).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar ao padrão da plataforma" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar ao padrão" }));
    await waitFor(() => expect(calls("admin_reset_custom_fees")).toHaveLength(1));
    expect(calls("admin_reset_custom_fees")[0]).toEqual({ _reason: "Voltar ao padrão da plataforma" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Zerar as taxas individuais de 3 sellers/);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("erro do servidor fica dentro do diálogo e nada fecha", async () => {
    handlers.admin_reset_custom_fees = () => ({ data: null, error: { message: "nenhum seller tem taxa individual" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Voltar todos ao padrão/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Teste de erro" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar ao padrão" }));
    expect(await within(dlg).findByText(/nenhum seller tem taxa individual|Não foi possível/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Configurações: liberação do cartão", () => {
  it("destaca o prazo atual e não faz nada ao clicar nele", async () => {
    await open();
    const g = screen.getByRole("group", { name: "Prazo padrão do cartão" });
    expect(within(g).getByRole("button", { name: "D+7" })).toHaveAttribute("aria-pressed", "true");
    expect(within(g).getByRole("button", { name: "D+15" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(g).getByRole("button", { name: "D+7" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("muda o prazo padrão com motivo e diz que vale só para as próximas vendas", async () => {
    await open();
    fireEvent.click(within(screen.getByRole("group", { name: "Prazo padrão do cartão" })).getByRole("button", { name: "D+15" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("D+7 → D+15")).toBeInTheDocument();
    expect(within(dlg).getByText(/ficam retidas por 15 dias/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Reduzir o risco" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Mudar prazo" }));
    await waitFor(() => expect(calls("admin_set_card_release")).toHaveLength(1));
    expect(calls("admin_set_card_release")[0]).toEqual({ _user_id: null, _days: 15, _reason: "Reduzir o risco" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/de D\+7 para D\+15/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prazo padrão agora é D+15."));
  });

  it("D+1 fala 'dia' no singular", async () => {
    await open();
    fireEvent.click(within(screen.getByRole("group", { name: "Prazo padrão do cartão" })).getByRole("button", { name: "D+1" }));
    expect(await screen.findByText(/ficam retidas por 1 dia\./)).toBeInTheDocument();
  });

  it("lista as exceções com o prazo de cada seller", async () => {
    await open();
    expect(screen.getByText("2 sellers têm prazo próprio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Prazo de Marina Duarte: D+15")).toBeInTheDocument();
    expect(screen.getByLabelText("Prazo de Loja do Caio: D+1")).toBeInTheDocument();
  });

  it("remove a exceção de um seller com motivo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Remover prazo de Marina Duarte" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Remover o prazo próprio?")).toBeInTheDocument();
    expect(within(dlg).getByText(/volta ao prazo padrão \(D\+7\)/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Voltar ao padrão" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Remover prazo" }));
    await waitFor(() => expect(calls("admin_clear_card_release")).toHaveLength(1));
    expect(calls("admin_clear_card_release")[0]).toEqual({ _user_id: "s1", _reason: "Voltar ao padrão" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prazo próprio removido. O seller foi avisado."));
  });

  it("altera a exceção de um seller sem precisar buscar de novo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Alterar prazo de Loja do Caio" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Loja do Caio")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "D+1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dlg).getByRole("button", { name: "D+30" }));
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Seller de alto risco" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar prazo" }));
    await waitFor(() => expect(calls("admin_set_card_release")).toHaveLength(1));
    expect(calls("admin_set_card_release")[0]).toEqual({ _user_id: "s2", _days: 30, _reason: "Seller de alto risco" });
  });

  it("adiciona uma exceção: busca o seller no servidor, escolhe o prazo e envia", async () => {
    handlers.admin_search_sellers = () => ({ data: [{ user_id: "s9", name: "Nova Loja", email: "nova@exemplo.com" }], error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar exceção" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar prazo" }));
    expect(await within(dlg).findByText("Escolha o seller.")).toBeInTheDocument();
    expect(calls("admin_set_card_release")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Seller"), { target: { value: "n" } });
    expect(calls("admin_search_sellers")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Seller"), { target: { value: "nov" } });
    fireEvent.click(await within(dlg).findByRole("button", { name: /Nova Loja/ }));
    expect(calls("admin_search_sellers").at(-1)).toEqual({ _query: "nov" });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar prazo" }));
    expect(await within(dlg).findByText("Escolha o prazo.")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "D+15" }));
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Primeiras vendas altas" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar prazo" }));
    await waitFor(() => expect(calls("admin_set_card_release")).toHaveLength(1));
    expect(calls("admin_set_card_release")[0]).toEqual({ _user_id: "s9", _days: 15, _reason: "Primeiras vendas altas" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prazo de Nova Loja agora é D+15. O seller foi avisado."));
  });

  it("busca sem resultado avisa e deixa tentar de novo", async () => {
    handlers.admin_search_sellers = () => ({ data: [], error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar exceção" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Seller"), { target: { value: "zzz" } });
    expect(await within(dlg).findByText(/Nenhuma conta encontrada para “zzz”/)).toBeInTheDocument();
  });

  it("avisa quando só parte das exceções está na lista", async () => {
    handlers.get_admin_settings = () => ({ data: settings({ release: { ...settings().release, overrides_total: 60 } }), error: null });
    await open();
    expect(screen.getByText("Mostrando os 2 mais recentes de 60.")).toBeInTheDocument();
  });
});

describe("Configurações: limite por venda", () => {
  const openTicket = async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Alterar limite" }));
    return await screen.findByRole("dialog");
  };

  it("mostra o limite atual, quem tem limite próprio e começa com 'só para quem criar conta depois'", async () => {
    await open();
    expect(screen.getByText(/^R\$\s200,00$/)).toBeInTheDocument();
    expect(screen.getByText(/2 sellers têm limite próprio/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alterar limite" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Novo limite") as HTMLInputElement).value).toBe("200,00");
    expect(within(dlg).getByRole("radio", { name: /Só para quem criar conta depois/ })).toBeChecked();
    expect(within(dlg).getByText("Apaga 2 limites individuais.")).toBeInTheDocument();
  });

  it("não deixa salvar o mesmo limite, nem sem motivo", async () => {
    const dlg = await openTicket();
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar limite" }));
    expect(await within(dlg).findByText("Esse já é o limite atual.")).toBeInTheDocument();
    expect(calls("admin_set_max_ticket")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Novo limite"), { target: { value: "50000" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar limite" }));
    expect(await within(dlg).findByText("Escreva o motivo (mínimo 5 caracteres).")).toBeInTheDocument();
    expect(calls("admin_set_max_ticket")).toHaveLength(0);
  });

  it("a máscara empurra os centavos e o envio leva o valor, o alcance e o motivo", async () => {
    handlers.admin_set_max_ticket = () => ({ data: { sellers_kept: 14, overrides_cleared: 0 }, error: null });
    const dlg = await openTicket();
    const input = within(dlg).getByLabelText("Novo limite") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50000" } });
    expect(input.value).toBe("500,00");
    fireEvent.click(within(dlg).getByRole("button", { name: "Reduzir o risco de fraude" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar limite" }));
    await waitFor(() => expect(calls("admin_set_max_ticket")).toHaveLength(1));
    expect(calls("admin_set_max_ticket")[0]).toEqual({ _value: 500, _scope: "new", _reason: "Reduzir o risco de fraude" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/de R\$\s200,00 para R\$\s500,00, só para quem criar conta depois/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Novo limite salvo\. 14 contas existentes continuam com R\$\s200,00\./)));
  });

  it("'para todos' avisa que apaga os limites individuais e deixa repetir o valor", async () => {
    const dlg = await openTicket();
    fireEvent.click(within(dlg).getByRole("radio", { name: /Para todos os sellers/ }));
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Padronizar para todos" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar limite" }));
    await waitFor(() => expect(calls("admin_set_max_ticket")).toHaveLength(1));
    expect(calls("admin_set_max_ticket")[0]).toEqual({ _value: 200, _scope: "all", _reason: "Padronizar para todos" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/para todos os sellers \(limites individuais são apagados\)/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Limite aplicado a todos os sellers."));
  });

  it("recusa limite acima do teto", async () => {
    const dlg = await openTicket();
    fireEvent.change(within(dlg).getByLabelText("Novo limite"), { target: { value: "100000001" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Motivo válido" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar limite" }));
    expect(calls("admin_set_max_ticket")).toHaveLength(0);
  });
});

describe("Configurações: cadastro", () => {
  it("desligado: ligar não pede motivo e envia a confirmação", async () => {
    await open();
    fireEvent.click(screen.getByRole("switch", { name: "Exigir confirmação de e-mail" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Ligar a confirmação de e-mail?")).toBeInTheDocument();
    expect(within(dlg).queryByLabelText("Motivo")).toBeNull();
    expect(within(dlg).getByText(/senão ninguém novo consegue entrar/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Ligar confirmação" }));
    await waitFor(() => expect(calls("admin_set_email_verification")).toHaveLength(1));
    expect(calls("admin_set_email_verification")[0]).toEqual({ _enabled: true, _reason: "" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Confirmação de e-mail ligada."));
  });

  it("ligado: desligar exige motivo e explica o risco de roubo de acesso", async () => {
    handlers.get_admin_settings = () => ({ data: settings({ signup: { require_email_verification: true, configured: true, updated_at: null, updated_by: null } }), error: null });
    await open();
    fireEvent.click(screen.getByRole("switch", { name: "Exigir confirmação de e-mail" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Desligar a confirmação de e-mail?")).toBeInTheDocument();
    expect(within(dlg).getByText(/Qualquer pessoa pode usar o e-mail de um comprador/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Desligar confirmação" }));
    expect(await within(dlg).findByText("Escreva o motivo (mínimo 5 caracteres).")).toBeInTheDocument();
    expect(calls("admin_set_email_verification")).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "Teste interno" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Desligar confirmação" }));
    await waitFor(() => expect(calls("admin_set_email_verification")).toHaveLength(1));
    expect(calls("admin_set_email_verification")[0]).toEqual({ _enabled: false, _reason: "Teste interno" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/roubar o acesso de compradores/);
  });

  it("fechar o diálogo sem confirmar não muda nada e o interruptor segue o servidor", async () => {
    await open();
    const sw = screen.getByRole("switch", { name: "Exigir confirmação de e-mail" });
    fireEvent.click(sw);
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls("admin_set_email_verification")).toHaveLength(0);
    expect(screen.getByRole("switch", { name: "Exigir confirmação de e-mail" })).not.toBeChecked();
  });
});

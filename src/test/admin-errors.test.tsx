import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const from = vi.fn(() => ({}));
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => (from as (...x: unknown[]) => unknown)(...a), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import ErrorsCenter from "@/features/admin-errors/ErrorsCenter";
import {
  AREAS, DELETE_SCOPES, agoLabel, areaInfo, dayLabel, deviceLabel, firstFrame, kindLabel, parseErrorDetail, parseErrorsPage, reportText, resolveAllText, sizeLabel, timesLabel, userLabel,
} from "@/features/admin-errors/errorsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const err = (over: Record<string, unknown> = {}) => ({
  id: "e1", error_type: "client_error", message: "TypeError: Cannot read properties of undefined (reading 'price')", route: "/pay/metodo-escala-10x", area: "checkout",
  context: "ErrorBoundary: at Checkout", user_id: "s1", user_name: "Marina Duarte", user_email: "marina@exemplo.com", occurrences: 38,
  created_at: ago(70), last_seen_at: ago(0.1), resolved: false, resolved_at: null, ...over,
});
const items = () => [
  err(),
  err({ id: "e2", message: "ReferenceError: lesson is not defined", route: "/membros-area/curso/abc", area: "member", context: "window.onerror", user_id: null, user_name: null, user_email: null, occurrences: 2 }),
  err({ id: "e3", message: "Falha ao carregar módulo", route: "/vendas/produtos", area: "seller", context: "unhandledrejection", user_name: null, user_email: "caio@exemplo.com", occurrences: 1 }),
  err({ id: "e4", message: "Minified React error #310", route: null, area: "unknown", context: null, user_id: null, user_name: null, user_email: null, resolved: true, resolved_at: ago(400), occurrences: 1 }),
];
const summary = (over: Record<string, unknown> = {}) => ({ all: 4, open: 3, resolved: 1, ...over });
const program = (over: Record<string, unknown> = {}) => ({
  open: 3, resolved: 1, total: 4, seen_last_hour: 2, seen_today: 5, occurrences_open: 41, affected_users: 2,
  oldest_open: ago(70), oldest: ago(900), size_bytes: 3_400_000, ...over,
});
const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({
  items: rows, total: rows.length, summary: summary(), areas: { checkout: 1, member: 1, seller: 1 }, program: program(), generated_at: ago(0), ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: "e1", error_type: "client_error", message: "TypeError: Cannot read properties of undefined (reading 'price')",
  stack_trace: "TypeError: Cannot read properties of undefined (reading 'price')\n    at Summary (https://exemplo.com/assets/Checkout-3c1d.js:12:3041)\n    at renderWithHooks (https://exemplo.com/assets/vendor.js:8:1200)",
  metadata: { context: "ErrorBoundary: at Checkout", route: "/pay/metodo-escala-10x", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1" },
  route: "/pay/metodo-escala-10x", area: "checkout", occurrences: 38, created_at: ago(70), last_seen_at: ago(0.1), resolved: false, resolved_at: null, resolved_by: null,
  user: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved" }, ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const writeText = vi.fn();

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear(); writeText.mockReset(); writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_error_logs_page = () => ({ data: page(items()), error: null });
  handlers.get_admin_error_log_detail = () => ({ data: detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("errorsModel", () => {
  it("lê a lista e rejeita formato inesperado", () => {
    const p = parseErrorsPage(page([err({ occurrences: "0", resolved: "sim", user_name: "", message: 5 })], { areas: { checkout: "3", x: "abc" } }));
    expect(p.items[0]).toMatchObject({ occurrences: 1, resolved: false, user_name: null, message: "" });
    expect(p.areas).toEqual({ checkout: 3, x: 0 });
    expect(p.summary).toEqual({ all: 4, open: 3, resolved: 1 });
    expect(p.program).toMatchObject({ open: 3, affected_users: 2, size_bytes: 3_400_000 });
    expect(() => parseErrorsPage(null)).toThrow();
    expect(() => parseErrorsPage({ items: "x" })).toThrow();
  });

  it("lê o raio-X, com e sem conta", () => {
    const d = parseErrorDetail(detail({ metadata: "lixo", resolved_by: "Admin", resolved: true }));
    expect(d.metadata).toEqual({});
    expect(d).toMatchObject({ resolved: true, resolved_by: "Admin", occurrences: 38, area: "checkout" });
    expect(d.user).toMatchObject({ name: "Marina Duarte", account_status: "approved" });
    expect(parseErrorDetail(detail({ user: null })).user).toBeNull();
    expect(parseErrorDetail(detail({ user: { user_id: "u", name: "" } })).user?.name).toBe("Conta sem nome");
    expect(() => parseErrorDetail({})).toThrow();
  });

  it("a área vem em palavras de quem opera; área desconhecida cai em 'Sem página'", () => {
    expect(AREAS.map((a) => a.value)).toEqual(["checkout", "member", "seller", "auth", "staff", "site", "unknown"]);
    expect(areaInfo("member").label).toBe("Área do aluno");
    expect(areaInfo("staff").long).toBe("Painel do admin, gerentes e sócio");
    expect(areaInfo("qualquer").label).toBe("Sem página");
  });

  it("origem do erro, quem viu e quantas vezes", () => {
    expect(kindLabel("ErrorBoundary: at X")).toBe("A tela quebrou");
    expect(kindLabel("window.onerror")).toBe("Erro no código da página");
    expect(kindLabel("unhandledrejection")).toBe("Falha sem tratamento");
    expect(kindLabel(null)).toBe("Erro no navegador");
    expect(kindLabel(null, "rate_limit")).toBe("rate limit");
    expect(userLabel({ user_id: "u", user_name: "Ana", user_email: "a@x.com" })).toBe("Ana");
    expect(userLabel({ user_id: "u", user_name: null, user_email: "a@x.com" })).toBe("a@x.com");
    expect(userLabel({ user_id: "u", user_name: null, user_email: null })).toBe("Conta sem nome");
    expect(userLabel({ user_id: null, user_name: null, user_email: null })).toBe("Visitante sem login");
    expect(timesLabel(1)).toBe("1 vez");
    expect(timesLabel(1200)).toBe("1.200 vezes");
  });

  it("tempo, tamanho e navegador", () => {
    const now = Date.parse("2026-11-25T15:00:00Z");
    const at = (min: number) => new Date(now - min * 60000).toISOString();
    expect(agoLabel(at(0.2), now)).toBe("agora há pouco");
    expect(agoLabel(at(5), now)).toBe("há 5 min");
    expect(agoLabel(at(180), now)).toBe("há 3 h");
    expect(agoLabel(at(60 * 30), now)).toBe("ontem");
    expect(agoLabel(at(60 * 24 * 3), now)).toBe("há 3 dias");
    expect(agoLabel(at(60 * 24 * 20), now)).toBe("05/11");
    expect(agoLabel(null, now)).toBe("—");
    expect(agoLabel("lixo", now)).toBe("—");
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(sizeLabel(0)).toBe("—");
    expect(sizeLabel(300)).toBe("1 KB");
    expect(sizeLabel(51_200)).toBe("50 KB");
    expect(sizeLabel(3_400_000)).toBe("3,2 MB");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36")).toBe("Chrome no Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit Version/17.5 Mobile Safari/604.1")).toBe("Safari no iOS");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537 Edg/130")).toBe("Edge no Windows");
    expect(deviceLabel("Mozilla/5.0 (Android 14) Chrome/130 Mobile Safari/537")).toBe("Chrome no Android");
    expect(deviceLabel("curl/8")).toBe("Não identificado");
    expect(deviceLabel(null)).toBe("Não informado");
  });

  it("primeira linha útil da pilha e relatório para copiar", () => {
    expect(firstFrame("TypeError: x\n    at Summary (https://e.com/a.js:1:2)\n    at b")).toBe("at Summary (https://e.com/a.js:1:2)");
    expect(firstFrame("erro@https://e.com/a.js:1:2")).toBe("erro@https://e.com/a.js:1:2");
    expect(firstFrame("só texto")).toBeNull();
    expect(firstFrame(null)).toBeNull();
    const r = reportText(parseErrorDetail(detail()));
    expect(r).toContain("TypeError: Cannot read properties");
    expect(r).toContain("Página: /pay/metodo-escala-10x (Checkout)");
    expect(r).toContain("Origem: A tela quebrou");
    expect(r).toContain("Vezes: 38");
    expect(r).toContain("Navegador: Safari no iOS");
    expect(r).toContain("at Summary");
    expect(reportText(parseErrorDetail(detail({ route: null, stack_trace: null, area: "unknown" })))).toContain("Página: não registrada");
  });

  it("textos da limpeza e do 'resolver todos'", () => {
    expect(resolveAllText("all", 1)).toBe("Marcar 1 erro aberto como resolvidos?");
    expect(resolveAllText("all", 12)).toBe("Marcar 12 erros abertos como resolvidos?");
    expect(resolveAllText("checkout", 12)).toBe('Marcar os erros abertos de "Checkout" como resolvidos?');
    expect(DELETE_SCOPES.map((s) => s.value)).toEqual(["resolved_old", "resolved"]);
  });
});

/* ───────── tela ───────── */

describe("ErrorsCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<ErrorsCenter isAdmin={false} />);
    expect(screen.getByText("Os erros do site são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lê pela RPC (nunca a tabela) e mostra totais, filtros com contagem e a lista", async () => {
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    expect(calls("get_admin_error_logs_page")[0]).toEqual({ _status: "open", _area: null, _search: null, _page: 1, _page_size: 25 });
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("3 erros abertos")).toBeInTheDocument();
    expect(screen.getByText("41 ocorrências")).toBeInTheDocument();
    expect(screen.getByText("hoje: 5")).toBeInTheDocument();
    expect(screen.getByText("no mínimo")).toBeInTheDocument();
    expect(screen.getByText("Abertos · 3")).toBeInTheDocument();
    expect(screen.getByText("Resolvidos · 1")).toBeInTheDocument();
    expect(screen.getByText("Todos · 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checkout · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Área do aluno · 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Login e cadastro/ })).toBeNull(); // sem erro nessa parte, sem chip
    expect(screen.getByText(/Só chegam aqui erros que o navegador captura/)).toBeInTheDocument();
    expect(screen.getByText(/Este registro ocupa 3,2 MB/)).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Checkout")).toBeInTheDocument();
    expect(within(rows[0]).getByText("/pay/metodo-escala-10x")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Marina Duarte")).toBeInTheDocument();
    expect(within(rows[0]).getByText("38 vezes")).toBeInTheDocument();
    expect(within(rows[0]).getByText("A tela quebrou")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Visitante sem login")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Erro no código da página")).toBeInTheDocument();
    expect(within(rows[2]).getByText("caio@exemplo.com")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Página não registrada")).toBeInTheDocument();
    expect(within(rows[3]).getByRole("button", { name: "Reabrir este erro" })).toBeInTheDocument();
  });

  it("sem erro aberto o topo diz que está limpo e a lista oferece ver os resolvidos", async () => {
    handlers.get_admin_error_logs_page = (a) => (a._status === "open"
      ? { data: page([], { summary: summary({ open: 0, resolved: 4, all: 4 }), areas: {}, program: program({ open: 0, resolved: 4, occurrences_open: 0, affected_users: 0, oldest_open: null }) }), error: null }
      : { data: page(items()), error: null });
    wrap(<ErrorsCenter />);
    expect((await screen.findAllByText("Nenhum erro aberto")).length).toBe(2); // o selo do topo e o título do estado vazio
    expect(screen.getByText("Tudo o que o site registrou já foi resolvido. Se um erro voltar a acontecer, ele aparece aqui de novo.")).toBeInTheDocument();
    expect(screen.getByText("nada aberto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resolver abertos/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ver resolvidos" }));
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _status: "resolved", _page: 1 }));
  });

  it("sem nenhum erro registrado tem texto próprio e 'Apagar resolvidos' fica desligado", async () => {
    handlers.get_admin_error_logs_page = () => ({ data: page([], { summary: summary({ all: 0, open: 0, resolved: 0 }), areas: {}, program: program({ open: 0, resolved: 0, total: 0, oldest: null, oldest_open: null, size_bytes: 16384 }) }), error: null });
    wrap(<ErrorsCenter />);
    expect(await screen.findByText("Nenhum erro registrado ainda")).toBeInTheDocument();
    expect(screen.getByText("Nenhum erro registrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apagar resolvidos/ })).toBeDisabled();
  });

  it("status, parte do site e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: /^Resolvidos/ }));
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _status: "resolved", _area: null, _page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Checkout · 1" }));
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _status: "resolved", _area: "checkout" }));
    expect(screen.getByRole("button", { name: "Checkout · 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Buscar erros"), { target: { value: "  price " } });
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _status: "resolved", _area: "checkout", _search: "price" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar erros") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _status: "open", _area: null, _search: null }));
    fireEvent.click(screen.getByRole("button", { name: "Todas as partes" }));
    expect(screen.getByRole("button", { name: "Todas as partes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtro sem resultado diz 'Nada por aqui' e oferece limpar", async () => {
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    handlers.get_admin_error_logs_page = () => ({ data: page([], { summary: summary({ all: 0, open: 0, resolved: 0 }), areas: {} }), error: null });
    fireEvent.change(screen.getByLabelText("Buscar erros"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.getByText("Nenhum erro bate com esses filtros.")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso, deixa os números indisponíveis e tenta de novo", async () => {
    handlers.get_admin_error_logs_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<ErrorsCenter />);
    expect(await screen.findByText("Não foi possível carregar os erros.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    handlers.get_admin_error_logs_page = () => ({ data: page(items()), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText(/TypeError: Cannot read properties/)).length).toBeGreaterThan(0);
  });

  it("resolver e reabrir direto da linha chamam a RPC e avisam", async () => {
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "Marcar este erro como resolvido" }));
    await waitFor(() => expect(calls("admin_set_error_resolved")).toHaveLength(1));
    expect(calls("admin_set_error_resolved")[0]).toEqual({ _id: "e1", _resolved: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Erro marcado como resolvido."));
    await waitFor(() => expect(calls("get_admin_error_logs_page").length).toBeGreaterThan(1));
    fireEvent.click(within(tableRows()[3]).getByRole("button", { name: "Reabrir este erro" }));
    await waitFor(() => expect(calls("admin_set_error_resolved")).toHaveLength(2));
    expect(calls("admin_set_error_resolved")[1]).toEqual({ _id: "e4", _resolved: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Erro reaberto."));
    expect(confirmSpy).not.toHaveBeenCalled(); // não pede senha: só marca que alguém olhou
  });

  it("erro do servidor ao resolver vira aviso e nada é dado como feito", async () => {
    handlers.admin_set_error_resolved = () => ({ data: null, error: { message: "o erro já está resolvido" } });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: "Marcar este erro como resolvido" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("o erro já está resolvido"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("detalhe: mostra pilha, onde, navegador e quem viu, e copia o relatório", async () => {
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: /Ver detalhes do erro/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Este erro já aconteceu 38 vezes/)).toBeInTheDocument();
    expect(calls("get_admin_error_log_detail")[0]).toEqual({ _id: "e1" });
    expect(within(dlg).getByText("Estourou em: at Summary (https://exemplo.com/assets/Checkout-3c1d.js:12:3041)")).toBeInTheDocument();
    expect(within(dlg).getByLabelText("Pilha do erro").textContent).toContain("at renderWithHooks");
    expect(within(dlg).getByText("Checkout e links de pagamento")).toBeInTheDocument();
    expect(within(dlg).getByText("Safari no iOS")).toBeInTheDocument();
    expect(within(dlg).getByText("Marina Duarte")).toBeInTheDocument();
    expect(within(dlg).getByText("Aprovada")).toBeInTheDocument();
    expect(within(dlg).getByText("As outras 37 vezes podem ter sido com outras pessoas.")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: /Copiar relatório/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("Página: /pay/metodo-escala-10x (Checkout)");
    expect(writeText.mock.calls[0][0]).toContain("at Summary");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Relatório copiado."));
  });

  it("copiar sem permissão do navegador avisa o que fazer", async () => {
    writeText.mockRejectedValue(new Error("negado"));
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: /Ver detalhes do erro/ }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText(/Este erro já aconteceu/);
    fireEvent.click(within(dlg).getByRole("button", { name: /Copiar relatório/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível copiar. Selecione o texto e copie à mão."));
  });

  it("detalhe de visitante sem pilha: diz isso de frente; resolvido mostra quem resolveu e oferece reabrir", async () => {
    handlers.get_admin_error_log_detail = () => ({ data: detail({ id: "e4", user: null, stack_trace: null, route: null, area: "unknown", occurrences: 1, resolved: true, resolved_at: ago(400), resolved_by: "Admin", metadata: { url: "https://exemplo.com/vendas" } }), error: null });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[3]).getByRole("button", { name: /Ver detalhes do erro/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Resolvido por Admin em/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Se o mesmo erro voltar, ele reabre sozinho/)).toBeInTheDocument();
    expect(within(dlg).getByText("O navegador não enviou a pilha deste erro.")).toBeInTheDocument();
    expect(within(dlg).getByText(/Visitante sem login: o erro aconteceu numa página aberta sem conta/)).toBeInTheDocument();
    expect(within(dlg).getByText("Não registrada")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(calls("admin_set_error_resolved")[0]).toEqual({ _id: "e4", _resolved: false }));
  });

  it("falha ao carregar o detalhe mostra o motivo e tenta de novo", async () => {
    handlers.get_admin_error_log_detail = () => ({ data: null, error: { message: "registro não encontrado" } });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(within(tableRows()[0]).getByRole("button", { name: /Ver detalhes do erro/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("registro não encontrado");
    expect(within(dlg).getByRole("button", { name: /Copiar relatório/ })).toBeDisabled();
    handlers.get_admin_error_log_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText(/Este erro já aconteceu 38 vezes/)).toBeInTheDocument();
  });

  it("resolver todos: explica o alcance, só chama a RPC depois de confirmar e avisa quantos", async () => {
    handlers.admin_resolve_all_errors = () => ({ data: { resolved: 3 }, error: null });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: /Resolver abertos/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText("Marcar 3 erros abertos como resolvidos?")).toBeInTheDocument();
    expect(within(dlg).getByText(/não corrige a causa de nenhum/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(calls("admin_resolve_all_errors")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Resolver abertos/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Marcar como resolvidos" }));
    await waitFor(() => expect(calls("admin_resolve_all_errors")).toHaveLength(1));
    expect(calls("admin_resolve_all_errors")[0]).toEqual({ _area: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("3 erros marcados como resolvidos."));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("resolver todos com uma parte do site escolhida só atinge essa parte", async () => {
    handlers.admin_resolve_all_errors = () => ({ data: { resolved: 1 }, error: null });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: "Checkout · 1" }));
    await waitFor(() => expect(calls("get_admin_error_logs_page").at(-1)).toMatchObject({ _area: "checkout" }));
    fireEvent.click(screen.getByRole("button", { name: /Resolver abertos/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText('Marcar os erros abertos de "Checkout" como resolvidos?')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Marcar como resolvidos" }));
    await waitFor(() => expect(calls("admin_resolve_all_errors")[0]).toEqual({ _area: "checkout" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 erro marcado como resolvido."));
  });

  it("falha ao resolver todos vira aviso", async () => {
    handlers.admin_resolve_all_errors = () => ({ data: null, error: { message: "nenhum erro aberto" } });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: /Resolver abertos/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Marcar como resolvidos" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nenhum erro aberto"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("apagar resolvidos: exige motivo, pede senha, manda o escopo escolhido e avisa quantos", async () => {
    handlers.admin_delete_error_logs = () => ({ data: { deleted: 1512 }, error: null });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: /Apagar resolvidos/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Apagar erros resolvidos?")).toBeInTheDocument();
    expect(within(dlg).getByText("1 erro resolvido hoje")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Resolvidos há mais de 30 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dlg).getByText(/Apaga só os erros já resolvidos e sem ocorrência nova nos últimos 30 dias/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_delete_error_logs")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Todos os resolvidos" }));
    expect(within(dlg).getByText(/Os abertos não são tocados/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Limpeza de registros antigos" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(calls("admin_delete_error_logs")).toHaveLength(1));
    expect(calls("admin_delete_error_logs")[0]).toEqual({ _scope: "resolved", _reason: "Limpeza de registros antigos" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Apagar erros: todos os resolvidos\. Não dá para desfazer\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1.512 registros apagados."));
    await waitFor(() => expect(calls("get_admin_error_logs_page").length).toBeGreaterThan(1));
  });

  it("apagar: erro do servidor fica dentro do diálogo e nada é dado como feito", async () => {
    handlers.admin_delete_error_logs = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    wrap(<ErrorsCenter />);
    await screen.findAllByText(/TypeError: Cannot read properties/);
    fireEvent.click(screen.getByRole("button", { name: /Apagar resolvidos/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Registros de teste" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    expect(await within(dlg).findByText(/reautenticação necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

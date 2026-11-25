import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() }, storage: { from: () => ({}) } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
const askReason = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import ToolsCenter from "@/features/admin-tools/ToolsCenter";
import { usePlatformPauses, parsePauses } from "@/hooks/usePlatformPauses";
import {
  COLUMNS, csvCell, fileName, heroStatus, historyEntry, parseNotes, parsePage, parseTools, periodProblem, periodText, sinceLine, spDateTime, toCsv,
} from "@/features/admin-tools/toolsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const sw = (o: Record<string, unknown> = {}) => ({ paused: false, at: null, by: null, reason: null, ...o });
const baseTools = () => ({
  switches: { payments: sw({ at: ago(30), by: "Matheus", reason: "Problema resolvido, tudo normalizado" }), withdrawals: sw() },
  program: { notes: 7, exports_30d: 3, sellers: 6 },
  history: [
    { at: ago(1), action: "data_export", by: "Matheus", details: { kind: "transactions", total: 1284, from: ago(24 * 20), to: ago(1) } },
    { at: ago(2), action: "kill_switch_payments_off", by: "Matheus", details: { reason: "Problema resolvido, tudo normalizado" } },
    { at: ago(5), action: "seller_note_create", by: "Matheus", details: { seller_name: "Marina Duarte", length: 142 } },
  ],
  generated_at: ago(0),
});
let toolsState = baseTools();

const note = (o: Record<string, unknown> = {}) => ({
  id: "n1", seller_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", author_name: "Matheus", author_role: "admin",
  content: "Pediu para adiar a análise de documentos.", created_at: ago(5), ...o,
});
const NOTES = [note(), note({ id: "n2", seller_id: "s2", seller_name: "Loja do Caio", author_name: "Bia", author_role: "staff", content: "Ligou sobre o saque." })];

const RANGE = { from: new Date("2026-11-01T03:00:00.000Z"), to: new Date("2026-11-26T02:59:59.999Z") };

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); askReason.mockReset(); confirmSpy.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.info).mockClear();
  toolsState = baseTools();
  handlers.get_admin_tools = () => ({ data: toolsState, error: null });
  handlers.get_admin_seller_notes = (a) => {
    const items = a._seller_id ? NOTES.filter((n) => n.seller_id === a._seller_id) : NOTES;
    return { data: { total: items.length, items }, error: null };
  };
  handlers.admin_search_sellers = () => ({ data: [{ user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com" }], error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: {}, error: null }));
});

afterEach(() => { vi.restoreAllMocks(); });

const open = async (props: Partial<React.ComponentProps<typeof ToolsCenter>> = {}) => {
  wrap(<ToolsCenter dateRange={RANGE} {...props} />);
  await screen.findByRole("group", { name: "Pagamentos" });
};
const card = (name: string) => screen.getByRole("group", { name });

/* ───────── modelo ───────── */

describe("modelo das ferramentas do admin", () => {
  it("lê as respostas do servidor com tolerância e recusa o que não vem dele", () => {
    const t = parseTools({ switches: { payments: { paused: true, at: "2026-11-25T10:00:00Z", by: "Ana", reason: " " }, withdrawals: "lixo" }, program: { notes: "4", exports_30d: 2 }, history: [{ at: "x", action: "data_export" }, "lixo"] });
    expect(t.switches.payments).toEqual({ paused: true, at: "2026-11-25T10:00:00Z", by: "Ana", reason: null });
    expect(t.switches.withdrawals.paused).toBe(false);
    expect(t.program).toEqual({ notes: 4, exports30d: 2, sellers: 0 });
    expect(t.history).toHaveLength(1);
    expect(() => parseTools(null)).toThrow("Resposta inesperada");
    expect(() => parseNotes({})).toThrow("Resposta inesperada");
    expect(() => parsePage({})).toThrow("Resposta inesperada");
    expect(parseNotes({ total: 0, items: [{ id: "a", seller_name: "" }] }).items[0].seller_name).toBe("Seller sem nome");
    expect(parsePage({ rows: [{ id: 1 }], next: { at: "2026-01-01T00:00:00Z" } }).next).toBeNull();
    expect(parsePauses({ payments: "true", withdrawals: true })).toEqual({ payments: false, withdrawals: true });
    expect(parsePauses(null)).toEqual({ payments: false, withdrawals: false });
  });

  it("o selo do topo mostra o que está pausado, e nunca 'tudo liberado' sem dado", () => {
    const t = (p: boolean, w: boolean) => parseTools({ switches: { payments: sw({ paused: p }), withdrawals: sw({ paused: w }) }, history: [] });
    expect(heroStatus(undefined, false)).toEqual({ tone: "neutral", label: "Carregando…" });
    expect(heroStatus(undefined, true)).toEqual({ tone: "destructive", label: "Não foi possível carregar" });
    expect(heroStatus(t(false, false), false)).toEqual({ tone: "success", label: "Tudo liberado", pulse: true });
    expect(heroStatus(t(true, false), false)).toEqual({ tone: "destructive", label: "Pagamentos pausados" });
    expect(heroStatus(t(false, true), false)).toEqual({ tone: "destructive", label: "Saques pausados" });
    expect(heroStatus(t(true, true), false)).toEqual({ tone: "destructive", label: "Pagamentos e saques pausados" });
  });

  it("diz desde quando e por quem, só quando há registro", () => {
    expect(sinceLine({ paused: true, at: null, by: null, reason: null })).toBeNull();
    expect(sinceLine({ paused: true, at: "2026-11-25T15:00:00Z", by: "Ana", reason: null })).toMatch(/^Pausado em .*, por Ana\.$/);
    expect(sinceLine({ paused: false, at: "2026-11-25T15:00:00Z", by: null, reason: null })).toMatch(/^Liberado em [^,]*\.$/);
  });

  it("o CSV neutraliza fórmulas, protege separador e aspas e usa vírgula decimal", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+5511999990000")).toBe("'+5511999990000");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@usuario")).toBe("'@usuario");
    expect(csvCell("\tfoo")).toBe("'\tfoo");
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("João; Silva")).toBe("\"João; Silva\"");
    expect(csvCell("linha 1\nlinha 2")).toBe("\"linha 1\nlinha 2\"");
    expect(csvCell("diz \"oi\"")).toBe("\"diz \"\"oi\"\"\"");
    expect(csvCell(1234.5)).toBe("1234,5");
    expect(csvCell(-12.5)).toBe("-12,5");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("Sim");
    expect(csvCell("Texto comum")).toBe("Texto comum");
  });

  it("monta cada arquivo na ordem de colunas definida aqui, com status e meio em português", () => {
    const tx = { id: "t1", created_at: "2026-11-25T15:30:05.000Z", status: "paid", amount: 97.9, net_amount: 90.5, seller_name: "Marina", seller_email: "m@x.com", product: "Curso", customer_name: "=CMD()", customer_email: "c@x.com", payment_method: "pix", simulated: false };
    const lines = toCsv("transactions", [tx, { ...tx, id: "t2", status: "estranho", payment_method: "", simulated: true }]).split("\r\n");
    expect(lines[0]).toBe(COLUMNS.transactions.map((c) => c.header).join(";"));
    expect(lines[0]).toBe("Data;Status;Valor;Líquido;Seller;E-mail do seller;Produto;Cliente;E-mail do cliente;Pagamento;Simulada;ID");
    expect(lines[1]).toBe("25/11/2026 12:30:05;Pago;97,9;90,5;Marina;m@x.com;Curso;'=CMD();c@x.com;PIX;Não;t1");
    expect(lines[2]).toContain(";estranho;");
    expect(lines[2]).toContain(";Sim;t2");
    const w = toCsv("withdrawals", [{ id: "w1", created_at: "2026-11-25T15:30:05.000Z", seller_name: "Marina", seller_email: "m@x.com", amount: 100, fee_amount: 3.67, net_amount: 96.33, status: "pending", type: "pix" }]).split("\r\n");
    expect(w[0]).toBe("Data;Seller;E-mail do seller;Valor;Taxa;Líquido;Status;Tipo;ID");
    expect(w[1]).toBe("25/11/2026 12:30:05;Marina;m@x.com;100;3,67;96,33;Pendente;PIX;w1");
    const s = toCsv("sellers", [{ id: "u1", name: "Caio", email: "c@x.com", phone: null, status: "approved", created_at: "2026-01-02T03:00:00.000Z" }]).split("\r\n");
    expect(s[0]).toBe("Nome;E-mail;Telefone;Situação da conta;Cadastro;ID");
    expect(s[1]).toBe("Caio;c@x.com;;Ativa;02/01/2026 00:00:00;u1");
  });

  it("data e período seguem o fuso de Brasília e o nome do arquivo diz o recorte", () => {
    expect(spDateTime("2026-11-25T02:30:00.000Z")).toBe("24/11/2026 23:30:00");
    expect(spDateTime("lixo")).toBe("");
    expect(spDateTime(null)).toBe("");
    expect(periodText(RANGE)).toBe("01/11/2026 a 25/11/2026");
    expect(periodText({ from: RANGE.from, to: new Date("2026-11-02T02:59:59.999Z") })).toBe("01/11/2026");
    expect(fileName("transactions", RANGE.from, RANGE.to)).toBe("transacoes-2026-11-01_a_2026-11-25.csv");
    expect(fileName("withdrawals", RANGE.from, new Date("2026-11-02T02:59:59.999Z"))).toBe("saques-2026-11-01.csv");
    expect(fileName("sellers", RANGE.from, RANGE.to, new Date("2026-11-25T15:00:00Z"))).toBe("sellers-2026-11-25.csv");
  });

  it("recusa período inválido ou maior que o limite do servidor", () => {
    expect(periodProblem(RANGE)).toBeNull();
    expect(periodProblem({ from: RANGE.to, to: RANGE.from })).toMatch(/inválido/);
    expect(periodProblem({ from: new Date("2025-01-01T03:00:00Z"), to: RANGE.to })).toMatch(/no máximo 400 dias/);
  });

  it("conta o histórico em português, inclusive os registros antigos", () => {
    expect(historyEntry({ at: "", action: "kill_switch_payments_on", by: null, details: { reason: "Instabilidade" } })).toEqual({ title: "Pagamentos pausados", text: "Motivo: Instabilidade" });
    expect(historyEntry({ at: "", action: "kill_switch_withdrawals_off", by: null, details: { payments: false, withdrawals: false } })).toEqual({ title: "Saques liberados", text: null });
    expect(historyEntry({ at: "", action: "seller_note_create", by: null, details: { seller_name: "Marina", length: 1 } })).toEqual({ title: "Nota criada", text: "Seller: Marina. 1 caractere." });
    expect(historyEntry({ at: "", action: "seller_note_created", by: null, details: {} })).toEqual({ title: "Nota criada", text: null });
    const exp = historyEntry({ at: "", action: "data_export", by: null, details: { kind: "withdrawals", total: 1, from: "2026-11-01T03:00:00Z", to: "2026-11-26T03:00:00Z" } });
    expect(exp.title).toBe("Exportação de saques");
    expect(exp.text).toBe("1 linha. Período: 01/11/2026 a 25/11/2026.");
    expect(historyEntry({ at: "", action: "data_export", by: null, details: { kind: "sellers", total: 6 } })).toEqual({ title: "Exportação de sellers", text: "6 linhas." });
    expect(historyEntry({ at: "", action: "outra", by: null, details: {} }).title).toBe("Alteração nas ferramentas");
  });
});

/* ───────── tela ───────── */

describe("tela de Ferramentas", () => {
  it("não chama nada para quem não é administrador", () => {
    wrap(<ToolsCenter isAdmin={false} dateRange={RANGE} />);
    expect(screen.getByText("As ferramentas são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra o estado das pausas, quem mexeu por último, as contagens e o histórico", async () => {
    await open();
    expect(screen.getByText("Tudo liberado")).toBeInTheDocument();
    const pay = within(card("Pagamentos"));
    expect(pay.getByText("Liberados")).toBeInTheDocument();
    expect(pay.getByText(/Liberado em .*, por Matheus\./)).toBeInTheDocument();
    expect(pay.getByText("Motivo: Problema resolvido, tudo normalizado")).toBeInTheDocument();
    expect(pay.getByRole("button", { name: "Pausar pagamentos" })).toBeInTheDocument();
    const wd = within(card("Saques"));
    expect(wd.getByText("Nunca foi pausado por aqui.")).toBeInTheDocument();
    expect(wd.getByText(/os sellers não conseguem pedir novos saques/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("nos últimos 30 dias")).toBeInTheDocument();
    const history = within(screen.getByRole("list", { name: "Histórico das ferramentas" }));
    expect(history.getByText("Exportação de transações")).toBeInTheDocument();
    expect(history.getByText("Pagamentos liberados")).toBeInTheDocument();
    expect(history.getByText("Nota criada")).toBeInTheDocument();
  });

  it("falha ao carregar mostra erro com nova tentativa, nunca 'tudo liberado'", async () => {
    handlers.get_admin_tools = () => ({ data: null, error: { message: "Sem conexão com o banco" } });
    wrap(<ToolsCenter dateRange={RANGE} />);
    expect(await screen.findByText("Não foi possível carregar as ferramentas.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.queryByText("Tudo liberado")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pagamentos" })).not.toBeInTheDocument();
  });

  it("pausar pede o motivo, depois a senha, e só então chama o servidor com os argumentos certos", async () => {
    handlers.admin_set_kill_switch = (a) => {
      toolsState = { ...toolsState, switches: { ...toolsState.switches, payments: sw({ paused: true, at: ago(0), by: "Matheus", reason: a._reason }) } };
      return { data: { changed: true, paused: true }, error: null };
    };
    askReason.mockResolvedValue("Instabilidade na adquirente");
    await open();
    fireEvent.click(within(card("Pagamentos")).getByRole("button", { name: "Pausar pagamentos" }));
    await waitFor(() => expect(calls("admin_set_kill_switch")).toHaveLength(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ minLength: 5, tone: "danger", label: "Motivo", confirmLabel: "Pausar pagamentos" });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(calls("admin_set_kill_switch")[0]).toEqual({ _key: "payments", _paused: true, _reason: "Instabilidade na adquirente" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pagamentos pausados."));
    expect(await screen.findByText("Pagamentos pausados")).toBeInTheDocument();
    const pay = within(card("Pagamentos"));
    expect(pay.getByText("Pausados")).toBeInTheDocument();
    expect(pay.getByText("Motivo: Instabilidade na adquirente")).toBeInTheDocument();
    expect(pay.getByRole("button", { name: "Liberar pagamentos" })).toBeInTheDocument();
  });

  it("cancelar o motivo não pede senha nem chama o servidor", async () => {
    askReason.mockResolvedValue(null);
    await open();
    fireEvent.click(within(card("Saques")).getByRole("button", { name: "Pausar saques" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_set_kill_switch")).toHaveLength(0);
  });

  it("liberar uma pausa manda paused=false com o motivo", async () => {
    toolsState = { ...baseTools(), switches: { payments: sw(), withdrawals: sw({ paused: true, at: ago(3), by: "Ana", reason: "Fila de saques sob revisão" }) } };
    askReason.mockResolvedValue("Revisão concluída");
    await open();
    const wd = within(card("Saques"));
    expect(wd.getByText("Pausados")).toBeInTheDocument();
    expect(wd.getByText("Motivo: Fila de saques sob revisão")).toBeInTheDocument();
    fireEvent.click(wd.getByRole("button", { name: "Liberar saques" }));
    await waitFor(() => expect(calls("admin_set_kill_switch")).toHaveLength(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ tone: "default", confirmLabel: "Liberar saques" });
    expect(calls("admin_set_kill_switch")[0]).toEqual({ _key: "withdrawals", _paused: false, _reason: "Revisão concluída" });
  });

  it("erro do servidor aparece no cartão e não anuncia sucesso", async () => {
    handlers.admin_set_kill_switch = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    askReason.mockResolvedValue("Teste de falha");
    await open();
    fireEvent.click(within(card("Pagamentos")).getByRole("button", { name: "Pausar pagamentos" }));
    const alert = await within(card("Pagamentos")).findByRole("alert");
    expect(alert).toHaveTextContent("reautenticação necessária");
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(card("Pagamentos")).getByText("Liberados")).toBeInTheDocument();
  });
});

/* ───────── exportação ───────── */

async function readBlob(b: Blob): Promise<{ text: string; bytes: number[] }> {
  const read = (m: "text" | "buffer") => new Promise<string | ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string | ArrayBuffer); if (m === "text") r.readAsText(b); else r.readAsArrayBuffer(b); });
  const buf = (await read("buffer")) as ArrayBuffer;
  return { text: (await read("text")) as string, bytes: Array.from(new Uint8Array(buf).slice(0, 3)) };
}

function captureDownloads() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { blobs.push(b as Blob); return "blob:teste"; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
  return { blobs, names };
}

const tx = (o: Record<string, unknown> = {}) => ({ id: "t0", created_at: "2026-11-10T12:00:00Z", status: "paid", amount: 50, net_amount: 46, seller_name: "Marina", seller_email: "m@x.com", product: "Curso", customer_name: "Ana", customer_email: "a@x.com", payment_method: "pix", simulated: false, ...o });

describe("exportação de dados", () => {
  const exportBtn = (name: string) => screen.getByRole("button", { name });

  it("junta as páginas pelo cursor do servidor, pede o período do topo e baixa um CSV seguro", async () => {
    const dl = captureDownloads();
    handlers.admin_export_page = (a) => (a._after_at
      ? { data: { rows: [tx({ id: "t2", customer_name: "João; Silva" })], count: 1, total: 3, next: null }, error: null }
      : { data: { rows: [tx({ id: "t1", customer_name: "=HYPERLINK(\"http://x\")" }), tx()], count: 2, total: 3, next: { at: "2026-11-10T12:00:00Z", id: "t0" } }, error: null });
    await open();
    fireEvent.click(exportBtn("Baixar CSV de transações"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("3 linhas exportadas."));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain("auditoria");
    const c = calls("admin_export_page");
    expect(c).toHaveLength(2);
    expect(c[0]).toEqual({ _kind: "transactions", _from: RANGE.from.toISOString(), _to: "2026-11-26T03:00:00.000Z", _after_at: null, _after_id: null, _limit: 1000 });
    expect(c[1]).toMatchObject({ _kind: "transactions", _after_at: "2026-11-10T12:00:00Z", _after_id: "t0" });
    expect(dl.names).toEqual(["transacoes-2026-11-01_a_2026-11-25.csv"]);
    const { text, bytes } = await readBlob(dl.blobs[0]);
    expect(bytes).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0].startsWith("Data;Status;Valor;")).toBe(true);
    expect(lines[1]).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(lines[3]).toContain("\"João; Silva\"");
    expect(dl.blobs[0].type).toContain("text/csv");
    // a tela volta ao normal e o histórico é recarregado (a exportação acabou de ser auditada)
    await waitFor(() => expect(exportBtn("Baixar CSV de transações")).not.toBeDisabled());
    expect(calls("get_admin_tools").length).toBeGreaterThanOrEqual(2);
  });

  it("sellers não dependem do período e saem sem datas", async () => {
    const dl = captureDownloads();
    handlers.admin_export_page = () => ({ data: { rows: [{ id: "u1", name: "Caio", email: "c@x.com", phone: null, status: "approved", created_at: "2026-01-02T03:00:00Z" }], count: 1, total: 1, next: null }, error: null });
    await open();
    fireEvent.click(exportBtn("Baixar CSV de sellers"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 linha exportada."));
    expect(calls("admin_export_page")[0]).toMatchObject({ _kind: "sellers", _from: null, _to: null });
    expect(dl.names[0]).toMatch(/^sellers-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("recorte acima do limite por arquivo não baixa nada e diz o que fazer", async () => {
    const dl = captureDownloads();
    handlers.admin_export_page = () => ({ data: { rows: [tx()], count: 1, total: 60000, next: { at: "2026-11-10T12:00:00Z", id: "t0" } }, error: null });
    await open();
    fireEvent.click(exportBtn("Baixar CSV de transações"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("60.000 linhas");
    expect(alert).toHaveTextContent("50.000");
    expect(alert).toHaveTextContent("Escolha um período menor");
    expect(calls("admin_export_page")).toHaveLength(1);
    expect(dl.blobs).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sem linhas avisa e não baixa arquivo vazio", async () => {
    const dl = captureDownloads();
    handlers.admin_export_page = () => ({ data: { rows: [], count: 0, total: 0, next: null }, error: null });
    await open();
    fireEvent.click(exportBtn("Baixar CSV de saques"));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Nenhuma linha para exportar neste período."));
    expect(dl.blobs).toHaveLength(0);
  });

  it("erro do servidor (senha expirada, por exemplo) aparece no cartão e nenhum arquivo é baixado", async () => {
    const dl = captureDownloads();
    handlers.admin_export_page = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    await open();
    fireEvent.click(exportBtn("Baixar CSV de transações"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("reautenticação necessária");
    expect(dl.blobs).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
    expect(exportBtn("Baixar CSV de transações")).not.toBeDisabled();
  });

  it("período do topo acima de 400 dias trava transações e saques, mas não sellers", async () => {
    wrap(<ToolsCenter dateRange={{ from: new Date("2025-01-01T03:00:00Z"), to: RANGE.to }} />);
    await screen.findByRole("group", { name: "Pagamentos" });
    expect(screen.getByText(/no máximo 400 dias/)).toBeInTheDocument();
    expect(exportBtn("Baixar CSV de transações")).toBeDisabled();
    expect(exportBtn("Baixar CSV de saques")).toBeDisabled();
    expect(exportBtn("Baixar CSV de sellers")).not.toBeDisabled();
  });
});

/* ───────── notas ───────── */

describe("notas sobre sellers", () => {
  const pick = async () => {
    fireEvent.change(screen.getByPlaceholderText("Nome ou e-mail do seller"), { target: { value: "mar" } });
    fireEvent.click(await screen.findByRole("button", { name: /Marina Duarte/ }));
    await screen.findByText("Notas de Marina Duarte");
  };

  it("lista as notas mais recentes e, ao escolher um seller, só as dele", async () => {
    await open();
    const list = within(await screen.findByRole("list", { name: "Notas" }));
    expect(list.getByText("Ligou sobre o saque.")).toBeInTheDocument();
    expect(list.getByText(/Bia \(equipe\)/)).toBeInTheDocument();
    expect(list.getByText(/, Matheus/)).toBeInTheDocument();
    expect(calls("get_admin_seller_notes")[0]).toEqual({ _seller_id: null, _limit: 30 });
    await pick();
    await waitFor(() => expect(calls("get_admin_seller_notes").some((c) => c._seller_id === "s1")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Ligou sobre o saque.")).not.toBeInTheDocument());
    expect(screen.getByText("Pediu para adiar a análise de documentos.")).toBeInTheDocument();
  });

  it("salva a nota do seller escolhido e atualiza a lista e os números", async () => {
    handlers.admin_add_seller_note = () => ({ data: { id: "n9", duplicate: false }, error: null });
    await open();
    await pick();
    fireEvent.change(screen.getByLabelText("Nota"), { target: { value: "  Combinou prazo novo para os documentos  " } });
    expect(screen.getByText("42/2.000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(calls("admin_add_seller_note")).toHaveLength(1));
    expect(calls("admin_add_seller_note")[0]).toEqual({ _seller_id: "s1", _content: "Combinou prazo novo para os documentos" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nota salva."));
    expect((screen.getByLabelText("Nota") as HTMLTextAreaElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_tools").length).toBeGreaterThanOrEqual(2));
  });

  it("sem seller ou com texto curto demais não chama o servidor", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha o seller da nota.");
    await pick();
    fireEvent.change(screen.getByLabelText("Nota"), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 3 caracteres");
    expect(calls("admin_add_seller_note")).toHaveLength(0);
  });

  it("nota repetida avisa que já estava salva, e erro do servidor fica na tela", async () => {
    handlers.admin_add_seller_note = () => ({ data: { id: "n1", duplicate: true }, error: null });
    await open();
    await pick();
    fireEvent.change(screen.getByLabelText("Nota"), { target: { value: "Pediu para adiar a análise de documentos." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Essa nota já estava salva."));

    handlers.admin_add_seller_note = () => ({ data: null, error: { message: "seller não encontrado" } });
    fireEvent.change(screen.getByLabelText("Nota"), { target: { value: "Outra nota qualquer" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("seller não encontrado");
    expect((screen.getByLabelText("Nota") as HTMLTextAreaElement).value).toBe("Outra nota qualquer");
  });

  it("diz de frente quem vê a nota", async () => {
    await open();
    expect(screen.getByText(/O seller não vê esta nota\. Quem tem acesso ao seller na equipe vê as notas feitas depois que recebeu o acesso\./)).toBeInTheDocument();
  });
});

/* ───────── aviso para o seller ───────── */

function Probe() {
  const p = usePlatformPauses();
  return <p>{p.withdrawals ? "saques pausados" : "saques liberados"}</p>;
}

describe("aviso de pausa para o seller", () => {
  it("mostra pausado só quando o banco diz true", async () => {
    handlers.get_platform_pauses = () => ({ data: { payments: false, withdrawals: true }, error: null });
    wrap(<Probe />);
    expect(await screen.findByText("saques pausados")).toBeInTheDocument();
  });

  it("falha na leitura deixa liberado (quem barra de verdade é o banco)", async () => {
    handlers.get_platform_pauses = () => ({ data: null, error: { message: "queda" } });
    wrap(<Probe />);
    await waitFor(() => expect(calls("get_platform_pauses").length).toBeGreaterThan(0));
    expect(screen.getByText("saques liberados")).toBeInTheDocument();
  });
});

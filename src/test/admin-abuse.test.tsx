import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), functions: { invoke: vi.fn() } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const askReason = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "adm1" } }) }));

import { toast } from "sonner";
import AdminAbuseMetricsTab from "@/pages/admin/tabs/AdminAbuseMetricsTab";
import { ActivityPanel } from "@/features/admin-abuse/ActivityPanel";
import { WaitingPanel } from "@/features/admin-abuse/WaitingPanel";
import { IpsPanel } from "@/features/admin-abuse/IpsPanel";
import {
  blockReasonLabel, checkBlockReason, clockLabel, durationLabel, endpointLabel, eventLabel, hourLabel, hoursLabel, lastLabel, parseIps, parseOverview, parseWaiting,
  peakOf, scopeLabel, shortHash, timeLeft,
} from "@/features/admin-abuse/abuseModel";

/* ───────── dados ───────── */

const HASH_A = "d38cf9763f4e0a1b2c3d4e5f60718293";
const HASH_B = "9a1b3c5d7e9f00112233445566778899";
const HASH_C = "00ff11ee22dd33cc44bb55aa66997788";
const inMin = (m: number) => new Date(Date.now() + m * 60000).toISOString();

const overview = (over: Record<string, unknown> = {}) => ({
  hours: 24, total: 61, failed: 52, rate_limited: 9, distinct_ips: 8, distinct_accounts: 11, blocks_active: 1, lockouts_active: 2,
  by_type: [{ event_type: "login_failed", count: 52 }, { event_type: "login_rate_limited", count: 9 }],
  by_endpoint: [{ endpoint: "gated-login", count: 61 }],
  hourly: [{ bucket: "2026-11-25T10:00:00Z", count: 3 }, { bucket: "2026-11-25T11:00:00Z", count: 14 }, { bucket: "2026-11-25T12:00:00Z", count: 0 }],
  ...over,
});

const waiting = (over: Record<string, unknown> = {}) => ({
  lockouts: [
    { kind: "email", scope: "seller", email: "marina.duarte@exemplo.com", ip_hash: null, fails: 5, resets_at: inMin(12) },
    { kind: "ip", scope: null, email: null, ip_hash: HASH_A, fails: 20, resets_at: inMin(7) },
  ],
  blocks: [{ id: "b1", ip_hash: HASH_B, endpoint: "gated-login", reason: "Bloqueio manual: tentando senhas de várias contas", blocked_until: inMin(48), created_at: inMin(-10) }],
  ...over,
});

const ipRow = (hash: string, over: Record<string, unknown> = {}) => ({
  ip_hash: hash, events: 19, failed: 15, rate_limited: 4, accounts: 7, last_at: "2026-11-25T11:10:00Z", block_id: null, blocked_until: null, ...over,
});
const ipsPage = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: { ips: items.length, blocked: items.filter((i) => (i as { block_id: string | null }).block_id).length }, ...over });
const defaultIps = () => ipsPage([ipRow(HASH_A), ipRow(HASH_B, { events: 8, failed: 8, rate_limited: 0, accounts: 1, block_id: "b1", blocked_until: inMin(48) }), ipRow(HASH_C, { events: 2, failed: 2, rate_limited: 0, accounts: 2 })]);

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); askReason.mockReset(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: null, error: null }));
});

/* ───────── modelo ───────── */

describe("abuseModel", () => {
  it("traduz o motivo do bloqueio e separa manual de automático", () => {
    expect(blockReasonLabel("Bloqueio manual: tentando várias contas")).toEqual({ manual: true, text: "tentando várias contas" });
    expect(blockReasonLabel("Bloqueio manual:")).toEqual({ manual: true, text: "Sem motivo registrado" });
    expect(blockReasonLabel("Auto-block: 120 events in 10s")).toEqual({ manual: false, text: "120 tentativas em 10 segundos" });
    expect(blockReasonLabel("Auto-block: 1 event in 10s")).toEqual({ manual: false, text: "1 tentativas em 10 segundos" });
    expect(blockReasonLabel("outro texto")).toEqual({ manual: false, text: "outro texto" });
    expect(blockReasonLabel(null)).toEqual({ manual: false, text: "Sem motivo registrado" });
  });

  it("conta o tempo que falta sem inventar", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(timeLeft("2026-11-25T12:12:00Z", now)).toBe("faltam 12 min");
    expect(timeLeft("2026-11-25T12:00:10Z", now)).toBe("faltam 1 min");
    expect(timeLeft("2026-11-25T14:10:00Z", now)).toBe("faltam 2 h 10 min");
    expect(timeLeft("2026-11-25T15:00:00Z", now)).toBe("faltam 3 h");
    expect(timeLeft("2026-11-28T12:00:00Z", now)).toBe("faltam 3 dias");
    expect(timeLeft("2026-11-25T11:59:00Z", now)).toBe("termina agora");
    expect(timeLeft("lixo", now)).toBe("—");
  });

  it("horas sempre no horário de Brasília", () => {
    expect(hourLabel("2026-11-25T11:00:00Z")).toBe("25/11 08h");
    expect(hourLabel("2026-11-25T02:30:00Z")).toBe("24/11 23h");
    expect(clockLabel("2026-11-25T11:05:00Z")).toBe("08:05");
    expect(hourLabel("lixo")).toBe("—");
    expect(clockLabel("")).toBe("—");
  });

  it("hora mais movimentada: a mais recente no empate e nada quando não há evento", () => {
    expect(peakOf([{ bucket: "a", count: 3 }, { bucket: "b", count: 7 }, { bucket: "c", count: 7 }, { bucket: "d", count: 0 }])).toEqual({ bucket: "c", count: 7 });
    expect(peakOf([{ bucket: "a", count: 0 }])).toBeNull();
    expect(peakOf([])).toBeNull();
  });

  it("nomes em português e código curto do IP", () => {
    expect(hoursLabel(1)).toBe("1 hora");
    expect(hoursLabel(6)).toBe("6 horas");
    expect(hoursLabel(24)).toBe("24 horas");
    expect(hoursLabel(72)).toBe("3 dias");
    expect(hoursLabel(168)).toBe("7 dias");
    expect(lastLabel(1)).toBe("na última hora");
    expect(lastLabel(6)).toBe("nas últimas 6 horas");
    expect(lastLabel(24)).toBe("nas últimas 24 horas");
    expect(lastLabel(72)).toBe("nos últimos 3 dias");
    expect(lastLabel(168)).toBe("nos últimos 7 dias");
    expect(eventLabel("login_failed")).toBe("E-mail ou senha errados");
    expect(eventLabel("login_rate_limited")).toBe("Barrado por excesso de tentativas");
    expect(eventLabel("x")).toBe("Outro evento");
    expect(endpointLabel("gated-login")).toBe("Login de vendedores e alunos");
    expect(endpointLabel("")).toBe("Rota não informada");
    expect(endpointLabel("outra-rota")).toBe("outra-rota");
    expect(scopeLabel("member")).toBe("Área do aluno");
    expect(scopeLabel("seller")).toBe("Área do vendedor");
    expect(scopeLabel(null)).toBe("Login");
    expect(shortHash(HASH_A)).toBe("d38cf9763f4e…");
    expect(shortHash("abc")).toBe("abc");
    expect(durationLabel(1440)).toBe("24 horas");
    expect(durationLabel(45)).toBe("45 minutos");
  });

  it("valida o motivo antes de enviar", () => {
    expect(checkBlockReason("")).toBe("Explique o motivo (mínimo 3 caracteres).");
    expect(checkBlockReason("  ab ")).toBe("Explique o motivo (mínimo 3 caracteres).");
    expect(checkBlockReason("abc")).toBeNull();
  });

  it("respostas fora do formato viram erro, não tela vazia", () => {
    expect(() => parseOverview(null)).toThrow("Resposta inesperada do servidor.");
    expect(() => parseOverview([])).toThrow();
    expect(() => parseWaiting("x")).toThrow();
    expect(() => parseIps({ total: 0 })).toThrow();
    expect(() => parseIps({ items: "x" })).toThrow();
  });

  it("lê os números mesmo quando vêm como texto ou faltam", () => {
    const o = parseOverview({ total: "61", failed: "52", hourly: [{ bucket: "b", count: "3" }, "lixo"], by_type: null });
    expect(o.total).toBe(61); expect(o.failed).toBe(52); expect(o.rate_limited).toBe(0);
    expect(o.hourly).toEqual([{ bucket: "b", count: 3 }]);
    expect(o.by_type).toEqual([]);
    const w = parseWaiting({ lockouts: [{ kind: "qualquer", fails: "5", resets_at: "x" }], blocks: [] });
    expect(w.lockouts[0].kind).toBe("email");
    expect(w.lockouts[0].fails).toBe(5);
    const i = parseIps({ items: [{ ip_hash: "h", events: "4" }], total: "1" });
    expect(i.items[0].events).toBe(4); expect(i.items[0].block_id).toBeNull(); expect(i.total).toBe(1); expect(i.summary).toEqual({ ips: 0, blocked: 0 });
  });
});

/* ───────── atividade ───────── */

describe("ActivityPanel", () => {
  it("mostra a hora mais movimentada, o que e onde aconteceu", () => {
    render(<ActivityPanel o={parseOverview(overview())} hours={24} />);
    expect(screen.getByText(/Tentativas de login com erro nas últimas 24 horas,/)).toBeTruthy();
    expect(screen.getByText("14 eventos")).toBeTruthy();
    expect(screen.getByText(/25\/11 08h\./)).toBeTruthy();
    expect(screen.getByText("E-mail ou senha errados")).toBeTruthy();
    expect(screen.getByText("Barrado por excesso de tentativas")).toBeTruthy();
    expect(screen.getByText("Login de vendedores e alunos")).toBeTruthy();
    expect(screen.getByText("(85%)")).toBeTruthy();
    expect(screen.getByText("(15%)")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Eventos por hora, de 25\/11 07h até 25\/11 09h/ })).toBeTruthy();
  });

  it("sem tentativas mostra um vazio que explica o que fazer aparecer ali", () => {
    render(<ActivityPanel o={parseOverview(overview({ total: 0, failed: 0, rate_limited: 0, by_type: [], by_endpoint: [], hourly: [] }))} hours={1} />);
    expect(screen.getByText("Nenhuma tentativa com erro")).toBeTruthy();
    expect(screen.queryByText("O que aconteceu")).toBeNull();
  });
});

/* ───────── em espera agora ───────── */

describe("WaitingPanel", () => {
  it("lista logins travados e IPs em quarentena, com o IP só como código", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    wrap(<WaitingPanel />);
    expect(await screen.findByText("marina.duarte@exemplo.com")).toBeTruthy();
    expect(screen.getByText("Área do vendedor")).toBeTruthy();
    expect(screen.getByText(/5 erros seguidos/)).toBeTruthy();
    expect(screen.getByText("IP d38cf9763f4e…")).toBeTruthy();
    expect(screen.getByText(/20 erros seguidos/)).toBeTruthy();
    expect(screen.getByText("Logins travados (2)")).toBeTruthy();
    expect(screen.getByText("IPs em quarentena (1)")).toBeTruthy();
    expect(screen.getByText("9a1b3c5d7e9f…")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText(/tentando senhas de várias contas/)).toBeTruthy();
    expect(screen.getAllByText(/faltam \d+ min/).length).toBe(3);
    expect(document.body.textContent).not.toContain(HASH_A);
  });

  it("bloqueio automático aparece traduzido", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting({ lockouts: [], blocks: [{ id: "b2", ip_hash: HASH_C, endpoint: "gated-login", reason: "Auto-block: 120 events in 10s", blocked_until: inMin(10), created_at: inMin(-5) }] }) });
    wrap(<WaitingPanel />);
    expect(await screen.findByText("Automático")).toBeTruthy();
    expect(screen.getByText(/120 tentativas em 10 segundos/)).toBeTruthy();
    expect(screen.getByText("Nenhum login travado.")).toBeTruthy();
  });

  it("liberar um IP: motivo, senha de novo e só então a chamada, com os argumentos certos", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    handlers.admin_abuse_release_block = () => ({ data: null, error: null });
    askReason.mockResolvedValue("era uma rede de escritório");
    wrap(<WaitingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Liberar o IP 9a1b3c5d7e9f…" }));
    await waitFor(() => expect(calls("admin_abuse_release_block")).toHaveLength(1));
    expect(askReason).toHaveBeenCalledWith(expect.objectContaining({ title: "Liberar este IP?", minLength: 3 }));
    expect(confirmSpy).toHaveBeenCalledWith("Liberar o IP 9a1b3c5d7e9f… da quarentena.");
    expect(calls("admin_abuse_release_block")[0]).toEqual({ _id: "b1", _reason: "era uma rede de escritório" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("IP liberado."));
    await waitFor(() => expect(calls("get_admin_abuse_waiting").length).toBeGreaterThan(1));
  });

  it("cancelar o motivo não chama nada nem pede a senha", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    askReason.mockResolvedValue(null);
    wrap(<WaitingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Liberar o IP 9a1b3c5d7e9f…" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    await Promise.resolve();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_abuse_release_block")).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("liberar login travado por e-mail e por IP manda o tipo, o escopo e o motivo", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    handlers.admin_release_login_lockout = () => ({ data: null, error: null });
    askReason.mockResolvedValue("pediu ajuda pelo suporte");
    wrap(<WaitingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Liberar o login de marina.duarte@exemplo.com" }));
    await waitFor(() => expect(calls("admin_release_login_lockout")).toHaveLength(1));
    expect(calls("admin_release_login_lockout")[0]).toEqual({ _kind: "email", _scope: "seller", _email: "marina.duarte@exemplo.com", _ip_hash: null, _reason: "pediu ajuda pelo suporte" });
    expect(confirmSpy).toHaveBeenCalledWith("Liberar o login travado de marina.duarte@exemplo.com.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Login liberado."));

    fireEvent.click(screen.getByRole("button", { name: "Liberar o login de IP d38cf9763f4e…" }));
    await waitFor(() => expect(calls("admin_release_login_lockout")).toHaveLength(2));
    expect(calls("admin_release_login_lockout")[1]).toEqual({ _kind: "ip", _scope: null, _email: null, _ip_hash: HASH_A, _reason: "pediu ajuda pelo suporte" });
  });

  it("falha ao liberar avisa que a trava continua e não diz que deu certo", async () => {
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    handlers.admin_release_login_lockout = () => ({ data: null, error: { message: "Sem permissão para esta ação." } });
    askReason.mockResolvedValue("motivo");
    wrap(<WaitingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Liberar o login de marina.duarte@exemplo.com" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe("Não foi possível liberar. A trava continua.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro de carga não vira “nada em espera” e dá para tentar de novo", async () => {
    let fail = true;
    handlers.get_admin_abuse_waiting = () => (fail ? { data: null, error: { message: "Falha de rede." } } : { data: waiting({ lockouts: [], blocks: [] }) });
    wrap(<WaitingPanel />);
    expect(await screen.findByText("Não foi possível carregar o que está em espera.")).toBeTruthy();
    expect(screen.queryByText("Nada em espera")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Nada em espera")).toBeTruthy();
  });
});

/* ───────── IPs mais ativos ───────── */

describe("IpsPanel", () => {
  it("consulta com a janela, sem busca e na primeira página", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    wrap(<IpsPanel hours={72} />);
    const table = await screen.findByRole("table");
    expect(calls("get_admin_abuse_ips")[0]).toEqual({ _hours: 72, _search: null, _page: 1, _page_size: 25 });
    expect(screen.getByText(/com erro nos últimos 3 dias\./)).toBeTruthy();
    expect(within(table).getByText("d38cf9763f4e…")).toBeTruthy();
    expect(within(table).getByText("15 com erro · 4 barradas")).toBeTruthy();
    expect(within(table).getByText("8 com erro")).toBeTruthy();
    expect(within(table).getByText(/Em quarentena até/)).toBeTruthy();
    expect(screen.getByText(/3 IPs no período, 1 em quarentena\./)).toBeTruthy();
    expect(document.body.textContent).not.toContain(HASH_A);
  });

  it("busca pelo começo do código com espera e volta para a página 1", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    wrap(<IpsPanel hours={24} />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Buscar IP pelo código"), { target: { value: "  d38c " } });
    await waitFor(() => expect(calls("get_admin_abuse_ips").some((c) => c._search === "d38c")).toBe(true), { timeout: 2000 });
    expect(calls("get_admin_abuse_ips").at(-1)).toEqual({ _hours: 24, _search: "d38c", _page: 1, _page_size: 25 });
  });

  it("busca sem resultado oferece limpar os filtros", async () => {
    handlers.get_admin_abuse_ips = (a) => ({ data: a._search ? ipsPage([]) : defaultIps() });
    wrap(<IpsPanel hours={24} />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Buscar IP pelo código"), { target: { value: "zzzz" } });
    expect(await screen.findByText("Nenhum IP aqui", undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText("Nenhum código bate com essa busca.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Limpar filtros/ })[0]);
    expect(await screen.findByRole("table")).toBeTruthy();
    expect((screen.getByLabelText("Buscar IP pelo código") as HTMLInputElement).value).toBe("");
  });

  it("sem nenhuma tentativa explica quando o IP passa a aparecer", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: ipsPage([]) });
    wrap(<IpsPanel hours={24} />);
    expect(await screen.findByText("Nenhum IP com tentativas")).toBeTruthy();
    expect(screen.queryByText("Limpar filtros")).toBeNull();
  });

  it("bloquear: exige motivo, manda a duração escolhida e o código completo", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    handlers.admin_abuse_block_ip = () => ({ data: null, error: null });
    wrap(<IpsPanel hours={24} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getAllByRole("button", { name: "Colocar o IP d38cf9763f4e… em quarentena" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Colocar este IP em quarentena")).toBeTruthy();
    expect(within(dialog).getByText("IP d38cf9763f4e…")).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: /1 hora/ }).getAttribute("aria-checked")).toBe("true");

    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: "ab" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bloquear IP" }));
    expect(await within(dialog).findByText("Explique o motivo (mínimo 3 caracteres).")).toBeTruthy();
    expect(calls("admin_abuse_block_ip")).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("radio", { name: /24 horas/ }));
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: "senhas de várias contas" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bloquear IP" }));
    await waitFor(() => expect(calls("admin_abuse_block_ip")).toHaveLength(1));
    expect(calls("admin_abuse_block_ip")[0]).toEqual({ _ip_hash: HASH_A, _minutes: 1440, _reason: "senhas de várias contas" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("IP em quarentena por 24 horas."));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(calls("get_admin_abuse_ips").length).toBeGreaterThan(1));
  });

  it("erro do servidor no bloqueio fica no popup e nada é anunciado como feito", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    handlers.admin_abuse_block_ip = () => ({ data: null, error: { message: "Este IP já está em quarentena." } });
    wrap(<IpsPanel hours={24} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getAllByRole("button", { name: /Colocar o IP 00ff11ee22dd… em quarentena/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: "teste" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Bloquear IP" }));
    expect(await within(dialog).findByText("Este IP já está em quarentena.")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("cancelar o popup não chama nada", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    wrap(<IpsPanel hours={24} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getAllByRole("button", { name: /Colocar o IP d38cf9763f4e…/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls("admin_abuse_block_ip")).toHaveLength(0);
  });

  it("IP já em quarentena mostra Liberar (e não Bloquear) e usa o id do bloqueio", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    handlers.admin_abuse_release_block = () => ({ data: null, error: null });
    askReason.mockResolvedValue("engano");
    wrap(<IpsPanel hours={24} />);
    const table = await screen.findByRole("table");
    expect(within(table).queryByRole("button", { name: /Colocar o IP 9a1b3c5d7e9f…/ })).toBeNull();
    fireEvent.click(within(table).getByRole("button", { name: "Liberar o IP 9a1b3c5d7e9f…" }));
    await waitFor(() => expect(calls("admin_abuse_release_block")).toHaveLength(1));
    expect(calls("admin_abuse_release_block")[0]).toEqual({ _id: "b1", _reason: "engano" });
  });

  it("erro de carga não vira lista vazia", async () => {
    handlers.get_admin_abuse_ips = () => ({ data: null, error: { message: "Falha de rede." } });
    wrap(<IpsPanel hours={24} />);
    expect(await screen.findByText("Não foi possível carregar os IPs.")).toBeTruthy();
    expect(screen.queryByText("Nenhum IP com tentativas")).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });
});

/* ───────── aba ───────── */

describe("AdminAbuseMetricsTab", () => {
  const setup = (over: Record<string, Res | ((a: Record<string, unknown>) => Res)> = {}) => {
    handlers.get_admin_abuse_overview = () => ({ data: overview() });
    handlers.get_admin_abuse_waiting = () => ({ data: waiting() });
    handlers.get_admin_abuse_ips = () => ({ data: defaultIps() });
    for (const [k, v] of Object.entries(over)) handlers[k] = typeof v === "function" ? v : () => v;
  };

  it("mostra o estado geral, os números e a atividade", async () => {
    setup();
    wrap(<AdminAbuseMetricsTab />);
    expect(await screen.findByText("3 em espera agora")).toBeTruthy();
    expect(screen.getAllByText("52").length).toBeGreaterThan(0);
    expect(screen.getByText("nas últimas 24 horas")).toBeTruthy();
    expect(screen.getByText("tentativas depois do limite")).toBeTruthy();
    expect(screen.getByText("11 e-mails tentados")).toBeTruthy();
    expect(screen.getByText("2 logins · 1 IP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Em espera agora · 3" })).toBeTruthy();
    expect(await screen.findByText(/Hora mais movimentada/)).toBeTruthy();
    expect(calls("get_admin_abuse_overview")[0]).toEqual({ _hours: 24 });
  });

  it("sem nada travado o selo diz isso", async () => {
    setup({ get_admin_abuse_overview: { data: overview({ blocks_active: 0, lockouts_active: 0 }) } });
    wrap(<AdminAbuseMetricsTab />);
    expect(await screen.findByText("Nada travado agora")).toBeTruthy();
    expect(screen.getByText("0 logins · 0 IPs")).toBeTruthy();
  });

  it("trocar a janela consulta de novo com as horas certas", async () => {
    setup();
    wrap(<AdminAbuseMetricsTab />);
    await screen.findByText("3 em espera agora");
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(calls("get_admin_abuse_overview").some((c) => c._hours === 168)).toBe(true));
    expect(await screen.findByText("nos últimos 7 dias")).toBeTruthy();
  });

  it("troca de seção abre Em espera agora e IPs mais ativos", async () => {
    setup();
    wrap(<AdminAbuseMetricsTab />);
    await screen.findByText("3 em espera agora");
    fireEvent.click(screen.getByRole("button", { name: "Em espera agora · 3" }));
    expect(await screen.findByText("Logins travados (2)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "IPs mais ativos" }));
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(calls("get_admin_abuse_ips")[0]._hours).toBe(24);
  });

  it("falha no resumo mostra “Indisponível” em vez de zeros e permite tentar de novo", async () => {
    let fail = true;
    setup({ get_admin_abuse_overview: () => (fail ? { data: null, error: { message: "Falha de rede." } } : { data: overview() }) });
    wrap(<AdminAbuseMetricsTab />);
    expect(await screen.findByText("Não foi possível carregar o resumo.")).toBeTruthy();
    expect(screen.getAllByText("Indisponível")).toHaveLength(4);
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.queryByText("Nada travado agora")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("3 em espera agora")).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar o resumo.")).toBeNull();
  });
});

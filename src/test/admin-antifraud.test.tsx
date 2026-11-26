import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const invoke = vi.fn();
const writes: { table: string; op: "update" | "insert"; payload: unknown; eq: [string, unknown][] }[] = [];
const state: Record<string, Res> = {};
function from(table: string) {
  const b: Record<string, unknown> = {};
  let mode: "read" | "update" | "insert" = "read";
  const eq: [string, unknown][] = [];
  for (const m of ["select", "order", "limit", "in"]) b[m] = () => b;
  b.eq = (c: string, v: unknown) => { eq.push([c, v]); return b; };
  b.update = (payload: unknown) => { mode = "update"; writes.push({ table, op: "update", payload, eq }); return b; };
  b.insert = (payload: unknown) => { mode = "insert"; writes.push({ table, op: "insert", payload, eq }); return b; };
  b.single = async () => state.insert ?? { data: { id: "new1" }, error: null };
  b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(mode === "update" ? (state.update ?? { error: null }) : (state[table] ?? { data: [] })).then(res, rej);
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const logAdminAction = vi.fn(async () => undefined);
vi.mock("@/lib/auditLog", () => ({ logAdminAction: (...a: unknown[]) => (logAdminAction as (...x: unknown[]) => unknown)(...a) }));
const askReason = vi.fn();
const askConfirm = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: askConfirm, dialog: null }),
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "adm1" } }) }));

import { toast } from "sonner";
import AdminRiskComplianceTab from "@/pages/admin/tabs/AdminRiskComplianceTab";
import { BlacklistPanel } from "@/features/admin-antifraud/BlacklistPanel";
import { RadarPanel } from "@/features/admin-antifraud/RadarPanel";
import { VelocityPanel } from "@/features/admin-antifraud/VelocityPanel";
import { TrailPanel } from "@/features/admin-antifraud/TrailPanel";
import { SecurityFindingsPanel } from "@/features/admin-antifraud/SecurityFindingsPanel";
import {
  checkBlacklistInput, draftDirty, draftFromRule, fmtWindow, levelReason, parseBlacklistPage, parseOverview, parseRules, ruleSentence, trailMatch, validateDraft,
  type RadarWindow, type VelocityRule,
} from "@/features/admin-antifraud/antifraudModel";

/* ───────── dados ───────── */

const entry = (id: string, over: Record<string, unknown> = {}) => ({
  id, entry_type: "cpf", entry_value: "12345678901", reason: "Chargeback recorrente", is_active: true,
  created_at: "2026-11-20T15:00:00Z", updated_at: "2026-11-20T15:00:00Z", added_by_name: "Lucker", ...over,
});
const blSummary = { all: 6, active: 5, removed: 1 };
const blPage = (items: unknown[], total = items.length) => ({ items, total, summary: blSummary });

const seller = (id: string, over: Record<string, unknown> = {}) => ({
  user_id: id, full_name: "Marina Duarte", email: "marina@exemplo.com", frozen: false, sales: 140, chargebacks: 4, refunds: 6, chargeback_amount: 788, cb_rate: 2.86, refund_rate: 4.29, level: "high", ...over,
});
const radarSummary = { sellers: 5, high: 2, watch: 1, ok: 1, few: 1, sales: 754, chargebacks: 9, chargeback_amount: 1576 };
const radarPage = (items: unknown[]) => ({ items, total: items.length, summary: radarSummary });

const rule = (over: Partial<VelocityRule> & Record<string, unknown> = {}) => ({
  id: "v1", rule_name: "Bloquear IP após tentativas de cartão recusado", rule_type: "ip_card_fail", is_enabled: true, max_attempts: 5, time_window_minutes: 10,
  threshold_amount: null, action: "block", created_at: "2026-03-11T00:00:00Z", ...over,
});

const trailRow = (id: string, over: Record<string, unknown> = {}) => ({
  id, created_at: "2026-11-25T10:00:00Z", block_type: "blacklist", block_reason: "Bloqueado pela Blacklist Global: cpf", matched_type: "cpf", matched_value: "12345678901",
  customer_email: "ana@exemplo.com", customer_document: "***8901", customer_ip: "189.12.4.8", seller_name: "Marina Duarte", product_name: "Curso Método", outcome: "blocked", ...over,
});
const trailSummary = { all: 3, blacklist: 1, velocity: 2, manual: 0, today: 2 };
const trailPage = (items: unknown[], summary = trailSummary) => ({ items, total: items.length, summary });

const finding = (id: string, over: Record<string, unknown> = {}) => ({
  id, created_by: "u", source: "storage", title: "Bucket de capas aceita .svg", description: "SVG com script embutido.", evidence: {}, status: "analyzed", risk_level: "high",
  ai_summary: "Risco real de XSS.", ai_recommendations: [{ priority: 1, title: "Bloquear .svg", action: "Remover a extensão.", rationale: "Fecha a porta." }], error_message: null,
  created_at: "2026-11-24T12:00:00Z", resolved_at: null, ...over,
});

const overview = { blacklist_active: 5, rules_enabled: 2, rules_total: 3, blocked_today: 4, sellers_high: 2, sellers_watch: 1 };

/** Cada teste define o que cada RPC responde; o resto devolve vazio sem erro. */
const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>);
const last = (name: string) => calls(name).at(-1);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); invoke.mockReset(); askReason.mockReset(); askConfirm.mockReset(); confirmSpy.mockClear(); logAdminAction.mockClear();
  writes.length = 0;
  for (const k of Object.keys(state)) delete state[k];
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.warning).mockClear();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: null, error: null }));
});

/* ───────── modelo ───────── */

describe("antifraudModel", () => {
  it("valida a blacklist antes de enviar, com a mesma regra do servidor", () => {
    expect(checkBlacklistInput("cpf", "", "motivo")).toBe("Informe o valor que será bloqueado.");
    expect(checkBlacklistInput("cpf", "123.456.789-0", "motivo")).toBe("O CPF precisa ter 11 dígitos.");
    expect(checkBlacklistInput("cpf", "123.456.789-01", "motivo")).toBeNull();
    expect(checkBlacklistInput("cnpj", "12.345.678/0001-9", "motivo")).toBe("O CNPJ precisa ter 14 dígitos.");
    expect(checkBlacklistInput("bin", "4111", "motivo")).toBe("O BIN precisa ter 6 dígitos.");
    expect(checkBlacklistInput("bin", "411111", "motivo")).toBeNull();
    expect(checkBlacklistInput("email", "sem-arroba", "motivo")).toBe("E-mail inválido.");
    expect(checkBlacklistInput("email", "a@b.co", "ab")).toBe("Explique o motivo (mínimo 3 caracteres).");
    expect(checkBlacklistInput("ip", "203.0.113.0/24", "motivo")).toBe("Informe um IP único, sem faixa (/24).");
    expect(checkBlacklistInput("ip", "203.0.113.7", "motivo")).toBeNull();
    expect(checkBlacklistInput("ip", "2001:db8::1", "motivo")).toBeNull();
  });

  it("janela em português e frase de cada regra", () => {
    expect(fmtWindow(1)).toBe("1 minuto");
    expect(fmtWindow(10)).toBe("10 minutos");
    expect(fmtWindow(60)).toBe("1 hora");
    expect(fmtWindow(1440)).toBe("1 dia");
    expect(fmtWindow(4320)).toBe("3 dias");
    expect(fmtWindow(0)).toBe("—");
    const base = { max_attempts: 5, time_window_minutes: 10, threshold_amount: null, action: "block" as const };
    expect(ruleSentence({ ...base, rule_type: "ip_card_fail" })).toBe("Barra a compra quando o mesmo IP ou e-mail já tem 5 recusas de cartão nos últimos 10 minutos.");
    expect(ruleSentence({ ...base, rule_type: "email_high_value", max_attempts: 3, time_window_minutes: 1440, threshold_amount: 500, action: "flag" }))
      .toContain("Só registra na trilha, sem barrar, quando o mesmo e-mail já tem 3 compras de valor alto (cada uma de pelo menos R$ 500) nos últimos 1 dia.");
  });

  it("rascunho de regra: limites e sujeira", () => {
    const r = parseRules([rule()])[0];
    const d = draftFromRule(r);
    expect(draftDirty(r, d)).toBe(false);
    expect(draftDirty(r, { ...d, action: "flag" })).toBe(true);
    expect(validateDraft(r, { ...d, max: "0" }).error).toContain("entre 1 e 1000");
    expect(validateDraft(r, { ...d, max: "1001" }).error).toContain("entre 1 e 1000");
    expect(validateDraft(r, { ...d, max: "2,5" }).error).toContain("entre 1 e 1000");
    expect(validateDraft(r, { ...d, window: "10081" }).error).toContain("10.080");
    expect(validateDraft(r, { ...d, window: "0" }).error).toContain("A janela");
    expect(validateDraft(r, { ...d, max: "7" }).value).toEqual({ enabled: true, max: 7, window: 10, threshold: null, action: "block" });
    const hv = parseRules([rule({ rule_type: "email_high_value", threshold_amount: 500 })])[0];
    const dh = draftFromRule(hv);
    expect(validateDraft(hv, { ...dh, threshold: "-1" }).error).toContain("valor mínimo");
    expect(validateDraft(hv, { ...dh, threshold: "250,50" }).value?.threshold).toBe(250.5);
    expect(validateDraft(hv, { ...dh, threshold: "1.500,00" }).value?.threshold).toBe(1500);
    expect(validateDraft(hv, { ...dh, threshold: "500" }).value?.threshold).toBe(500);
    // "1.500" sem vírgula não pode virar R$ 1,50
    expect(validateDraft(hv, { ...dh, threshold: "1.500" }).error).toContain("valor mínimo");
    expect(validateDraft(hv, { ...dh, threshold: "" }).value?.threshold).toBeNull();
  });

  it("regras desconhecidas viram 'só registrar' e lista inesperada vira erro", () => {
    expect(parseRules([rule({ action: "notify" as never })])[0].action).toBe("flag");
    expect(() => parseRules({})).toThrow();
    expect(() => parseBlacklistPage({})).toThrow();
    expect(() => parseOverview(null)).toThrow();
    expect(parseOverview({ blacklist_active: "4" }).blacklist_active).toBe(4);
  });

  it("explica por que o seller está em cada faixa", () => {
    expect(levelReason({ level: "high", chargebacks: 4, sales: 140, cb_rate: 2.857 })).toBe("4 chargebacks em 140 vendas pagas: 2,86%, acima do limite de 1,50%.");
    expect(levelReason({ level: "watch", chargebacks: 1, sales: 100, cb_rate: 1 })).toBe("1 chargeback em 100 vendas pagas: 1,00%, acima de 0,50%.");
    expect(levelReason({ level: "ok", chargebacks: 0, sales: 320, cb_rate: 0 })).toBe("0 chargebacks em 320 vendas pagas: 0,00%.");
    expect(levelReason({ level: "few", chargebacks: 1, sales: 4, cb_rate: 25 })).toBe("1 chargeback em 4 vendas pagas. Com menos de 10 vendas a taxa não diz nada ainda.");
  });

  it("texto do que barrou: dado da blacklist ou nome da regra", () => {
    expect(trailMatch({ block_type: "blacklist", matched_type: "email", matched_value: "a@b.com" })).toBe("E-mail: a@b.com");
    expect(trailMatch({ block_type: "velocity", matched_type: "ip_attempts", matched_value: "x" })).toBe("Regra: Muitas tentativas do mesmo IP");
    expect(trailMatch({ block_type: "velocity", matched_type: null, matched_value: null })).toBe("—");
  });
});

/* ───────── blacklist ───────── */

describe("Blacklist", () => {
  const rows = () => [entry("b1"), entry("b2", { entry_type: "email", entry_value: "fraudador@teste.com", reason: "Fraude confirmada" }), entry("b3", { is_active: false, entry_value: "98765432100", updated_at: "2026-11-22T15:00:00Z" })];

  it("carrega a página ativa, com contagens vindas do servidor", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    expect(last("get_admin_blacklist_page")).toEqual({ _search: null, _type: "all", _status: "active", _page: 1, _page_size: 25 });
    expect(screen.getByRole("button", { name: "Bloqueadas · 5" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Removidas · 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todas · 6" })).toBeTruthy();
  });

  it("busca (com atraso), tipo e situação viram argumentos do servidor", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    fireEvent.change(screen.getByLabelText("Buscar na blacklist"), { target: { value: "fraud" } });
    await waitFor(() => expect(last("get_admin_blacklist_page")?._search).toBe("fraud"));
    fireEvent.change(screen.getByLabelText("Filtrar por tipo"), { target: { value: "email" } });
    await waitFor(() => expect(last("get_admin_blacklist_page")?._type).toBe("email"));
    fireEvent.click(screen.getByRole("button", { name: /Removidas/ }));
    await waitFor(() => expect(last("get_admin_blacklist_page")?._status).toBe("removed"));
  });

  it("erro de carga não vira lista vazia, e 'Tentar de novo' busca de novo", async () => {
    let fail = true;
    handlers.get_admin_blacklist_page = () => (fail ? { error: { message: "falhou" } } : { data: blPage(rows()) });
    wrap(<BlacklistPanel />);
    await screen.findByText("Não foi possível carregar a blacklist.");
    expect(screen.queryByText("A blacklist está vazia")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findAllByText("12345678901");
  });

  it("vazio sem filtro convida a agir; vazio com filtro oferece limpar", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage([]) });
    wrap(<BlacklistPanel />);
    await screen.findByText("A blacklist está vazia");
    fireEvent.change(screen.getByLabelText("Buscar na blacklist"), { target: { value: "zzz" } });
    await screen.findByText("Nada por aqui");
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    await screen.findByText("A blacklist está vazia");
    expect((screen.getByLabelText("Buscar na blacklist") as HTMLInputElement).value).toBe("");
  });

  it("remover: motivo, senha de novo e só então a RPC", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    handlers.admin_blacklist_remove = () => ({ data: null });
    askReason.mockResolvedValue("Bloqueio errado");
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Remover 12345678901 da blacklist" }));
    await waitFor(() => expect(last("admin_blacklist_remove")).toEqual({ _id: "b1", _reason: "Bloqueio errado" }));
    expect(askReason.mock.calls[0][0].description).toContain("CPF 12345678901");
    expect(confirmSpy).toHaveBeenCalledWith("Remover CPF 12345678901 da blacklist.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Removido da blacklist."));
  });

  it("remover: cancelar o motivo não chama nada", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    askReason.mockResolvedValue(null);
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Remover 12345678901 da blacklist" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_blacklist_remove")).toHaveLength(0);
  });

  it("remover: falha do servidor avisa que continua bloqueado", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    handlers.admin_blacklist_remove = () => ({ error: { message: "Essa entrada já foi removida." } });
    askReason.mockResolvedValue("Teste");
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Remover 12345678901 da blacklist" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível remover. A entrada continua bloqueada.", { description: "Essa entrada já foi removida." }));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("'Bloquear de novo' abre o formulário já preenchido", async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage(rows()) });
    wrap(<BlacklistPanel />);
    await screen.findAllByText("98765432100");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Bloquear 98765432100 de novo" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByLabelText("Valor") as HTMLInputElement).value).toBe("98765432100");
  });
});

describe("Bloquear um dado", () => {
  const open = async () => {
    handlers.get_admin_blacklist_page = () => ({ data: blPage([entry("b1")]) });
    wrap(<BlacklistPanel />);
    await screen.findAllByText("12345678901");
    fireEvent.click(screen.getByRole("button", { name: /Bloquear um dado/ }));
    return screen.findByRole("dialog");
  };
  const fill = (dlg: HTMLElement, value: string, reason: string) => {
    fireEvent.change(within(dlg).getByLabelText("Valor"), { target: { value } });
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: reason } });
  };

  it("não envia vazio nem CPF curto: mostra o problema no campo certo", async () => {
    const dlg = await open();
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    expect(await within(dlg).findByText("Informe o valor que será bloqueado.")).toBeTruthy();
    fill(dlg, "123", "");
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    expect(await within(dlg).findByText("O CPF precisa ter 11 dígitos.")).toBeTruthy();
    fill(dlg, "123.456.789-01", "ab");
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    expect(await within(dlg).findByText("Explique o motivo (mínimo 3 caracteres).")).toBeTruthy();
    expect(calls("admin_blacklist_add")).toHaveLength(0);
  });

  it("envia tipo, valor e motivo; fecha, avisa e registra a ação", async () => {
    handlers.admin_blacklist_add = () => ({ data: { entry_value: "12345678901", reactivated: false } });
    const dlg = await open();
    fill(dlg, "123.456.789-01", "Fraude confirmada");
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    await waitFor(() => expect(last("admin_blacklist_add")).toEqual({ _type: "cpf", _value: "123.456.789-01", _reason: "Fraude confirmada" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("CPF adicionado à blacklist."));
    expect(logAdminAction).toHaveBeenCalledWith("add_blacklist_ui", "global_blacklist", "12345678901", { entry_type: "cpf" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("dado que estava removido volta a ser bloqueado e o aviso diz isso", async () => {
    handlers.admin_blacklist_add = () => ({ data: { entry_value: "12345678901", reactivated: true } });
    const dlg = await open();
    fill(dlg, "12345678901", "Voltou a fraudar");
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("CPF bloqueado de novo."));
  });

  it("erro do servidor fica dentro do formulário e nada fecha", async () => {
    handlers.admin_blacklist_add = () => ({ error: { message: "Esse valor já está na blacklist." } });
    const dlg = await open();
    fill(dlg, "12345678901", "Duplicado");
    fireEvent.click(within(dlg).getByRole("button", { name: "Bloquear" }));
    expect(await within(dlg).findByText("Esse valor já está na blacklist.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("trocar o tipo troca o exemplo e a dica", async () => {
    const dlg = await open();
    fireEvent.click(within(dlg).getByRole("radio", { name: /^E-mail/ }));
    expect(within(dlg).getByPlaceholderText("pessoa@exemplo.com")).toBeTruthy();
    expect(within(dlg).getByText(/Maiúsculas e minúsculas/)).toBeTruthy();
  });
});

/* ───────── radar ───────── */

function RadarHarness() {
  const [days, setDays] = useState<RadarWindow>(90);
  return <RadarPanel days={days} onDays={setDays} />;
}

describe("Radar de chargeback", () => {
  const sellers = () => [seller("s1"), seller("s2", { full_name: "Loja do Caio", email: "caio@exemplo.com", frozen: true }), seller("s4", { full_name: "Rafael Souza", email: "rafael@exemplo.com", level: "ok", chargebacks: 0, cb_rate: 0, sales: 320 })];

  it("pede a janela e a faixa ao servidor e explica cada situação em frase", async () => {
    handlers.get_admin_chargeback_radar = () => ({ data: radarPage(sellers()) });
    wrap(<RadarHarness />);
    await screen.findAllByText("Marina Duarte");
    expect(last("get_admin_chargeback_radar")).toEqual({ _days: 90, _level: "all", _search: null, _page: 1, _page_size: 25 });
    expect(screen.getAllByText("4 chargebacks em 140 vendas pagas: 2,86%, acima do limite de 1,50%.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Em risco · 2" })).toBeTruthy();
    expect(screen.getByText(/754 vendas pagas, 9 chargebacks/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    await waitFor(() => expect(last("get_admin_chargeback_radar")?._days).toBe(30));
    fireEvent.click(screen.getByRole("button", { name: /Em risco/ }));
    await waitFor(() => expect(last("get_admin_chargeback_radar")?._level).toBe("high"));
  });

  it("só oferece congelar a quem está em risco e ainda não está congelado", async () => {
    handlers.get_admin_chargeback_radar = () => ({ data: radarPage(sellers()) });
    wrap(<RadarHarness />);
    await screen.findAllByText("Marina Duarte");
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Congelar o saldo de Marina Duarte" })).toBeTruthy();
    expect(table.queryByRole("button", { name: /Congelar o saldo de Loja do Caio/ })).toBeNull();
    expect(table.queryByRole("button", { name: /Congelar o saldo de Rafael/ })).toBeNull();
    expect(table.getByText("Saldo congelado")).toBeTruthy();
  });

  it("congelar: motivo escrito pelo admin vai para o servidor e para o histórico", async () => {
    handlers.get_admin_chargeback_radar = () => ({ data: radarPage(sellers()) });
    handlers.admin_freeze_account = () => ({ data: null });
    askReason.mockResolvedValue("Taxa de chargeback acima do limite");
    wrap(<RadarHarness />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Congelar o saldo de Marina Duarte" }));
    await waitFor(() => expect(last("admin_freeze_account")).toEqual({ _user_id: "s1", _freeze: true, _reason: "Taxa de chargeback acima do limite" }));
    expect(askReason.mock.calls[0][0].description).toContain("O seller recebe este motivo");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saldo congelado. O seller foi avisado."));
    expect(logAdminAction).toHaveBeenCalledWith("freeze_from_radar", "profile", "s1", { reason: "Taxa de chargeback acima do limite", chargeback_rate: 2.86 });
  });

  it("congelar: sem motivo não faz nada; falha do servidor avisa que o saldo não mudou", async () => {
    handlers.get_admin_chargeback_radar = () => ({ data: radarPage(sellers()) });
    askReason.mockResolvedValueOnce(null);
    wrap(<RadarHarness />);
    await screen.findAllByText("Marina Duarte");
    const btn = () => within(screen.getByRole("table")).getByRole("button", { name: "Congelar o saldo de Marina Duarte" });
    fireEvent.click(btn());
    await waitFor(() => expect(askReason).toHaveBeenCalledTimes(1));
    expect(calls("admin_freeze_account")).toHaveLength(0);
    handlers.admin_freeze_account = () => ({ error: { message: "Seller não encontrado." } });
    askReason.mockResolvedValueOnce("Motivo válido");
    fireEvent.click(btn());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível congelar. O saldo não mudou.", { description: "Seller não encontrado." }));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro de carga e estado vazio têm texto próprio", async () => {
    handlers.get_admin_chargeback_radar = () => ({ error: { message: "falhou" } });
    wrap(<RadarHarness />);
    await screen.findByText("Não foi possível carregar o radar.");
    expect(screen.queryByText("Ainda não há vendas pagas")).toBeNull();
  });

  it("sem vendas no período explica por que está vazio", async () => {
    handlers.get_admin_chargeback_radar = () => ({ data: { items: [], total: 0, summary: { ...radarSummary, sellers: 0, sales: 0 } } });
    wrap(<RadarHarness />);
    await screen.findByText("Ainda não há vendas pagas");
    expect(screen.getByText(/Nenhum seller teve venda paga nos últimos 90 dias/)).toBeTruthy();
  });
});

/* ───────── velocidade ───────── */

describe("Regras de velocidade", () => {
  const rules = () => [rule(), rule({ id: "v2", rule_type: "email_high_value", is_enabled: false, max_attempts: 3, time_window_minutes: 1440, threshold_amount: 500, action: "flag" })];
  const card = (title: string) => within(screen.getByRole("heading", { name: title }).closest("section") as HTMLElement);

  it("mostra cada regra em frase e só pede valor mínimo na regra de e-mail", async () => {
    state.velocity_rules = { data: rules() };
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Cartões recusados em sequência" });
    expect(screen.getByText("Barra a compra quando o mesmo IP ou e-mail já tem 5 recusas de cartão nos últimos 10 minutos.")).toBeTruthy();
    expect(screen.getAllByLabelText("Valor mínimo por compra (R$)")).toHaveLength(1);
    expect(card("Muitas compras do mesmo e-mail").getByText("Desligada")).toBeTruthy();
  });

  it("salvar fica desligado até mudar algo e 'Descartar' volta ao valor salvo", async () => {
    state.velocity_rules = { data: rules() };
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Cartões recusados em sequência" });
    const c = card("Cartões recusados em sequência");
    expect((c.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(c.getByLabelText("Tentativas permitidas"), { target: { value: "9" } });
    expect((c.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(c.getByRole("button", { name: "Descartar" }));
    expect((c.getByLabelText("Tentativas permitidas") as HTMLInputElement).value).toBe("5");
  });

  it("valor inválido mostra o erro e não pede a senha", async () => {
    state.velocity_rules = { data: rules() };
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Cartões recusados em sequência" });
    const c = card("Cartões recusados em sequência");
    fireEvent.change(c.getByLabelText("Tentativas permitidas"), { target: { value: "0" } });
    fireEvent.click(c.getByRole("button", { name: "Salvar alterações" }));
    expect((await c.findByRole("alert")).textContent).toContain("entre 1 e 1000");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_update_velocity_rule")).toHaveLength(0);
  });

  it("salvar pede a senha com a frase do que vai mudar e manda tudo ao servidor", async () => {
    state.velocity_rules = { data: rules() };
    handlers.admin_update_velocity_rule = () => ({ data: {} });
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Cartões recusados em sequência" });
    const c = card("Cartões recusados em sequência");
    fireEvent.change(c.getByLabelText("Tentativas permitidas"), { target: { value: "7" } });
    fireEvent.click(c.getByRole("radio", { name: /Só registrar/ }));
    fireEvent.click(c.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(last("admin_update_velocity_rule")).toEqual({ _id: "v1", _enabled: true, _max_attempts: 7, _window_minutes: 10, _threshold: null, _action: "flag" }));
    expect(confirmSpy.mock.calls[0][0]).toContain("Cartões recusados em sequência: ligada.");
    expect(confirmSpy.mock.calls[0][0]).toContain("Só registra na trilha, sem barrar, quando o mesmo IP ou e-mail já tem 7 recusas de cartão nos últimos 10 minutos.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Regra salva e ligada."));
    expect(logAdminAction).toHaveBeenCalledWith("update_velocity_rule_ui", "velocity_rules", "v1", { rule_type: "ip_card_fail" });
  });

  it("ligar a regra de e-mail manda o valor mínimo em número", async () => {
    state.velocity_rules = { data: rules() };
    handlers.admin_update_velocity_rule = () => ({ data: {} });
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Muitas compras do mesmo e-mail" });
    const c = card("Muitas compras do mesmo e-mail");
    fireEvent.click(c.getByRole("switch"));
    fireEvent.change(c.getByLabelText("Valor mínimo por compra (R$)"), { target: { value: "250,5" } });
    fireEvent.click(c.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(last("admin_update_velocity_rule")).toEqual({ _id: "v2", _enabled: true, _max_attempts: 3, _window_minutes: 1440, _threshold: 250.5, _action: "flag" }));
  });

  it("falha ao salvar avisa que a regra continua como estava", async () => {
    state.velocity_rules = { data: rules() };
    handlers.admin_update_velocity_rule = () => ({ error: { message: "Regra não encontrada." } });
    wrap(<VelocityPanel />);
    await screen.findByRole("heading", { name: "Cartões recusados em sequência" });
    const c = card("Cartões recusados em sequência");
    fireEvent.click(c.getByRole("switch"));
    fireEvent.click(c.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar. A regra continua como estava.", { description: "Regra não encontrada." }));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro de carga não vira 'nenhuma regra'", async () => {
    state.velocity_rules = { error: { message: "falhou" } };
    wrap(<VelocityPanel />);
    await screen.findByText("Não foi possível carregar as regras.");
    expect(screen.queryByText("Nenhuma regra cadastrada")).toBeNull();
  });
});

/* ───────── trilha ───────── */

describe("Trilha de bloqueios", () => {
  const rows = () => [trailRow("f1"), trailRow("f2", { block_type: "velocity", block_reason: "Muitas tentativas: 5 em 10 min (limite: 5)", matched_type: "ip_card_fail", matched_value: "Bloquear IP", customer_document: null, outcome: "flagged" })];

  it("lista com documento mascarado, resultado e contagens; 'Manuais' só aparece se houver", async () => {
    handlers.get_admin_fraud_trail = () => ({ data: trailPage(rows()) });
    wrap(<TrailPanel />);
    const table = await screen.findByRole("table");
    expect(last("get_admin_fraud_trail")).toEqual({ _search: null, _type: "all", _page: 1, _page_size: 25 });
    expect(within(table).getByText(/\*\*\*8901/)).toBeTruthy();
    expect(within(table).getByText("Barrada")).toBeTruthy();
    expect(within(table).getByText("Só registrada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Blacklist · 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Velocidade · 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Manuais/ })).toBeNull();
  });

  it("filtro e busca vão para o servidor", async () => {
    handlers.get_admin_fraud_trail = () => ({ data: trailPage(rows()) });
    wrap(<TrailPanel />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /^Velocidade/ }));
    await waitFor(() => expect(last("get_admin_fraud_trail")?._type).toBe("velocity"));
    fireEvent.change(screen.getByLabelText("Buscar na trilha"), { target: { value: "189.12" } });
    await waitFor(() => expect(last("get_admin_fraud_trail")?._search).toBe("189.12"));
  });

  it("vazio explica quando os bloqueios começam; erro não vira vazio", async () => {
    handlers.get_admin_fraud_trail = () => ({ data: trailPage([], { ...trailSummary, all: 0 }) });
    const first = wrap(<TrailPanel />);
    await screen.findByText("Nenhum bloqueio registrado");
    first.unmount();
    handlers.get_admin_fraud_trail = () => ({ error: { message: "falhou" } });
    wrap(<TrailPanel />);
    await screen.findByText("Não foi possível carregar a trilha.");
    expect(screen.queryByText("Nenhum bloqueio registrado")).toBeNull();
  });
});

/* ───────── achados de segurança ───────── */

describe("Achados de segurança", () => {
  it("erro de carga não aparece como 'nenhum achado'", async () => {
    state.security_findings = { error: { message: "falhou" } };
    wrap(<SecurityFindingsPanel />);
    await screen.findByText("Não foi possível carregar os achados.");
    expect(screen.queryByText("Nenhum achado registrado")).toBeNull();
  });

  it("mostra origem, risco, conclusão da IA e recomendações em ordem", async () => {
    state.security_findings = { data: [finding("sf1"), finding("sf2", { status: "failed", risk_level: null, ai_summary: null, ai_recommendations: [], error_message: "Créditos de IA esgotados." }), finding("sf3", { status: "resolved", resolved_at: "2026-11-21T12:00:00Z" })] };
    wrap(<SecurityFindingsPanel />);
    await screen.findAllByText("Bucket de capas aceita .svg");
    expect(screen.getAllByText("Armazenamento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Risco alto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bloquear .svg").length).toBeGreaterThan(0);
    expect(screen.getByText("Créditos de IA esgotados.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analisar de novo" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Resolver/ })).toHaveLength(2); // o resolvido não tem ações
  });

  it("resolver: só marca depois de confirmar", async () => {
    state.security_findings = { data: [finding("sf1")] };
    askConfirm.mockResolvedValueOnce(false);
    wrap(<SecurityFindingsPanel />);
    await screen.findByText("Bucket de capas aceita .svg");
    fireEvent.click(screen.getByRole("button", { name: /Resolver/ }));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(writes).toHaveLength(0);
    askConfirm.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: /Resolver/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ table: "security_findings", op: "update", eq: [["id", "sf1"]] });
    expect((writes[0].payload as { status: string }).status).toBe("resolved");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Achado marcado como resolvido."));
  });

  it("analisar: chama a função com o id; análise que falha mostra o motivo", async () => {
    state.security_findings = { data: [finding("sf1")] };
    invoke.mockResolvedValueOnce({ data: { success: false, error: "Créditos de IA esgotados." }, error: null });
    wrap(<SecurityFindingsPanel />);
    await screen.findByText("Bucket de capas aceita .svg");
    fireEvent.click(screen.getByRole("button", { name: "Reanalisar" }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("analyze-security-finding", { body: { findingId: "sf1" } }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A análise não foi concluída.", { description: "Créditos de IA esgotados." }));
  });

  it("registrar: exige título e descrição, grava com o admin como autor e já analisa", async () => {
    state.security_findings = { data: [] };
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    wrap(<SecurityFindingsPanel />);
    await screen.findByText("Nenhum achado registrado");
    fireEvent.click(screen.getByRole("button", { name: /Registrar achado/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: /Registrar e analisar/ }));
    expect(await within(dlg).findByText("Dê um título com pelo menos 3 caracteres.")).toBeTruthy();
    expect(within(dlg).getByText("Descreva o problema com pelo menos 10 caracteres.")).toBeTruthy();
    expect(writes).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Leitura pública excessiva" } });
    fireEvent.change(within(dlg).getByLabelText("O que acontece"), { target: { value: "A view lista produtos pausados." } });
    fireEvent.click(within(dlg).getByRole("button", { name: /Registrar e analisar/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ table: "security_findings", op: "insert", payload: { created_by: "adm1", source: "database", title: "Leitura pública excessiva", evidence: {} } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("analyze-security-finding", { body: { findingId: "new1" } }));
  });
});

/* ───────── aba ───────── */

describe("Aba Anti-Fraude", () => {
  it("resumo no topo vem do servidor, avisa que o checkout ainda não cobra e abre o radar na janela de 90 dias", async () => {
    handlers.get_admin_antifraud_overview = () => ({ data: overview });
    handlers.get_admin_blacklist_page = () => ({ data: blPage([entry("b1")]) });
    handlers.get_admin_chargeback_radar = () => ({ data: radarPage([seller("s1")]) });
    wrap(<AdminRiskComplianceTab />);
    expect(await screen.findByText("2 sellers em risco")).toBeTruthy();
    expect(screen.getByText("2 de 3")).toBeTruthy();
    expect(screen.getByText("tem regra desligada")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("nenhum adquirente configurado");
    expect(last("get_admin_antifraud_overview")).toEqual({ _days: 90 });
    expect(screen.getByRole("button", { name: "Blacklist · 5" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Radar de chargeback/ }));
    await waitFor(() => expect(last("get_admin_chargeback_radar")?._days).toBe(90));
  });

  it("resumo que falha não finge números: mostra erro, 'Indisponível' e traço", async () => {
    handlers.get_admin_antifraud_overview = () => ({ error: { message: "falhou" } });
    handlers.get_admin_blacklist_page = () => ({ data: blPage([entry("b1")]) });
    wrap(<AdminRiskComplianceTab />);
    await screen.findByText("Não foi possível carregar o resumo.");
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.getAllByText("Indisponível").length).toBe(4);
    expect(screen.queryByText("Nenhum seller em risco")).toBeNull();
  });

  it("sem seller em risco e com todas as regras ligadas o selo fica verde", async () => {
    handlers.get_admin_antifraud_overview = () => ({ data: { ...overview, sellers_high: 0, rules_enabled: 3 } });
    handlers.get_admin_blacklist_page = () => ({ data: blPage([entry("b1")]) });
    wrap(<AdminRiskComplianceTab />);
    expect(await screen.findByText("Nenhum seller em risco")).toBeTruthy();
    expect(screen.getByText("todas ligadas")).toBeTruthy();
  });
});

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
vi.mock("@/components/seller-ui/copy", () => ({ copyText: vi.fn(async () => true) }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import { copyText } from "@/components/seller-ui/copy";
import AuditCenter from "@/features/admin-audit/AuditCenter";
import {
  COLUMNS, DEFAULT_FILTERS, actionLabel, actorName, auditFileName, detailText, entityLabel, fieldLabel, filtersActive, heroStatus, hintText, parseAuditEntry, parseAuditPage,
  entityGroups, periodDays, reportText, targetLine, toAuditCsv, valueText, type AuditItem,
} from "@/features/admin-audit/auditModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const NBSP = String.fromCharCode(160);
const actor = (o: Record<string, unknown> = {}) => ({ id: "a1", name: "Matheus", email: "matheus@exemplo.com", role: "admin", ...o });
const item = (o: Record<string, unknown> = {}) => ({
  id: "i1", source: "admin", at: ago(1), actor: actor(), action: "update_custom_fees", entity_type: "profiles", entity_id: "3f2a9c10-aaaa-bbbb-cccc-0123456789ab",
  entity_label: "Marina Duarte", sensitive: true, hint: { changed: ["pix_percentage", "card_percentage"], changed_n: 2, fields: {} }, ...o,
});
const ITEMS = [
  item(),
  item({ id: "i2", source: "staff", actor: actor({ id: "a2", name: "Bia Lima", email: "bia@exemplo.com", role: "manager" }), action: "update_withdrawals", entity_type: "withdrawals", entity_id: "w1", entity_label: null, sensitive: true, hint: { changed: ["status"], changed_n: 1, fields: {} } }),
  item({ id: "i3", source: "activity", actor: actor({ id: "a3", name: "Loja do Caio", email: "caio@exemplo.com", role: "seller" }), action: "export_sales", entity_type: "transactions", entity_id: null, entity_label: null, sensitive: false, hint: { changed: [], changed_n: 0, fields: { count: 120 } } }),
  item({ id: "i4", actor: { id: null, name: null, email: null, role: "system" }, action: "auto_withdrawal_created", entity_type: "withdrawals", entity_id: null, entity_label: null, sensitive: false, hint: { changed: [], changed_n: 0, fields: {} } }),
];
const PAGE = (o: Record<string, unknown> = {}) => ({
  items: ITEMS, total: 4, page: 1, page_size: 25,
  sources: { all: 4, admin: 2, staff: 1, activity: 1 },
  entities: [{ type: "profiles", n: 1 }, { type: "withdrawals", n: 2 }, { type: "transactions", n: 1 }],
  actors: [{ id: "a1", name: "Matheus", email: "matheus@exemplo.com", role: "admin", n: 1 }, { id: "a2", name: "Bia Lima", email: "bia@exemplo.com", role: "manager", n: 1 }, { id: null, name: null, email: null, role: "system", n: 1 }],
  overview: { today: 2, week: 4, actors_week: 3, sensitive_week: 2, last_at: ago(1), total: 40 },
  ...o,
});
const ENTRY = (o: Record<string, unknown> = {}) => ({
  ...ITEMS[0], user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36", ip: "203.0.113.9",
  detail: {
    fields: { reason: "Ajuste combinado com o vendedor" },
    changes: { pix_percentage: { from: 2.5, to: 2 }, document_number: { from: "[oculto]", to: "[oculto*]" } },
    snapshot: null, snapshot_of: null,
  },
  related: [{ id: "r1", source: "staff", at: ago(30), action: "update_withdrawals", actor_name: "Bia Lima" }],
  ...o,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);
const last = (n: string) => calls(n).at(-1) as Record<string, unknown>;

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); confirmSpy.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.info).mockClear(); vi.mocked(copyText).mockClear();
  handlers.get_admin_audit_page = () => ({ data: PAGE(), error: null });
  handlers.get_admin_audit_entry = () => ({ data: ENTRY(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: {}, error: null }));
});
afterEach(() => { vi.restoreAllMocks(); });

const open = async () => {
  wrap(<AuditCenter />);
  await screen.findByRole("list", { name: "Registros da auditoria" });
};

/* ───────── modelo ───────── */

describe("modelo da auditoria", () => {
  it("rejeita resposta fora do formato e lê os campos com segurança", () => {
    expect(() => parseAuditPage(null)).toThrow();
    expect(() => parseAuditPage({ total: 1 })).toThrow();
    const p = parseAuditPage(PAGE({ items: [{ ...ITEMS[0], source: "estranha", hint: "lixo", actor: null }] }));
    expect(p.items[0].source).toBe("admin");
    expect(p.items[0].actor.role).toBe("seller");
    expect(p.items[0].hint).toEqual({ changed: [], changed_n: 0, fields: {} });
    expect(p.sources).toEqual({ all: 4, admin: 2, staff: 1, activity: 1 });
    expect(p.overview?.sensitive_week).toBe(2);
    expect(() => parseAuditEntry({})).toThrow();
    expect(parseAuditEntry(ENTRY()).related[0].actor_name).toBe("Bia Lima");
  });

  it("traduz a ação em frase e nunca deixa o código cru na lista", () => {
    expect(actionLabel("update_custom_fees")).toBe("Mudou as taxas do vendedor");
    expect(actionLabel("kill_switch_payments_on")).toBe("Pausou os pagamentos");
    expect(actionLabel("kill_switch_withdrawals_off")).toBe("Retomou os saques");
    expect(actionLabel("update", "withdrawals")).toBe("Mudou um registro de saque");
    expect(actionLabel("INSERT", "auto_withdrawal_settings")).toBe("Criou um registro de saque automático");
    expect(actionLabel("delete")).toBe("Apagou um registro");
    expect(actionLabel("alguma_coisa_nova")).toBe("Alguma coisa nova");
    expect(actionLabel("")).toBe("Ação sem nome");
    expect(entityLabel("revenue_race_override")).toBe("Valor fixo da corrida");
    expect(entityLabel("tipo_novo")).toBe("Tipo novo");
  });

  it("mostra quem fez mesmo quando a conta não existe mais", () => {
    expect(actorName({ id: null, name: null, email: null, role: "system" })).toBe("Sistema");
    expect(actorName({ id: "c36ffe8f-1111", name: null, email: null, role: "admin" })).toBe("Conta removida (c36ffe8f)");
    expect(actorName({ id: "x", name: null, email: "a@b.com", role: "admin" })).toBe("a@b.com");
  });

  it("mostra o alvo pelo nome e, sem nome, pelo tipo e o começo do código", () => {
    expect(targetLine({ entity_type: "product", entity_id: "abc", entity_label: "Curso X" })).toEqual({ title: "Curso X", sub: "Produto" });
    expect(targetLine({ entity_type: "withdrawals", entity_id: "3f2a9c10-aaaa-bbbb-cccc-0123456789ab", entity_label: null })).toEqual({ title: "Saque", sub: "#3f2a9c10" });
    expect(targetLine({ entity_type: "export", entity_id: null, entity_label: null }).sub).toBeNull();
    // ids que são palavras do sistema viram texto de gente
    expect(targetLine({ entity_type: "platform_settings", entity_id: "kill_switches", entity_label: null })).toEqual({ title: "Pausas de emergência", sub: "Configurações da plataforma" });
    expect(targetLine({ entity_type: "export", entity_id: "audit", entity_label: null })).toEqual({ title: "Auditoria", sub: "Exportação" });
  });

  it("tipos de alvo com o mesmo nome viram um filtro só, com a lista que o servidor aceita", () => {
    const g = entityGroups([{ type: "withdrawals", n: 2 }, { type: "profiles", n: 3 }, { type: "withdrawal", n: 1 }, { type: "profile", n: 1 }]);
    expect(g).toEqual([{ label: "Vendedor", value: "profiles,profile", n: 4 }, { label: "Saque", value: "withdrawals,withdrawal", n: 3 }]);
    expect(entityGroups([])).toEqual([]);
  });

  it("escreve valores como quem opera: reais, porcentagem, sim/não, situação, oculto e vazio", () => {
    expect(valueText("price", 1234.5)).toBe(`R$${NBSP}1.234,50`);
    expect(valueText("pix_percentage", 2.5)).toBe("2,5%");
    expect(valueText("frozen", true)).toBe("Sim");
    expect(valueText("account_status", "pending_review")).toBe("Em análise");
    expect(valueText("anything", "[oculto*]")).toBe("oculto");
    expect(valueText("notes", null)).toBe("vazio");
    expect(valueText("notes", "")).toBe("vazio");
    expect(valueText("supported_methods", ["pix", "card"])).toBe("Pix, Cartão");
    expect(valueText("title", "x".repeat(300)).length).toBe(241);
    expect(fieldLabel("pix_percentage")).toBe("Pix (%)");
    expect(fieldLabel("campo_novo_qualquer")).toBe("Campo novo qualquer");
  });

  it("resume a mudança numa linha só", () => {
    expect(hintText({ hint: { changed: ["pix_percentage", "card_percentage"], changed_n: 2, fields: {} } })).toBe("Mudou: Pix (%), Cartão (%)");
    expect(hintText({ hint: { changed: ["a", "b", "c"], changed_n: 7, fields: {} } })).toBe("Mudou: A, B, C e mais 4");
    expect(hintText({ hint: { changed: [], changed_n: 0, fields: { reason: "Pedido do vendedor", amount: 10 } } })).toBe("Motivo: Pedido do vendedor");
    expect(hintText({ hint: { changed: [], changed_n: 0, fields: {} } })).toBeNull();
  });

  it("não deixa valor oculto vazar no texto do relatório", () => {
    const text = detailText(parseAuditEntry(ENTRY()).detail);
    expect(text).toContain("Pix (%): 2,5% → 2%");
    expect(text).toContain("Documento: mudou (valor oculto)");
    expect(text).toContain("Motivo: Ajuste combinado com o vendedor");
    const report = reportText(parseAuditEntry(ENTRY()));
    expect(report).toContain("Mudou as taxas do vendedor (update_custom_fees)");
    expect(report).toContain("Quem: Matheus <matheus@exemplo.com> · Administrador");
  });

  it("CSV: separador ;, cabeçalho em português e fórmula neutralizada", () => {
    const rows = parseAuditPage(PAGE({ items: [{ ...ITEMS[0], actor: actor({ name: "=HYPERLINK(\"http://x\")" }), entity_label: "João; Silva", detail: parseAuditEntry(ENTRY()).detail }] })).items;
    const csv = toAuditCsv(rows);
    const [head, line] = csv.split("\r\n");
    expect(head.split(";")).toHaveLength(COLUMNS.length);
    expect(head.startsWith("Data e hora;Origem;Responsável;")).toBe(true);
    expect(line).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(line).toContain("\"João; Silva\"");
    expect(line).toContain(";Sim;");
    expect(auditFileName("30", new Date("2026-11-25T15:00:00Z"))).toBe("auditoria-30-dias-2026-11-25.csv");
    expect(auditFileName("all", new Date("2026-11-25T15:00:00Z"))).toBe("auditoria-completa-2026-11-25.csv");
  });

  it("filtros: o padrão é 30 dias e só conta como filtro o que foge dele", () => {
    expect(periodDays("1")).toBe(1);
    expect(periodDays("all")).toBeNull();
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false);
    expect(filtersActive({ ...DEFAULT_FILTERS, period: "7" })).toBe(true);
    expect(filtersActive({ ...DEFAULT_FILTERS, search: "  " })).toBe(false);
    expect(filtersActive({ ...DEFAULT_FILTERS, sensitive: true })).toBe(true);
  });

  it("status do topo nunca diz que está tudo bem quando não carregou", () => {
    expect(heroStatus(undefined, true).tone).toBe("destructive");
    expect(heroStatus(undefined, false).label).toBe("Carregando…");
    const p = parseAuditPage(PAGE());
    expect(heroStatus(p, false).label).toBe("2 ações hoje");
    expect(heroStatus(parseAuditPage(PAGE({ overview: { ...PAGE().overview, today: 1 } })), false).label).toBe("1 ação hoje");
    expect(heroStatus(parseAuditPage(PAGE({ overview: { ...PAGE().overview, today: 0 } })), false).label).toBe("Nenhuma ação hoje");
  });
});

/* ───────── tela ───────── */

describe("tela da auditoria", () => {
  it("pede o primeiro recorte ao servidor e escreve cada linha em português", async () => {
    await open();
    expect(last("get_admin_audit_page")).toMatchObject({ _source: "all", _days: 30, _actor: null, _entity: null, _search: null, _only_sensitive: false, _page: 1, _page_size: 25 });
    const list = screen.getByRole("list", { name: "Registros da auditoria" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByText("Mudou as taxas do vendedor")).toBeInTheDocument();
    expect(within(list).getByText("Mudou: Pix (%), Cartão (%)")).toBeInTheDocument();
    expect(within(list).getByText("Marina Duarte")).toBeInTheDocument();
    expect(within(list).getByText("w1")).toBeInTheDocument();
    expect(within(list).getByText("Mudou um saque")).toBeInTheDocument();
    expect(within(list).getAllByText("Sistema").length).toBeGreaterThanOrEqual(1);
    expect(within(list).getByText("Exportou vendas")).toBeInTheDocument();
    expect(within(list).queryByText("update_custom_fees")).toBeNull();
    // o topo conta o que o servidor mandou
    expect(screen.getByText("2 ações hoje")).toBeInTheDocument();
    expect(screen.getByText("Ações sensíveis")).toBeInTheDocument();
    expect(screen.getByText("agiram nos últimos 7 dias")).toBeInTheDocument();
  });

  it("origem, período, sensíveis, responsável e alvo viram argumentos do servidor e voltam à primeira página", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Equipe · 1" }));
    await waitFor(() => expect(last("get_admin_audit_page")._source).toBe("staff"));
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(last("get_admin_audit_page")._days).toBe(7));
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    await waitFor(() => expect(last("get_admin_audit_page")._days).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Só sensíveis" }));
    await waitFor(() => expect(last("get_admin_audit_page")._only_sensitive).toBe(true));
    fireEvent.change(screen.getByLabelText("Filtrar por responsável"), { target: { value: "a2" } });
    await waitFor(() => expect(last("get_admin_audit_page")._actor).toBe("a2"));
    fireEvent.click(screen.getByRole("button", { name: "Saque · 2" }));
    await waitFor(() => expect(last("get_admin_audit_page")._entity).toBe("withdrawals"));
    expect(last("get_admin_audit_page")._page).toBe(1);
    // quem não tem conta (sistema) não vira opção de filtro
    expect(within(screen.getByLabelText("Filtrar por responsável")).queryByText(/Sistema/)).toBeNull();
  });

  it("a busca espera o fim da digitação, tira os espaços e não dispara uma chamada por tecla", async () => {
    await open();
    const before = calls("get_admin_audit_page").length;
    const box = screen.getByLabelText("Buscar na auditoria");
    fireEvent.change(box, { target: { value: "m" } });
    fireEvent.change(box, { target: { value: "  marina " } });
    await waitFor(() => expect(last("get_admin_audit_page")._search).toBe("marina"));
    expect(calls("get_admin_audit_page").length - before).toBe(1);
  });

  it("filtro sem resultado explica e limpa; recorte padrão vazio oferece ver tudo", async () => {
    await open();
    handlers.get_admin_audit_page = () => ({ data: PAGE({ items: [], total: 0, sources: { all: 0, admin: 0, staff: 0, activity: 0 } }), error: null });
    fireEvent.click(screen.getByRole("button", { name: "Só sensíveis" }));
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
    handlers.get_admin_audit_page = () => ({ data: PAGE(), error: null });
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" }).at(-1) as HTMLElement);
    await waitFor(() => expect(last("get_admin_audit_page")._only_sensitive).toBe(false));
    expect(await screen.findByText("Mudou as taxas do vendedor")).toBeInTheDocument();
  });

  it("sem nenhum registro no sistema diz isso, sem inventar atividade", async () => {
    handlers.get_admin_audit_page = () => ({ data: PAGE({ items: [], total: 0, overview: { today: 0, week: 0, actors_week: 0, sensitive_week: 0, last_at: null, total: 0 } }), error: null });
    wrap(<AuditCenter />);
    expect(await screen.findByText("Nenhuma ação registrada ainda")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma ação registrada")).toBeInTheDocument();
  });

  it("falha do servidor mostra o erro com nova tentativa e nunca um vazio falso", async () => {
    handlers.get_admin_audit_page = () => ({ data: null, error: { message: "boom" } });
    wrap(<AuditCenter />);
    expect(await screen.findByText("Não foi possível carregar a auditoria.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma ação registrada ainda")).toBeNull();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    handlers.get_admin_audit_page = () => ({ data: PAGE(), error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Mudou as taxas do vendedor")).toBeInTheDocument();
  });

  it("quem não é administrador não chama nada", async () => {
    wrap(<AuditCenter isAdmin={false} />);
    expect(screen.getByText("A auditoria é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("ficha do registro", () => {
  it("abre pelo clique, mostra antes e depois, esconde valores ocultos e leva a outras ações do mesmo alvo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes: Mudou as taxas do vendedor, Matheus/ }));
    const dialog = await screen.findByRole("dialog");
    expect(calls("get_admin_audit_entry")[0]).toEqual({ _source: "admin", _id: "i1" });
    expect(await within(dialog).findByText("Ação sensível: mexe com dinheiro, acesso ou dados pessoais de alguém.")).toBeInTheDocument();
    expect(within(dialog).getByText("Pix (%)")).toBeInTheDocument();
    expect(within(dialog).getByText("2,5%")).toBeInTheDocument();
    expect(within(dialog).getByText("2%")).toBeInTheDocument();
    expect(within(dialog).getByText("Mudou, mas o valor não é mostrado aqui.")).toBeInTheDocument();
    expect(within(dialog).queryByText("[oculto]")).toBeNull();
    expect(within(dialog).getByText("203.0.113.9")).toBeInTheDocument();
    expect(within(dialog).getByText("Chrome no Windows")).toBeInTheDocument();
    expect(within(dialog).getByText("Ajuste combinado com o vendedor")).toBeInTheDocument();
    expect(within(dialog).getByText("update_custom_fees")).toBeInTheDocument();

    // outra ação no mesmo alvo abre a ficha dela
    handlers.get_admin_audit_entry = (a) => ({ data: ENTRY({ id: a._id, source: a._source, action: "update_withdrawals", sensitive: false, detail: { fields: null, changes: {}, snapshot: null, snapshot_of: null }, related: [] }), error: null });
    fireEvent.click(within(dialog).getByRole("button", { name: /Mudou um saque/ }));
    await waitFor(() => expect(calls("get_admin_audit_entry").at(-1)).toEqual({ _source: "staff", _id: "r1" }));
    expect(await screen.findByText("Nenhum campo relevante mudou.")).toBeInTheDocument();
  });

  it("copia um relatório sem segredos", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes: Mudou as taxas do vendedor/ }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("203.0.113.9");
    fireEvent.click(within(dialog).getByRole("button", { name: /Copiar relatório/ }));
    await waitFor(() => expect(copyText).toHaveBeenCalled());
    const text = vi.mocked(copyText).mock.calls[0][0];
    expect(text).toContain("Mudou as taxas do vendedor (update_custom_fees)");
    expect(text).toContain("Documento: mudou (valor oculto)");
    expect(text).not.toContain("[oculto");
  });

  it("falha ao abrir mostra o erro dentro da ficha, mantendo o título da lista", async () => {
    await open();
    handlers.get_admin_audit_entry = () => ({ data: null, error: { message: "Registro não encontrado." } });
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes: Mudou as taxas do vendedor/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(within(dialog).getByText("Mudou as taxas do vendedor")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copiar relatório" })).toBeDisabled();
  });

  it("registro de snapshot explica de que momento é", () => {
    const e = parseAuditEntry(ENTRY({ detail: { fields: null, changes: null, snapshot: { full_name: "Marina", account_status: "approved" }, snapshot_of: "before" } }));
    expect(e.detail?.snapshot_of).toBe("before");
    expect(detailText(e.detail)).toContain("Nome: Marina");
    expect(detailText(e.detail)).toContain("Situação da conta: Aprovado");
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
const exportItem = (o: Record<string, unknown>) => ({ ...ITEMS[0], detail: parseAuditEntry(ENTRY()).detail, ip: "203.0.113.9", ...o });

describe("exportação da auditoria", () => {
  it("pede a senha, junta as páginas do mesmo recorte congelado e baixa um CSV seguro", async () => {
    const dl = captureDownloads();
    await open();
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(last("get_admin_audit_page")._days).toBe(7));
    handlers.get_admin_audit_page = (a) => {
      if (!a._export) return { data: PAGE({ total: 3 }), error: null };
      return { data: PAGE({ total: 3, items: a._page === 1 ? [exportItem({ id: "e1", actor: actor({ name: "=HYPERLINK(\"http://x\")" }) }), exportItem({ id: "e2" })] : [exportItem({ id: "e3", entity_label: "João; Silva" })] }), error: null };
    };
    await waitFor(() => expect(screen.getByRole("button", { name: /Exportar CSV/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain("fica registrada nesta auditoria");
    await waitFor(() => expect(dl.blobs).toHaveLength(1));
    const exp = calls("get_admin_audit_page").filter((a) => a._export === true);
    expect(exp.map((a) => a._page)).toEqual([1, 2]);
    expect(exp.every((a) => a._page_size === 1000 && a._days === 7 && a._source === "all")).toBe(true);
    expect(new Set(exp.map((a) => a._until)).size).toBe(1);
    expect(typeof exp[0]._until).toBe("string");
    const { text, bytes } = await readBlob(dl.blobs[0]);
    expect(bytes).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(lines[3]).toContain("\"João; Silva\"");
    expect(text).not.toContain("[oculto");
    expect(dl.names[0]).toMatch(/^auditoria-7-dias-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("3 registros exportados.");
    await waitFor(() => expect(screen.getByRole("button", { name: /Exportar CSV/ })).not.toBeDisabled());
  });

  it("recorte grande demais não baixa nada e diz o que fazer", async () => {
    const dl = captureDownloads();
    await open();
    handlers.get_admin_audit_page = (a) => ({ data: a._export ? PAGE({ total: 20001, items: [exportItem({ id: "e1" })] }) : PAGE({ total: 20001 }), error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: /Exportar CSV/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("20.001 registros");
    expect(alert).toHaveTextContent("Escolha um período menor");
    expect(dl.blobs).toHaveLength(0);
    expect(calls("get_admin_audit_page").filter((a) => a._export === true)).toHaveLength(1);
  });

  it("senha vencida no servidor aparece como erro honesto e nenhum arquivo sai", async () => {
    const dl = captureDownloads();
    await open();
    handlers.get_admin_audit_page = (a) => (a._export ? { data: null, error: { message: "reautenticação necessária: confirme sua senha" } } : { data: PAGE(), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.length).toBeGreaterThan(10);
    expect(dl.blobs).toHaveLength(0);
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
  });

  it("sem registros no recorte o botão fica desligado", async () => {
    handlers.get_admin_audit_page = () => ({ data: PAGE({ items: [], total: 0 }), error: null });
    wrap(<AuditCenter />);
    await screen.findByText("Nenhuma ação nos últimos 30 dias");
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("tipos auxiliares", () => {
  it("item da lista mantém a origem para abrir a ficha certa", () => {
    const rows: AuditItem[] = parseAuditPage(PAGE()).items;
    expect(rows.map((r) => r.source)).toEqual(["admin", "staff", "activity", "admin"]);
  });
});

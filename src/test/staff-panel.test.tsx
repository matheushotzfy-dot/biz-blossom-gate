import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const inserts: { table: string; row: Record<string, unknown> }[] = [];
const tableRows: Record<string, unknown[]> = {};
let insertError: unknown = null;

vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    const done = () => Promise.resolve({ data: tableRows[table] ?? [], error: null });
    for (const m of ["select", "eq", "order", "gte", "lte", "in"]) q[m] = () => q;
    q.limit = () => done();
    q.then = (res: (v: unknown) => unknown) => done().then(res);
    q.insert = (row: Record<string, unknown>) => { inserts.push({ table, row }); return Promise.resolve({ data: null, error: insertError }); };
    return q;
  };
  return {
    supabase: {
      rpc: (...a: unknown[]) => rpc(...a), from, channel: () => ch, removeChannel: vi.fn(),
      auth: { signOut: vi.fn(async () => ({})), getUser: async () => ({ data: { user: { id: "me" } } }) },
      storage: { from: () => ({ createSignedUrls: async (p: string[]) => ({ data: p.map((x) => ({ path: x, signedUrl: `https://s/${x}` })), error: null }) }) },
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "me" }, loading: false }) }));
vi.mock("@/hooks/useIdleLogout", () => ({ useIdleLogout: vi.fn() }));
vi.mock("@/hooks/useSellerSkin", () => ({ useSellerSkin: vi.fn() }));
vi.mock("@/hooks/useMinWidth", () => ({ useMinWidth: () => true }));
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/features/admin-support/SupportCenter", () => ({ default: () => <p>Central de suporte</p> }));
vi.mock("@/features/admin-finance/FinancialMetricsPanel", () => ({ FinancialMetricsPanel: () => null }));

import { toast } from "sonner";
import StaffPanel, { sectionsFor } from "@/features/staff-panel/StaffPanel";
import { StaffRequestForm } from "@/features/staff/StaffRequestForm";
import { STAFF_PERMISSIONS } from "@/features/staff/staffPolicy";
import {
  availableForPayout, checkFees, checkPayout, parsePortfolio, parseSellerDetail, staffError,
} from "@/features/staff-panel/staffPanelModel";

/* ───────── dados ───────── */

const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";
const ALL = ["approve_kyc", "edit_fees", "edit_seller_notes", "freeze_seller_withdrawals", "reject_kyc", "view_disputes", "view_sellers", "view_support", "view_transactions", "view_withdrawals"];
const portfolio = (over: Record<string, unknown> = {}) => ({
  role: "manager", permissions: ALL, commission_pct: 4,
  fee_limits: { min_transaction_percentage: 2, min_transaction_fixed: 1, min_withdrawal_fee: 3 },
  metrics: { seller_count: 2, kyc_pending: 1, sales_count: 10, volume: 1970, ticket_average: 197, refunds: 1, chargebacks: 0, medpix: 0, commission_generated: 50, commission_reversed: 0, commission_balance: 300 },
  kyc_queue: [{ user_id: S2, full_name: "Juliana Prado", email: "ju@x.com", submitted_at: new Date(Date.now() - 3 * 36e5).toISOString() }],
  sellers: [
    { seller_user_id: S1, full_name: "Marina Duarte", email: "marina@x.com", account_status: "approved", started_at: "2026-09-10T12:00:00Z", sales_count: 10, volume: 1970, net_volume: 1800 },
    { seller_user_id: S2, full_name: "Juliana Prado", email: "ju@x.com", account_status: "pending_review", started_at: "2026-11-20T12:00:00Z", sales_count: 0, volume: 0, net_volume: 0 },
  ],
  total_sellers: 2, page: 1, page_size: 25, ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  seller: { user_id: S1, full_name: "Marina Duarte", email: "marina@x.com", phone: "44999990001", document_type: "cpf", document_masked: "321.***.***-09", account_status: "approved", created_at: "2026-08-20T10:00:00Z", last_login_at: "2026-11-25T10:00:00Z", balance_frozen: false },
  assigned_at: "2026-09-10T12:00:00Z",
  stats: { sales_count: 10, volume: 1970, net_volume: 1800, attempts: 14, last_sale_at: "2026-11-25T10:00:00Z" },
  fees: { transaction_percentage: 4.99, transaction_fixed: 1, withdrawal_fee: 5, updated_at: null, by_me: false },
  withdrawal_block: { active: false },
  withdrawals: [{ id: "w1", amount: 300, status: "pending", created_at: "2026-11-25T10:00:00Z" }],
  disputes: [{ id: "d1", type: "medpix", status: "open", amount: 197, created_at: "2026-11-24T10:00:00Z", response_deadline: null }],
  notes: [{ id: "n1", content: "Ligar na sexta", created_at: "2026-11-24T10:00:00Z", mine: true, author: "Eu" }],
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function show(path = "/gerentes/dashboard") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><StaffPanel /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); inserts.length = 0; insertError = null;
  for (const k of Object.keys(handlers)) delete handlers[k];
  for (const k of Object.keys(tableRows)) delete tableRows[k];
  vi.mocked(toast.success).mockClear(); vi.mocked(toast.error).mockClear();
  handlers.get_staff_portfolio_dashboard = () => ({ data: portfolio(), error: null });
  handlers.get_staff_seller_detail = () => ({ data: detail(), error: null });
  handlers.get_staff_portfolio_transactions = () => ({ data: { rows: [{ id: "t1", amount: 197, status: "approved", payment_method: "pix", customer_name: "Ana", created_at: new Date().toISOString(), seller_name: "Marina Duarte" }], total: 1, page: 1, page_size: 25 }, error: null });
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => Promise.resolve(handlers[name]?.(args ?? {}) ?? { data: null, error: null }));
});

/* ───────── regras ───────── */

describe("modelo do painel da equipe", () => {
  it("lê a carteira e liga as permissões às ações", () => {
    const p = parsePortfolio(portfolio({ permissions: ["view_transactions", "respond_support"], role: "employee" }));
    expect(p.role).toBe("employee");
    expect(p.flags).toMatchObject({ viewTransactions: true, viewSupport: true, respondSupport: true, editFees: false });
    expect(p.sellers[0]).toMatchObject({ id: S1, name: "Marina Duarte", sales: 10, volume: 1970 });
    expect(p.kycQueue[0].id).toBe(S2);
    expect(parsePortfolio(null)).toMatchObject({ role: "employee", sellers: [], total: 0, feeLimits: null });
  });

  it("blocos sem permissão chegam vazios", () => {
    const d = parseSellerDetail(detail({ fees: null, withdrawal_block: null, withdrawals: null, disputes: null, notes: null }));
    expect([d.fees, d.withdrawalBlock, d.withdrawals, d.disputes, d.notes]).toEqual([null, null, null, null, null]);
    expect(parseSellerDetail({}).seller.name).toBe("Sem nome");
  });

  it("menu conforme papel e permissões", () => {
    const ids = (role: "manager" | "employee", perms: string[]) => sectionsFor(parsePortfolio(portfolio({ role, permissions: perms }))).map((s) => s.id);
    expect(ids("manager", ALL)).toEqual(["carteira", "sellers", "vendas", "suporte", "comissao", "pedidos"]);
    expect(ids("employee", [])).toEqual(["carteira", "sellers"]);
    expect(ids("employee", ["respond_support"])).toEqual(["carteira", "sellers", "suporte"]);
  });

  it("taxas: formato, piso do dono e sem piso definido", () => {
    const lim = { pct: 2, fixed: 1, withdrawal: 3 };
    expect(checkFees({ pct: "4,99", fixed: "1,00", withdrawal: "5" }, lim).values).toEqual({ pct: 4.99, fixed: 1, withdrawal: 5 });
    const low = checkFees({ pct: "1,5", fixed: "0,50", withdrawal: "2,99" }, lim);
    expect(low.values).toBeNull();
    expect(low.errors).toEqual({ pct: "O mínimo para você é 2%.", fixed: expect.stringMatching(/R\$\s1,00/), withdrawal: expect.stringMatching(/R\$\s3,00/) });
    expect(checkFees({ pct: "abc", fixed: "1.500", withdrawal: "3" }, lim).errors).toMatchObject({ pct: expect.any(String), fixed: expect.any(String) });
    expect(checkFees({ pct: "5", fixed: "1", withdrawal: "5" }, null).errors.pct).toMatch(/ainda não definiu/);
  });

  it("pedido de pagamento: só até o saldo livre", () => {
    expect(availableForPayout(300, [{ amount: 100, status: "pending" }, { amount: 50, status: "paid" }])).toBe(200);
    expect(checkPayout("150,00", 200)).toEqual({ amount: 150, error: null });
    expect(checkPayout("250", 200).error).toMatch(/até R\$\s200,00/);
    expect(checkPayout("0", 200).error).toMatch(/Informe o valor/);
  });

  it("erros do servidor em português", () => {
    expect(staffError({ message: "Fee below owner minimum" })).toMatch(/piso/);
    expect(staffError({ message: "Only owner can release; active assigned staff permission required to block" })).toBe("Só o dono libera saques bloqueados.");
    expect(staffError({ message: "insufficient_commission_balance" })).toMatch(/comissão disponível/);
    expect(staffError({ message: "seller fora da sua carteira" })).toMatch(/não está na sua carteira/);
    expect(staffError({ message: "access denied" })).toMatch(/permissão/);
  });

  it("a lista de permissões só oferece o que o servidor aplica", () => {
    const keys = STAFF_PERMISSIONS.map((p) => p.key);
    for (const dead of ["view_financial", "view_analytics", "review_products", "approve_product", "suspend_products", "request_refund", "manage_med", "view_rewards", "ship_rewards"]) expect(keys).not.toContain(dead);
    expect(keys).toEqual(expect.arrayContaining(["view_sellers", "view_transactions", "approve_kyc", "edit_fees", "freeze_seller_withdrawals", "respond_support"]));
  });
});

/* ───────── tela ───────── */

describe("painel da equipe", () => {
  it("mostra a carteira, a fila de verificação e o menu do gerente", async () => {
    show();
    expect(await screen.findByRole("button", { name: /Juliana Prado/ })).toBeInTheDocument();
    expect(screen.getByText("Sua carteira")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent?.replace(/\d+$/, ""))).toEqual(["Carteira", "Sellers", "Vendas", "Suporte", "Comissão", "Pedidos ao dono"]);
    expect(calls("get_staff_portfolio_dashboard")[0]).toMatchObject({ _page: 1, _search: "" });
  });

  it("funcionário sem permissões não vê vendas, suporte, comissão nem pedidos", async () => {
    handlers.get_staff_portfolio_dashboard = () => ({ data: portfolio({ role: "employee", permissions: [] }), error: null });
    show("/gerentes/dashboard?s=comissao");
    expect(await screen.findByText(/aparecem aqui quando o dono liberar/)).toBeInTheDocument();
    expect(screen.getByText("Sua carteira")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(within(nav).queryByRole("button", { name: /Vendas|Suporte|Comissão|Pedidos/ })).toBeNull();
  });

  it("falha ao carregar diz o que houve e deixa tentar de novo", async () => {
    handlers.get_staff_portfolio_dashboard = () => ({ data: null, error: { message: "access denied" } });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível carregar sua carteira\. Sua conta não tem permissão/);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("busca de sellers vai para o servidor", async () => {
    show("/gerentes/dashboard?s=sellers");
    fireEvent.change(await screen.findByLabelText("Buscar sellers"), { target: { value: "mar" } });
    await waitFor(() => expect(calls("get_staff_portfolio_dashboard").some((c) => c._search === "mar")).toBe(true), { timeout: 2000 });
  });

  it("vendas só com a permissão e com o status traduzido", async () => {
    show("/gerentes/dashboard?s=vendas");
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Paga")).toBeInTheDocument();
  });

  const openMarina = async () => {
    show("/gerentes/dashboard?s=sellers");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Marina Duarte" }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Desde que entrou na sua carteira (10/09/2026)");
    return dlg;
  };

  it("ficha: abas conforme permissão e taxas validadas antes de ir ao servidor", async () => {
    const dlg = await openMarina();
    expect(within(dlg).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumo", "Verificação", "Taxas", "Saques", "Disputas", "Observações"]);
    fireEvent.mouseDown(within(dlg).getByRole("tab", { name: /Taxas/ }));
    const wd = await within(dlg).findByLabelText("Taxa de saque");
    fireEvent.change(wd, { target: { value: "2,50" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar taxas" }));
    expect(await within(dlg).findByText(/O mínimo para você é R\$\s3,00/)).toBeInTheDocument();
    expect(calls("set_staff_seller_fees")).toHaveLength(0);
    fireEvent.change(wd, { target: { value: "3,50" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar taxas" }));
    await waitFor(() => expect(calls("set_staff_seller_fees")).toEqual([{ _seller: S1, _percentage: 4.99, _fixed: 1, _withdrawal: 3.5 }]));
  });

  it("ficha: bloquear saques pede motivo e só o dono libera", async () => {
    const dlg = await openMarina();
    fireEvent.mouseDown(within(dlg).getByRole("tab", { name: /Saques/ }));
    fireEvent.click(await within(dlg).findByRole("button", { name: /Bloquear saques/ }));
    const ask = await screen.findByRole("dialog", { name: /Bloquear os saques/ });
    fireEvent.change(within(ask).getByRole("textbox"), { target: { value: "Muitos MED seguidos" } });
    fireEvent.click(within(ask).getByRole("button", { name: "Bloquear saques" }));
    await waitFor(() => expect(calls("set_seller_withdrawal_block")).toEqual([{ _seller: S1, _block: true, _reason: "Muitos MED seguidos" }]));
  });

  it("ficha: observação nova vai para a tabela da equipe", async () => {
    const dlg = await openMarina();
    fireEvent.mouseDown(within(dlg).getByRole("tab", { name: /Observações/ }));
    fireEvent.change(await within(dlg).findByLabelText("Nova observação"), { target: { value: "  Quer migrar o checkout  " } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Adicionar observação" }));
    await waitFor(() => expect(inserts).toEqual([{ table: "seller_notes", row: { seller_user_id: S1, author_user_id: "me", content: "Quer migrar o checkout" } }]));
  });

  it("ficha em análise abre direto na verificação e decide por staff_review_kyc", async () => {
    handlers.get_staff_seller_detail = () => ({ data: detail({ seller: { ...detail().seller, user_id: S2, full_name: "Juliana Prado", account_status: "pending_review" } }), error: null });
    handlers.get_kyc_review = () => ({ data: { seller: { user_id: S2, full_name: "Juliana Prado", document_type: "cpf", account_status: "pending_review" }, documents: [], required: ["front", "back", "selfie"], submissions: [], can_approve: false, can_reject: true, is_admin: false }, error: null });
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Juliana Prado/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Cadastro para comparar")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar" }));
    fireEvent.change(within(dlg).getByLabelText("Motivo da reprovação"), { target: { value: "Documento cortado na foto" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar e avisar o seller" }));
    await waitFor(() => expect(calls("staff_review_kyc")).toEqual([{ _seller: S2, _approve: false, _reason: "Documento cortado na foto" }]));
  });

  it("comissão: pede pagamento dentro do saldo livre", async () => {
    tableRows.staff_commission_payouts = [{ id: "p1", amount: 100, status: "pending", method: "pix", notes: null, created_at: "2026-11-20T10:00:00Z", processed_at: null }];
    show("/gerentes/dashboard?s=comissao");
    const input = await screen.findByLabelText("Valor");
    await screen.findByText("Até R$ 200,00.", { exact: false });
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(await screen.findByText(/Você pode pedir até/)).toBeInTheDocument();
    expect(inserts).toHaveLength(0);
    fireEvent.change(input, { target: { value: "150,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await waitFor(() => expect(inserts).toEqual([{ table: "staff_commission_payouts", row: { staff_user_id: "me", amount: 150, method: "pix", notes: null } }]));
  });
});

describe("pedido ao dono", () => {
  it("ligar/desligar adquirente exige dizer qual dos dois e manda isso ao servidor", async () => {
    handlers.list_acquirers_basic = () => ({ data: [{ id: "aq1", name: "Alfa" }], error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><StaffRequestForm /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("radio", { name: /Ligar\/desligar adquirente/ }));
    await screen.findByRole("option", { name: "Alfa" });
    fireEvent.change(screen.getByLabelText("Adquirente"), { target: { value: "aq1" } });
    fireEvent.change(screen.getByLabelText("Por quê"), { target: { value: "Alfa voltou a aprovar bem" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao dono" }));
    expect(await screen.findByText("Diga se é para ligar ou desligar.")).toBeInTheDocument();
    expect(calls("request_staff_action")).toHaveLength(0);
    fireEvent.click(screen.getByRole("radio", { name: "Ligar" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao dono" }));
    await waitFor(() => expect(calls("request_staff_action")).toEqual([{ _kind: "acquirer_toggle", _reason: "Alfa voltou a aprovar bem", _target_acquirer: "aq1", _payload: { seller_email: null, active: true } }]));
  });
});

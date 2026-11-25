import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const state = { products: { data: [] } as Res, profiles: { data: [] } as Res };

function plain(result: () => Res) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "in", "eq"]) b[m] = () => b;
  b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (table: string) => (table === "products" ? plain(() => state.products) : table === "profiles" ? plain(() => state.profiles) : plain(() => ({ data: [] }))),
  },
}));
vi.mock("@/components/transactions/TransactionTimeline", () => ({ default: () => <div>linha do tempo</div>, TransactionTimeline: () => <div>linha do tempo</div> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/features/admin-finance/SellerSelect", () => ({
  SellerSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Seller" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { toast } from "sonner";
import AdminTransactionsTab from "@/pages/admin/tabs/AdminTransactionsTab";
import type { Tables } from "@/integrations/supabase/types";

const tx = (i: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, user_id: "s1", product_id: "p1", amount: 100, fee_amount: 7, net_amount: 93, discount_amount: null,
  status: "completed", payment_method: "pix", customer_name: `Cliente ${i}`, customer_email: `c${i}@exemplo.com`, customer_document: "12345678909", customer_phone: "44999990000",
  customer_address: null, external_id: null, source: null, created_at: new Date(Date.now() - i * 60_000).toISOString(), updated_at: new Date().toISOString(),
  retained_amount: null, retained_until: null, retention_released: false, pix_expires_at: null, ...over,
});
const summary = { total: 130, gross: 12345.5, net: 11480.2, fees: 865.3, approved: 100, pending: 10, failed: 12, refunded: 5, chargeback: 3, chargeback_amount: 300, refunded_amount: 500 };
const page = (items: unknown[], total = items.length, s = summary) => ({ items, total, page: 1, page_size: 80, summary: s });

const profiles = [{ user_id: "s1", full_name: "Marina Duarte", email: "marina@exemplo.com", created_at: new Date().toISOString(), seller_type: null }] as unknown as Tables<"profiles">[];
const products = [{ id: "p1", name: "Método Escala 10x" }] as unknown as Tables<"products">[];
const range = { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-25T23:59:59Z") };
const navigate = vi.fn();

function renderTab(opts: { onNavigate?: (t: string) => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminTransactionsTab profiles={profiles} products={products} dateRange={range} onNavigate={opts.onNavigate} /></QueryClientProvider>);
}
const lastArgs = () => rpc.mock.calls.at(-1)?.[1] as Record<string, unknown>;
const table = () => screen.getByRole("table");

beforeEach(() => {
  rpc.mockReset();
  navigate.mockReset();
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.warning).mockClear();
  state.products = { data: [] };
  state.profiles = { data: [] };
  rpc.mockResolvedValue({ data: page([tx(1), tx(2)], 130), error: null });
});

describe("AdminTransactionsTab", () => {
  it("KPIs e contagens vêm do resumo do banco, não das linhas carregadas", async () => {
    renderTab();
    await screen.findByRole("table");
    expect(screen.getByText(/12\.345,50/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Aprovadas · 100/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Chargebacks · 3/ })).toBeTruthy();
    expect(screen.getByText("Mostrando 2 de 130")).toBeTruthy();
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
  });

  it("filtro de situação pede ao banco o grupo certo", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Recusadas e expiradas/ }));
    await waitFor(() => expect(lastArgs()._status).toBe("failed"));
    expect(lastArgs()._page).toBe(1);
  });

  it("busca espera o fim da digitação antes de consultar", async () => {
    renderTab();
    await screen.findByRole("table");
    const before = rpc.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Buscar transação"), { target: { value: "maria" } });
    expect(rpc.mock.calls.length).toBe(before);
    await waitFor(() => expect(lastArgs()._search).toBe("maria"));
  });

  it("carregar mais acrescenta a próxima página sem repetir linhas", async () => {
    rpc.mockImplementation(async (_n: string, a: { _page: number }) => ({ data: a._page === 1 ? page([tx(1), tx(2)], 4) : { ...page([tx(3), tx(4)], 4), page: 2 }, error: null }));
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/ }));
    await waitFor(() => expect(within(table()).getAllByRole("row")).toHaveLength(5));
    expect(screen.getByText("Mostrando 4 de 4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  });

  it("erro do banco mostra mensagem honesta e permite tentar de novo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderTab();
    expect(await screen.findByText("Não foi possível carregar as transações.")).toBeTruthy();
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy(); // selo do topo
    expect((screen.getByRole("button", { name: /Exportar CSV/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("table");
    expect(screen.queryByText("Não foi possível carregar as transações.")).toBeNull();
  });

  it("sem resultados com filtro oferece limpar filtros", async () => {
    rpc.mockResolvedValue({ data: page([], 0, { ...summary, total: 0, approved: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 }), error: null });
    renderTab();
    fireEvent.click(await screen.findByRole("button", { name: /Aprovadas/ }));
    expect(await screen.findByText("Nenhuma transação bate com esses filtros neste período.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect(await screen.findByText("Ainda não houve transações neste período.")).toBeTruthy();
  });

  it("nome do produto fora da lista do painel é buscado sob demanda", async () => {
    rpc.mockResolvedValue({ data: page([tx(1, { product_id: "p-fora" })], 1), error: null });
    state.products = { data: [{ id: "p-fora", name: "Planilha de Anúncios" }] };
    renderTab();
    await waitFor(() => expect(within(table()).getByText("Planilha de Anúncios")).toBeTruthy());
  });

  it("exporta o período inteiro, em páginas, e avisa quando passa do limite", async () => {
    const createUrl = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    rpc.mockImplementation(async (_n: string, a: { _page: number; _page_size: number }) => ({
      data: a._page_size === 200 ? page(Array.from({ length: 200 }, (_, i) => tx((a._page - 1) * 200 + i + 1)), 450) : page([tx(1), tx(2)], 450),
      error: null,
    }));
    renderTab();
    await screen.findByRole("table");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ })); });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const exportCalls = rpc.mock.calls.filter((c) => (c[1] as { _page_size: number })._page_size === 200);
    expect(exportCalls.map((c) => (c[1] as { _page: number })._page)).toEqual([1, 2, 3]);
    expect(String(vi.mocked(toast.success).mock.calls[0][0])).toContain("450");
    expect(createUrl).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("exportação que falha no meio não baixa nada e diz isso", async () => {
    const createUrl = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    rpc.mockImplementation(async (_n: string, a: { _page: number; _page_size: number }) => (a._page_size === 200 && a._page === 2 ? { data: null, error: { message: "x" } } : { data: page(Array.from({ length: a._page_size === 200 ? 200 : 2 }, (_, i) => tx(i + 1)), 450), error: null }));
    renderTab();
    await screen.findByRole("table");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ })); });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(createUrl).not.toHaveBeenCalled();
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain("Nada foi baixado");
  });

  it("dossiê mostra os dados do cliente, avisa que estorno está indisponível e navega", async () => {
    renderTab({ onNavigate: navigate });
    await screen.findByRole("table");
    fireEvent.click(within(table()).getAllByRole("button", { name: /Ver detalhes/ })[0]);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("c1@exemplo.com")).toBeTruthy();
    expect(screen.getByText(/Estornar pagamento fica indisponível/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir em Reembolsos" }));
    expect(navigate).toHaveBeenCalledWith("refunds");
  });

  it("sem permissão para outras abas, o dossiê não mostra atalhos", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getAllByRole("button", { name: /Ver detalhes/ })[0]);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Abrir em Reembolsos" })).toBeNull();
  });
});

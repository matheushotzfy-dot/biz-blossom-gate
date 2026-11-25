import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import AdminCheckoutDeliveriesTab from "@/pages/admin/tabs/AdminCheckoutDeliveriesTab";
import { canRetry, explain, parseDeliveriesPage, retryOutcome } from "@/features/admin-deliveries/deliveriesModel";

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const del = (id: string, over: Record<string, unknown> = {}) => ({
  id, transaction_id: `tx-${id}`, product_id: "p1", seller_user_id: "s1", buyer_user_id: null, customer_email: `${id}@exemplo.com`, status: "pending", attempt_count: 1,
  last_error: "Aguardando conta do comprador com e-mail confirmado", delivered_at: null, last_attempt_at: ago(1), created_at: ago(5), product_name: "Método Escala 10x",
  seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", tx_amount: 197, tx_status: "approved", ...over,
});
const summary = { total: 30, pending: 4, failed: 2, delivered: 22, revoked: 2, oldest_open: ago(72) };
const pageOf = (items: unknown[], total = items.length) => ({ items, total, summary });

describe("deliveriesModel", () => {
  it("só reprocessa o que está em aberto e com pagamento confirmado", () => {
    expect(canRetry({ status: "pending", tx_status: "approved" })).toBe(true);
    expect(canRetry({ status: "failed", tx_status: "completed" })).toBe(true);
    expect(canRetry({ status: "failed", tx_status: "refunded" })).toBe(false);
    expect(canRetry({ status: "revoked", tx_status: "approved" })).toBe(false);
    expect(canRetry({ status: "delivered", tx_status: "approved" })).toBe(false);
    expect(canRetry({ status: "pending", tx_status: null })).toBe(false);
  });
  it("explica os casos conhecidos em português e mostra o texto do banco nos outros", () => {
    expect(explain({ status: "pending", last_error: "Aguardando conta do comprador com e-mail confirmado", tx_status: "approved" })).toContain("não tem conta");
    expect(explain({ status: "failed", last_error: "Produto sem curso vinculado", tx_status: "approved" })).toContain("vincular um curso");
    expect(explain({ status: "failed", last_error: "erro estranho 42", tx_status: "approved" })).toBe("erro estranho 42");
    expect(explain({ status: "pending", last_error: null, tx_status: "refunded" })).toContain("não está confirmado");
    expect(explain({ status: "revoked", last_error: null, tx_status: "approved" })).toContain("Acesso retirado");
  });
  it("resultado do reprocessamento não diz 'sucesso' quando continua pendente ou falho", () => {
    expect(retryOutcome({ status: "delivered" }, "a@b.com")).toMatchObject({ kind: "success" });
    expect(retryOutcome({ status: "pending" }, "a@b.com")).toMatchObject({ kind: "warning" });
    expect(retryOutcome({ status: "failed", reason: "course_not_linked" }, "a@b.com").message).toContain("curso vinculado");
    expect(retryOutcome(null, "a@b.com").kind).toBe("warning");
  });
  it("página inesperada vira erro", () => { expect(() => parseDeliveriesPage(null)).toThrow(); });
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminCheckoutDeliveriesTab /></QueryClientProvider>);
}
const lastList = () => [...rpc.mock.calls].reverse().find((c) => c[0] === "get_admin_checkout_deliveries_page")?.[1] as Record<string, unknown>;
const table = () => screen.getByRole("table");

beforeEach(() => {
  rpc.mockReset(); confirmSpy.mockClear();
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.warning).mockClear();
  rpc.mockImplementation(async (name: string) => (name === "get_admin_checkout_deliveries_page"
    ? { data: pageOf([del("a", { status: "failed", last_error: "Produto sem curso vinculado" }), del("b"), del("c", { status: "delivered", last_error: null, delivered_at: ago(2) }), del("d", { tx_status: "refunded" })], 30), error: null }
    : { data: { status: "delivered" }, error: null }));
});

describe("AdminCheckoutDeliveriesTab", () => {
  it("contagens vêm do banco e rótulos estão em português", async () => {
    renderTab();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Falhas · 2/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Aguardando · 4/ })).toBeTruthy();
    expect(within(table()).getAllByText("Falhou")).toHaveLength(1);
    expect(within(table()).queryByText("failed")).toBeNull();
  });

  it("busca e filtro vão para o banco, não só para as 50 linhas da tela", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Falhas · 2/ }));
    await waitFor(() => expect(lastList()._status).toBe("failed"));
    fireEvent.change(screen.getByLabelText("Buscar entrega"), { target: { value: " ana@x.com " } });
    await waitFor(() => expect(lastList()._search).toBe("ana@x.com"));
    expect(lastList()._page).toBe(1);
  });

  it("reprocessar pede confirmação reforçada, chama o banco e avisa que liberou", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Reprocessar entrega para b@exemplo.com" }));
    expect(confirmSpy.mock.calls[0][0]).toContain("b@exemplo.com");
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_retry_checkout_delivery", { _delivery_id: "b" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Acesso liberado para b@exemplo.com."));
  });

  it("continua aguardando: avisa com alerta, sem fingir sucesso", async () => {
    rpc.mockImplementation(async (name: string) => (name === "admin_retry_checkout_delivery" ? { data: { status: "pending" }, error: null } : { data: pageOf([del("b")]), error: null }));
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: /Reprocessar entrega/ }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("falha do banco no reprocessamento vira erro claro", async () => {
    rpc.mockImplementation(async (name: string) => (name === "admin_retry_checkout_delivery" ? { data: null, error: { message: "recent authentication required" } } : { data: pageOf([del("b")]), error: null }));
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: /Reprocessar entrega/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain("Não foi possível reprocessar");
  });

  it("não oferece reprocessar entrega entregue, revogada ou de pagamento não confirmado", async () => {
    renderTab();
    await screen.findByRole("table");
    expect(within(table()).queryByRole("button", { name: "Reprocessar entrega para c@exemplo.com" })).toBeNull();
    expect(within(table()).queryByRole("button", { name: "Reprocessar entrega para d@exemplo.com" })).toBeNull();
    expect(within(table()).getByRole("button", { name: "Reprocessar entrega para a@exemplo.com" })).toBeTruthy();
  });

  it("erro ao listar não vira 'nenhuma entrega': mostra o erro e tenta de novo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderTab();
    expect(await screen.findByText("Não foi possível carregar as entregas.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma entrega aqui")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("table");
  });

  it("vazio com filtro oferece limpar; vazio sem filtro explica", async () => {
    rpc.mockResolvedValue({ data: pageOf([], 0), error: null });
    renderTab();
    expect(await screen.findByText(/Quando uma compra for confirmada/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Entregues/ }));
    expect(await screen.findByText("Nenhuma entrega bate com esses filtros.")).toBeTruthy();
  });
});

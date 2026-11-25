import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { SellersDirectory } from "@/features/admin-finance/SellersDirectory";

const row = (over: Record<string, unknown> = {}) => ({
  user_id: "00000000-0000-4000-8000-0000000000a1", full_name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved",
  seller_type: "white", balance_frozen: false, created_at: "2026-09-01T10:00:00Z", attempts: 60, sales: 1, volume: 120,
  med: 0, med_amount: 0, chargebacks: 0, chargeback_amount: 0, refunds: 0, refund_amount: 0, ...over,
});
const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 0, page_size: 25, checked_at: "2026-11-25T10:00:00Z", summary: { registered: 3, selling: 1, kyc: 0, volume: 120, med: 0, chargebacks: 0 } });
const answer = (v: unknown) => ({ abortSignal: () => Promise.resolve({ data: v, error: null }) });

const renderDir = (onOpen = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SellersDirectory range={{ from: new Date("2026-11-25T00:00:00"), to: new Date("2026-11-25T23:59:59") }} onOpen={onOpen} money={(v) => `R$ ${v.toFixed(2)}`} enabled /></QueryClientProvider>);
  return onOpen;
};

beforeEach(() => { rpc.mockReset(); rpc.mockImplementation(() => answer(page([row()]))); });

describe("SellersDirectory", () => {
  it("clicar na linha abre o seller uma única vez", async () => {
    const onOpen = renderDir();
    const name = await screen.findByRole("button", { name: "Marina Duarte" });
    fireEvent.click(name);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000a1");

    onOpen.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Marina Duarte" }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    onOpen.mockClear();
    fireEvent.click(screen.getByText("marina@exemplo.com"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("resumo de vendas e volume aparece no cartão do seller (para telas sem as colunas), com singular correto", async () => {
    renderDir();
    expect(await screen.findByText("1 venda · R$ 120.00")).toBeInTheDocument();
  });

  it("falha ao carregar não vira lista vazia", async () => {
    rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data: null, error: { message: "boom" } }) }));
    renderDir();
    expect(await screen.findByText("Não foi possível carregar os sellers.", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("Nenhum seller encontrado para estes filtros.")).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
const toastError = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import AdminCommandCenterTab from "@/pages/admin/tabs/AdminCommandCenterTab";

const ops = (over: Record<string, unknown> = {}) => ({
  withdrawals: { count: 2, amount: 2450, oldest: new Date(Date.now() - 30 * 3600000).toISOString() },
  kyc: 3, med: 1, chargebacks: 1, refunds: 0, support: 4, error_count: 1,
  errors: [{ id: "e1", error_type: "checkout_pix", message: "Timeout", created_at: "2026-11-25T10:00:00Z" }],
  fraud: [], webhooks: { delivered: 10, failed: 1, pending: 0 }, apps: { delivered: 0, failed: 0, pending: 0 },
  risky_sellers: [], checked_at: "2026-11-25T10:00:00Z", ...over,
});
const metrics = {
  summary: { gross: 1000, fees: 70, acquirer: 0, profit: 70, sales: 5, attempts: 10 }, daily: [], hourly: [], methods: [],
  risk: { chargebacks: 0, chargeback_amount: 0, med_count: 0, med_amount: 0, med_open: 0 },
  new_users: 0, kyc_pending: 0, from: "2026-11-25", to: "2026-11-25", timezone: "America/Sao_Paulo",
};

// cada rpc devolve um objeto com abortSignal, como o cliente real
const answer = (v: { data: unknown; error: unknown }) => ({ abortSignal: () => Promise.resolve(v), then: (r: (x: unknown) => unknown) => Promise.resolve(v).then(r) });

const setup = (route: (name: string) => { data: unknown; error: unknown }) => {
  rpc.mockImplementation((name: string) => answer(route(name)));
};

const renderTab = (onNavigate = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdminCommandCenterTab dateRange={{ from: new Date("2026-11-25T00:00:00"), to: new Date("2026-11-25T23:59:59") }} fmtCurrency={(v) => `R$ ${v.toFixed(2)}`} onNavigate={onNavigate} />
    </QueryClientProvider>,
  );
  return { client, onNavigate };
};

beforeEach(() => { rpc.mockReset(); toastError.mockReset(); });

describe("AdminCommandCenterTab", () => {
  it("sem dados e com erro: não afirma nada sobre as filas e oferece tentar de novo", async () => {
    setup(() => ({ data: null, error: { message: "boom" } }));
    renderTab();
    expect(await screen.findByText("Centro de comando indisponível", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma anomalia/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("mostra alertas e filas com contagem; clicar na fila abre a aba certa", async () => {
    setup((n) => ({ data: n === "get_admin_command_center" ? ops() : metrics, error: null }));
    const { onNavigate } = renderTab();
    expect(await screen.findByText("Saque parado há mais de 24h")).toBeInTheDocument();
    expect(screen.getByText("1 entrega com falha nas últimas 24h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Saques pendentes/ }));
    expect(onNavigate).toHaveBeenCalledWith("withdrawals");
  });

  it("busca: menos de 3 caracteres avisa sem chamar o servidor; erro do servidor vira mensagem clara", async () => {
    setup((n) => (n === "admin_search_transactions" ? { data: null, error: { message: "function public.admin_search_transactions does not exist" } } : { data: n === "get_admin_command_center" ? ops() : metrics, error: null }));
    renderTab();
    await screen.findByText("Busca rápida de transação");
    const input = screen.getByLabelText("Buscar transação");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(toastError).toHaveBeenCalledWith("Digite entre 3 e 120 caracteres");
    expect(rpc.mock.calls.some((c) => c[0] === "admin_search_transactions")).toBe(false);

    fireEvent.change(input, { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não foi possível buscar agora. Tente de novo em instantes."));
  });

  it("resultado da busca mostra o status em português", async () => {
    setup((n) => {
      if (n === "admin_search_transactions") return { data: [{ id: "8f2a1c9e-0000", amount: 97, status: "waiting_payment", customer_email: "a@b.com", customer_name: "Ana", created_at: "2026-11-25T10:00:00Z" }], error: null };
      return { data: n === "get_admin_command_center" ? ops() : metrics, error: null };
    });
    renderTab();
    await screen.findByText("Busca rápida de transação");
    fireEvent.change(screen.getByLabelText("Buscar transação"), { target: { value: "ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Aguardando")).toBeInTheDocument();
  });
});

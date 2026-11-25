import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
// recharts precisa de medidas de layout que o jsdom não tem
vi.mock("@/features/admin-finance/FinancialCharts", () => ({ FinancialCharts: () => <div>graficos</div> }));

import { FinancialMetricsPanel, MAX_RANGE_DAYS, brDay, resolveRange } from "@/features/admin-finance/FinancialMetricsPanel";

const metrics = {
  totals: { count: 52, all_count: 80, conversion: 65, gross: 18400, platform_fee: 1288, fee_percent: 1012, fee_fixed: 276, acquirer_fee: 410.5, seller_net: 17112, discounts: 320, platform_profit: 953.5 },
  methods: [{ method: "pix", count: 40, gross: 14200, fee: 994, fee_percent: 781, fee_fixed: 213, acquirer_fee: 280 }, { method: "credit_card", count: 12, gross: 4200, fee: 294, fee_percent: 231, fee_fixed: 63, acquirer_fee: 130.5 }],
  daily: [{ day: "2026-11-24", gross: 2100, fee: 147, profit: 99, count: 7 }],
  outflows: { refunds: 97, chargebacks: 197, dispute_holds: 0, dispute_releases: 0, adjust_credit: 50, adjust_debit: 20, med_lost: 197, med_open: 150, dispute_fees: 30 },
  withdrawals: { paid_count: 4, paid_amount: 4000, fee: 20, pending_count: 1, pending_amount: 1200, rejected_count: 0 },
};
const zero = { totals: { count: 0, all_count: 0, conversion: 0, gross: 0, platform_fee: 0, fee_percent: 0, fee_fixed: 0, acquirer_fee: 0, seller_net: 0, discounts: 0, platform_profit: 0 }, methods: [], daily: [],
  outflows: { refunds: 0, chargebacks: 0, dispute_holds: 0, dispute_releases: 0, adjust_credit: 0, adjust_debit: 0, med_lost: 0, med_open: 0, dispute_fees: 0 },
  withdrawals: { paid_count: 0, paid_amount: 0, fee: 0, pending_count: 0, pending_amount: 0, rejected_count: 0 } };

const setup = (metricsReply: () => { data: unknown; error: unknown }) => rpc.mockImplementation((name: string) => {
  if (name === "list_acquirers_basic") return Promise.resolve({ data: [{ id: "aq1", name: "Adquirente Alfa", is_active: true }], error: null });
  return Promise.resolve(metricsReply());
});
const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><FinancialMetricsPanel profiles={[]} /></QueryClientProvider>);
};
const metricCalls = () => rpc.mock.calls.filter((c) => c[0] === "get_financial_metrics");

beforeEach(() => rpc.mockReset());
afterEach(() => vi.useRealTimers());

describe("período das métricas financeiras", () => {
  it("brDay usa a data de São Paulo: 23h30 em Brasília ainda é o mesmo dia (em UTC já seria o dia seguinte)", () => {
    expect(brDay(new Date("2026-11-26T02:30:00Z"))).toBe("2026-11-25");
    expect(brDay(new Date("2026-11-25T03:00:00Z"))).toBe("2026-11-25");
    expect(brDay(new Date("2026-11-25T02:59:00Z"))).toBe("2026-11-24");
  });

  it("resolveRange fecha o dia final (exclusivo no dia seguinte) no fuso -03:00", () => {
    expect(resolveRange("2026-11-25", "2026-11-25")).toEqual({ error: null, s: "2026-11-25T03:00:00.000Z", e: "2026-11-26T03:00:00.000Z" });
  });

  it("recusa período invertido, vazio e maior que o limite do banco", () => {
    expect(resolveRange("2026-11-25", "2026-11-24").error).toMatch(/igual ou depois/);
    expect(resolveRange("", "2026-11-24").error).toMatch(/Escolha/);
    expect(resolveRange("2025-01-01", "2026-11-25").error).toBe(`O período máximo é de ${MAX_RANGE_DAYS} dias.`);
    expect(resolveRange("2025-10-22", "2026-11-25").error).toBeNull(); // 400 dias contando o último
    expect(resolveRange("2025-10-21", "2026-11-25").error).toBe(`O período máximo é de ${MAX_RANGE_DAYS} dias.`); // 401
  });
});

describe("FinancialMetricsPanel", () => {
  it("às 23h30 de Brasília, 'Hoje' pergunta pelo dia de hoje e não pelo de amanhã", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T02:30:00Z"));
    setup(() => ({ data: metrics, error: null }));
    renderPanel();
    await waitFor(() => expect(metricCalls().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    await waitFor(() => expect(metricCalls().some((c) => c[1]._from === "2026-11-25T03:00:00.000Z" && c[1]._to === "2026-11-26T03:00:00.000Z")).toBe(true));
  });

  it("mostra entradas, taxas, saídas e as tabelas com o nome dos métodos", async () => {
    setup(() => ({ data: metrics, error: null }));
    renderPanel();
    expect(await screen.findByText("Lucro da plataforma")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*953,50/).length).toBeGreaterThan(0);
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Cartão")).toBeInTheDocument();
    expect(screen.getByText("de 80 tentativas")).toBeInTheDocument();
    expect(screen.getByText("4 saques")).toBeInTheDocument();
    expect(screen.getByText("1 saque")).toBeInTheDocument();
  });

  it("período sem nenhuma venda mostra o aviso em vez de uma parede de zeros", async () => {
    setup(() => ({ data: zero, error: null }));
    renderPanel();
    expect(await screen.findByText("Nenhuma venda neste período")).toBeInTheDocument();
    expect(screen.queryByText("Lucro da plataforma")).toBeNull();
  });

  it("se o banco falha, mostra o erro com 'Tentar de novo' e se recupera", async () => {
    setup(() => ({ data: null, error: { message: "not authorized" } }));
    renderPanel();
    expect(await screen.findByText("Não foi possível carregar as métricas.")).toBeInTheDocument();
    expect(screen.getByText("Sem permissão para esta ação")).toBeInTheDocument();
    expect(screen.queryByText("Lucro da plataforma")).toBeNull();

    setup(() => ({ data: metrics, error: null }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Lucro da plataforma")).toBeInTheDocument();
  });

  it("data final antes da inicial: avisa e não consulta o banco", async () => {
    setup(() => ({ data: metrics, error: null }));
    renderPanel();
    await screen.findByText("Lucro da plataforma");
    const before = metricCalls().length;
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2099-01-01" } }); // depois da data final
    expect(await screen.findByRole("alert")).toHaveTextContent("igual ou depois da inicial");
    expect(metricCalls().length).toBe(before);
  });
});

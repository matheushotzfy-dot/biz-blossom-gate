import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
// gráficos dependem de medidas de layout que o jsdom não tem
vi.mock("@/features/admin-finance/OverviewCharts", () => ({ OverviewCharts: () => <div>graficos</div> }));
vi.mock("@/features/admin-finance/AnalyticsActivity", () => ({ AnalyticsActivity: () => <div>atividade</div> }));

import AdminAnalyticsTab from "@/pages/admin/tabs/AdminAnalyticsTab";

const detail = {
  summary: { registered_sellers: 14, active_sellers: 11, selling_sellers: 2, selling_today: 2, clients: 118, repeat_clients: 9, unidentified_sales: 1, new_registrations: 7,
    refunds: 1, refund_amount: 97, chargebacks: 1, chargeback_amount: 197, med: 1, med_amount: 197, pending_transactions: 3, failed_transactions: 18 },
  operations: { pending_refunds: 0, refunds_reserved: 0, pending_withdrawals: 2, withdrawal_amount: 2450, open_med: 1, kyc_pending: 3, frozen_sellers: 1 },
  daily: [], sellers: [], seller_count: 0, page: 0, page_size: 25, checked_at: "2026-11-25T10:00:00Z",
};
const overview = {
  summary: { gross: 1000, fees: 70, acquirer: 0, profit: 70, sales: 5, attempts: 10 }, daily: [], hourly: [],
  methods: [{ method: "boleto", total: 4, sales: 2, gross: 300 }, { method: "pix", total: 6, sales: 3, gross: 700 }],
  risk: { chargebacks: 0, chargeback_amount: 0, med_count: 0, med_amount: 0, med_open: 0 },
  new_users: 0, kyc_pending: 0, from: "2026-11-25", to: "2026-11-25", timezone: "America/Sao_Paulo",
};
const answer = (v: { data: unknown; error: unknown }) => ({ abortSignal: () => Promise.resolve(v) });
const setup = (fail: Partial<Record<string, boolean>> = {}) => rpc.mockImplementation((name: string) => {
  if (fail[name]) return answer({ data: null, error: { message: "boom" } });
  return answer({ data: name === "get_admin_analytics_detail" ? detail : overview, error: null });
});

const renderTab = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminAnalyticsTab dateRange={{ from: new Date("2026-11-25T00:00:00"), to: new Date("2026-11-25T23:59:59") }} fmtCurrency={(v) => `R$ ${v.toFixed(2)}`} /></QueryClientProvider>);
};

beforeEach(() => rpc.mockReset());

describe("AdminAnalyticsTab", () => {
  it("mostra indicadores do período e traduz os métodos de pagamento (inclui boleto)", async () => {
    setup();
    renderTab();
    expect(await screen.findByText("Volume transacionado")).toBeInTheDocument();
    expect(screen.getByText("R$ 1000.00")).toBeInTheDocument();
    expect(screen.getByText("Boleto")).toBeInTheDocument();
    expect(screen.getByText("PIX")).toBeInTheDocument();
  });

  it("se as duas consultas falham, não mostra zeros: avisa que não carregou e permite tentar de novo", async () => {
    setup({ get_admin_analytics_detail: true, get_admin_overview_metrics: true });
    renderTab();
    expect(await screen.findByText("Não foi possível carregar o Analytics deste período.", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("Volume transacionado")).toBeNull();

    setup();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Volume transacionado")).toBeInTheDocument());
  });
});

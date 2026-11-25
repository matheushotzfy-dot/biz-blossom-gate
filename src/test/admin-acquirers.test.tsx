import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// o seletor de seller é um Select do Radix (precisa de layout); aqui basta um campo simples
vi.mock("@/features/admin-finance/SellerSelect", () => ({
  SellerSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Seller" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import AcquirersPanel, { acquirerStatus } from "@/features/admin-finance/AcquirersPanel";
import type { Tables } from "@/integrations/supabase/types";

const overview = { default_id: "aq1", sellers_on_default: 12, acquirers: [
  { id: "aq1", name: "Adquirente Alfa", is_active: true, priority: 1, allow_failover: true, health_status: "online", is_default: true, fee_percent: 1.2, fee_fixed: 0.3, sellers: 1, tx_total: 80, tx_paid: 52, gross: 18400, acquirer_fee: 410.5 },
  { id: "aq2", name: "Adquirente Beta", is_active: true, priority: 2, allow_failover: true, health_status: "degraded", is_default: false, fee_percent: 1.5, fee_fixed: 0.25, sellers: 1, tx_total: 10, tx_paid: 6, gross: 1900, acquirer_fee: 55 },
  { id: "aq3", name: "Adquirente Gama", is_active: false, priority: 3, allow_failover: false, health_status: "offline", is_default: false, fee_percent: 0, fee_fixed: 0, sellers: 0, tx_total: 0, tx_paid: 0, gross: 0, acquirer_fee: 0 },
] };
const profiles = [{ user_id: "s1", full_name: "Marina Duarte", email: "marina@exemplo.com", acquirer_id: "aq2" }] as unknown as Tables<"profiles">[];
const renderPanel = () => { const c = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={c}><AcquirersPanel profiles={profiles} /></QueryClientProvider>); };
beforeEach(() => { rpc.mockReset(); confirmSpy.mockReset(); });

describe("acquirerStatus", () => {
  it("desligada vence a saúde reportada e os estados saem em português", () => {
    expect(acquirerStatus({ is_active: false, health_status: "online" }).label).toBe("Desligada");
    expect(acquirerStatus({ is_active: true, health_status: "degraded" }).label).toBe("Instável");
    expect(acquirerStatus({ is_active: true, health_status: "offline" }).label).toBe("Fora do ar");
    expect(acquirerStatus({ is_active: true, health_status: "maintenance" }).label).toBe("Em manutenção");
  });
});

describe("AcquirersPanel", () => {
  it("mostra a padrão, as reservas e o estado de cada uma", async () => {
    rpc.mockResolvedValue({ data: overview, error: null });
    renderPanel();
    expect(await screen.findByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Reserva")).toBeInTheDocument();
    expect(screen.getByText("Instável")).toBeInTheDocument();
    expect(screen.getByText("Desligada")).toBeInTheDocument();
    expect(screen.getByText("de 3 cadastradas")).toBeInTheDocument();
    expect(screen.getByText("12 sellers usam a padrão da plataforma.")).toBeInTheDocument();
  });

  it("sem nenhuma adquirente, diz o que isso significa para o checkout", async () => {
    rpc.mockResolvedValue({ data: { default_id: null, sellers_on_default: 14, acquirers: [] }, error: null });
    renderPanel();
    expect(await screen.findByText("Nenhuma adquirente cadastrada ainda")).toBeInTheDocument();
    expect(screen.getByText(/checkouts ficam indisponíveis/)).toBeInTheDocument();
  });

  it("erro de carga não vira tabela vazia: mostra o erro e deixa tentar de novo", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not authorized" } });
    renderPanel();
    expect(await screen.findByText("Não foi possível carregar as adquirentes.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma adquirente cadastrada ainda")).toBeNull();
    rpc.mockResolvedValue({ data: overview, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((await screen.findAllByText("Adquirente Alfa")).length).toBeGreaterThan(0);
  });

  it("trocar exige motivo (aviso no formulário) e a confirmação diz seller e destino", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "get_acquirer_overview" ? overview : { ok: true }, error: null }));
    renderPanel();
    await screen.findAllByText("Adquirente Alfa");
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar troca" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 5 caracteres");
    expect(rpc.mock.calls.some((c) => c[0] === "admin_set_seller_acquirer")).toBe(false);

    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Muitas recusas no Pix" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar troca" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_seller_acquirer", { _seller_id: "s1", _new_acquirer_id: undefined, _reason: "Muitas recusas no Pix" }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Marina Duarte para a padrão da plataforma"));
    expect(screen.getByText("Adquirente Beta", { selector: "span.font-semibold" })).toBeInTheDocument(); // "Hoje este seller usa"
  });
});

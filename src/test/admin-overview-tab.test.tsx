import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

type Res = { data: unknown[] | null; error: { message: string } | null };
const results: Record<string, Res> = {};
const handlers: Record<string, (p: { new: unknown }) => void> = {};
const from = vi.fn();

const chain = (table: string) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "in", "order", "limit"]) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(results[table]).then(ok, bad);
  return q;
};

vi.mock("@/integrations/supabase/client", () => {
  const channel = {
    on: (_t: string, cfg: { event: string }, cb: (p: { new: unknown }) => void) => { handlers[cfg.event] = cb; return channel; },
    subscribe: () => channel,
  };
  return { supabase: { from: (t: string) => { from(t); return chain(t); }, channel: () => channel, removeChannel: () => {} } };
});
vi.mock("@/features/admin-finance/AdminOverviewMetrics", () => ({ AdminOverviewMetrics: () => <div>metricas</div> }));
vi.mock("@/components/admin/AdminAlertsBanner", () => ({ AdminAlertsBanner: () => null }));
vi.mock("@/components/transactions/TransactionDetailPanel", () => ({ TransactionDetailPanel: () => null }));

import AdminOverviewTab from "@/pages/admin/tabs/AdminOverviewTab";

const tx = (over: Record<string, unknown>) => ({
  id: "t1", status: "approved", amount: 97, customer_name: "Ana", payment_method: "pix", created_at: "2026-11-25T12:00:00Z",
  is_simulated: false, ...over,
}) as never;

const wd = { id: "w1", status: "pending", amount: 1200, user_id: "u9", created_at: "2026-11-25T10:00:00Z" } as never;

const renderTab = (props: Partial<React.ComponentProps<typeof AdminOverviewTab>> = {}) => {
  const onWithdrawalAction = vi.fn();
  render(
    <AdminOverviewTab
      transactions={[]} profiles={[]} products={[]} withdrawals={[]}
      onWithdrawalAction={onWithdrawalAction} fmtCurrency={(v) => `R$ ${v.toFixed(2)}`}
      dateRange={{ from: new Date("2026-11-25T00:00:00"), to: new Date("2026-11-25T23:59:59") }}
      {...props}
    />,
  );
  return { onWithdrawalAction };
};

beforeEach(() => {
  from.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  results.disputes = { data: [], error: null };
  results.fraud_logs = { data: [], error: null };
});

describe("AdminOverviewTab", () => {
  it("MEDs e bloqueios: mostra 'carregando' antes e 'nenhum' só depois de a consulta responder", async () => {
    renderTab();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(await screen.findByText("Nenhum MED em aberto")).toBeInTheDocument();
    expect(screen.getByText("Nenhum bloqueio recente")).toBeInTheDocument();
  });

  it("consulta de MEDs falhou: avisa e permite tentar de novo, sem fingir que não há nenhum", async () => {
    results.disputes = { data: null, error: { message: "boom" } };
    renderTab();
    expect(await screen.findByText("Não foi possível carregar os MEDs em aberto.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum MED em aberto")).toBeNull();

    results.disputes = { data: [], error: null };
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Nenhum MED em aberto")).toBeInTheDocument();
  });

  it("consulta de anti-fraude falhou: avisa em vez de 'nenhum bloqueio'", async () => {
    results.fraud_logs = { data: null, error: { message: "boom" } };
    renderTab();
    expect(await screen.findByText("Não foi possível carregar os bloqueios anti-fraude.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum bloqueio recente")).toBeNull();
  });

  it("saque em revisão: não oferece aprovar (sem adquirente) e a recusa continua funcionando", async () => {
    const { onWithdrawalAction } = renderTab({ withdrawals: [wd] });
    await screen.findByText("Nenhum MED em aberto");
    expect(screen.getByText("Aprovação indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Recusar saque de R\$ 1200\.00/ }));
    expect(onWithdrawalAction).toHaveBeenCalledWith("w1", "rejected");
  });

  it("atividade ao vivo: status novos têm rótulo em português e venda simulada que chega em tempo real é ignorada", async () => {
    renderTab({ transactions: [tx({ id: "a", status: "waiting_payment", customer_name: "Bia" })] });
    await screen.findByText("Nenhum MED em aberto");
    expect(screen.getByText("Aguardando")).toBeInTheDocument();
    expect(screen.getByText("Bia")).toBeInTheDocument();

    act(() => handlers.INSERT({ new: tx({ id: "sim", customer_name: "Teste Simulado", is_simulated: true }) }));
    expect(screen.queryByText("Teste Simulado")).toBeNull();

    act(() => handlers.INSERT({ new: tx({ id: "real", customer_name: "Carlos" }) }));
    await waitFor(() => expect(screen.getByText("Carlos")).toBeInTheDocument());
  });
});

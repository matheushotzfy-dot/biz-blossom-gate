import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Row = Record<string, unknown>;
const state: { plans: Row[]; subs: Row[]; updateError: { message: string } | null } = { plans: [], subs: [], updateError: null };
const updates: Row[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const select = (table: string) => ({ eq: () => ({ order: async () => ({ data: table === "subscription_plans" ? state.plans : state.subs, error: null }) }) });
  const update = (patch: Row) => ({ eq: () => ({ eq: async () => { updates.push(patch); return { error: state.updateError }; } }) });
  return { supabase: { from: (t: string) => ({ select: () => select(t), update, insert: async () => ({ error: null }) }), channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn(), rpc: vi.fn() } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useQueryData", () => ({ useProducts: () => ({ data: [] }) }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import Assinaturas from "@/pages/vendas/Assinaturas";
import { PlansGrid } from "@/components/subscriptions/PlansGrid";
import { planErrorMessage } from "@/components/subscriptions/planMeta";
import { isHeldPlan, type Plan } from "@/components/subscriptions/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "pl1", user_id: "u1", product_id: null, name: "Clube Premium", description: "Acesso ao clube.", price: 49.9, interval: "monthly", interval_count: 1, trial_days: 0,
  is_active: true, created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-01T12:00:00Z", admin_hold_at: null, admin_hold_reason: null, ...over,
});
const held = plan({ id: "pl3", name: "Plano Bronze", is_active: false, admin_hold_at: "2026-11-24T10:00:00Z", admin_hold_reason: "Promete resultado garantido" });

const grid = (plans: Plan[], onToggle = vi.fn()) => render(<PlansGrid plans={plans} subs={[]} loading={false} searching={false} onToggle={onToggle} onCreate={vi.fn()} />);

describe("plano pausado pela equipe (visão do seller)", () => {
  it("regras: isHeldPlan e mensagens do servidor em linguagem do seller", () => {
    expect(isHeldPlan({ admin_hold_at: "2026-11-24T10:00:00Z" })).toBe(true);
    expect(isHeldPlan({ admin_hold_at: null })).toBe(false);
    expect(isHeldPlan({})).toBe(false);
    expect(planErrorMessage({ message: "A equipe pausou este plano e ele só volta com a liberação do suporte." }, "x")).toBe("A equipe pausou este plano. Fale com o suporte para liberar.");
    expect(planErrorMessage({ message: "Este plano tem assinantes e não pode ser apagado. Pause o plano em vez disso." }, "x")).toMatch(/tem assinantes/);
    expect(planErrorMessage({ message: "O preço do plano precisa ser de pelo menos R$ 1,00." }, "x")).toBe("O preço do plano precisa ser de pelo menos R$ 1,00.");
    expect(planErrorMessage({ message: 'new row for relation "subscription_plans" violates check constraint "valid_price"' }, "x")).toMatch(/R\$ 1,00/);
    expect(planErrorMessage({ message: "Escolha um produto seu para este plano." }, "x")).toBe("Escolha um produto seu para este plano.");
    expect(planErrorMessage({ message: "JWT expired" }, "x")).toMatch(/sessão expirou/);
    expect(planErrorMessage({ message: "new row violates row-level security policy" }, "x")).toMatch(/permissão/);
    expect(planErrorMessage({ message: "algo" }, "Nada foi alterado.")).toBe("Nada foi alterado.");
    expect(planErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("cartão: mostra o aviso com o motivo, trava o interruptor e não diz 'Pausado' do seller", () => {
    grid([held]);
    expect(screen.getByText("Pausado pela equipe")).toBeInTheDocument();
    expect(screen.getByText(/Você não consegue reativar nem apagar este plano/)).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Promete resultado garantido/)).toBeInTheDocument();
    const sw = screen.getByRole("switch", { name: "Plano Bronze está pausado pela equipe" });
    expect(sw).toBeDisabled();
    expect(sw).not.toBeChecked();
    expect(screen.queryByText("Ativo")).toBeNull();
  });

  it("sem motivo registrado não escreve 'null'", () => {
    grid([{ ...held, admin_hold_reason: null }]);
    expect(screen.getByText(/Você não consegue reativar/)).toBeInTheDocument();
    expect(screen.queryByText(/Motivo:/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it("plano normal não muda: ativo liga/desliga e pausado pelo seller continua simples", () => {
    const onToggle = vi.fn();
    const { unmount } = grid([plan()], onToggle);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Pausar Clube Premium" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/A equipe/)).toBeNull();
    unmount();
    grid([plan({ is_active: false })]);
    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Ativar Clube Premium" })).not.toBeDisabled();
  });
});

describe("Assinaturas (seller): pausar e ativar plano", () => {
  const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Assinaturas /></MemoryRouter>
    </QueryClientProvider>,
  );

  beforeEach(() => {
    updates.length = 0; state.updateError = null; state.subs = [];
    state.plans = [plan(), held];
    vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  });

  it("pausa o plano e confirma só depois de o banco aceitar", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Pausar Clube Premium" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Plano pausado"));
    expect(updates).toEqual([{ is_active: false }]);
  });

  it("erro do banco aparece e não diz que deu certo", async () => {
    state.updateError = { message: "A equipe pausou este plano e ele só volta com a liberação do suporte." };
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Pausar Clube Premium" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A equipe pausou este plano. Fale com o suporte para liberar."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("plano retido nem chega a tentar: o interruptor fica travado e o resumo não o conta como ativo", async () => {
    renderPage();
    const sw = await screen.findByRole("switch", { name: "Plano Bronze está pausado pela equipe" });
    expect(sw).toBeDisabled();
    fireEvent.click(sw);
    expect(updates).toEqual([]);
    // planos ativos = 1 (o outro está retido), de 2 criados
    expect(screen.getByText("2 planos criados")).toBeInTheDocument();
  });
});

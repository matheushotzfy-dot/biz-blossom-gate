import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const from = vi.fn(() => ({}));
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => (from as (...x: unknown[]) => unknown)(...a), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import SubscriptionsCenter from "@/features/admin-subscriptions/SubscriptionsCenter";
import {
  checkReason, cycleStatus, cyclesLabel, dayLabel, historyLabel, intervalLabel, methodLabel, nextChargeLabel, parsePlanDetail, parsePlansPage, parseSubDetail, parseSubsPage,
  planState, subStatus,
} from "@/features/admin-subscriptions/subscriptionsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const ahead = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

const sub = (over: Record<string, unknown> = {}) => ({
  id: "u2", subscriber_name: "Rafael Menezes", subscriber_email: "rafael@exemplo.com", status: "active", billing_method: "pix", cancel_at_period_end: false,
  completed_cycles: 3, max_cycles: null, next_charge_at: ahead(12), last_payment_at: ago(400), current_period_end: ahead(12), trial_end: null, canceled_at: null, created_at: ago(2200),
  plan_id: "pl1", plan_name: "Clube Premium", plan_price: 49.9, plan_interval: "monthly", plan_interval_count: 1, plan_held: false,
  seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", monthly: 49.9, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 4, active: 2, trial: 1, late: 1, paused: 0, canceled: 0, ...over });
const overview = (over: Record<string, unknown> = {}) => ({ plans: 3, plans_live: 1, plans_held: 1, subs: 4, active: 2, trial: 1, late: 1, canceled: 0, monthly: 156.53, paid_cycles: 29, paid_amount: 1651.3, ...over });
const subsPage = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), program: overview(), generated_at: ago(0), ...over });

const plan = (over: Record<string, unknown> = {}) => ({
  id: "pl1", name: "Clube Premium", price: 49.9, interval: "monthly", interval_count: 1, trial_days: 7, is_active: true, hold_reason: null, hold_at: null, created_at: ago(2500),
  product_id: "p1", product_name: "Método Lançamento 7D", product_deleted: false, seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com",
  subs: 5, active: 3, trial: 1, late: 1, paused: 0, canceled: 1, monthly: 149.7, ...over,
});
const plansPage = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: { all: items.length, live: 1, paused: 1, held: 1 }, generated_at: ago(0), ...over });

const cycle = (n: number, status: string, over: Record<string, unknown> = {}) => ({
  id: "c" + n, cycle_number: n, due_at: ago(24 * 30 * (4 - n)), amount: 49.9, status, attempt_count: status === "paid" ? 1 : 0, last_attempt_at: null, paid_at: status === "paid" ? ago(24 * 30 * (4 - n)) : null, has_transaction: status === "paid", ...over,
});
const subDetail = (over: Record<string, unknown> = {}) => ({
  subscription: { id: "u2", subscriber_name: "Rafael Menezes", subscriber_email: "rafael@exemplo.com", has_account: true, status: "active", billing_method: "pix", cancel_at_period_end: false, completed_cycles: 2, max_cycles: null,
    current_period_start: ago(24 * 18), current_period_end: ahead(12), trial_end: null, canceled_at: null, next_charge_at: ahead(12), last_payment_at: ago(24 * 18), created_at: ago(2200) },
  plan: { id: "pl1", name: "Clube Premium", price: 49.9, interval: "monthly", interval_count: 1, trial_days: 7, is_active: true, hold_reason: null, hold_at: null, product_id: "p1", product_name: "Método Lançamento 7D" },
  seller: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "active" },
  stats: { cycles: 4, paid: 2, failed: 1, overdue: 1, paid_amount: 99.8, monthly: 49.9 },
  cycles: [cycle(4, "overdue", { paid_at: null }), cycle(3, "failed", { attempt_count: 3, paid_at: null }), cycle(2, "paid"), cycle(1, "paid")],
  history: [],
  ...over,
});
const canceledDetail = () => subDetail({
  subscription: { ...subDetail().subscription, status: "canceled", canceled_at: ago(300), next_charge_at: null },
  history: [{ id: "h1", action: "subscription_cancel", created_at: ago(300), admin_name: "Admin", details: { reason: "Pedido do assinante por e-mail" } }],
});
const planDetail = (over: Record<string, unknown> = {}) => ({
  plan: { id: "pl1", name: "Clube Premium", description: "Acesso ao clube e aulas ao vivo.", price: 49.9, interval: "monthly", interval_count: 1, trial_days: 7, is_active: true, hold_reason: null, hold_at: null, created_at: ago(2500), product_id: "p1", product_name: "Método Lançamento 7D" },
  product: { id: "p1", name: "Método Lançamento 7D", status: "active", deleted: false },
  seller: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "active" },
  stats: { subs: 5, active: 3, trial: 1, late: 1, paused: 0, canceled: 1, monthly: 149.7, paid_amount: 748.5 },
  subscriptions: [
    { id: "u1", subscriber_name: "Rafael Menezes", subscriber_email: "rafael@exemplo.com", status: "past_due", completed_cycles: 5, created_at: ago(900) },
    { id: "u3", subscriber_name: null, subscriber_email: "ana@exemplo.com", status: "trialing", completed_cycles: 0, created_at: ago(100) },
  ],
  history: [],
  ...over,
});
const heldPlanDetail = () => planDetail({
  plan: { ...planDetail().plan, name: "Plano Bronze", is_active: false, hold_at: ago(30), hold_reason: "Promete resultado garantido" },
  history: [{ id: "h9", action: "plan_hold", created_at: ago(30), admin_name: "Admin", details: { reason: "Promete resultado garantido" } }],
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const openSub = (name: string) => fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Ver assinatura de ${name}` }));
const openPlan = (name: string) => fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Ver plano ${name}` }));
const goPlans = async () => { fireEvent.click(screen.getByRole("button", { name: "Planos" })); await screen.findAllByText("Plano Bronze"); };

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_subscriptions_page = () => ({
    data: subsPage([
      sub({ id: "u1", status: "past_due", subscriber_name: "Larissa Gomes", subscriber_email: "larissa@exemplo.com", next_charge_at: ago(60), completed_cycles: 5, monthly: 0 }),
      sub(),
      sub({ id: "u3", status: "trialing", subscriber_name: null, subscriber_email: "ana@exemplo.com", trial_end: ahead(5), next_charge_at: ahead(5), last_payment_at: null, completed_cycles: 0, monthly: 0 }),
      sub({ id: "u4", cancel_at_period_end: true, subscriber_name: "Caio Teixeira", subscriber_email: "caio@exemplo.com", plan_held: true, plan_id: "pl3", plan_name: "Plano Bronze", plan_interval_count: 3, max_cycles: 12 }),
    ]),
    error: null,
  });
  handlers.get_admin_subscription_plans_page = () => ({
    data: plansPage([
      plan(),
      plan({ id: "pl3", name: "Plano Bronze", is_active: false, hold_at: ago(30), hold_reason: "Promete resultado garantido", price: 19.9, interval_count: 3, trial_days: 0, subs: 1, active: 1, trial: 0, late: 0, canceled: 0, monthly: 6.63, seller_name: "Loja do Caio" }),
      plan({ id: "pl4", name: "Plano Semanal", is_active: false, interval: "weekly", price: 9.9, trial_days: 0, product_deleted: true, subs: 0, active: 0, trial: 0, late: 0, canceled: 0, monthly: 0 }),
    ]),
    error: null,
  });
  handlers.get_admin_subscription_detail = () => ({ data: subDetail(), error: null });
  handlers.get_admin_subscription_plan_detail = () => ({ data: planDetail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("subscriptionsModel", () => {
  it("lê a lista de assinaturas e rejeita formato inesperado", () => {
    const p = parseSubsPage(subsPage([sub({ plan_price: "49.9", completed_cycles: "3", subscriber_name: "", plan_name: "", plan_interval_count: 0, max_cycles: "" })]));
    expect(p.items[0]).toMatchObject({ plan_price: 49.9, completed_cycles: 3, subscriber_name: null, plan_name: "Plano sem nome", plan_interval_count: 1, max_cycles: null, plan_held: false });
    expect(p.summary).toEqual({ all: 4, active: 2, trial: 1, late: 1, paused: 0, canceled: 0 });
    expect(p.program).toMatchObject({ plans_held: 1, monthly: 156.53, paid_cycles: 29 });
    expect(() => parseSubsPage(null)).toThrow();
    expect(() => parseSubsPage({ items: "x" })).toThrow();
  });

  it("lê a lista de planos", () => {
    const p = parsePlansPage(plansPage([plan({ price: "49.9", hold_reason: "", product_name: null })]));
    expect(p.items[0]).toMatchObject({ price: 49.9, hold_reason: null, product_name: null, is_active: true, subs: 5 });
    expect(p.summary).toEqual({ all: 1, live: 1, paused: 1, held: 1 });
    expect(() => parsePlansPage({})).toThrow();
  });

  it("lê o raio-X da assinatura e do plano", () => {
    const d = parseSubDetail(subDetail());
    expect(d.stats).toMatchObject({ paid: 2, failed: 1, overdue: 1, paid_amount: 99.8 });
    expect(d.cycles).toHaveLength(4);
    expect(d.cycles[0]).toMatchObject({ cycle_number: 4, status: "overdue", paid_at: null });
    expect(d.subscription.has_account).toBe(true);
    expect(d.seller.name).toBe("Marina Duarte");
    expect(parseSubDetail(canceledDetail()).history[0]).toMatchObject({ action: "subscription_cancel", reason: "Pedido do assinante por e-mail", admin_name: "Admin" });
    expect(() => parseSubDetail({})).toThrow();
    const p = parsePlanDetail(heldPlanDetail());
    expect(p.plan).toMatchObject({ name: "Plano Bronze", hold_reason: "Promete resultado garantido" });
    expect(p.subscriptions).toHaveLength(2);
    expect(p.product).toMatchObject({ name: "Método Lançamento 7D", deleted: false });
    expect(parsePlanDetail(planDetail({ product: null })).product).toBeNull();
    expect(() => parsePlanDetail({})).toThrow();
  });

  it("status reais da assinatura e da cobrança (sem 'expirada' nem 'cancelled')", () => {
    expect(subStatus("active")).toEqual({ label: "Ativa", tone: "success" });
    expect(subStatus("trialing").label).toBe("Em teste");
    expect(subStatus("past_due")).toEqual({ label: "Atrasada", tone: "warning" });
    expect(subStatus("paused").label).toBe("Pausada");
    expect(subStatus("canceled").label).toBe("Cancelada");
    expect(subStatus("expired").label).toBe("Outro status");
    expect(cycleStatus("paid")).toEqual({ label: "Pago", tone: "success" });
    expect(cycleStatus("failed").tone).toBe("destructive");
    expect(cycleStatus("overdue").label).toBe("Atrasado");
    expect(cycleStatus("scheduled").label).toBe("Agendado");
    expect(cycleStatus("x").label).toBe("Outro status");
  });

  it("situação do plano: pausa da equipe vence a do seller", () => {
    expect(planState({ is_active: true, hold_at: null })).toEqual({ label: "No ar", tone: "success" });
    expect(planState({ is_active: false, hold_at: null }).label).toBe("Pausado pelo seller");
    expect(planState({ is_active: false, hold_at: ago(1) })).toEqual({ label: "Pausado pela equipe", tone: "destructive" });
  });

  it("textos: intervalo, método, progresso, dia e próxima cobrança", () => {
    expect(intervalLabel("monthly", 1)).toBe("por mês");
    expect(intervalLabel("monthly", 3)).toBe("a cada 3 meses");
    expect(intervalLabel("yearly", 1)).toBe("por ano");
    expect(intervalLabel("weekly", 2)).toBe("a cada 2 semanas");
    expect(intervalLabel("daily", 1)).toBe("por dia");
    expect(methodLabel("credit_card")).toBe("Cartão");
    expect(methodLabel("pix")).toBe("Pix");
    expect(methodLabel("x")).toBe("—");
    expect(cyclesLabel(1, null)).toBe("1 cobrança paga");
    expect(cyclesLabel(5, 12)).toBe("5 cobranças pagas de 12");
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(dayLabel(null)).toBe("—");
    expect(dayLabel("lixo")).toBe("—");
    const base = { status: "active", next_charge_at: "2026-12-07T12:00:00Z", cancel_at_period_end: false, current_period_end: "2026-12-07T12:00:00Z" };
    expect(nextChargeLabel(base)).toBe("07/12/2026");
    expect(nextChargeLabel({ ...base, next_charge_at: null })).toBe("Não agendada");
    expect(nextChargeLabel({ ...base, cancel_at_period_end: true })).toBe("Encerra em 07/12/2026");
    expect(nextChargeLabel({ ...base, status: "canceled" })).toBe("Sem nova cobrança");
    expect(historyLabel("subscription_cancel")).toBe("Cancelada pela equipe");
    expect(historyLabel("plan_hold")).toBe("Plano pausado pela equipe");
    expect(historyLabel("plan_release")).toBe("Plano liberado para o seller reativar");
    expect(historyLabel("outra")).toBe("Ação registrada");
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("  ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Fraude")).toBeNull();
  });
});

/* ───────── tela ───────── */

describe("SubscriptionsCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<SubscriptionsCenter isAdmin={false} />);
    expect(screen.getByText("As assinaturas são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra totais, aviso honesto sobre cobrança e a lista pela RPC (nunca lê a tabela)", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    const list = calls("get_admin_subscriptions_page");
    expect(list.some((c) => c._page === 1 && c._page_size === 25 && c._filter === "all" && c._search === null)).toBe(true);
    expect(from).not.toHaveBeenCalled();
    expect(calls("get_admin_subscription_plans_page")).toHaveLength(0);
    expect(screen.getByText("1 assinatura atrasada")).toBeInTheDocument();
    expect(screen.getByText(/cobrança automática de cada ciclo ainda não existe/)).toBeInTheDocument();
    expect(screen.getByText("R$ 156,53")).toBeInTheDocument();
    expect(screen.getByText("de 3 · 1 pausados")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getByText("Atrasada")).toBeInTheDocument();
    expect(within(rows[0]).getByText("5 cobranças pagas")).toBeInTheDocument();
    expect(within(rows[1]).getByText("R$ 49,90")).toBeInTheDocument();
    expect(within(rows[1]).getByText("por mês · Pix")).toBeInTheDocument();
    expect(within(rows[2]).getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Sem nome informado")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Em teste")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Nenhum pagamento")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Plano pausado pela equipe")).toBeInTheDocument();
    expect(within(rows[3]).getByText(/Encerra em/)).toBeInTheDocument();
    expect(within(rows[3]).getByText("3 cobranças pagas de 12")).toBeInTheDocument();
    expect(within(rows[3]).getByText("a cada 3 meses · Pix")).toBeInTheDocument();
    expect(screen.getByText("Todas · 4")).toBeInTheDocument();
    expect(screen.getByText("Atrasadas · 1")).toBeInTheDocument();
  });

  it("sem atrasada nem plano pausado o aviso do topo fica tranquilo", async () => {
    handlers.get_admin_subscriptions_page = () => ({ data: subsPage([sub()], { summary: summary({ late: 0 }), program: overview({ late: 0, plans_held: 0 }) }), error: null });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    expect(screen.getByText("2 assinaturas ativas")).toBeInTheDocument();
  });

  it("filtro e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    fireEvent.click(screen.getByRole("button", { name: /^Atrasadas/ }));
    await waitFor(() => expect(calls("get_admin_subscriptions_page").at(-1)).toMatchObject({ _filter: "late", _page: 1 }));
    fireEvent.change(screen.getByLabelText("Buscar assinaturas"), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_subscriptions_page").at(-1)).toMatchObject({ _filter: "late", _search: "caio" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar assinaturas") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_subscriptions_page").at(-1)).toMatchObject({ _filter: "all", _search: null }));
  });

  it("visão de planos usa a própria RPC, filtros próprios e mostra a situação real", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    fireEvent.click(screen.getByRole("button", { name: "Planos" }));
    await screen.findAllByText("Plano Bronze");
    expect(calls("get_admin_subscription_plans_page")[0]).toEqual({ _filter: "all", _search: null, _page: 1, _page_size: 25 });
    const rows = tableRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("No ar")).toBeInTheDocument();
    expect(within(rows[0]).getByText("5 assinantes")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/7 dias de teste/)).toBeInTheDocument();
    expect(within(rows[0]).getByText("R$ 149,70")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Pausado pela equipe")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Motivo: Promete resultado garantido/)).toBeInTheDocument();
    expect(within(rows[2]).getByText("Pausado pelo seller")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Método Lançamento 7D \(apagado\)/)).toBeInTheDocument();
    expect(within(rows[2]).getByText("Ninguém assinou ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pausados pela equipe/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Pausados pela equipe/ }));
    await waitFor(() => expect(calls("get_admin_subscription_plans_page").at(-1)).toMatchObject({ _filter: "held" }));
    fireEvent.change(screen.getByLabelText("Buscar planos"), { target: { value: "bronze" } });
    await waitFor(() => expect(calls("get_admin_subscription_plans_page").at(-1)).toMatchObject({ _filter: "held", _search: "bronze" }));
  });

  it("os números do topo continuam certos na visão de planos", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    fireEvent.click(screen.getByRole("button", { name: "Planos" }));
    await screen.findAllByText("Plano Bronze");
    expect(screen.getByText("R$ 156,53")).toBeInTheDocument();
    expect(screen.getByText("de 3 · 1 pausados")).toBeInTheDocument();
  });

  it("sem resultado e sem assinaturas têm textos diferentes", async () => {
    handlers.get_admin_subscriptions_page = () => ({ data: subsPage([], { summary: summary({ all: 0, active: 0, trial: 0, late: 0 }), program: overview({ plans: 0, plans_live: 0, plans_held: 0, subs: 0, active: 0, trial: 0, late: 0, monthly: 0 }) }), error: null });
    wrap(<SubscriptionsCenter />);
    expect(await screen.findByText("Nenhuma assinatura ainda")).toBeInTheDocument();
    expect(screen.getByText("nenhum plano criado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar assinaturas"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso e tenta de novo", async () => {
    handlers.get_admin_subscriptions_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<SubscriptionsCenter />);
    expect(await screen.findByText("Não foi possível carregar as assinaturas.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    handlers.get_admin_subscriptions_page = () => ({ data: subsPage([sub()]), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("Rafael Menezes")).length).toBeGreaterThan(0);
  });

  it("raio-X da assinatura mostra cobranças, dados e avisa do plano pausado e do cancelamento agendado", async () => {
    handlers.get_admin_subscription_detail = () => ({
      data: subDetail({
        subscription: { ...subDetail().subscription, cancel_at_period_end: true },
        plan: { ...subDetail().plan, hold_at: ago(30), hold_reason: "Promete resultado garantido", is_active: false },
      }),
      error: null,
    });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    openSub("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Cobrança 4")).toBeInTheDocument();
    expect(calls("get_admin_subscription_detail")[0]).toEqual({ _id: "u2" });
    expect(within(dlg).getByText("Atrasado")).toBeInTheDocument();
    expect(within(dlg).getByText("Falhou")).toBeInTheDocument();
    expect(within(dlg).getAllByText("Pago")).toHaveLength(2);
    expect(within(dlg).getByText(/3 tentativas/)).toBeInTheDocument();
    expect(within(dlg).getByText("R$ 99,80")).toBeInTheDocument();
    expect(within(dlg).getByText(/O plano está pausado pela equipe desde/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Motivo: Promete resultado garantido/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Cancelamento agendado/)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Cancelar assinatura" })).toBeInTheDocument();
  });

  it("assinatura cancelada não oferece cancelar de novo e mostra o histórico", async () => {
    handlers.get_admin_subscription_detail = () => ({ data: canceledDetail(), error: null });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    openSub("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Cancelada pela equipe")).toBeInTheDocument();
    expect(within(dlg).getByText("Pedido do assinante por e-mail")).toBeInTheDocument();
    expect(within(dlg).getByText("Sem nova cobrança")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Cancelar assinatura" })).toBeNull();
    expect(within(dlg).queryByText(/Cancelamento agendado/)).toBeNull();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_subscription_detail = () => ({ data: null, error: { message: "assinatura não encontrada" } });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    openSub("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/assinatura não encontrada/)).toBeInTheDocument();
    handlers.get_admin_subscription_detail = () => ({ data: subDetail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("Cobrança 4")).toBeInTheDocument();
  });

  it("cancelar a assinatura: exige motivo, pede senha, avisa o que não desfaz e chama a RPC", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    openSub("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Cancelar assinatura" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Cancelar assinatura?")).toBeInTheDocument();
    expect(within(mod).getByText(/Um Pix que já foi gerado não é desfeito e nenhum valor é devolvido/)).toBeInTheDocument();
    // sem motivo: nada é enviado e o erro aparece
    fireEvent.click(within(mod).getByRole("button", { name: "Cancelar assinatura" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_cancel_subscription")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(mod).getByRole("button", { name: "Pedido do assinante" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Pedido do assinante");
    fireEvent.click(within(mod).getByRole("button", { name: "Cancelar assinatura" }));
    await waitFor(() => expect(calls("admin_cancel_subscription")).toHaveLength(1));
    expect(calls("admin_cancel_subscription")[0]).toEqual({ _id: "u2", _reason: "Pedido do assinante" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Cancelar assinatura: Rafael Menezes, no plano Clube Premium\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Assinatura cancelada."));
    await waitFor(() => expect(calls("get_admin_subscriptions_page").length).toBeGreaterThan(1));
  });

  it("erro do servidor ao cancelar aparece no diálogo e nada é dado como feito", async () => {
    handlers.admin_cancel_subscription = () => ({ data: null, error: { message: "esta assinatura já está cancelada" } });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    openSub("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Cancelar assinatura" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Fraude confirmada" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Cancelar assinatura" }));
    expect(await within(mod).findByText(/esta assinatura já está cancelada/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("raio-X do plano mostra assinantes, receita estimada e oferece pausar", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    await goPlans();
    openPlan("Clube Premium");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("ana@exemplo.com")).toBeInTheDocument();
    expect(calls("get_admin_subscription_plan_detail")[0]).toEqual({ _id: "pl1" });
    expect(within(dlg).getByText("receita estimada pelo preço do plano")).toBeInTheDocument();
    expect(within(dlg).getByText("R$ 149,70")).toBeInTheDocument();
    expect(within(dlg).getByText("R$ 748,50 pagos")).toBeInTheDocument();
    expect(within(dlg).getByText("Atrasada")).toBeInTheDocument();
    expect(within(dlg).getByText("Mostrando as 2 assinaturas mais recentes.", { exact: false })).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Pausar plano" })).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Liberar plano" })).toBeNull();
  });

  it("pausar o plano: exige motivo, pede senha e manda _hold true", async () => {
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    await goPlans();
    openPlan("Clube Premium");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar plano" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Pausar plano?")).toBeInTheDocument();
    expect(within(mod).getByText(/o seller não consegue reativar nem apagar/)).toBeInTheDocument();
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar plano" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_set_plan_hold")).toHaveLength(0);
    fireEvent.click(within(mod).getByRole("button", { name: "Promessa enganosa" }));
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar plano" }));
    await waitFor(() => expect(calls("admin_set_plan_hold")).toHaveLength(1));
    expect(calls("admin_set_plan_hold")[0]).toEqual({ _plan_id: "pl1", _hold: true, _reason: "Promessa enganosa" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Pausar plano: Clube Premium, de Marina Duarte\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Plano pausado. O seller não reativa sozinho."));
    await waitFor(() => expect(calls("get_admin_subscription_plans_page").length).toBeGreaterThan(1));
  });

  it("plano pausado pela equipe: mostra motivo e histórico e oferece liberar (o seller decide reativar)", async () => {
    handlers.get_admin_subscription_plan_detail = () => ({ data: heldPlanDetail(), error: null });
    wrap(<SubscriptionsCenter />);
    await screen.findAllByText("Rafael Menezes");
    await goPlans();
    openPlan("Plano Bronze");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Pausado pela equipe desde/)).toBeInTheDocument();
    expect(within(dlg).getAllByText(/Promete resultado garantido/).length).toBeGreaterThan(0);
    expect(within(dlg).getByText("Plano pausado pela equipe")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Pausar plano" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Liberar plano" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText(/quem decide reativar é o seller/)).toBeInTheDocument();
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Seller corrigiu a página" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Liberar plano" }));
    await waitFor(() => expect(calls("admin_set_plan_hold")).toHaveLength(1));
    expect(calls("admin_set_plan_hold")[0]).toEqual({ _plan_id: "pl3", _hold: false, _reason: "Seller corrigiu a página" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Plano liberado. O seller decide quando reativar."));
  });
});

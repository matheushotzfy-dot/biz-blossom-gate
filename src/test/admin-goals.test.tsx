import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() }, storage: { from: () => ({}) } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const askReason = vi.fn();
const askConfirm = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: askConfirm, dialog: null }),
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
const copySpy = vi.fn();
vi.mock("@/components/seller-ui/copy", () => ({ copyText: (...a: unknown[]) => copySpy(...a) }));

import { toast } from "sonner";
import GoalsCenter from "@/features/admin-goals/GoalsCenter";
import {
  awardSteps, awardTag, brl, goalErrors, goalNeedsPassword, goalTag, heroStatus, historyEntry, matchesFilter, parseGoalDetail, parseGoals, pctOf, reachedText, statsOf,
  type GoalForm, type RankRow,
} from "@/features/admin-goals/goalsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const G1 = "gggggggg-0000-4000-8000-000000000001";
const G2 = "gggggggg-0000-4000-8000-000000000002";
const NBSP = String.fromCharCode(160);
const nb = (s: string) => s.split(NBSP).join(" ");

const core = (over: Record<string, unknown> = {}) => ({
  id: G1, title: "Meta de novembro", description: "Quem somar R$ 10.000 líquidos leva o prêmio.", target: 10000, starts_at: ago(24 * 10), ends_at: ago(-24 * 20),
  reward_title: "iPhone 16 Pro", reward_description: "Entrega em até 15 dias úteis.", is_active: true, created_at: ago(24 * 12), ...over,
});
const item = (over: Record<string, unknown> = {}) => ({ ...core(), sellers: 3, reached: 2, to_deliver: 1, revenue: 29790.8, top: 12100, awards: { pending: 0, paid: 1, cancelled: 0 }, ...over });
const goals = (items: unknown[] = [item(), item({ id: G2, title: "Rascunho de teste", is_active: false, reached: 0, to_deliver: 0, sellers: 0, revenue: 0, top: 0, awards: { pending: 0, paid: 0, cancelled: 0 }, reward_title: "Brinde" })]) => ({ items, total: items.length });

const row = (over: Record<string, unknown> = {}) => ({ seller_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", revenue: 12100, sales: 120, reached: true, award: null, ...over });
const paidAward = { id: "a1", status: "paid", paid_at: ago(5), note: "Entregue pessoalmente no evento", amount: 12100, registered_at: ago(5) };
const detail = (over: Record<string, unknown> = {}) => ({
  goal: core(), totals: { sellers: 3, revenue: 29790.8, sales: 252 },
  ranking: {
    total: 3, items: [
      row({ award: paidAward }),
      row({ seller_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com", revenue: 10480.5, sales: 133 }),
      row({ seller_id: "s3", name: "Estúdio Lume", email: "contato@lume.com.br", revenue: 7210.3, sales: 96, reached: false }),
    ],
  },
  history: [
    { at: ago(24 * 2), action: "goal_award_paid", by: "Admin", details: { seller_name: "Marina Duarte", amount: 12100, note: "Pix de reembolso enviado" } },
    { at: ago(24 * 10), action: "goal_activate", by: "Admin", details: {} },
    { at: ago(24 * 12), action: "goal_create", by: "Admin", details: { title: "Meta de novembro", target: 10000, reward: "iPhone 16 Pro" } },
  ],
  ...over,
});
/** Meta em andamento, sem nenhum prêmio registrado: valor e datas ainda podem mudar. */
const detailOpen = () => detail({ ranking: { total: 2, items: [row(), row({ seller_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com", revenue: 10480.5, sales: 133 })] } });
const detailDraft = (over: Record<string, unknown> = {}) => detail({
  goal: core({ id: G2, title: "Rascunho de teste", is_active: false, reward_title: "Brinde", starts_at: ago(-24 * 5), ends_at: ago(-24 * 35) }),
  totals: { sellers: 0, revenue: 0, sales: 0 }, ranking: { total: 0, items: [] }, history: [], ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); askReason.mockReset(); askConfirm.mockReset(); confirmSpy.mockReset(); copySpy.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_goals = () => ({ data: goals(), error: null });
  handlers.get_admin_goal_detail = (a) => ({ data: a._id === G2 ? detailDraft() : detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { id: G1 }, error: null }));
});

const open = async () => { wrap(<GoalsCenter />); await screen.findByRole("heading", { level: 2, name: "Meta de novembro" }); };
const openDraft = async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: /Rascunho de teste/ }));
  await screen.findByRole("heading", { level: 2, name: "Rascunho de teste" });
};
const tab = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/* ───────── modelo ───────── */

describe("modelo das metas do admin", () => {
  it("lê a lista e o detalhe com tolerância e recusa o que não vem do servidor", () => {
    const l = parseGoals({ items: [item({ target: "5000", sellers: "x" }), "lixo"], total: 7 });
    expect(l.items).toHaveLength(1);
    expect(l.items[0].target).toBe(5000);
    expect(l.items[0].sellers).toBe(0);
    expect(l.total).toBe(7);
    expect(() => parseGoals(null)).toThrow("Resposta inesperada");
    expect(() => parseGoalDetail({})).toThrow("Resposta inesperada");
    const d = parseGoalDetail(detail({ ranking: { total: 0, items: [row({ award: { ...paidAward, status: "qualquer" }, name: "" })] } }));
    expect(d.ranking.items[0].award?.status).toBe("pending");
    expect(d.ranking.items[0].name).toBe("Seller");
    expect(d.ranking.total).toBe(1);
  });

  it("rotula a meta pela situação, e oculta vence qualquer fase", () => {
    const now = Date.now();
    expect(goalTag({ is_active: false, starts_at: ago(5), ends_at: ago(-5) }, now)).toEqual({ label: "Oculta", tone: "neutral" });
    expect(goalTag({ is_active: true, starts_at: ago(5), ends_at: ago(-5) }, now).label).toBe("No ar");
    expect(goalTag({ is_active: true, starts_at: ago(-5), ends_at: ago(-50) }, now).label).toBe("Agendada");
    expect(goalTag({ is_active: true, starts_at: ago(50), ends_at: ago(5) }, now)).toEqual({ label: "Encerrada, visível", tone: "warning" });
  });

  it("filtra por situação", () => {
    const now = Date.now();
    const live = parseGoals(goals([item()])).items[0];
    const hidden = parseGoals(goals([item({ is_active: false })])).items[0];
    const done = parseGoals(goals([item({ starts_at: ago(24 * 40), ends_at: ago(24 * 10) })])).items[0];
    const next = parseGoals(goals([item({ starts_at: ago(-24), ends_at: ago(-24 * 9) })])).items[0];
    expect(matchesFilter(live, "all", now)).toBe(true);
    expect(matchesFilter(live, "live", now)).toBe(true);
    expect(matchesFilter(hidden, "live", now)).toBe(false);
    expect(matchesFilter(hidden, "hidden", now)).toBe(true);
    expect(matchesFilter(done, "ended", now)).toBe(true);
    expect(matchesFilter(next, "scheduled", now)).toBe(true);
    expect(matchesFilter(next, "live", now)).toBe(false);
  });

  it("soma só o que está no ar e resume o topo", () => {
    const l = parseGoals(goals([item(), item({ id: G2, is_active: false, reached: 4, to_deliver: 3, awards: { pending: 0, paid: 2, cancelled: 0 } })]));
    expect(statsOf(l.items)).toEqual({ live: 1, reachedLive: 2, toDeliver: 4, delivered: 3 });
    expect(heroStatus(undefined, true).tone).toBe("destructive");
    expect(heroStatus(undefined, false).label).toMatch(/Carregando/);
    expect(heroStatus(parseGoals(goals([])), false).label).toBe("Nenhuma meta criada");
    expect(heroStatus(l, false)).toEqual({ tone: "warning", label: "4 prêmios a entregar" });
    expect(heroStatus(parseGoals(goals([item({ to_deliver: 0 })])), false)).toEqual({ tone: "success", label: "1 meta no ar", pulse: true });
    expect(heroStatus(parseGoals(goals([item({ to_deliver: 0, is_active: false })])), false).label).toBe("Nenhuma meta no ar");
  });

  it("mostra a porcentagem sem arredondar para cima antes de bater", () => {
    expect(pctOf(0, 0)).toBe(0);
    expect(pctOf(50, 10000)).toBe(0);
    expect(pctOf(5000, 10000)).toBe(50);
    expect(pctOf(9999.99, 10000)).toBe(99);
    expect(pctOf(10000, 10000)).toBe(100);
    expect(pctOf(25000, 10000)).toBe(100);
    expect(pctOf(-5, 100)).toBe(0);
  });

  it("valida a meta como o servidor", () => {
    const ok: GoalForm = { title: "Meta de dezembro", description: "", target: "10.000,00", starts: "2026-12-01T00:00", ends: "2026-12-31T23:59", reward_title: "AirPods", reward_description: "" };
    expect(goalErrors(ok)).toEqual({});
    expect(goalErrors({ ...ok, title: "  ab " }).title).toMatch(/3 a 80/);
    expect(goalErrors({ ...ok, description: "x".repeat(501) }).description).toMatch(/500/);
    expect(goalErrors({ ...ok, target: "" }).target).toBe("Informe o valor da meta.");
    expect(goalErrors({ ...ok, target: "0,00" }).target).toBe("Informe o valor da meta.");
    expect(goalErrors({ ...ok, target: "100.000.001,00" }).target).toMatch(/100\.000\.000/);
    expect(goalErrors({ ...ok, starts: "" }).starts).toBe("Informe o início.");
    expect(goalErrors({ ...ok, ends: "" }).ends).toBe("Informe o fim.");
    expect(goalErrors({ ...ok, ends: "2026-12-01T00:00" }).ends).toMatch(/depois do início/);
    expect(goalErrors({ ...ok, ends: "2028-12-31T23:59" }).ends).toMatch(/400 dias/);
    expect(goalErrors({ ...ok, reward_title: " a " }).reward_title).toMatch(/2 a 80/);
    expect(goalErrors({ ...ok, reward_description: "x".repeat(501) }).reward_description).toMatch(/500/);
  });

  it("pede senha só quando valor ou datas de uma meta que já começou mudam", () => {
    const started = { starts_at: "2026-11-01T03:00:00.000Z", ends_at: "2026-12-01T03:00:00.000Z", target: 10000 };
    const same = { target: "10.000,00", starts: "2026-11-01T00:00", ends: "2026-12-01T00:00" };
    const during = Date.parse("2026-11-10T00:00:00Z");
    expect(goalNeedsPassword(started, same, during)).toBe(false);
    expect(goalNeedsPassword(started, { ...same, target: "12.000,00" }, during)).toBe(true);
    expect(goalNeedsPassword(started, { ...same, ends: "2026-12-15T00:00" }, during)).toBe(true);
    expect(goalNeedsPassword(started, { ...same, starts: "2026-11-02T00:00" }, during)).toBe(true);
    expect(goalNeedsPassword(started, { ...same, target: "12.000,00" }, Date.parse("2026-10-10T00:00:00Z"))).toBe(false);
    expect(goalNeedsPassword(null, same)).toBe(false);
  });

  it("oferece só os passos que o servidor aceita para o prêmio", () => {
    expect(awardSteps(null).map((s) => s.to)).toEqual(["paid", "cancelled"]);
    expect(awardSteps("pending").map((s) => s.to)).toEqual(["paid", "cancelled"]);
    expect(awardSteps("cancelled").map((s) => s.to)).toEqual(["pending"]);
    expect(awardSteps("paid")).toEqual([]);
    const [pay] = awardSteps(null);
    expect(pay.title("Ana")).toBe("Marcar o prêmio de Ana como entregue?");
    expect(pay.description("AirPods")).toMatch(/AirPods/);
  });

  it("rotula o prêmio de quem bateu", () => {
    const r = (reached: boolean, status?: string) => ({ reached, award: status ? { ...paidAward, status } : null }) as Pick<RankRow, "reached" | "award">;
    expect(awardTag(r(false))).toBeNull();
    expect(awardTag(r(true))?.label).toBe("A entregar");
    expect(awardTag(r(true, "pending"))?.label).toBe("A entregar");
    expect(awardTag(r(true, "paid"))?.label).toBe("Entregue");
    expect(awardTag(r(true, "cancelled"))?.label).toBe("Cancelado");
    expect(awardTag(r(false, "paid"))?.tone).toBe("success");
  });

  it("conta o histórico em português", () => {
    expect(historyEntry({ at: ago(1), action: "goal_activate", by: null, details: {} }).title).toBe("Colocada no ar");
    expect(historyEntry({ at: ago(1), action: "goal_deactivate", by: null, details: {} }).title).toBe("Ocultada");
    const c = historyEntry({ at: ago(1), action: "goal_create", by: null, details: { title: "Meta X", target: 8000, reward: "iPad" } });
    expect(nb(c.text ?? "")).toBe("“Meta X”\nMeta de R$ 8.000,00\nPrêmio: iPad\nNasceu oculta.");
    const u = historyEntry({ at: ago(1), action: "goal_update", by: null, details: { title: "Meta X", target_from: 8000, target_to: 10000, reward_from: "iPad", reward_to: "iPhone" } });
    expect(nb(u.text ?? "")).toContain("Valor: R$ 8.000,00 para R$ 10.000,00");
    expect(u.text).toContain("Prêmio: iPad para iPhone");
    const p = historyEntry({ at: ago(1), action: "goal_award_paid", by: null, details: { seller_name: "Ana", amount: 12100, note: "Pix enviado" } });
    expect(p.title).toBe("Prêmio entregue");
    expect(nb(p.text ?? "")).toBe("Ana, R$ 12.100,00 na meta\nEntrega: Pix enviado");
    expect(historyEntry({ at: ago(1), action: "goal_award_cancelled", by: null, details: { seller_name: "Ana", note: "Pediu para não receber" } }).text).toContain("Motivo: Pediu para não receber");
    expect(historyEntry({ at: ago(1), action: "goal_award_pending", by: null, details: {} }).title).toBe("Prêmio reaberto");
    expect(historyEntry({ at: ago(1), action: "goal_delete", by: null, details: { title: "Meta X", reason: "Duplicada" } }).text).toContain("Motivo: Duplicada");
    expect(historyEntry({ at: ago(1), action: "qualquer", by: null, details: {} }).title).toBe("Alteração na meta");
  });

  it("monta a lista de quem bateu para copiar", () => {
    const d = parseGoalDetail(detail({ ranking: { total: 3, items: [row({ award: paidAward }), row({ seller_id: "s2", name: "Loja do Caio", email: null, revenue: 10480.5 }), row({ seller_id: "s3", name: "Estúdio Lume", reached: false, revenue: 7000 })] } }));
    const text = nb(reachedText(d.goal, d.ranking.items));
    expect(text).toContain("Meta de novembro (meta de R$ 10.000,00, prêmio: iPhone 16 Pro)");
    expect(text).toContain("Marina Duarte <marina@exemplo.com>, R$ 12.100,00, entregue");
    expect(text).toContain("Loja do Caio, R$ 10.480,50, a entregar");
    expect(text).not.toContain("Estúdio Lume");
    expect(reachedText(d.goal, [])).toContain("Ninguém bateu a meta ainda.");
  });

  it("formata reais com centavos e nunca devolve NaN", () => {
    expect(nb(brl(10000))).toBe("R$ 10.000,00");
    expect(nb(brl(0.5))).toBe("R$ 0,50");
    expect(nb(brl(Number.NaN))).toBe("R$ 0,00");
  });
});

/* ───────── tela ───────── */

describe("Metas do admin", () => {
  it("só o administrador abre e nada é consultado sem a permissão", () => {
    wrap(<GoalsCenter isAdmin={false} />);
    expect(screen.getByText("A gestão das metas é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("diz de frente que os sellers ainda não veem as metas", async () => {
    await open();
    expect(screen.getByRole("note")).toHaveTextContent(/Os sellers ainda não têm uma tela para ver as metas/);
  });

  it("mostra a meta, o aviso de prêmio a entregar e o ranking com valores exatos", async () => {
    await open();
    expect(screen.getByText("1 prêmio a entregar")).toBeInTheDocument();
    expect(screen.getByText(/1 seller bateu a meta e ainda não tem o prêmio registrado como entregue/)).toBeInTheDocument();
    expect(screen.getByText(/A meta ainda está correndo/)).toBeInTheDocument();
    const rank = screen.getByRole("list", { name: "Ranking da meta" });
    expect(within(rank).getByText("Marina Duarte")).toBeInTheDocument();
    expect(within(rank).getByText("marina@exemplo.com")).toBeInTheDocument();
    expect(within(rank).getByText("R$ 10.480,50")).toBeInTheDocument();
    expect(within(rank).getByRole("progressbar", { name: "Estúdio Lume: 72% da meta" })).toBeInTheDocument();
    expect(within(rank).getByText(/Entregue em .*: Entregue pessoalmente no evento/)).toBeInTheDocument();
    expect(calls("get_admin_goal_detail")[0]._id).toBe(G1);
  });

  it("mostra erro com nova tentativa quando a lista falha", async () => {
    handlers.get_admin_goals = () => ({ error: { message: "falhou" } });
    wrap(<GoalsCenter />);
    expect(await screen.findByText("Não foi possível carregar as metas.")).toBeInTheDocument();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    handlers.get_admin_goals = () => ({ data: goals(), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Meta de novembro" })).toBeInTheDocument();
  });

  it("mostra erro com nova tentativa quando o detalhe de uma meta falha", async () => {
    await open();
    handlers.get_admin_goal_detail = () => ({ error: { message: "falhou" } });
    fireEvent.click(screen.getByRole("button", { name: /Rascunho de teste/ }));
    expect(await screen.findByText("Não foi possível carregar a meta.")).toBeInTheDocument();
  });

  it("sem meta criada, convida a criar a primeira", async () => {
    handlers.get_admin_goals = () => ({ data: goals([]), error: null });
    wrap(<GoalsCenter />);
    expect((await screen.findAllByText("Nenhuma meta criada")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Criar a primeira meta/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Nova meta");
  });

  it("filtra a lista por situação", async () => {
    await open();
    tab(/Ocultas · 1/);
    expect(screen.queryByRole("button", { name: /Meta de novembro/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Rascunho de teste/ })).toBeInTheDocument();
    tab(/Agendadas · 0/);
    expect(screen.getByText("Nenhuma meta neste filtro.")).toBeInTheDocument();
  });

  it("cria uma meta com as datas em horário de Brasília e avisa que nasce oculta", async () => {
    handlers.admin_save_goal = () => ({ data: { id: G2 }, error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Nova meta/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText("Valor da meta")).toHaveAttribute("placeholder", "0,00");
    fireEvent.change(within(dlg).getByLabelText("Nome da meta"), { target: { value: "Meta de dezembro" } });
    fireEvent.change(within(dlg).getByLabelText("Valor da meta"), { target: { value: "1000000" } });
    expect(within(dlg).getByLabelText("Valor da meta")).toHaveValue("10.000,00");
    fireEvent.change(within(dlg).getByLabelText("Início"), { target: { value: "2026-12-01T00:00" } });
    fireEvent.change(within(dlg).getByLabelText("Fim"), { target: { value: "2026-12-31T23:59" } });
    fireEvent.change(within(dlg).getByLabelText("Prêmio"), { target: { value: "AirPods" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar meta" }));
    await waitFor(() => expect(calls("admin_save_goal")).toHaveLength(1));
    expect(calls("admin_save_goal")[0]).toEqual({
      _id: null, _title: "Meta de dezembro", _description: "", _target: 10000, _starts_at: "2026-12-01T03:00:00.000Z", _ends_at: "2027-01-01T02:59:00.000Z",
      _reward_title: "AirPods", _reward_description: "",
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/oculta/)));
  });

  it("não envia a meta com dados inválidos e mostra o motivo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Nova meta/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar meta" }));
    expect(await within(dlg).findByText(/Dê um nome à meta/)).toBeInTheDocument();
    expect(within(dlg).getByText("Informe o valor da meta.")).toBeInTheDocument();
    expect(within(dlg).getByText(/Diga qual é o prêmio/)).toBeInTheDocument();
    expect(calls("admin_save_goal")).toHaveLength(0);
  });

  it("mostra o erro do servidor ao salvar e não diz que salvou", async () => {
    handlers.admin_save_goal = () => ({ error: { message: "esta meta já tem prêmio registrado: crie outra para mudar o valor ou as datas" } });
    handlers.get_admin_goal_detail = () => ({ data: detailOpen(), error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da meta"), { target: { value: "Meta renomeada" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar meta" }));
    expect(await within(dlg).findByText(/já tem prêmio registrado/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("editar o valor de uma meta que já começou pede a senha", async () => {
    handlers.get_admin_goal_detail = () => ({ data: detailOpen(), error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText("Valor da meta")).toBeEnabled();
    fireEvent.change(within(dlg).getByLabelText("Valor da meta"), { target: { value: "1200000" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar meta" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/quais vendas contam/);
    await waitFor(() => expect(calls("admin_save_goal")).toHaveLength(1));
    expect(calls("admin_save_goal")[0]).toMatchObject({ _id: G1, _target: 12000 });
  });

  it("editar só o nome não pede senha", async () => {
    handlers.get_admin_goal_detail = () => ({ data: detailOpen(), error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da meta"), { target: { value: "Meta de novembro (final)" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar meta" }));
    await waitFor(() => expect(calls("admin_save_goal")).toHaveLength(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_save_goal")[0]).toMatchObject({ _id: G1, _title: "Meta de novembro (final)", _target: 10000 });
  });

  it("com prêmio registrado, valor e datas ficam travados e a tela explica", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText("Valor da meta")).toBeDisabled();
    expect(within(dlg).getByLabelText("Início")).toBeDisabled();
    expect(within(dlg).getByLabelText("Fim")).toBeDisabled();
    expect(within(dlg).getByLabelText("Nome da meta")).toBeEnabled();
    expect(within(dlg).getByText(/já tem prêmio registrado, então o valor e as datas não mudam mais/)).toBeInTheDocument();
  });

  it("oculta a meta no ar na hora e avisa", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
    await waitFor(() => expect(calls("admin_set_goal_active")).toEqual([{ _id: G1, _active: false }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Meta ocultada."));
  });

  it("coloca uma meta oculta no ar", async () => {
    await openDraft();
    fireEvent.click(screen.getByRole("button", { name: /Colocar no ar/ }));
    await waitFor(() => expect(calls("admin_set_goal_active")).toEqual([{ _id: G2, _active: true }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Meta no ar."));
  });

  it("mostra o erro do servidor se a mudança de situação falhar, sem fingir que deu certo", async () => {
    handlers.admin_set_goal_active = () => ({ error: { message: "não foi possível" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
    await waitFor(() => expect(screen.getAllByRole("alert").some((a) => /não foi possível/i.test(a.textContent ?? ""))).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a meta no ar não pode ser apagada e o motivo aparece", async () => {
    await open();
    expect(screen.getByRole("button", { name: /Apagar Meta de novembro/ })).toBeDisabled();
    expect(screen.getByText("Oculte a meta antes de apagar.")).toBeInTheDocument();
  });

  it("meta oculta com prêmios registrados não pode ser apagada, só mantida oculta", async () => {
    handlers.get_admin_goal_detail = () => ({ data: detail({ goal: core({ is_active: false }) }), error: null });
    await open();
    expect(screen.getByRole("button", { name: /Apagar Meta de novembro/ })).toBeDisabled();
    expect(screen.getByText("Tem prêmios registrados: mantenha oculta em vez de apagar.")).toBeInTheDocument();
  });

  it("apagar uma meta oculta pede o motivo, depois a senha, e chama a função", async () => {
    askReason.mockResolvedValue("Meta criada por engano");
    await openDraft();
    fireEvent.click(screen.getByRole("button", { name: /Apagar Rascunho de teste/ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ minLength: 5, tone: "danger" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Apagar “Rascunho de teste” de vez/);
    await waitFor(() => expect(calls("admin_delete_goal")).toEqual([{ _id: G2, _reason: "Meta criada por engano" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/foi apagada/)));
  });

  it("não apaga se a pessoa cancelar o motivo", async () => {
    askReason.mockResolvedValue(null);
    await openDraft();
    fireEvent.click(screen.getByRole("button", { name: /Apagar Rascunho de teste/ }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_delete_goal")).toHaveLength(0);
  });

  it("marca o prêmio como entregue pedindo como foi entregue e depois a senha", async () => {
    askReason.mockResolvedValue("Pix enviado em 25/11");
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como entregue: Loja do Caio" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ label: "Como foi entregue", minLength: 5, title: expect.stringMatching(/Loja do Caio/) });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/“iPhone 16 Pro” de Loja do Caio/);
    await waitFor(() => expect(calls("admin_set_goal_award")).toHaveLength(1));
    expect(calls("admin_set_goal_award")[0]).toEqual({ _goal_id: G1, _seller_id: "s2", _status: "paid", _note: "Pix enviado em 25/11" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Prêmio marcado como entregue."));
  });

  it("cancela o prêmio como ação de risco e não oferece nada para quem já recebeu", async () => {
    askReason.mockResolvedValue("Pediu para não receber");
    await open();
    expect(screen.queryByRole("button", { name: /: Marina Duarte/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /: Estúdio Lume/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Não vai receber: Loja do Caio" }));
    await waitFor(() => expect(calls("admin_set_goal_award")).toHaveLength(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ tone: "danger" });
    expect(calls("admin_set_goal_award")[0]).toMatchObject({ _status: "cancelled", _seller_id: "s2" });
  });

  it("reabre um prêmio cancelado", async () => {
    askReason.mockResolvedValue("O seller voltou atrás");
    handlers.get_admin_goal_detail = () => ({ data: detail({ ranking: { total: 1, items: [row({ seller_id: "s2", name: "Loja do Caio", award: { ...paidAward, status: "cancelled", paid_at: null, note: "Pediu para não receber" } })] } }), error: null });
    await open();
    expect(screen.getByText(/Cancelado: Pediu para não receber/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reabrir: Loja do Caio" }));
    await waitFor(() => expect(calls("admin_set_goal_award")).toHaveLength(1));
    expect(calls("admin_set_goal_award")[0]).toMatchObject({ _status: "pending", _seller_id: "s2" });
  });

  it("não registra nada se a pessoa desistir do motivo", async () => {
    askReason.mockResolvedValue(null);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como entregue: Loja do Caio" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_set_goal_award")).toHaveLength(0);
  });

  it("mostra o erro do servidor ao registrar o prêmio e não diz que registrou", async () => {
    askReason.mockResolvedValue("Pix enviado em 25/11");
    handlers.admin_set_goal_award = () => ({ error: { message: "este seller ainda não bateu a meta" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como entregue: Loja do Caio" }));
    expect(await screen.findByText(/ainda não bateu a meta/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("copia a lista de quem bateu", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Copiar quem bateu/ }));
    expect(copySpy).toHaveBeenCalledTimes(1);
    const text = nb(copySpy.mock.calls[0][0] as string);
    expect(text).toContain("Marina Duarte <marina@exemplo.com>, R$ 12.100,00, entregue");
    expect(text).toContain("Loja do Caio <caio@exemplo.com>, R$ 10.480,50, a entregar");
    expect(text).not.toContain("Estúdio Lume");
  });

  it("sem ninguém pontuando, o ranking diz isso", async () => {
    await openDraft();
    expect(screen.getByText("Ninguém pontuou ainda")).toBeInTheDocument();
  });

  it("mostra o histórico da meta", async () => {
    await open();
    tab("Histórico");
    expect(await screen.findByText("Prêmio entregue")).toBeInTheDocument();
    expect(screen.getByText("Colocada no ar")).toBeInTheDocument();
    expect(screen.getByText("Meta criada")).toBeInTheDocument();
    expect(screen.getByText(/Entrega: Pix de reembolso enviado/)).toBeInTheDocument();
    expect(screen.getByText(/Nasceu oculta/)).toBeInTheDocument();
  });

  it("sem histórico, explica o que aparece ali", async () => {
    await openDraft();
    tab("Histórico");
    expect(await screen.findByText("Nenhuma alteração registrada")).toBeInTheDocument();
  });
});

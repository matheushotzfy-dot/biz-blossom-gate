import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  const bucket = {
    createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://assinado.exemplo.com/${p}` }, error: null }),
    upload: vi.fn(async () => ({ error: null })), getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/race-assets/${p}` } }),
    list: vi.fn(async () => ({ data: [], error: null })), remove: vi.fn(async () => ({ error: null })),
  };
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() }, storage: { from: () => bucket } } };
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
import RaceCenter from "@/features/admin-race/RaceCenter";
import {
  assetPath, entryErrors, fromSpInput, heroStatus, historyEntry, holdersFor, imageProblem, parseRaceDetail, parseRaces, phaseLine, phaseOf, prizeErrors, prizeHolders,
  prizeNeedsPassword, raceErrors, raceNeedsPassword, raceTag, toSpInput, winnersText, type BoardRow, type PrizeItem, type RaceForm,
} from "@/features/admin-race/raceModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const R1 = "aaaaaaaa-0000-4000-8000-000000000001";
const R2 = "aaaaaaaa-0000-4000-8000-000000000002";

const race = (over: Record<string, unknown> = {}) => ({
  id: R1, title: "Corrida Hotzfy", description: "Quem faturar mais leva.", starts_at: ago(24 * 100), ends_at: ago(24 * 3), is_active: true, is_live: true,
  banner_url: null, logo_url: null, created_at: ago(24 * 110), prizes: 4, entries: 2, fictional: 1, participants: 2, revenue_cents: 1_284_000, sales: 31, ...over,
});
const races = (items: unknown[] = [race(), race({ id: R2, title: "Corrida de Dezembro", starts_at: ago(-24 * 12), ends_at: ago(-24 * 42), is_active: false, is_live: false, prizes: 0, entries: 0, fictional: 0, participants: 0, revenue_cents: 0, sales: 0 })]) => ({
  items, live_id: (items as Array<{ id: string; is_live: boolean }>).find((r) => r.is_live)?.id ?? null, generated_at: ago(0),
});
const prize = (over: Record<string, unknown> = {}) => ({ id: "pz1", title: "MacBook Air", description: "", image_url: null, kind: "place", position: 1, goal_cents: 0, sort_order: 0, ...over });
const board = () => [
  { rank: 1, seller_id: null, name: "Bryan G.", revenue_cents: 87_500_000, sales_count: 912, is_manual: true, has_account: false, email: null },
  { rank: 2, seller_id: "s1", name: "Marina Duarte", revenue_cents: 824_000, sales_count: 19, is_manual: false, has_account: true, email: "marina@exemplo.com" },
  { rank: 3, seller_id: "s2", name: "Loja do Caio", revenue_cents: 460_000, sales_count: 12, is_manual: false, has_account: true, email: "caio@exemplo.com" },
];
const entry = (over: Record<string, unknown> = {}) => ({ id: "e1", seller_id: null, display_name: "Bryan G.", avatar_url: null, revenue_cents: 87_500_000, sales_count: 912, updated_at: ago(24 * 90), seller: null, real_revenue_cents: 0, real_sales: 0, ...over });
const detail = (over: Record<string, unknown> = {}) => ({
  race: race(), live_title: "Corrida Hotzfy", totals: { participants: 2, revenue_cents: 1_284_000, sales: 31 },
  prizes: [prize(), prize({ id: "pz2", title: "iPhone", position: 2, sort_order: 1 }), prize({ id: "pz3", title: "Kit de boas-vindas", kind: "goal", position: null, goal_cents: 500_000, sort_order: 2 })],
  entries: [entry()], board: board(),
  history: [{ at: ago(24 * 50), action: "race_entry_create", by: "Admin", details: { name: "Bryan G.", linked: false, revenue_cents: 87_500_000, sales_count: 912, reason: "Demonstração do lançamento" } }, { at: ago(24 * 100), action: "race_activate", by: "Admin", details: {} }],
  generated_at: ago(0), ...over,
});
const detailDec = () => detail({
  race: race({ id: R2, title: "Corrida de Dezembro", starts_at: ago(-24 * 12), ends_at: ago(-24 * 42), is_active: false, is_live: false }),
  totals: { participants: 0, revenue_cents: 0, sales: 0 }, prizes: [], entries: [], board: [], history: [],
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
  handlers.get_admin_races = () => ({ data: races(), error: null });
  handlers.get_admin_race_detail = (a) => ({ data: a._id === R2 ? detailDec() : detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { id: R1 }, error: null }));
});

const open = async () => { wrap(<RaceCenter />); await screen.findByRole("heading", { level: 2, name: "Corrida Hotzfy" }); };
const tab = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const fill = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

/* ───────── modelo ───────── */

describe("modelo das corridas do admin", () => {
  it("lê a lista e o detalhe com tolerância e recusa o que não vem do servidor", () => {
    const l = parseRaces({ items: [race({ revenue_cents: "100", banner_url: "  " }), "lixo"], live_id: R1 });
    expect(l.items).toHaveLength(1);
    expect(l.items[0].revenue_cents).toBe(100);
    expect(l.items[0].banner_url).toBeNull();
    expect(() => parseRaces(null)).toThrow("Resposta inesperada");
    expect(() => parseRaceDetail({})).toThrow("Resposta inesperada");
    const d = parseRaceDetail(detail({ prizes: [prize({ kind: "qualquer", position: 0 })] }));
    expect(d.prizes[0].kind).toBe("goal");
    expect(d.race.prizes).toBe(1);
    expect(d.race.fictional).toBe(1);
  });

  it("separa início, andamento e fim e descreve a situação", () => {
    const now = Date.now();
    expect(phaseOf({ starts_at: ago(-5), ends_at: ago(-50) }, now)).toBe("upcoming");
    expect(phaseOf({ starts_at: ago(5), ends_at: ago(-50) }, now)).toBe("running");
    expect(phaseOf({ starts_at: ago(50), ends_at: ago(5) }, now)).toBe("ended");
    expect(phaseLine({ starts_at: ago(5), ends_at: ago(-24 * 12) }, now)).toBe("Termina em 12 dias");
    expect(phaseLine({ starts_at: ago(-30), ends_at: ago(-60) }, now)).toBe("Começa em 30 horas");
    expect(phaseLine({ starts_at: ago(50), ends_at: ago(5) }, now)).toMatch(/^Terminou em /);
  });

  it("rotula a corrida pela situação para os sellers", () => {
    const now = Date.now();
    expect(raceTag({ is_live: false, starts_at: ago(5), ends_at: ago(-5) }, now)).toEqual({ label: "Oculta", tone: "neutral" });
    expect(raceTag({ is_live: true, starts_at: ago(5), ends_at: ago(-5) }, now).label).toBe("No ar");
    expect(raceTag({ is_live: true, starts_at: ago(-5), ends_at: ago(-50) }, now).label).toBe("Agendada");
    expect(raceTag({ is_live: true, starts_at: ago(50), ends_at: ago(5) }, now)).toEqual({ label: "Encerrada, visível", tone: "warning" });
  });

  it("trata as datas no horário de Brasília", () => {
    expect(fromSpInput("2026-11-25T00:00")).toBe("2026-11-25T03:00:00.000Z");
    expect(toSpInput("2026-11-25T03:00:00.000Z")).toBe("2026-11-25T00:00");
    expect(toSpInput("2026-11-25T02:59:00.000Z")).toBe("2026-11-24T23:59");
    expect(fromSpInput("2026-11-25")).toBeNull();
    expect(fromSpInput("")).toBeNull();
    expect(toSpInput("lixo")).toBe("");
  });

  it("valida a corrida como o servidor", () => {
    const ok: RaceForm = { title: "Corrida de verão", description: "", starts: "2026-12-01T00:00", ends: "2026-12-31T23:59", banner_url: "", logo_url: "" };
    expect(raceErrors(ok)).toEqual({});
    expect(raceErrors({ ...ok, title: "  ab " }).title).toMatch(/3 a 80/);
    expect(raceErrors({ ...ok, description: "x".repeat(501) }).description).toMatch(/500/);
    expect(raceErrors({ ...ok, starts: "" }).starts).toBe("Informe o início.");
    expect(raceErrors({ ...ok, ends: "2026-12-01T00:00" }).ends).toMatch(/depois do início/);
    expect(raceErrors({ ...ok, ends: "2028-12-31T23:59" }).ends).toMatch(/400 dias/);
  });

  it("pede senha só quando mexer nas datas de uma corrida que já começou", () => {
    const started = { starts_at: "2026-11-01T03:00:00.000Z", ends_at: "2026-12-01T03:00:00.000Z" };
    const same = { starts: "2026-11-01T00:00", ends: "2026-12-01T00:00" };
    expect(raceNeedsPassword(started, same, Date.parse("2026-11-10T00:00:00Z"))).toBe(false);
    expect(raceNeedsPassword(started, { ...same, ends: "2026-12-15T00:00" }, Date.parse("2026-11-10T00:00:00Z"))).toBe(true);
    expect(raceNeedsPassword(started, { ...same, ends: "2026-12-15T00:00" }, Date.parse("2026-10-10T00:00:00Z"))).toBe(false);
    expect(raceNeedsPassword(null, same)).toBe(false);
  });

  it("valida o prêmio, a colocação repetida e a meta", () => {
    const f = { title: "MacBook", description: "", kind: "place" as const, position: "1", goal: "", image_url: "" };
    expect(prizeErrors(f, [2, 3])).toEqual({});
    expect(prizeErrors(f, [1]).position).toMatch(/1º lugar já tem/);
    expect(prizeErrors({ ...f, position: "0" }, []).position).toMatch(/1º a 100º/);
    expect(prizeErrors({ ...f, position: "abc" }, []).position).toBeTruthy();
    expect(prizeErrors({ ...f, title: "x" }, []).title).toBeTruthy();
    expect(prizeErrors({ ...f, kind: "goal", goal: "" }, []).goal).toMatch(/meta/);
    expect(prizeErrors({ ...f, kind: "goal", goal: "5.000,00" }, [])).toEqual({});
    expect(prizeErrors({ ...f, image_url: "javascript:alert(1)" }, []).image_url).toMatch(/http/);
  });

  it("o prêmio de corrida em andamento pede senha ao criar e ao mudar colocação ou meta", () => {
    const f = { title: "iPhone", description: "", kind: "place" as const, position: "2", goal: "", image_url: "" };
    const p = parseRaceDetail(detail()).prizes[1];
    expect(prizeNeedsPassword(false, null, f)).toBe(false);
    expect(prizeNeedsPassword(true, null, f)).toBe(true);
    expect(prizeNeedsPassword(true, p, f)).toBe(false);
    expect(prizeNeedsPassword(true, p, { ...f, title: "iPhone 16" })).toBe(false);
    expect(prizeNeedsPassword(true, p, { ...f, position: "3" })).toBe(true);
    expect(prizeNeedsPassword(true, p, { ...f, kind: "goal", goal: "100,00" })).toBe(true);
  });

  it("exige motivo e, para quem não tem conta, o nome", () => {
    const f = { mode: "fictional" as const, name: "Bryan G.", revenue: "100,00", sales: "3", reason: "Demonstração" };
    expect(entryErrors(f, true, false)).toEqual({});
    expect(entryErrors({ ...f, reason: "curto" }, true, false).reason).toBeUndefined();
    expect(entryErrors({ ...f, reason: "  ab " }, true, false).reason).toMatch(/motivo/i);
    expect(entryErrors({ ...f, name: "" }, true, false).name).toBeTruthy();
    expect(entryErrors({ ...f, mode: "account", name: "" }, true, false).seller).toBe("Escolha o seller.");
    expect(entryErrors({ ...f, mode: "account", name: "" }, true, true).name).toBeUndefined();
    expect(entryErrors({ ...f, sales: "1,5" }, true, false).sales).toBeTruthy();
  });

  it("descobre quem leva cada prêmio pelo ranking", () => {
    const b = board() as BoardRow[];
    const [p1, p2, p3] = parseRaceDetail(detail({ prizes: [prize(), prize({ id: "pz9", title: "Terceiro", position: 9 }), prize({ id: "pz3", kind: "goal", position: null, goal_cents: 500_000 })] })).prizes as PrizeItem[];
    expect(holdersFor(p1, b).map((h) => h.name)).toEqual(["Bryan G."]);
    expect(holdersFor(p2, b)).toEqual([]);
    expect(holdersFor(p3, b).map((h) => h.rank)).toEqual([1, 2]);
    const text = winnersText("Corrida", prizeHolders([p1, p2, p3], b));
    expect(text).toContain("1º lugar: MacBook Air");
    expect(text).toContain("Bryan G. (sem conta)");
    expect(text).toContain("ninguém ainda");
    expect(text).toContain("marina@exemplo.com");
  });

  it("conta o histórico em português", () => {
    expect(historyEntry({ at: ago(1), action: "race_activate", by: null, details: {} }).title).toBe("Colocada no ar");
    expect(historyEntry({ at: ago(1), action: "race_deactivate", by: null, details: { replaced_by: R2 } }).text).toMatch(/Outra corrida/);
    const e = historyEntry({ at: ago(1), action: "race_entry_update", by: null, details: { name: "Bryan", revenue_from: 1000, revenue_to: 5000, reason: "Corrigido" } });
    expect(e.title).toBe("Valor fixo alterado");
    expect(e.text).toContain("Motivo: Corrigido");
    expect(historyEntry({ at: ago(1), action: "qualquer", by: null, details: {} }).title).toBe("Alteração na corrida");
  });

  it("reconhece só imagens do bucket e barra arquivo errado", () => {
    expect(assetPath(`https://x.supabase.co/storage/v1/object/public/race-assets/${R1}/banner-1.png?t=1`)).toBe(`${R1}/banner-1.png`);
    expect(assetPath("https://exemplo.com/foto.png")).toBeNull();
    expect(assetPath(null)).toBeNull();
    expect(imageProblem({ type: "image/svg+xml", size: 10 })).toMatch(/PNG, JPG/);
    expect(imageProblem({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(imageProblem({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("resume a corrida no topo", () => {
    expect(heroStatus(undefined, true).tone).toBe("destructive");
    expect(heroStatus(undefined, false).label).toMatch(/Carregando/);
    expect(heroStatus(parseRaces(races([])), false).label).toBe("Nenhuma corrida criada");
    expect(heroStatus(parseRaces(races([race({ is_live: false })])), false).label).toBe("Nenhuma corrida no ar");
    expect(heroStatus(parseRaces(races()), false).tone).toBe("warning");
    expect(heroStatus(parseRaces(races([race({ ends_at: ago(-24 * 5) })])), false).tone).toBe("success");
  });
});

/* ───────── tela ───────── */

describe("Corridas do admin", () => {
  it("só o administrador abre e nada é consultado sem a permissão", () => {
    wrap(<RaceCenter isAdmin={false} />);
    expect(screen.getByText("A gestão das corridas é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra a corrida no ar, os avisos e o ranking com valores exatos", async () => {
    await open();
    expect(screen.getAllByText("Encerrada, visível").length).toBeGreaterThan(0);
    expect(screen.getByText(/continua visível para os sellers/)).toBeInTheDocument();
    expect(screen.getByText(/1 participante sem conta aparece/)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 875.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText("marina@exemplo.com")).toBeInTheDocument();
    expect(screen.getAllByText("Sem conta").length).toBeGreaterThan(0);
    expect(calls("get_admin_race_detail")[0]._id).toBe(R1);
  });

  it("mostra erro com nova tentativa quando a lista falha", async () => {
    handlers.get_admin_races = () => ({ error: { message: "falhou" } });
    wrap(<RaceCenter />);
    expect(await screen.findByText("Não foi possível carregar as corridas.")).toBeInTheDocument();
    handlers.get_admin_races = () => ({ data: races(), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Corrida Hotzfy" })).toBeInTheDocument();
  });

  it("sem corrida criada, convida a criar a primeira", async () => {
    handlers.get_admin_races = () => ({ data: races([]), error: null });
    wrap(<RaceCenter />);
    expect((await screen.findAllByText("Nenhuma corrida criada")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Criar a primeira corrida/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Nova corrida");
  });

  it("cria uma corrida com as datas em horário de Brasília e avisa que nasce oculta", async () => {
    handlers.admin_save_race = () => ({ data: { id: R2 }, error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Nova corrida/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da corrida"), { target: { value: "Corrida de verão" } });
    fireEvent.change(within(dlg).getByLabelText("Início"), { target: { value: "2026-12-01T00:00" } });
    fireEvent.change(within(dlg).getByLabelText("Fim"), { target: { value: "2026-12-31T23:59" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar corrida" }));
    await waitFor(() => expect(calls("admin_save_race")).toHaveLength(1));
    const a = calls("admin_save_race")[0];
    expect(a._id).toBeNull();
    expect(a._title).toBe("Corrida de verão");
    expect(a._starts_at).toBe("2026-12-01T03:00:00.000Z");
    expect(a._ends_at).toBe("2027-01-01T02:59:00.000Z");
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/oculta/)));
  });

  it("não envia a corrida com dados inválidos e mostra o motivo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Nova corrida/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar corrida" }));
    expect(await within(dlg).findByText(/Dê um nome à corrida/)).toBeInTheDocument();
    expect(calls("admin_save_race")).toHaveLength(0);
  });

  it("editar as datas de uma corrida que já começou pede a senha", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Fim"), { target: { value: "2027-01-10T12:00" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar corrida" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/quem vence/);
    await waitFor(() => expect(calls("admin_save_race")).toHaveLength(1));
    expect(calls("admin_save_race")[0]._id).toBe(R1);
  });

  it("editar só o nome não pede senha", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Nome da corrida"), { target: { value: "Temporada Premium" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar corrida" }));
    await waitFor(() => expect(calls("admin_save_race")).toHaveLength(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("tira a corrida do ar depois de confirmar", async () => {
    askConfirm.mockResolvedValue(true);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Tirar do ar/ }));
    await waitFor(() => expect(calls("admin_set_race_active")).toHaveLength(1));
    expect(calls("admin_set_race_active")[0]).toEqual({ _id: R1, _active: false, _replace: false });
    expect(askConfirm.mock.calls[0][0].description).toMatch(/dá para colocar no ar de novo/);
  });

  it("não tira do ar se a pessoa desistir", async () => {
    askConfirm.mockResolvedValue(false);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Tirar do ar/ }));
    await waitFor(() => expect(askConfirm).toHaveBeenCalled());
    expect(calls("admin_set_race_active")).toHaveLength(0);
  });

  it("colocar outra corrida no ar avisa que a atual sai e pede a troca explícita", async () => {
    askConfirm.mockResolvedValue(true);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Corrida de Dezembro/ }));
    await screen.findByRole("heading", { level: 2, name: "Corrida de Dezembro" });
    fireEvent.click(screen.getByRole("button", { name: /Colocar no ar/ }));
    await waitFor(() => expect(calls("admin_set_race_active")).toHaveLength(1));
    expect(calls("admin_set_race_active")[0]).toEqual({ _id: R2, _active: true, _replace: true });
    const opts = askConfirm.mock.calls[0][0];
    expect(opts.title).toMatch(/Trocar a corrida no ar/);
    expect(opts.description).toMatch(/“Corrida Hotzfy”/);
    expect(opts.description).toMatch(/ainda não tem prêmios/);
  });

  it("mostra o erro do servidor se a troca falhar, sem fingir que deu certo", async () => {
    askConfirm.mockResolvedValue(true);
    handlers.admin_set_race_active = () => ({ error: { message: "já existe uma corrida no ar: “Corrida Hotzfy”. Confirme a troca para continuar" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Corrida de Dezembro/ }));
    await screen.findByRole("heading", { level: 2, name: "Corrida de Dezembro" });
    fireEvent.click(screen.getByRole("button", { name: /Colocar no ar/ }));
    expect(await screen.findByText(/já existe uma corrida no ar/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a corrida no ar não pode ser apagada e o motivo aparece", async () => {
    await open();
    const del = screen.getByRole("button", { name: /Apagar Corrida Hotzfy/ });
    expect(del).toBeDisabled();
    expect(screen.getByText("Tire a corrida do ar antes de apagar.")).toBeInTheDocument();
  });

  it("apagar uma corrida oculta pede a senha e chama a função", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Corrida de Dezembro/ }));
    await screen.findByRole("heading", { level: 2, name: "Corrida de Dezembro" });
    fireEvent.click(screen.getByRole("button", { name: /Apagar Corrida de Dezembro/ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(confirmSpy.mock.calls[0][0]).toMatch(/não pode ser desfeito/);
    await waitFor(() => expect(calls("admin_delete_race")).toEqual([{ _id: R2 }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/foi apagada/)));
  });

  it("corrida com vendas reais não pode ser apagada, só ocultada", async () => {
    handlers.get_admin_race_detail = () => ({ data: detail({ race: race({ is_active: false, is_live: false }) }), error: null });
    await open();
    expect(screen.getByRole("button", { name: /Apagar Corrida Hotzfy/ })).toBeDisabled();
    expect(screen.getByText(/31 vendas reais no período: oculte em vez de apagar/)).toBeInTheDocument();
  });

  it("adiciona alguém sem conta ao ranking com motivo e senha", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Novo valor fixo/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("radio", { name: /Alguém sem conta/ }));
    expect(within(dlg).getByText(/Os sellers veem esta pessoa no ranking como se fosse real/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Adicionar ao ranking" }));
    expect(await within(dlg).findByText(/Explique o motivo/)).toBeInTheDocument();
    expect(calls("admin_save_race_entry")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Nome exibido"), { target: { value: "Larissa M." } });
    fireEvent.change(within(dlg).getByLabelText("Faturamento"), { target: { value: "100000" } });
    fireEvent.change(within(dlg).getByLabelText("Vendas"), { target: { value: "42" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Participante de demonstração" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Adicionar ao ranking" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/como se fosse real/);
    await waitFor(() => expect(calls("admin_save_race_entry")).toHaveLength(1));
    expect(calls("admin_save_race_entry")[0]).toMatchObject({ _id: null, _race_id: R1, _seller_id: null, _display_name: "Larissa M.", _revenue_cents: 100000, _sales_count: 42, _reason: "Participante de demonstração" });
  });

  it("escolher um seller da plataforma troca o faturamento real e avisa disso", async () => {
    handlers.admin_search_sellers = () => ({ data: [{ user_id: "s9", name: "Marina Duarte", email: "marina@exemplo.com" }], error: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Novo valor fixo/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByPlaceholderText(/Nome ou e-mail/), { target: { value: "mari" } });
    fireEvent.click(await within(dlg).findByRole("button", { name: /Marina Duarte/ }, { timeout: 2000 }));
    fireEvent.change(within(dlg).getByLabelText("Faturamento"), { target: { value: "50000" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Venda fora da plataforma" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Adicionar ao ranking" }));
    await waitFor(() => expect(calls("admin_save_race_entry")).toHaveLength(1));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/no lugar do faturamento real/);
    expect(calls("admin_save_race_entry")[0]).toMatchObject({ _seller_id: "s9", _revenue_cents: 50000, _display_name: "" });
  });

  it("mostra o erro do servidor ao salvar o valor fixo e não diz que salvou", async () => {
    handlers.admin_save_race_entry = () => ({ error: { message: "este seller já tem valor fixo nesta corrida" } });
    await open();
    fireEvent.click(screen.getByRole("button", { name: /^Editar Bryan G\.$/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Ajuste do valor" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar valor" }));
    expect(await within(dlg).findByText(/já tem valor fixo/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("remove um valor fixo pedindo motivo e depois a senha", async () => {
    askReason.mockResolvedValue("Participante de teste");
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Remover Bryan G\./ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ minLength: 5, tone: "danger" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/pode mudar quem recebe os prêmios/);
    await waitFor(() => expect(calls("admin_delete_race_entry")).toEqual([{ _id: "e1", _reason: "Participante de teste" }]));
  });

  it("não remove o valor fixo se a pessoa cancelar o motivo", async () => {
    askReason.mockResolvedValue(null);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Remover Bryan G\./ }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_delete_race_entry")).toHaveLength(0);
  });

  it("cria um prêmio por colocação e recusa a colocação repetida", async () => {
    await open();
    tab(/^Prêmios/);
    fireEvent.click(await screen.findByRole("button", { name: /Novo prêmio/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText("Colocação")).toHaveValue("3");
    fireEvent.change(within(dlg).getByLabelText("Colocação"), { target: { value: "1" } });
    fireEvent.change(within(dlg).getByLabelText("Nome do prêmio"), { target: { value: "AirPods" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar prêmio" }));
    expect(await within(dlg).findByText(/1º lugar já tem um prêmio/)).toBeInTheDocument();
    expect(calls("admin_save_race_prize")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Colocação"), { target: { value: "3" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar prêmio" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(calls("admin_save_race_prize")).toHaveLength(1));
    expect(calls("admin_save_race_prize")[0]).toMatchObject({ _id: null, _race_id: R1, _title: "AirPods", _kind: "place", _position: 3, _goal_cents: null });
  });

  it("cria um prêmio por meta de faturamento", async () => {
    await open();
    tab(/^Prêmios/);
    fireEvent.click(await screen.findByRole("button", { name: /Novo prêmio/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(within(dlg).getByRole("radio", { name: /meta de faturamento/i }));
    fireEvent.change(within(dlg).getByLabelText("Nome do prêmio"), { target: { value: "Placa 1 milhão" } });
    fireEvent.change(within(dlg).getByLabelText("Meta de faturamento"), { target: { value: "10000000" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar prêmio" }));
    await waitFor(() => expect(calls("admin_save_race_prize")).toHaveLength(1));
    expect(calls("admin_save_race_prize")[0]).toMatchObject({ _kind: "goal", _position: null, _goal_cents: 10_000_000 });
  });

  it("reordena e apaga prêmios", async () => {
    await open();
    tab(/^Prêmios/);
    fireEvent.click(await screen.findByRole("button", { name: "Descer MacBook Air" }));
    await waitFor(() => expect(calls("admin_move_race_prize")).toEqual([{ _id: "pz1", _dir: "down" }]));
    expect(screen.getByRole("button", { name: "Subir MacBook Air" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apagar iPhone" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(confirmSpy.mock.calls[0][0]).toMatch(/já começou/);
    await waitFor(() => expect(calls("admin_delete_race_prize")).toEqual([{ _id: "pz2" }]));
  });

  it("mostra quem leva cada prêmio, avisa de quem não tem conta e copia a lista", async () => {
    await open();
    tab("Quem leva");
    expect(await screen.findByText(/Resultado final: a corrida terminou em/)).toBeInTheDocument();
    expect(screen.getByText(/Um prêmio está com alguém sem conta|prêmios estão com alguém sem conta/)).toBeInTheDocument();
    expect(screen.getAllByText("Sem conta, ninguém para receber").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Marina Duarte").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Copiar lista/ }));
    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(copySpy.mock.calls[0][0]).toContain("MacBook Air");
    expect(copySpy.mock.calls[0][0]).toContain("Bryan G. (sem conta)");
  });

  it("mostra o histórico da corrida", async () => {
    await open();
    tab("Histórico");
    expect(await screen.findByText("Colocada no ar")).toBeInTheDocument();
    expect(screen.getByText("Participante sem conta adicionado")).toBeInTheDocument();
    expect(screen.getByText(/Motivo: Demonstração do lançamento/)).toBeInTheDocument();
  });

  it("mostra erro com nova tentativa quando o detalhe de uma corrida falha", async () => {
    await open();
    handlers.get_admin_race_detail = () => ({ error: { message: "falhou" } });
    fireEvent.click(screen.getByRole("button", { name: /Corrida de Dezembro/ }));
    expect(await screen.findByText("Não foi possível carregar a corrida.")).toBeInTheDocument();
  });
});

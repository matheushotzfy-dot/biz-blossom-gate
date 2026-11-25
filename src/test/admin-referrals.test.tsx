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
import ReferralsCenter from "@/features/admin-referrals/ReferralsCenter";
import {
  OUTCOME, accountLabel, checkCreate, checkReason, dayLabel, historyLabel, nextOutcomes, parseRefDetail, parseRefPage, parseSellers, referredNote, refStatus,
} from "@/features/admin-referrals/referralsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const ref = (over: Record<string, unknown> = {}) => ({
  id: "r3", referrer_user_id: "s1", referrer_name: "Marina Duarte", referrer_email: "marina@exemplo.com", referred_email: "ana@exemplo.com", referred_user_id: null, referred_name: null,
  reward_amount: 50, status: "pending", paid_at: null, created_at: ago(72), updated_at: ago(72), account_before: false, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 6, pending: 2, qualified: 1, paid: 1, rejected: 1, cancelled: 1, ...over });
const program = (over: Record<string, unknown> = {}) => ({ total: 6, referrers: 2, pending: 2, qualified: 1, paid: 1, owed: 75.5, expected: 100, paid_amount: 50, ...over });
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), program: program(), generated_at: ago(0), ...over });

const detail = (over: Record<string, unknown> = {}) => ({
  referral: { id: "r1", referred_email: "rafael@exemplo.com", status: "qualified", reward_amount: 75.5, paid_at: null, created_at: ago(200), updated_at: ago(100), linked: true },
  referrer: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved", created_at: ago(2000), referrals: 4, paid: 1, rejected: 1 },
  referred: { user_id: "u1", name: "Rafael Menezes", account_status: "approved", created_at: ago(60), last_login_at: ago(12), same_as_referrer: false, sales: 3, volume: 591 },
  others: [],
  history: [],
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const openRef = (email: string) => fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Ver indicação de ${email}` }));

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_referrals_page = () => ({
    data: page([
      ref({ id: "r1", status: "qualified", referred_email: "rafael@exemplo.com", referred_user_id: "u1", referred_name: "Rafael Menezes", reward_amount: 75.5 }),
      ref({ id: "r2", referred_email: "juliana@exemplo.com", referred_user_id: "u2", referred_name: "Juliana Prado", account_before: true }),
      ref({ id: "r3" }),
      ref({ id: "r4", status: "paid", referred_email: "bia@exemplo.com", referred_user_id: "u3", referred_name: "Bia Santos", paid_at: "2026-11-24T15:00:00Z" }),
      ref({ id: "r5", status: "rejected", referred_email: "fraude@exemplo.com" }),
      ref({ id: "r6", status: "cancelled", referred_email: "engano@exemplo.com" }),
    ]),
    error: null,
  });
  handlers.get_admin_referral_detail = (a) => {
    const id = String(a._id);
    if (id === "r3") return { data: detail({ referral: { ...detail().referral, id: "r3", referred_email: "ana@exemplo.com", status: "pending", reward_amount: 50, linked: false }, referred: null }), error: null };
    if (id === "r2") return { data: detail({ referral: { ...detail().referral, id: "r2", referred_email: "juliana@exemplo.com", status: "pending", reward_amount: 50, created_at: ago(72), linked: false }, referred: { ...detail().referred, name: "Juliana Prado", created_at: ago(900) } }), error: null };
    if (id === "r4") return {
      data: detail({
        referral: { ...detail().referral, id: "r4", referred_email: "bia@exemplo.com", status: "paid", reward_amount: 50, paid_at: ago(30) },
        history: [
          { id: "h2", action: "referral_paid", created_at: ago(30), admin_name: "Admin", details: { reason: "Pix manual feito hoje" } },
          { id: "h1", action: "referral_qualified", created_at: ago(60), admin_name: "Admin", details: { reason: "Indicado criou conta e vendeu" } },
        ],
      }), error: null,
    };
    return { data: detail(), error: null };
  };
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("referralsModel", () => {
  it("lê a lista e rejeita formato inesperado", () => {
    const p = parseRefPage(page([ref({ reward_amount: "75.5", referrer_name: "", referred_name: "", account_before: "sim" })]));
    expect(p.items[0]).toMatchObject({ reward_amount: 75.5, referrer_name: "Seller sem nome", referred_name: null, account_before: false });
    expect(p.summary).toEqual({ all: 6, pending: 2, qualified: 1, paid: 1, rejected: 1, cancelled: 1 });
    expect(p.program).toMatchObject({ referrers: 2, owed: 75.5, expected: 100, paid_amount: 50 });
    expect(() => parseRefPage(null)).toThrow();
    expect(() => parseRefPage({ items: "x" })).toThrow();
  });

  it("lê o raio-X, com e sem conta do indicado", () => {
    const d = parseRefDetail(detail({ history: [{ id: "h1", action: "referral_paid", created_at: ago(1), admin_name: "Admin", details: { reason: "Pix manual" } }], others: [{ id: "x", status: "rejected", created_at: ago(9), referrer_name: "" }] }));
    expect(d.referral).toMatchObject({ status: "qualified", reward_amount: 75.5, linked: true });
    expect(d.referrer).toMatchObject({ name: "Marina Duarte", referrals: 4, paid: 1, rejected: 1 });
    expect(d.referred).toMatchObject({ name: "Rafael Menezes", sales: 3, volume: 591, same_as_referrer: false });
    expect(d.history[0]).toMatchObject({ action: "referral_paid", reason: "Pix manual", admin_name: "Admin" });
    expect(d.others[0].referrer_name).toBe("Seller sem nome");
    expect(parseRefDetail(detail({ referred: null })).referred).toBeNull();
    expect(() => parseRefDetail({})).toThrow();
  });

  it("lê a busca de sellers e ignora lixo", () => {
    expect(parseSellers([{ user_id: "s1", name: "Marina", email: "m@x.com" }, { name: "sem id" }, "x", { user_id: "s2", name: "", email: "" }])).toEqual([
      { user_id: "s1", name: "Marina", email: "m@x.com" }, { user_id: "s2", name: "Seller sem nome", email: null },
    ]);
    expect(parseSellers(null)).toEqual([]);
  });

  it("status, próximos passos e textos", () => {
    expect(refStatus("pending")).toEqual({ label: "Pendente", tone: "info" });
    expect(refStatus("qualified")).toEqual({ label: "Qualificada", tone: "warning" });
    expect(refStatus("paid")).toEqual({ label: "Paga", tone: "success" });
    expect(refStatus("rejected").tone).toBe("destructive");
    expect(refStatus("cancelled").label).toBe("Cancelada");
    expect(refStatus("x").label).toBe("Outro status");
    expect(nextOutcomes("pending")).toEqual(["qualified", "rejected", "cancelled"]);
    expect(nextOutcomes("qualified")).toEqual(["paid", "rejected", "cancelled"]);
    for (const s of ["paid", "rejected", "cancelled", "x"]) expect(nextOutcomes(s)).toEqual([]);
    expect(OUTCOME.paid.effect).toMatch(/nenhum valor entra no saldo/);
    expect(accountLabel("approved")).toBe("Aprovada");
    expect(accountLabel("active")).toBe("Aprovada");
    expect(accountLabel("pending_review")).toBe("KYC pendente");
    expect(accountLabel("blocked")).toBe("Bloqueada");
    expect(accountLabel(null)).toBe("—");
    expect(historyLabel("referral_create")).toBe("Registrada pela equipe");
    expect(historyLabel("referral_paid")).toBe("Pagamento registrado");
    expect(historyLabel("outra")).toBe("Ação registrada");
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(dayLabel(null)).toBe("—");
    expect(dayLabel("lixo")).toBe("—");
  });

  it("nota sobre o indicado: conta antiga é alerta, conta ligada e sem conta são informação", () => {
    expect(referredNote({ referred_user_id: "u", referred_name: "Rafa", account_before: true, status: "pending" })).toEqual({ text: "A conta já existia antes da indicação", tone: "warning" });
    expect(referredNote({ referred_user_id: "u", referred_name: "Rafa", account_before: false, status: "pending" })).toEqual({ text: "Tem conta: Rafa", tone: "muted" });
    expect(referredNote({ referred_user_id: null, referred_name: null, account_before: false, status: "pending" })).toEqual({ text: "Ainda sem conta na plataforma", tone: "muted" });
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("  ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Fraude")).toBeNull();
  });

  it("formulário de registro espelha as regras do servidor", () => {
    const seller = { user_id: "s1", name: "Marina", email: "marina@exemplo.com" };
    const ok = { seller, email: "novo@exemplo.com", reward: 50, reason: "Seller avisou" };
    expect(checkCreate(ok)).toEqual({});
    expect(checkCreate({ ...ok, seller: null }).seller).toMatch(/Escolha quem indicou/);
    expect(checkCreate({ ...ok, email: " " }).email).toMatch(/Informe o e-mail/);
    expect(checkCreate({ ...ok, email: "isso nao e email" }).email).toMatch(/não parece válido/);
    expect(checkCreate({ ...ok, email: "a@b" }).email).toMatch(/não parece válido/);
    expect(checkCreate({ ...ok, email: `${"a".repeat(250)}@x.com` }).email).toMatch(/não parece válido/);
    expect(checkCreate({ ...ok, email: " MARINA@exemplo.com " }).email).toMatch(/próprio indicador/);
    expect(checkCreate({ ...ok, reward: 10000.01 }).reward).toMatch(/entre R\$ 0 e R\$ 10\.000/);
    expect(checkCreate({ ...ok, reward: 10000 })).toEqual({});
    expect(checkCreate({ ...ok, reward: 0 })).toEqual({});
    expect(checkCreate({ ...ok, reason: "ab" }).reason).toMatch(/mínimo 5/);
  });
});

/* ───────── tela ───────── */

describe("ReferralsCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<ReferralsCenter isAdmin={false} />);
    expect(screen.getByText("As indicações são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra totais, aviso honesto sobre o programa e a lista pela RPC (nunca lê a tabela)", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    expect(calls("get_admin_referrals_page").some((c) => c._page === 1 && c._page_size === 25 && c._filter === "all" && c._search === null)).toBe(true);
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("1 recompensa a pagar")).toBeInTheDocument();
    expect(screen.getByText(/O seller ainda não tem uma tela para indicar, e nada qualifica ou paga sozinho/)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 75,50").length).toBeGreaterThan(1); // cartão "A pagar" + a linha
    expect(screen.getByText("R$ 100,00 previstos")).toBeInTheDocument();
    expect(screen.getByText("de 2 sellers")).toBeInTheDocument();
    expect(screen.getByText("1 qualificada")).toBeInTheDocument();
    expect(screen.getByText("Todas · 6")).toBeInTheDocument();
    expect(screen.getByText("Qualificadas · 1")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByText("Qualificada")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Tem conta: Rafael Menezes")).toBeInTheDocument();
    expect(within(rows[0]).getByText("A pagar")).toBeInTheDocument();
    expect(within(rows[0]).getByText("R$ 75,50")).toBeInTheDocument();
    expect(within(rows[1]).getByText("A conta já existia antes da indicação")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Ainda sem conta na plataforma")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Prevista")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Paga")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Paga em 24/11/2026")).toBeInTheDocument();
    expect(within(rows[4]).getByText("Recusada")).toBeInTheDocument();
    expect(within(rows[4]).getByText("Sem pagamento")).toBeInTheDocument();
    expect(within(rows[5]).getByText("Cancelada")).toBeInTheDocument();
  });

  it("sem recompensa a pagar o topo mostra o que está pendente; sem nada pendente, tudo em dia", async () => {
    handlers.get_admin_referrals_page = () => ({ data: page([ref()], { program: program({ qualified: 0, owed: 0 }) }), error: null });
    const a = wrap(<ReferralsCenter />);
    await screen.findAllByText("ana@exemplo.com");
    expect(screen.getByText("2 indicações pendentes")).toBeInTheDocument();
    expect(screen.getByText("nada a pagar")).toBeInTheDocument();
    a.unmount();
    handlers.get_admin_referrals_page = () => ({ data: page([ref({ status: "paid", paid_at: ago(1) })], { program: program({ qualified: 0, pending: 0, owed: 0, expected: 0 }) }), error: null });
    wrap(<ReferralsCenter />);
    await screen.findAllByText("ana@exemplo.com");
    expect(screen.getByText("Tudo em dia")).toBeInTheDocument();
  });

  it("filtro e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    fireEvent.click(screen.getByRole("button", { name: /^Pendentes/ }));
    await waitFor(() => expect(calls("get_admin_referrals_page").at(-1)).toMatchObject({ _filter: "pending", _page: 1 }));
    fireEvent.change(screen.getByLabelText("Buscar indicações"), { target: { value: "  marina " } });
    await waitFor(() => expect(calls("get_admin_referrals_page").at(-1)).toMatchObject({ _filter: "pending", _search: "marina" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar indicações") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_referrals_page").at(-1)).toMatchObject({ _filter: "all", _search: null }));
  });

  it("sem indicações e sem resultado têm textos diferentes", async () => {
    handlers.get_admin_referrals_page = () => ({ data: page([], { summary: summary({ all: 0, pending: 0, qualified: 0, paid: 0, rejected: 0, cancelled: 0 }), program: program({ total: 0, referrers: 0, pending: 0, qualified: 0, paid: 0, owed: 0, expected: 0, paid_amount: 0 }) }), error: null });
    wrap(<ReferralsCenter />);
    expect(await screen.findByText("Nenhuma indicação ainda")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma indicação")).toBeInTheDocument();
    expect(screen.getByText("nenhuma ainda")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Registrar indicação" })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar indicações"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso e tenta de novo", async () => {
    handlers.get_admin_referrals_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<ReferralsCenter />);
    expect(await screen.findByText("Não foi possível carregar as indicações.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    handlers.get_admin_referrals_page = () => ({ data: page([ref()]), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("ana@exemplo.com")).length).toBeGreaterThan(0);
  });

  it("raio-X da indicação qualificada: avisa que falta pagar e oferece pagar, recusar e cancelar", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    openRef("rafael@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Falta pagar a recompensa de R\$ 75,50/)).toBeInTheDocument();
    expect(calls("get_admin_referral_detail")[0]).toEqual({ _id: "r1" });
    expect(within(dlg).getByText("paga por fora, sem crédito automático no saldo")).toBeInTheDocument();
    expect(within(dlg).getByText("4 indicações · 1 paga")).toBeInTheDocument();
    expect(within(dlg).getByText("3 vendas · R$ 591,00")).toBeInTheDocument();
    expect(within(dlg).getAllByText("Aprovada")).toHaveLength(2);
    expect(within(dlg).queryByText("approved")).toBeNull();
    for (const n of ["Registrar pagamento", "Recusar", "Cancelar"]) expect(within(dlg).getByRole("button", { name: n })).toBeEnabled();
    expect(within(dlg).queryByRole("button", { name: "Qualificar" })).toBeNull();
  });

  it("registrar o pagamento: exige motivo, pede senha, diz que não credita saldo e chama a RPC", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    openRef("rafael@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Registrar pagamento" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Registrar pagamento?")).toBeInTheDocument();
    expect(within(mod).getByText(/nenhum valor entra no saldo do seller/)).toBeInTheDocument();
    fireEvent.click(within(mod).getByRole("button", { name: "Registrar pagamento" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_set_referral_status")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(mod).getByRole("button", { name: "Pix manual feito" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Pix manual feito");
    fireEvent.click(within(mod).getByRole("button", { name: "Registrar pagamento" }));
    await waitFor(() => expect(calls("admin_set_referral_status")).toHaveLength(1));
    expect(calls("admin_set_referral_status")[0]).toEqual({ _id: "r1", _status: "paid", _reason: "Pix manual feito" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Registrar pagamento: rafael@exemplo\.com, indicado por Marina Duarte\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pagamento registrado. O seller foi avisado."));
    await waitFor(() => expect(calls("get_admin_referrals_page").length).toBeGreaterThan(1));
  });

  it("erro do servidor ao mudar o status aparece no diálogo e nada é dado como feito", async () => {
    handlers.admin_set_referral_status = () => ({ data: null, error: { message: "esta indicação já foi encerrada e não muda mais" } });
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    openRef("rafael@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Recusar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Suspeita de fraude" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Recusar" }));
    expect(await within(mod).findByText(/já foi encerrada e não muda mais/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("indicado sem conta: avisa, não deixa qualificar e ainda deixa recusar", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("ana@exemplo.com");
    openRef("ana@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/ainda não tem conta na plataforma. Só dá para qualificar/)).toBeInTheDocument();
    expect(within(dlg).getByText("Ainda não criou conta")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Qualificar" })).toBeDisabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Recusar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText(/O e-mail fica livre para outra indicação/)).toBeInTheDocument();
    fireEvent.click(within(mod).getByRole("button", { name: "Indicado nunca criou conta" }));
    fireEvent.click(within(mod).getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(calls("admin_set_referral_status")).toHaveLength(1));
    expect(calls("admin_set_referral_status")[0]).toEqual({ _id: "r3", _status: "rejected", _reason: "Indicado nunca criou conta" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Indicação recusada. O seller foi avisado."));
  });

  it("conta do indicado anterior à indicação vira alerta antes de qualificar", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("juliana@exemplo.com");
    openRef("juliana@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("A conta do indicado já existia antes desta indicação.")).toBeInTheDocument();
    expect(within(dlg).getByText(/Confira antes de qualificar/)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Qualificar" })).toBeEnabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Qualificar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Qualificar indicação?")).toBeInTheDocument();
    fireEvent.click(within(mod).getByRole("button", { name: "Confirmado com o seller" }));
    fireEvent.click(within(mod).getByRole("button", { name: "Qualificar" }));
    await waitFor(() => expect(calls("admin_set_referral_status")[0]).toEqual({ _id: "r2", _status: "qualified", _reason: "Confirmado com o seller" }));
  });

  it("indicação paga é final: sem ações, com o histórico", async () => {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("bia@exemplo.com");
    openRef("bia@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Pagamento registrado")).toBeInTheDocument();
    expect(within(dlg).getByText("Pix manual feito hoje")).toBeInTheDocument();
    expect(within(dlg).getByText("Qualificada")).toBeInTheDocument();
    expect(within(dlg).getByText("Indicado criou conta e vendeu")).toBeInTheDocument();
    for (const n of ["Registrar pagamento", "Qualificar", "Recusar", "Cancelar"]) expect(within(dlg).queryByRole("button", { name: n })).toBeNull();
    expect(within(dlg).queryByText(/Falta pagar/)).toBeNull();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_referral_detail = () => ({ data: null, error: { message: "indicação não encontrada" } });
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    openRef("rafael@exemplo.com");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/indicação não encontrada/)).toBeInTheDocument();
    handlers.get_admin_referral_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText(/Falta pagar a recompensa/)).toBeInTheDocument();
  });
});

/* ───────── registrar indicação ───────── */

describe("registrar indicação", () => {
  const sellers = [{ user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com" }, { user_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com" }];
  async function openCreate() {
    wrap(<ReferralsCenter />);
    await screen.findAllByText("rafael@exemplo.com");
    fireEvent.click(screen.getByRole("button", { name: "Registrar indicação" }));
    return await screen.findByRole("dialog");
  }
  async function pickSeller(dlg: HTMLElement, name = "Marina Duarte") {
    fireEvent.change(within(dlg).getByLabelText("Quem indicou"), { target: { value: "mar" } });
    fireEvent.click(await within(dlg).findByRole("button", { name: new RegExp(name) }));
  }

  it("sem preencher nada mostra os erros e não chama nada", async () => {
    const dlg = await openCreate();
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar indicação" }));
    expect(await within(dlg).findByText("Escolha quem indicou.")).toBeInTheDocument();
    expect(within(dlg).getByText("Informe o e-mail do indicado.")).toBeInTheDocument();
    expect(within(dlg).getByText(/Escreva o motivo/)).toBeInTheDocument();
    expect(calls("admin_create_referral")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("busca o seller no servidor (mínimo 2 letras) e registra com recompensa, e-mail normalizado e motivo", async () => {
    handlers.admin_search_sellers = () => ({ data: sellers, error: null });
    const dlg = await openCreate();
    fireEvent.change(within(dlg).getByLabelText("Quem indicou"), { target: { value: "m" } });
    expect(calls("admin_search_sellers")).toHaveLength(0);
    await pickSeller(dlg);
    expect(calls("admin_search_sellers").at(-1)).toEqual({ _query: "mar" });
    expect(within(dlg).getByText("Marina Duarte")).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("E-mail do indicado"), { target: { value: "  Novo@Exemplo.com " } });
    expect((within(dlg).getByLabelText("Recompensa") as HTMLInputElement).value).toBe("50,00");
    fireEvent.change(within(dlg).getByLabelText("Recompensa"), { target: { value: "12345" } });
    expect((within(dlg).getByLabelText("Recompensa") as HTMLInputElement).value).toBe("123,45");
    fireEvent.click(within(dlg).getByRole("button", { name: "Seller avisou pelo suporte" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar indicação" }));
    await waitFor(() => expect(calls("admin_create_referral")).toHaveLength(1));
    expect(calls("admin_create_referral")[0]).toEqual({ _referrer: "s1", _email: "novo@exemplo.com", _reward: 123.45, _reason: "Seller avisou pelo suporte" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Registrar a indicação de novo@exemplo\.com em nome de Marina Duarte, com recompensa de R\$\s123,45\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Indicação registrada como pendente."));
    await waitFor(() => expect(calls("get_admin_referrals_page").length).toBeGreaterThan(2));
  });

  it("o indicado não pode ser o próprio indicador, e a recompensa não passa de R$ 10.000", async () => {
    handlers.admin_search_sellers = () => ({ data: sellers, error: null });
    const dlg = await openCreate();
    await pickSeller(dlg);
    fireEvent.change(within(dlg).getByLabelText("E-mail do indicado"), { target: { value: "MARINA@exemplo.com" } });
    fireEvent.change(within(dlg).getByLabelText("Recompensa"), { target: { value: "1000001" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo do registro"), { target: { value: "Combinado por mensagem" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar indicação" }));
    expect(await within(dlg).findByText("O indicado não pode ser o próprio indicador.")).toBeInTheDocument();
    expect(within(dlg).getByText(/entre R\$ 0 e R\$ 10\.000/)).toBeInTheDocument();
    expect(calls("admin_create_referral")).toHaveLength(0);
  });

  it("recompensa em branco não vira R$ 0 por acidente", async () => {
    handlers.admin_search_sellers = () => ({ data: sellers, error: null });
    const dlg = await openCreate();
    await pickSeller(dlg);
    fireEvent.change(within(dlg).getByLabelText("E-mail do indicado"), { target: { value: "novo@exemplo.com" } });
    fireEvent.change(within(dlg).getByLabelText("Recompensa"), { target: { value: "" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo do registro"), { target: { value: "Combinado por mensagem" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar indicação" }));
    expect(await within(dlg).findByText(/Informe a recompensa/)).toBeInTheDocument();
    expect(calls("admin_create_referral")).toHaveLength(0);
  });

  it("seller não encontrado, erro na busca e erro ao registrar aparecem no lugar certo", async () => {
    handlers.admin_search_sellers = () => ({ data: [], error: null });
    const dlg = await openCreate();
    fireEvent.change(within(dlg).getByLabelText("Quem indicou"), { target: { value: "zzz" } });
    expect(await within(dlg).findByText(/Nenhuma conta encontrada para “zzz”/)).toBeInTheDocument();
    handlers.admin_search_sellers = () => ({ data: null, error: { message: "falha de rede" } });
    fireEvent.change(within(dlg).getByLabelText("Quem indicou"), { target: { value: "mar" } });
    expect(await within(dlg).findByText(/Tentar de novo/)).toBeInTheDocument();
    handlers.admin_search_sellers = () => ({ data: sellers, error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    fireEvent.click(await within(dlg).findByRole("button", { name: /Marina Duarte/ }));
    handlers.admin_create_referral = () => ({ data: null, error: { message: "esse e-mail já tem uma indicação ativa" } });
    fireEvent.change(within(dlg).getByLabelText("E-mail do indicado"), { target: { value: "ana@exemplo.com" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo do registro"), { target: { value: "Combinado por mensagem" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar indicação" }));
    expect(await within(dlg).findByText(/já tem uma indicação ativa/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("trocar o seller escolhido volta para a busca", async () => {
    handlers.admin_search_sellers = () => ({ data: sellers, error: null });
    const dlg = await openCreate();
    await pickSeller(dlg);
    fireEvent.click(within(dlg).getByRole("button", { name: "Trocar" }));
    expect((within(dlg).getByLabelText("Quem indicou") as HTMLInputElement).value).toBe("");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
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
vi.mock("@/components/seller-ui/copy", () => ({ copyText: vi.fn() }));

import { toast } from "sonner";
import RewardsCenter from "@/features/admin-rewards/RewardsCenter";
import {
  accountStatusLabel, daysLabel, emptyCopy, fullAddress, historyEntry, labelText, mapsUrl, noteProblem, parseClaimDetail, parseClaimsPage, parseTiers,
  reasonProblem, rewardsFromText, rewardsToText, statusOf, stepsFor, tierErrors, tierImpact, tierNeedsPassword, trackingErrors, waitLabel, claimRef, type TierItem,
} from "@/features/admin-rewards/rewardsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const ID1 = "11111111-aaaa-4000-8000-000000000001";
const ID2 = "22222222-aaaa-4000-8000-000000000002";
const ID3 = "33333333-aaaa-4000-8000-000000000003";

const claim = (over: Record<string, unknown> = {}) => ({
  id: ID1, user_id: "u1", tier_id: "100k", tier_label: "Placa 100 MIL", tier_value: 100000, recipient_name: "Marina Duarte Lima", shipping_city: "Maringá", shipping_state: "PR",
  status: "pending", tracking_carrier: null, tracking_code: null, created_at: ago(76), delivered_at: null, updated_at: ago(76), has_message: false,
  seller: { user_id: "u1", name: "Marina Duarte", email: "marina@exemplo.com" }, ...over,
});
const rows = () => [
  claim(),
  claim({ id: ID2, tier_id: "10k", tier_label: "Kit Pulseiras VENXPAY", tier_value: 10000, status: "shipped", tracking_carrier: "Correios", tracking_code: "BR123456789BR", recipient_name: "Caio Souza", shipping_city: "Campinas", shipping_state: "SP", seller: { user_id: "u2", name: "Loja do Caio", email: "caio@exemplo.com" } }),
];
const page = (items: unknown[] = rows(), over: Record<string, unknown> = {}) => ({
  items, total: items.length,
  counts: { open: 2, pending: 1, preparing: 0, shipped: 1, delivered: 3, cancelled: 1, all: 6 },
  program: { pending: 1, pending_since: ago(76), in_progress: 1, delivered_30d: 2, median_days_to_deliver: 8.5, delivered_sample: 3, total: 6 },
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: ID1, user_id: "u1", tier_id: "100k", tier_label: "Placa 100 MIL", tier_value: 100000, status: "pending", created_at: ago(76), updated_at: ago(76), delivered_at: null,
  recipient_name: "Marina Duarte Lima", phone: "(44) 99999-0000", document: "123.456.789-09", shipping_street: "Rua das Palmeiras", shipping_number: "120", shipping_complement: "Apto 32",
  shipping_neighborhood: "Zona 7", shipping_city: "Maringá", shipping_state: "PR", shipping_zip: "87020-100",
  tracking_carrier: null, tracking_code: null, tracking_url: null, message: null,
  seller: { user_id: "u1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved", joined_at: ago(24 * 200), revenue: 184200.5, sales: 640 },
  other_claims: [{ id: "x1", tier_label: "Kit Pulseiras VENXPAY", status: "delivered", created_at: ago(900) }],
  history: [{ at: ago(1), action: "reward_claim_note", by: "Admin", details: { note: "Ligar antes de postar" } }],
  ...over,
});
const tier = (over: Record<string, unknown> = {}) => ({
  id: "10k", title: "Kit Pulseiras VENXPAY", tier: "Iniciante", value: 10000, description: "", phrase: "", rewards: ["Pulseira preta"], image_url: null, sort_order: 1, is_active: true,
  claims: { total: 3, open: 1, delivered: 1, cancelled: 1 }, reached: 41, waiting_to_claim: 6, ...over,
});
const tiers = () => ({ items: [tier(), tier({ id: "100k", title: "Placa 100 MIL", tier: "Bronze", value: 100000, sort_order: 2, claims: { total: 0, open: 0, delivered: 0, cancelled: 0 }, reached: 9, waiting_to_claim: 0 }), tier({ id: "250k", title: "Placa 250 MIL", value: 250000, sort_order: 3, is_active: false, reached: 0, waiting_to_claim: 0, claims: { total: 0, open: 0, delivered: 0, cancelled: 0 } })] });

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); askReason.mockReset(); askConfirm.mockReset(); confirmSpy.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_reward_claims_page = () => ({ data: page(), error: null });
  handlers.get_admin_reward_claim_detail = (a) => ({ data: a._id === ID2 ? detail({ id: ID2, tier_label: "Kit Pulseiras VENXPAY", tier_value: 10000, status: "shipped", tracking_carrier: "Correios", tracking_code: "BR123456789BR", tracking_url: "https://rastreio.exemplo.com/BR1", message: "Postado hoje" }) : a._id === ID3 ? detail({ id: ID3, status: "cancelled", message: "Endereço não confere" }) : detail(), error: null });
  handlers.get_admin_award_tiers = () => ({ data: tiers(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

const openClaim = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole("button", { name }));
  return screen.findByRole("dialog");
};

/* ───────── modelo ───────── */

describe("modelo das premiações do admin", () => {
  it("lê a lista com tolerância e recusa o que não vem do servidor", () => {
    const p = parseClaimsPage(page([claim({ status: "approved", tier_value: "100000", has_message: "sim" })]));
    expect(p.items[0].status).toBe("preparing");
    expect(p.items[0].tier_value).toBe(100000);
    expect(p.items[0].has_message).toBe(false);
    expect(p.counts.open).toBe(2);
    expect(parseClaimsPage({ items: [], total: 0 }).program.median_days_to_deliver).toBeNull();
    expect(() => parseClaimsPage(null)).toThrow("Resposta inesperada");
    expect(() => parseClaimDetail({})).toThrow("Resposta inesperada");
    expect(() => parseTiers({})).toThrow("Resposta inesperada");
    expect(statusOf("qualquer")).toBe("pending");
  });

  it("lê o detalhe e os marcos", () => {
    const d = parseClaimDetail(detail({ seller: { user_id: "u1", revenue: -5 }, history: [{ at: ago(1), action: "x", details: "texto" }, "lixo"] }));
    expect(d.seller.revenue).toBe(0);
    expect(d.history).toHaveLength(1);
    expect(d.history[0].details).toEqual({});
    const t = parseTiers(tiers());
    expect(t).toHaveLength(3);
    expect(t[0].claims.total).toBe(3);
    expect(parseTiers({ items: [{ id: "a", rewards: ["x", 3, null], is_active: "sim" }] })[0]).toMatchObject({ rewards: ["x"], is_active: false });
  });

  it("só oferece o que o servidor aceita em cada etapa", () => {
    expect(stepsFor("pending")).toEqual(["prepare", "cancel"]);
    expect(stepsFor("preparing")).toEqual(["ship", "cancel"]);
    expect(stepsFor("shipped")).toEqual(["deliver", "cancel"]);
    expect(stepsFor("cancelled")).toEqual(["reopen"]);
    expect(stepsFor("delivered")).toEqual([]);
  });

  it("confere rastreio, motivo e anotação como o servidor", () => {
    expect(trackingErrors({ carrier: "", code: "", url: "", message: "" }).code).toBe("Informe o código de rastreio.");
    expect(trackingErrors({ carrier: "", code: "BR1", url: "javascript:alert(1)", message: "" }).url).toContain("http://");
    expect(trackingErrors({ carrier: "", code: "BR1", url: "https://x.com/a b", message: "" }).url).toBeDefined();
    expect(trackingErrors({ carrier: "x".repeat(61), code: "BR1", url: "", message: "y".repeat(501) })).toMatchObject({ carrier: expect.any(String), message: expect.any(String) });
    expect(trackingErrors({ carrier: "Correios", code: "BR1", url: "https://rastreio.com/BR1", message: "" })).toEqual({});
    expect(reasonProblem("abc")).toContain("mínimo 5");
    expect(reasonProblem("  motivo ok ")).toBeNull();
    expect(noteProblem(" a ")).toBe("Escreva a anotação.");
    expect(noteProblem("anotação")).toBeNull();
  });

  it("confere o formulário da peça e pede senha só para meta ou ativação", () => {
    const ok = { title: "Placa", tier: "", value: "", description: "", phrase: "", rewards: "", image_url: "" };
    expect(tierErrors(ok, 1000)).toEqual({});
    expect(tierErrors({ ...ok, title: "P" }, 1000).title).toBeDefined();
    expect(tierErrors(ok, 0).value).toBeDefined();
    expect(tierErrors(ok, 200_000_000).value).toContain("100.000.000");
    expect(tierErrors({ ...ok, rewards: "1\n2\n3\n4\n5\n6\n7\n8\n9" }, 1).rewards).toContain("8");
    expect(tierErrors({ ...ok, image_url: "ftp://x" }, 1).image_url).toBeDefined();
    expect(rewardsFromText(" a \n\n b\r\nc ")).toEqual(["a", "b", "c"]);
    expect(rewardsToText(["a", "b"])).toBe("a\nb");
    const t = parseTiers(tiers())[0] as TierItem;
    expect(tierNeedsPassword(null, 5, true)).toBe(false);
    expect(tierNeedsPassword(t, 10000, true)).toBe(false);
    expect(tierNeedsPassword(t, 9000, true)).toBe(true);
    expect(tierNeedsPassword({ ...t, is_active: false }, 10000, true)).toBe(true);
    expect(tierNeedsPassword({ ...t, is_active: false }, 10000, false)).toBe(false);
    expect(tierImpact(t)).toContain("não pode ser apagada");
  });

  it("escreve o histórico, o endereço e os prazos em português", () => {
    const h = (action: string, details: Record<string, unknown> = {}) => historyEntry({ at: ago(1), action, by: null, details });
    expect(h("reward_claim_shipped", { carrier: "Correios", code: "BR1", message: "Vai chegar" })).toMatchObject({ title: "Marcado como postado", text: "Rastreio: Correios BR1\nVai chegar" });
    expect(h("reward_claim_cancelled", { message: "Sem estoque" }).text).toBe("Motivo: Sem estoque");
    expect(h("reward_claim_address", { fields: ["CEP", "rua"], reason: "pedido do seller" }).text).toBe("Mudou: CEP, rua.\nMotivo: pedido do seller");
    expect(h("reward_claim_note", { note: "ligar" })).toMatchObject({ title: "Anotação interna", internal: true });
    expect(h("outra").title).toBe("Alteração no pedido");
    const d = parseClaimDetail(detail());
    expect(fullAddress(d)).toBe("Rua das Palmeiras, 120 · Apto 32 · Zona 7 · Maringá/PR · CEP 87020-100");
    expect(labelText(d).split("\n")).toEqual(["Marina Duarte Lima", "(44) 99999-0000 · 123.456.789-09", "Rua das Palmeiras, 120 - Apto 32", "Zona 7", "Maringá/PR", "CEP 87020-100"]);
    expect(mapsUrl("Rua A, 1")).toContain("query=Rua%20A%2C%201");
    expect(claimRef(ID1)).toBe("#11111111");
    const now = Date.now();
    expect(waitLabel(new Date(now - 30 * 60_000).toISOString(), now)).toBe("menos de 1 hora");
    expect(waitLabel(new Date(now - 5 * 3_600_000).toISOString(), now)).toBe("5 horas");
    expect(waitLabel(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe("3 dias");
    expect(waitLabel(new Date(now - 21 * 86_400_000).toISOString(), now)).toBe("3 semanas");
    expect(daysLabel(0.4)).toBe("menos de 1 dia");
    expect(daysLabel(8.5)).toBe("8,5 dias");
    expect(accountStatusLabel("approved")).toBe("Cadastro aprovado");
    expect(emptyCopy("open", true, true).title).toBe("Nada por aqui");
    expect(emptyCopy("open", false, false).title).toBe("Nenhum pedido ainda");
    expect(emptyCopy("cancelled", false, true).title).toBe("Nenhum pedido cancelado");
  });
});

/* ───────── pedidos ───────── */

describe("lista de pedidos", () => {
  it("mostra o resumo, a fila e o que importa de cada etapa", async () => {
    wrap(<RewardsCenter />);
    expect(await screen.findByText("1 pedido aguarda análise")).toBeInTheDocument();
    expect(screen.getByText("8,5 dias")).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Pedidos de premiação" });
    expect(within(list).getByText("Placa 100 MIL")).toBeInTheDocument();
    expect(within(list).getByText(/Espera há 3 dias/)).toBeInTheDocument();
    expect(within(list).getByText("Correios BR123456789BR")).toBeInTheDocument();
    expect(within(list).getByText("Para Caio Souza, Campinas/SP")).toBeInTheDocument();
    expect(calls("get_admin_reward_claims_page")[0]).toMatchObject({ _status: "open", _search: null, _page: 1 });
  });

  it("troca o filtro e busca no servidor", async () => {
    wrap(<RewardsCenter />);
    await screen.findByRole("list", { name: "Pedidos de premiação" });
    fireEvent.click(screen.getByRole("button", { name: /Cancelados/ }));
    await waitFor(() => expect(calls("get_admin_reward_claims_page").some((c) => c._status === "cancelled")).toBe(true));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar pedidos" }), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_reward_claims_page").some((c) => c._search === "caio")).toBe(true));
  });

  it("explica a lista vazia e oferece limpar o filtro", async () => {
    handlers.get_admin_reward_claims_page = (a) => ({ data: a._status === "open" ? page([]) : page([]), error: null });
    wrap(<RewardsCenter />);
    expect(await screen.findByText("Nenhum pedido em andamento")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Entregues/ }));
    expect(await screen.findByText("Nenhum pedido entregue")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Limpar filtros" }).length).toBeGreaterThan(0);
  });

  it("sem nenhum pedido no programa, convida a esperar o primeiro", async () => {
    handlers.get_admin_reward_claims_page = () => ({ data: page([], { program: { pending: 0, pending_since: null, in_progress: 0, delivered_30d: 0, median_days_to_deliver: null, delivered_sample: 0, total: 0 } }), error: null });
    wrap(<RewardsCenter />);
    expect((await screen.findAllByText("Nenhum pedido ainda")).length).toBeGreaterThan(0);
    expect(screen.getByText("sem entregas em 90 dias")).toBeInTheDocument();
  });

  it("mostra erro de carregamento com nova tentativa, sem inventar lista vazia", async () => {
    let fail = true;
    handlers.get_admin_reward_claims_page = () => (fail ? { data: null, error: { message: "relation \"x\" does not exist" } } : { data: page(), error: null });
    wrap(<RewardsCenter />);
    expect(await screen.findByText("Não foi possível carregar os pedidos.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("list", { name: "Pedidos de premiação" })).toBeInTheDocument();
  });

  it("quem não é administrador vê o aviso e nada é consultado", () => {
    wrap(<RewardsCenter isAdmin={false} />);
    expect(screen.getByText("A gestão de premiações é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("ficha do pedido", () => {
  it("mostra o seller, o faturamento contra a meta, o endereço, o histórico e quem lê cada coisa", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    expect(await within(dlg).findByText("Rua das Palmeiras, 120 · Apto 32 · Zona 7 · Maringá/PR · CEP 87020-100")).toBeInTheDocument();
    expect(within(dlg).getByText(/R\$\s184\.201 de R\$\s100\.000/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Meta batida/)).toBeInTheDocument();
    expect(within(dlg).getByText("Kit Pulseiras VENXPAY: entregue")).toBeInTheDocument();
    expect(within(dlg).getByText("só a equipe vê")).toBeInTheDocument();
    expect(within(dlg).getByText("Ligar antes de postar")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Corrigir endereço" })).toBeInTheDocument();
    expect(calls("get_admin_reward_claim_detail")[0]).toEqual({ _id: ID1 });
  });

  it("avisa quando o faturamento caiu abaixo da meta depois do pedido", async () => {
    handlers.get_admin_reward_claim_detail = () => ({ data: detail({ seller: { user_id: "u1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved", joined_at: ago(100), revenue: 96400, sales: 10 } }), error: null });
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    expect(await within(dlg).findByText(/Abaixo da meta agora/)).toBeInTheDocument();
  });

  it("aceita o pedido com um clique e avisa que o seller foi notificado", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aceitar e preparar" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")).toEqual([{ _id: ID1, _status: "preparing", _carrier: null, _code: null, _url: null, _message: null }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pedido em preparo. O seller foi avisado."));
  });

  it("cancelar pede o motivo e o envia; sem motivo, nada é chamado", async () => {
    askReason.mockResolvedValueOnce(null);
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(askReason).toHaveBeenCalledTimes(1));
    expect(askReason.mock.calls[0][0]).toMatchObject({ minLength: 5, label: "Motivo do cancelamento" });
    expect(calls("admin_set_reward_claim")).toHaveLength(0);

    askReason.mockResolvedValueOnce("Endereço não confere com o cadastro");
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")).toEqual([{ _id: ID1, _status: "cancelled", _carrier: null, _code: null, _url: null, _message: "Endereço não confere com o cadastro" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pedido cancelado. O seller foi avisado do motivo."));
  });

  it("cancelar um pedido já postado avisa que a entrega não para", async () => {
    askReason.mockResolvedValueOnce(null);
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Kit Pulseiras VENXPAY, de Loja do Caio/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(String(askReason.mock.calls[0][0].description)).toContain("não interrompe a entrega");
  });

  it("mostra o erro do servidor dentro da ficha e não diz que deu certo", async () => {
    handlers.admin_set_reward_claim = () => ({ data: null, error: { message: "não dá para mudar um pedido entregue para aguardando" } });
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aceitar e preparar" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("não dá para mudar um pedido entregue para aguardando");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("marcar como postado exige o código e manda os dados do rastreio", async () => {
    handlers.get_admin_reward_claim_detail = () => ({ data: detail({ status: "preparing" }), error: null });
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Marcar como postado" }));
    const trk = await screen.findByRole("dialog", { name: "Marcar como postado" });
    fireEvent.click(within(trk).getByRole("button", { name: "Marcar como postado" }));
    expect(await within(trk).findByText("Informe o código de rastreio.")).toBeInTheDocument();
    expect(calls("admin_set_reward_claim")).toHaveLength(0);
    fireEvent.change(within(trk).getByLabelText("Código de rastreio"), { target: { value: " BR999 " } });
    fireEvent.change(within(trk).getByLabelText("Transportadora"), { target: { value: "Correios" } });
    fireEvent.change(within(trk).getByLabelText("Link de rastreio"), { target: { value: "https://rastreio.exemplo.com/BR999" } });
    fireEvent.change(within(trk).getByLabelText("Mensagem para o seller"), { target: { value: "Chega em 5 dias" } });
    fireEvent.click(within(trk).getByRole("button", { name: "Marcar como postado" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")).toEqual([{ _id: ID1, _status: "shipped", _carrier: "Correios", _code: " BR999 ", _url: "https://rastreio.exemplo.com/BR999", _message: "Chega em 5 dias" }]));
  });

  it("rastreio de pedido postado abre preenchido e só corrige o que mudou de lugar", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Kit Pulseiras VENXPAY, de Loja do Caio/);
    expect(await within(dlg).findByText("Correios BR123456789BR")).toBeInTheDocument();
    expect(within(dlg).getByRole("link", { name: /Rastrear/ })).toHaveAttribute("href", "https://rastreio.exemplo.com/BR1");
    fireEvent.click(within(dlg).getByRole("button", { name: "Corrigir rastreio" }));
    const trk = await screen.findByRole("dialog", { name: "Corrigir rastreio" });
    expect(within(trk).getByLabelText("Código de rastreio")).toHaveValue("BR123456789BR");
    fireEvent.change(within(trk).getByLabelText("Código de rastreio"), { target: { value: "BR000" } });
    fireEvent.click(within(trk).getByRole("button", { name: "Salvar rastreio" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")[0]).toMatchObject({ _id: ID2, _status: "shipped", _code: "BR000", _carrier: "Correios" }));
  });

  it("marcar como entregue pede confirmação; recusar não chama nada", async () => {
    askConfirm.mockResolvedValueOnce(false);
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Kit Pulseiras VENXPAY, de Loja do Caio/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Marcar como entregue" }));
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(calls("admin_set_reward_claim")).toHaveLength(0);
    askConfirm.mockResolvedValueOnce(true);
    fireEvent.click(within(dlg).getByRole("button", { name: "Marcar como entregue" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")[0]).toMatchObject({ _id: ID2, _status: "delivered" }));
  });

  it("pedido cancelado mostra o motivo ao seller e permite reabrir", async () => {
    handlers.get_admin_reward_claims_page = () => ({ data: page([claim({ id: ID3, status: "cancelled", has_message: true })]), error: null });
    askConfirm.mockResolvedValueOnce(true);
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte, cancelado/);
    expect(await within(dlg).findByText("Motivo do cancelamento")).toBeInTheDocument();
    expect(within(dlg).getByText("Endereço não confere")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Corrigir endereço" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reabrir pedido" }));
    await waitFor(() => expect(calls("admin_set_reward_claim")[0]).toMatchObject({ _id: ID3, _status: "pending", _message: null }));
  });

  it("salva a anotação interna e recusa anotação vazia", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Salvar anotação" }));
    expect(await within(dlg).findByText("Escreva a anotação.")).toBeInTheDocument();
    expect(calls("admin_add_reward_claim_note")).toHaveLength(0);
    fireEvent.change(within(dlg).getByRole("textbox", { name: /Anotação interna/ }), { target: { value: "  Ela pediu para ligar  " } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar anotação" }));
    await waitFor(() => expect(calls("admin_add_reward_claim_note")).toEqual([{ _id: ID1, _note: "Ela pediu para ligar" }]));
  });
});

describe("correção de endereço", () => {
  it("pede o motivo, valida e envia os campos normalizados", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Corrigir endereço" }));
    const adr = await screen.findByRole("dialog", { name: "Corrigir endereço de envio" });
    expect(within(adr).getByLabelText("CEP")).toHaveValue("87020-100");
    fireEvent.change(within(adr).getByLabelText("Número"), { target: { value: "130" } });
    fireEvent.click(within(adr).getByRole("button", { name: "Salvar endereço" }));
    expect(await within(adr).findByText(/Escreva o motivo/)).toBeInTheDocument();
    expect(calls("admin_update_reward_claim_shipping")).toHaveLength(0);
    fireEvent.change(within(adr).getByLabelText("Motivo da correção"), { target: { value: "o seller pediu para trocar o número" } });
    fireEvent.click(within(adr).getByRole("button", { name: "Salvar endereço" }));
    await waitFor(() => expect(calls("admin_update_reward_claim_shipping")).toEqual([expect.objectContaining({
      _id: ID1, _recipient_name: "Marina Duarte Lima", _zip: "87020-100", _street: "Rua das Palmeiras", _number: "130", _complement: "Apto 32", _state: "PR", _reason: "o seller pediu para trocar o número",
    })]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Endereço corrigido. O seller foi avisado."));
  });

  it("CEP incompleto bloqueia o envio e a mensagem do servidor aparece dentro do diálogo", async () => {
    handlers.admin_update_reward_claim_shipping = () => ({ data: null, error: { message: "nada mudou no endereço" } });
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Placa 100 MIL, de Marina Duarte/);
    fireEvent.click(await within(dlg).findByRole("button", { name: "Corrigir endereço" }));
    const adr = await screen.findByRole("dialog", { name: "Corrigir endereço de envio" });
    fireEvent.change(within(adr).getByLabelText("CEP"), { target: { value: "8702" } });
    fireEvent.change(within(adr).getByLabelText("Motivo da correção"), { target: { value: "conferindo o endereço" } });
    fireEvent.click(within(adr).getByRole("button", { name: "Salvar endereço" }));
    expect(await within(adr).findByText("Informe o CEP com 8 números.")).toBeInTheDocument();
    expect(calls("admin_update_reward_claim_shipping")).toHaveLength(0);
    fireEvent.change(within(adr).getByLabelText("CEP"), { target: { value: "87020100" } });
    fireEvent.click(within(adr).getByRole("button", { name: "Salvar endereço" }));
    expect(await within(adr).findByRole("alert")).toHaveTextContent("nada mudou no endereço");
  });

  it("pedido já postado não oferece correção de endereço", async () => {
    wrap(<RewardsCenter />);
    const dlg = await openClaim(/Kit Pulseiras VENXPAY, de Loja do Caio/);
    await within(dlg).findByText("Correios BR123456789BR");
    expect(within(dlg).queryByRole("button", { name: "Corrigir endereço" })).toBeNull();
  });
});

/* ───────── peças ───────── */

const openTiers = async () => {
  wrap(<RewardsCenter />);
  fireEvent.click(await screen.findByRole("button", { name: "Peças" }));
  return screen.findByRole("list", { name: "Peças de premiação" });
};

describe("peças de premiação", () => {
  it("lista as peças com quem bateu a meta, quem ainda não pediu e os pedidos", async () => {
    const list = await openTiers();
    expect(within(list).getByText(/41 sellers bateram/)).toBeInTheDocument();
    expect(within(list).getByText(/6 ainda não pediram/)).toBeInTheDocument();
    expect(within(list).getByText(/3 pedidos, 1 em andamento/)).toBeInTheDocument();
    expect(within(list).getByText("Oculta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir Kit Pulseiras VENXPAY" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Placa 250 MIL" })).toBeDisabled();
  });

  it("muda a ordem pelo servidor", async () => {
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Subir Placa 100 MIL" }));
    await waitFor(() => expect(calls("admin_move_award_tier")).toEqual([{ _id: "100k", _dir: "up" }]));
  });

  it("ocultar pede confirmação e manda a peça inteira com is_active falso", async () => {
    askConfirm.mockResolvedValueOnce(true);
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Kit Pulseiras VENXPAY" }));
    await waitFor(() => expect(calls("admin_save_award_tier")).toHaveLength(1));
    expect(calls("admin_save_award_tier")[0]).toMatchObject({ _id: "10k", _create: false, _title: "Kit Pulseiras VENXPAY", _value: 10000, _rewards: ["Pulseira preta"], _is_active: false });
    expect(String(askConfirm.mock.calls[0][0].description)).toContain("1 pedido em andamento segue");
  });

  it("mostrar uma peça oculta pede a senha antes", async () => {
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Placa 250 MIL" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain("Placa 250 MIL");
    await waitFor(() => expect(calls("admin_save_award_tier")[0]).toMatchObject({ _id: "250k", _is_active: true }));
  });

  it("peça com pedidos não pode ser apagada; sem pedidos, apagar pede a senha", async () => {
    await openTiers();
    expect(screen.getByRole("button", { name: "Apagar Kit Pulseiras VENXPAY" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apagar Placa 100 MIL" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(calls("admin_delete_award_tier")).toEqual([{ _id: "100k" }]));
  });

  it("mostra o erro do servidor ao mudar a ordem, sem fingir que deu certo", async () => {
    handlers.admin_move_award_tier = () => ({ data: null, error: { message: "peça não encontrada" } });
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Descer Kit Pulseiras VENXPAY" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("peça não encontrada");
  });

  it("editar só o texto não pede senha; mudar a meta pede", async () => {
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Editar Kit Pulseiras VENXPAY" }));
    const dlg = await screen.findByRole("dialog", { name: "Editar peça" });
    expect(within(dlg).getByLabelText("Meta de faturamento")).toHaveValue("10.000,00");
    fireEvent.change(within(dlg).getByLabelText("Descrição"), { target: { value: "Duas pulseiras de brinde" } });
    fireEvent.change(within(dlg).getByLabelText("O que o seller recebe"), { target: { value: "Pulseira preta\n\n Pulseira esmeralda " } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar peça" }));
    await waitFor(() => expect(calls("admin_save_award_tier")).toHaveLength(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(calls("admin_save_award_tier")[0]).toMatchObject({ _id: "10k", _create: false, _value: 10000, _description: "Duas pulseiras de brinde", _rewards: ["Pulseira preta", "Pulseira esmeralda"], _is_active: true });
  });

  it("mudar a meta confirma com a senha e explica o efeito", async () => {
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Editar Placa 100 MIL" }));
    const dlg = await screen.findByRole("dialog", { name: "Editar peça" });
    fireEvent.change(within(dlg).getByLabelText("Meta de faturamento"), { target: { value: "9000000" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar peça" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/muda de R\$\s100\.000 para R\$\s90\.000/);
    await waitFor(() => expect(calls("admin_save_award_tier")[0]).toMatchObject({ _id: "100k", _value: 90000 }));
  });

  it("peça nova nasce oculta, valida o nome e a meta antes de enviar", async () => {
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    const dlg = await screen.findByRole("dialog", { name: "Nova peça" });
    expect(within(dlg).queryByLabelText("Mostrar a peça para os sellers")).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar peça" }));
    expect(await within(dlg).findByText(/Dê um nome à peça/)).toBeInTheDocument();
    expect(within(dlg).getByText("Informe a meta de faturamento.")).toBeInTheDocument();
    expect(calls("admin_save_award_tier")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Nome da peça"), { target: { value: "Placa 750 MIL" } });
    fireEvent.change(within(dlg).getByLabelText("Meta de faturamento"), { target: { value: "75000000" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Criar peça" }));
    await waitFor(() => expect(calls("admin_save_award_tier")[0]).toMatchObject({ _id: null, _create: true, _title: "Placa 750 MIL", _value: 750000, _is_active: false, _image_url: null }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("erro do servidor ao salvar aparece no diálogo e ele continua aberto", async () => {
    handlers.admin_save_award_tier = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    await openTiers();
    fireEvent.click(screen.getByRole("button", { name: "Editar Placa 100 MIL" }));
    const dlg = await screen.findByRole("dialog", { name: "Editar peça" });
    fireEvent.change(within(dlg).getByLabelText("Frase da peça"), { target: { value: "O primeiro marco" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Salvar peça" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("reautenticação necessária");
    expect(screen.getByRole("dialog", { name: "Editar peça" })).toBeInTheDocument();
  });

  it("sem peças cadastradas explica que o seller vê as padrão", async () => {
    handlers.get_admin_award_tiers = () => ({ data: { items: [] }, error: null });
    wrap(<RewardsCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Peças" }));
    expect(await screen.findByText(/os sellers veem as sete peças padrão/)).toBeInTheDocument();
    expect(screen.getByText("Nenhuma peça cadastrada")).toBeInTheDocument();
  });
});

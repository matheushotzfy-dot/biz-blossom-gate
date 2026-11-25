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
import AffiliatesCenter from "@/features/admin-affiliates/AffiliatesCenter";
import {
  affiliateState, checkReason, conversionLabel, dayLabel, historyLabel, linkState, parseAffiliateDetail, parseAffiliatesPage, parseProductsPage,
  pctLabel, productProgramState, refundAttention, saleStatus,
} from "@/features/admin-affiliates/affiliatesModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const affiliate = (over: Record<string, unknown> = {}) => ({
  user_id: "f1", name: "Rafael Menezes", email: "rafael@exemplo.com", account_status: "active", links: 3, links_active: 3, links_held: 0, clicks: 1820, products: 3, sellers: 2,
  sales: 58, refunded: 2, revenue: 11426, commission: 3140.5, reversed: 118.2, last_sale_at: ago(4), hold_reason: null, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 3, selling: 2, idle: 1, held: 1, ...over });
const program = (over: Record<string, unknown> = {}) => ({ affiliates: 3, links: 5, links_active: 4, links_held: 1, clicks: 2080, sales: 67, refunded: 7, revenue: 13199, commission: 3406.5, reversed: 266.2, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), program: program(), generated_at: ago(0), ...over });

const product = (over: Record<string, unknown> = {}) => ({
  product_id: "p1", name: "Método Lançamento 7D", price: 197, status: "active", deleted: false, affiliate_enabled: true, commission_pct: 30, seller_user_id: "s1", seller_name: "Marina Duarte",
  seller_email: "marina@exemplo.com", affiliates: 3, links: 4, links_active: 3, clicks: 1200, sales: 40, refunded: 1, revenue: 7880, commission: 2364, ...over,
});

const link = (over: Record<string, unknown> = {}) => ({
  id: "l1", slug: "l1", clicks: 640, commission_pct: 30, is_active: true, paused_by_owner: false, created_at: ago(900), hold_reason: null, hold_at: null, product_id: "p1", product_name: "Método Lançamento 7D",
  product_deleted: false, product_status: "active", product_open: true, seller_user_id: "s1", seller_name: "Marina Duarte", sales: 30, commission: 1180, ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  affiliate: { user_id: "f1", name: "Rafael Menezes", email: "rafael@exemplo.com", account_status: "active" },
  stats: { links: 2, links_active: 2, links_held: 0, clicks: 1820, sales: 58, refunded: 2, revenue: 11426, commission: 3140.5, reversed: 118.2 },
  links: [link(), link({ id: "l2", product_id: "p3", product_name: "Planilha de Anúncios", product_open: false, sales: 28, commission: 1960.5 })],
  sales: [
    { id: "a1", status: "approved", sale_amount: 197, commission_pct: 30, commission_amount: 59.1, created_at: ago(4), product_name: "Método Lançamento 7D", seller_name: "Marina Duarte" },
    { id: "a2", status: "refunded", sale_amount: 197, commission_pct: 30, commission_amount: 59.1, created_at: ago(70), product_name: "Planilha de Anúncios", seller_name: "Marina Duarte" },
  ],
  history: [{ id: "h1", action: "affiliate_release", created_at: ago(50), admin_name: "Admin", details: { reason: "Seller confirmou a venda", links: 1 } }],
  ...over,
});
const heldDetail = () => detail({
  affiliate: { user_id: "f3", name: "Caio Teixeira", email: "caio@exemplo.com", account_status: "active" },
  stats: { links: 1, links_active: 0, links_held: 1, clicks: 260, sales: 9, refunded: 5, revenue: 1773, commission: 266, reversed: 148 },
  links: [link({ id: "l9", is_active: false, hold_at: ago(30), hold_reason: "Autoafiliação suspeita", sales: 9, commission: 266 })],
  history: [{ id: "h9", action: "affiliate_hold", created_at: ago(30), admin_name: "Admin", details: { reason: "Autoafiliação suspeita", links: 1 } }],
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const openRow = (name: string) => fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Ver ${name}` }));

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_affiliates_page = () => ({
    data: pageOf([
      affiliate(),
      affiliate({ user_id: "f3", name: "Caio Teixeira", email: "caio@exemplo.com", links: 1, links_active: 0, links_held: 1, clicks: 260, products: 1, sellers: 1, sales: 9, refunded: 5, revenue: 1773, commission: 266, reversed: 148, hold_reason: "Autoafiliação suspeita" }),
      affiliate({ user_id: "f5", name: "Pedro Alves", email: null, links: 1, links_active: 0, clicks: 0, products: 1, sellers: 1, sales: 0, refunded: 0, revenue: 0, commission: 0, reversed: 0, last_sale_at: null }),
    ]),
    error: null,
  });
  handlers.get_admin_affiliate_products_page = () => ({
    data: { items: [product(), product({ product_id: "p2", name: "Curso de Tráfego", seller_name: "Loja do Caio", price: 497, commission_pct: 45.5, affiliates: 0, links: 0, links_active: 0, sales: 0, refunded: 0, revenue: 0, commission: 0, clicks: 0, affiliate_enabled: false })], total: 2, summary: { open: 1, with_links: 1, with_sales: 1 }, generated_at: ago(0) },
    error: null,
  });
  handlers.get_admin_affiliate_detail = () => ({ data: detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("affiliatesModel", () => {
  it("lê a lista e rejeita formato inesperado", () => {
    const p = parseAffiliatesPage(pageOf([affiliate({ clicks: "1820", email: "", name: "" }), affiliate({ user_id: "x", name: "", email: "z@exemplo.com" })]));
    expect(p.items[0]).toMatchObject({ clicks: 1820, email: null, name: "Afiliado sem nome", hold_reason: null });
    expect(p.items[1].name).toBe("z@exemplo.com");
    expect(p.summary).toEqual({ all: 3, selling: 2, idle: 1, held: 1 });
    expect(p.program).toMatchObject({ links_held: 1, commission: 3406.5, reversed: 266.2 });
    expect(() => parseAffiliatesPage(null)).toThrow();
    expect(() => parseAffiliatesPage({ items: "x" })).toThrow();
  });

  it("lê a visão por produto", () => {
    const p = parseProductsPage({ items: [product({ price: null, commission_pct: "45.5", deleted: false })], total: 1, summary: { open: 1, with_links: 1, with_sales: 1 } });
    expect(p.items[0]).toMatchObject({ price: null, commission_pct: 45.5, affiliate_enabled: true, seller_name: "Marina Duarte" });
    expect(p.summary.open).toBe(1);
    expect(() => parseProductsPage({})).toThrow();
  });

  it("lê o raio-X com links, vendas e histórico", () => {
    const d = parseAffiliateDetail(detail());
    expect(d.stats).toMatchObject({ sales: 58, reversed: 118.2, links_active: 2 });
    expect(d.links).toHaveLength(2);
    expect(d.links[1]).toMatchObject({ product_open: false, hold_at: null, sales: 28 });
    expect(d.sales[1]).toMatchObject({ status: "refunded", commission_amount: 59.1 });
    expect(d.history[0]).toMatchObject({ action: "affiliate_release", reason: "Seller confirmou a venda", links: 1, admin_name: "Admin" });
    expect(() => parseAffiliateDetail({})).toThrow();
  });

  it("situação do afiliado: pausado pela equipe vence", () => {
    expect(affiliateState({ links: 3, links_active: 3, links_held: 0 })).toEqual({ label: "Link no ar", tone: "success" });
    expect(affiliateState({ links: 3, links_active: 2, links_held: 1 })).toEqual({ label: "Pausado pela equipe", tone: "destructive" });
    expect(affiliateState({ links: 2, links_active: 0, links_held: 0 }).label).toBe("Nenhum link no ar");
    expect(affiliateState({ links: 0, links_active: 0, links_held: 0 }).label).toBe("Sem link");
  });

  it("situação real do link: o que o checkout faz com ele", () => {
    const base = { is_active: true, paused_by_owner: false, hold_at: null, product_deleted: false, product_status: "active", product_open: true };
    expect(linkState(base)).toEqual({ label: "No ar", tone: "success" });
    expect(linkState({ ...base, hold_at: ago(1), is_active: false }).label).toBe("Pausado pela equipe");
    expect(linkState({ ...base, product_deleted: true }).label).toBe("Produto apagado");
    expect(linkState({ ...base, product_status: "inactive" }).label).toBe("Produto fora do ar");
    expect(linkState({ ...base, product_open: false }).label).toBe("Programa fechado");
    expect(linkState({ ...base, is_active: false, paused_by_owner: true }).label).toBe("Pausado pelo seller");
    expect(linkState({ ...base, is_active: false }).label).toBe("Pausado");
  });

  it("situação do produto no programa", () => {
    expect(productProgramState({ deleted: false, status: "active", affiliate_enabled: true }).label).toBe("Aberto a afiliados");
    expect(productProgramState({ deleted: false, status: "active", affiliate_enabled: false }).label).toBe("Programa fechado");
    expect(productProgramState({ deleted: false, status: "inactive", affiliate_enabled: true }).label).toBe("Produto fora do ar");
    expect(productProgramState({ deleted: true, status: "active", affiliate_enabled: true }).label).toBe("Produto apagado");
  });

  it("aviso de estorno só com volume e proporção relevantes", () => {
    expect(refundAttention({ sales: 1, refunded: 2 })).toBeNull();
    expect(refundAttention({ sales: 58, refunded: 2 })).toBeNull();
    expect(refundAttention({ sales: 9, refunded: 5 })).toBe("5 de 14 vendas estornadas");
    expect(refundAttention({ sales: 3, refunded: 1 })).toBe("1 de 4 vendas estornadas");
    expect(refundAttention({ sales: 10, refunded: 0 })).toBeNull();
  });

  it("textos: venda, comissão, conversão, dia e histórico", () => {
    expect(saleStatus("approved")).toEqual({ label: "Paga", tone: "success" });
    expect(saleStatus("refunded")).toEqual({ label: "Estornada", tone: "warning" });
    expect(saleStatus("x").label).toBe("Outro status");
    expect(pctLabel(30)).toBe("30%");
    expect(pctLabel(45.5)).toBe("45,5%");
    expect(pctLabel(null)).toBe("—");
    expect(conversionLabel(0, 0)).toBe("sem cliques ainda");
    expect(conversionLabel(58, 1820)).toBe("3,2% viraram venda");
    expect(conversionLabel(5, 2)).toBe("100% viraram venda");
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(dayLabel(null)).toBe("—");
    expect(dayLabel("lixo")).toBe("—");
    expect(historyLabel("affiliate_hold", 1)).toBe("Pausado pela equipe (1 link)");
    expect(historyLabel("affiliate_hold", 3)).toBe("Pausado pela equipe (3 links)");
    expect(historyLabel("affiliate_release")).toBe("Liberado para o seller reativar");
    expect(historyLabel("outra")).toBe("Ação registrada");
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("  ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Autoafiliação")).toBeNull();
  });
});

/* ───────── tela ───────── */

describe("AffiliatesCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<AffiliatesCenter isAdmin={false} />);
    expect(screen.getByText("A curadoria de afiliados é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra totais, avisos e a lista pela RPC (nunca lê a tabela)", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    expect(calls("get_admin_affiliates_page")[0]).toEqual({ _filter: "all", _search: null, _page: 1, _page_size: 25 });
    expect(calls("get_admin_affiliate_products_page")).toHaveLength(0);
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("1 link pausado pela equipe")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("58 vendas pagas")).toBeInTheDocument();
    expect(within(rows[0]).getByText("3 links no ar de 3")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/3,2% viraram venda/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Pausado pela equipe")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Motivo: Autoafiliação suspeita/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("5 de 14 vendas estornadas")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Sem e-mail")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Nenhum link no ar")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/sem cliques ainda/)).toBeInTheDocument();
    expect(screen.getByText("Todos · 3")).toBeInTheDocument();
    expect(screen.getByText("Pausados · 1")).toBeInTheDocument();
  });

  it("sem link pausado o aviso do topo fica tranquilo", async () => {
    handlers.get_admin_affiliates_page = () => ({ data: pageOf([affiliate()], { summary: summary({ held: 0 }), program: program({ links_held: 0, links_active: 3 }) }), error: null });
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    expect(screen.getByText("3 links no ar")).toBeInTheDocument();
  });

  it("filtro e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    fireEvent.click(screen.getByRole("button", { name: /^Pausados/ }));
    await waitFor(() => expect(calls("get_admin_affiliates_page").at(-1)).toMatchObject({ _filter: "held", _page: 1 }));
    fireEvent.change(screen.getByLabelText("Buscar afiliados"), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_affiliates_page").at(-1)).toMatchObject({ _filter: "held", _search: "caio" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar afiliados") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_affiliates_page").at(-1)).toMatchObject({ _filter: "all", _search: null }));
  });

  it("visão por produto usa a própria RPC e não tem filtro de situação", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
    await screen.findAllByText("Método Lançamento 7D");
    expect(calls("get_admin_affiliate_products_page")[0]).toEqual({ _search: null, _page: 1, _page_size: 25 });
    const rows = tableRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Aberto a afiliados")).toBeInTheDocument();
    expect(within(rows[0]).getByText("3 afiliados")).toBeInTheDocument();
    expect(within(rows[0]).getByText("40 vendas pagas")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Programa fechado")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Comissão 45,5%/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Com vendas/ })).toBeNull();
    // não há ação por produto: só leitura
    expect(within(screen.getByRole("table")).queryByRole("button")).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar produtos"), { target: { value: "caio" } });
    await waitFor(() => expect(calls("get_admin_affiliate_products_page").at(-1)).toMatchObject({ _search: "caio" }));
  });

  it("sem resultado e sem afiliados têm textos diferentes", async () => {
    handlers.get_admin_affiliates_page = () => ({ data: pageOf([], { summary: summary({ all: 0, selling: 0, idle: 0, held: 0 }), program: program({ affiliates: 0, links: 0, links_active: 0, links_held: 0, clicks: 0, sales: 0, commission: 0, reversed: 0, revenue: 0 }) }), error: null });
    wrap(<AffiliatesCenter />);
    expect(await screen.findByText("Nenhum afiliado ainda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar afiliados"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso e tenta de novo", async () => {
    handlers.get_admin_affiliates_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<AffiliatesCenter />);
    expect(await screen.findByText("Não foi possível carregar os afiliados.")).toBeInTheDocument();
    handlers.get_admin_affiliates_page = () => ({ data: pageOf([affiliate()]), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("Rafael Menezes")).length).toBeGreaterThan(0);
  });

  it("raio-X mostra resultado, links (com o que não paga comissão), vendas e histórico", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    openRow("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    expect((await within(dlg).findAllByText("Planilha de Anúncios")).length).toBeGreaterThan(0);
    expect(calls("get_admin_affiliate_detail")[0]).toEqual({ _user_id: "f1" });
    expect(within(dlg).getByText(/118,20 estornados/)).toBeInTheDocument();
    expect(within(dlg).getByText("No ar")).toBeInTheDocument();
    expect(within(dlg).getByText("Programa fechado")).toBeInTheDocument();
    expect(within(dlg).getAllByText(/o checkout não paga comissão por ele/)).toHaveLength(1);
    expect(within(dlg).getByText("Paga")).toBeInTheDocument();
    expect(within(dlg).getByText("Estornada")).toBeInTheDocument();
    expect(within(dlg).getByText("Liberado para o seller reativar (1 link)")).toBeInTheDocument();
    expect(within(dlg).getByText("Seller confirmou a venda")).toBeInTheDocument();
    expect(within(dlg).getByText(/reembolso parcial ainda não reduz a comissão/)).toBeInTheDocument();
    // sem link pausado: oferece pausar, não liberar
    expect(within(dlg).getByRole("button", { name: "Pausar afiliado" })).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Liberar afiliado" })).toBeNull();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_affiliate_detail = () => ({ data: null, error: { message: "afiliado não encontrado" } });
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    openRow("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/afiliado não encontrado/)).toBeInTheDocument();
    handlers.get_admin_affiliate_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("Paga")).toBeInTheDocument();
  });

  it("pausar o afiliado: exige motivo, pede senha, chama a RPC para todos os links e avisa", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    openRow("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar afiliado" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Pausar afiliado?")).toBeInTheDocument();
    expect(within(mod).getByText(/nenhuma comissão é paga, nem nas vendas que já estavam em andamento/)).toBeInTheDocument();
    // sem motivo: nada é enviado e o erro aparece
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar afiliado" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_set_affiliate_hold")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    // chip preenche o motivo
    fireEvent.click(within(mod).getByRole("button", { name: "Autoafiliação suspeita" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Autoafiliação suspeita");
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar afiliado" }));
    await waitFor(() => expect(calls("admin_set_affiliate_hold")).toHaveLength(1));
    expect(calls("admin_set_affiliate_hold")[0]).toEqual({ _affiliate_user_id: "f1", _link_id: null, _hold: true, _reason: "Autoafiliação suspeita" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Pausar afiliado: Rafael Menezes\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Afiliado pausado. Os links já não contam vendas."));
    await waitFor(() => expect(calls("get_admin_affiliates_page").length).toBeGreaterThan(1));
  });

  it("pausar só um link manda o id do link", async () => {
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    openRow("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar o link de Planilha de Anúncios" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Pausar link?")).toBeInTheDocument();
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Divulgação enganosa" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar link" }));
    await waitFor(() => expect(calls("admin_set_affiliate_hold")).toHaveLength(1));
    expect(calls("admin_set_affiliate_hold")[0]).toEqual({ _affiliate_user_id: "f1", _link_id: "l2", _hold: true, _reason: "Divulgação enganosa" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Pausar link: Planilha de Anúncios, de Rafael Menezes/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link pausado. Ele já não conta vendas."));
  });

  it("afiliado pausado: mostra o motivo, só oferece liberar e libera com motivo", async () => {
    handlers.get_admin_affiliate_detail = () => ({ data: heldDetail(), error: null });
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Caio Teixeira");
    openRow("Caio Teixeira");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Todos os links estão pausados desde/)).toBeInTheDocument();
    expect(within(dlg).getAllByText(/Motivo: Autoafiliação suspeita/).length).toBeGreaterThan(0);
    expect(within(dlg).queryByRole("button", { name: "Pausar afiliado" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Liberar afiliado" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Liberar afiliado?")).toBeInTheDocument();
    expect(within(mod).getByText(/quem decide reativar é o dono do produto/)).toBeInTheDocument();
    expect(within(mod).queryByRole("button", { name: "Autoafiliação suspeita" })).toBeNull();
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Seller confirmou a venda" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Liberar afiliado" }));
    await waitFor(() => expect(calls("admin_set_affiliate_hold")).toHaveLength(1));
    expect(calls("admin_set_affiliate_hold")[0]).toEqual({ _affiliate_user_id: "f3", _link_id: null, _hold: false, _reason: "Seller confirmou a venda" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Liberado. O dono do produto decide quando reativar."));
  });

  it("erro do servidor fica no diálogo e nada fecha", async () => {
    handlers.admin_set_affiliate_hold = () => ({ data: null, error: { message: "Autenticação recente necessária" } });
    wrap(<AffiliatesCenter />);
    await screen.findAllByText("Rafael Menezes");
    openRow("Rafael Menezes");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar afiliado" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Muitos estornos" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar afiliado" }));
    expect(await within(mod).findByText(/Autenticação recente necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Pausar afiliado?")).toBeInTheDocument();
  });
});

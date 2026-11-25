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
import CouponsCenter from "@/features/admin-coupons/CouponsCenter";
import {
  checkReason, dayLabel, discountLabel, expiryLabel, historyLabel, isFullDiscount, parseCouponDetail, parseCouponsPage, stateInfo, usesLabel,
} from "@/features/admin-coupons/couponsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const coupon = (over: Record<string, unknown> = {}) => ({
  id: "k1", code: "BLACK20", state: "active", discount_type: "percentage", discount_value: 20, apply_to_bumps: false, max_uses: 100, current_uses: 38, is_active: true,
  expires_at: null, created_at: ago(200), hold_reason: null, hold_at: null, product_id: "p1", product_name: "Método Lançamento 7D", product_deleted: false,
  seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", sales: 36, buyers: 34, discount: 1420.4, gross: 5680, open_reservations: 2, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 3, active: 2, paused: 1, expired: 0, exhausted: 0, held: 1, full_discount: 1, sales: 41, buyers: 35, discount: 1618.4, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), generated_at: ago(0), ...over });

const sale = (over: Record<string, unknown> = {}) => ({ id: "t1", status: "completed", amount: 157.6, discount_amount: 39.4, payment_method: "pix", created_at: ago(3), buyer_name: "Rafael Menezes", buyer_email: "rafael@exemplo.com", simulated: false, ...over });
const detail = (over: Record<string, unknown> = {}) => ({
  coupon: { id: "k1", code: "BLACK20", state: "active", discount_type: "percentage", discount_value: 20, apply_to_bumps: true, max_uses: 100, current_uses: 38, is_active: true, expires_at: null, created_at: ago(200), hold_reason: null, hold_at: null },
  product: { id: "p1", name: "Método Lançamento 7D", price: 197, deleted: false },
  seller: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "active" },
  stats: { sales: 36, buyers: 34, discount: 1420.4, gross: 5680, refunds: 1, chargebacks: 0, open_reservations: 2, lost: 5, simulated: 1 },
  sales: [
    sale(),
    sale({ id: "t2", status: "pending", buyer_name: null, buyer_email: "ana@exemplo.com" }),
    sale({ id: "t3", status: "refunded", buyer_name: "Juliana Prado", buyer_email: "ju@exemplo.com" }),
    sale({ id: "t4", amount: 1, discount_amount: 99, buyer_name: "Teste", buyer_email: "teste@exemplo.com", simulated: true }),
  ],
  history: [{ id: "h1", action: "coupon_release", created_at: ago(50), admin_name: "Admin", details: { reason: "Seller corrigiu o cupom" } }],
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const openRow = (code: string) => fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Ver ${code}` }));

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_coupons_page = () => ({
    data: pageOf([
      coupon(),
      coupon({ id: "k2", code: "GRATIS100", discount_value: 100, max_uses: null, current_uses: 2, sales: 2, buyers: 1, discount: 198, gross: 2, product_id: null, product_name: null, seller_name: "Loja do Caio" }),
      coupon({ id: "k3", code: "AUTOCOMPRA", state: "held", is_active: false, hold_at: ago(30), hold_reason: "Autocompra do seller", discount_value: 100, seller_name: "Loja do Caio" }),
    ]),
    error: null,
  });
  handlers.get_admin_coupon_detail = () => ({ data: detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("couponsModel", () => {
  it("lê a lista e rejeita formato inesperado", () => {
    const p = parseCouponsPage(pageOf([coupon({ current_uses: "38", max_uses: null, product_id: "" })]));
    expect(p.items[0]).toMatchObject({ code: "BLACK20", current_uses: 38, max_uses: null, product_id: null, state: "active" });
    expect(p.summary.full_discount).toBe(1);
    expect(parseCouponsPage(pageOf([coupon({ state: "qualquer" })])).items[0].state).toBe("active");
    expect(() => parseCouponsPage(null)).toThrow();
    expect(() => parseCouponsPage({ items: "x" })).toThrow();
  });

  it("lê o raio-X com vendas, estatísticas e histórico", () => {
    const d = parseCouponDetail(detail());
    expect(d.stats).toMatchObject({ sales: 36, discount: 1420.4, simulated: 1, lost: 5 });
    expect(d.sales).toHaveLength(4);
    expect(d.sales[1]).toMatchObject({ buyer_name: null, buyer_email: "ana@exemplo.com", status: "pending" });
    expect(d.sales[3].simulated).toBe(true);
    expect(d.history[0]).toMatchObject({ action: "coupon_release", reason: "Seller corrigiu o cupom", admin_name: "Admin" });
    expect(parseCouponDetail(detail({ product: null })).product).toBeNull();
    expect(() => parseCouponDetail({})).toThrow();
  });

  it("situação: pausado pela equipe tem rótulo próprio", () => {
    expect(stateInfo("active")).toEqual({ label: "Ativo", tone: "success" });
    expect(stateInfo("held")).toEqual({ label: "Pausado pela equipe", tone: "destructive" });
    expect(stateInfo("paused").label).toBe("Pausado pelo seller");
    expect(stateInfo("expired").label).toBe("Expirado");
    expect(stateInfo("exhausted").label).toBe("Esgotado");
  });

  it("desconto, 100% e usos", () => {
    expect(discountLabel({ discount_type: "percentage", discount_value: 20 })).toBe("20%");
    expect(discountLabel({ discount_type: "percentage", discount_value: 12.5 })).toBe("12,5%");
    expect(discountLabel({ discount_type: "fixed", discount_value: 25 })).toMatch(/R\$\s25,00/);
    expect(isFullDiscount({ discount_type: "percentage", discount_value: 100 })).toBe(true);
    expect(isFullDiscount({ discount_type: "percentage", discount_value: 99 })).toBe(false);
    expect(isFullDiscount({ discount_type: "fixed", discount_value: 100 })).toBe(false);
    expect(usesLabel({ current_uses: 38, max_uses: 100 })).toBe("38 de 100 usos");
    expect(usesLabel({ current_uses: 2, max_uses: null })).toBe("2 usos");
    expect(usesLabel({ current_uses: 1, max_uses: null })).toBe("1 uso");
  });

  it("validade, dia e histórico", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(expiryLabel({ expires_at: null }, now)).toBeNull();
    expect(expiryLabel({ expires_at: "2026-12-04T12:00:00Z" }, now)).toBe("Vale até 04/12/2026");
    expect(expiryLabel({ expires_at: "2026-11-05T12:00:00Z" }, now)).toBe("Expirou em 05/11/2026");
    expect(expiryLabel({ expires_at: "lixo" }, now)).toBeNull();
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(dayLabel(null)).toBe("—");
    expect(dayLabel("lixo")).toBe("—");
    expect(historyLabel("coupon_hold")).toBe("Pausado pela equipe");
    expect(historyLabel("coupon_release")).toBe("Liberado para o seller ativar");
    expect(historyLabel("outra")).toBe("Ação registrada");
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("  ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Autocompra")).toBeNull();
  });
});

/* ───────── tela ───────── */

describe("CouponsCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<CouponsCenter isAdmin={false} />);
    expect(screen.getByText("A curadoria de cupons é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra totais, avisos e a lista pela RPC (nunca lê a tabela)", async () => {
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    expect(calls("get_admin_coupons_page")[0]).toEqual({ _status: "all", _search: null, _page: 1, _page_size: 25 });
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("1 cupom de 100% no ar")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("36 vendas pagas")).toBeInTheDocument();
    expect(within(rows[0]).getByText("38 de 100 usos")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Todos os produtos")).toBeInTheDocument();
    expect(within(rows[1]).getByText("100%: sai de graça")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Pausado pela equipe")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Motivo: Autocompra do seller/)).toBeInTheDocument();
    expect(screen.getByText("Todos · 3")).toBeInTheDocument();
    expect(screen.getByText("Pausados · 1")).toBeInTheDocument();
  });

  it("sem cupom de 100% o aviso do topo fica tranquilo", async () => {
    handlers.get_admin_coupons_page = () => ({ data: pageOf([coupon()], { summary: summary({ all: 1, active: 1, paused: 0, held: 0, full_discount: 0 }) }), error: null });
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    expect(screen.getByText("1 no ar, nenhum de 100%")).toBeInTheDocument();
  });

  it("filtro de situação e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    fireEvent.click(screen.getByRole("button", { name: /^Pausados/ }));
    await waitFor(() => expect(calls("get_admin_coupons_page").at(-1)).toMatchObject({ _status: "paused", _page: 1 }));
    fireEvent.change(screen.getByLabelText("Buscar cupons"), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_coupons_page").at(-1)).toMatchObject({ _status: "paused", _search: "caio" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar cupons") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_coupons_page").at(-1)).toMatchObject({ _status: "all", _search: null }));
  });

  it("sem resultado e sem cupons têm textos diferentes", async () => {
    handlers.get_admin_coupons_page = () => ({ data: pageOf([], { summary: summary({ all: 0, active: 0, paused: 0, held: 0, full_discount: 0 }) }), error: null });
    wrap(<CouponsCenter />);
    expect(await screen.findByText("Nenhum cupom criado ainda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar cupons"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso e tenta de novo", async () => {
    handlers.get_admin_coupons_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<CouponsCenter />);
    expect(await screen.findByText("Não foi possível carregar os cupons.")).toBeInTheDocument();
    handlers.get_admin_coupons_page = () => ({ data: pageOf([coupon()], { summary: summary({ all: 1, active: 1, paused: 0, held: 0, full_discount: 0 }) }), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("BLACK20")).length).toBeGreaterThan(0);
  });

  it("raio-X mostra uso, vendas (com a simulada marcada) e histórico", async () => {
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    openRow("BLACK20");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Rafael Menezes")).toBeInTheDocument();
    expect(calls("get_admin_coupon_detail")[0]).toEqual({ _id: "k1" });
    expect(within(dlg).getByText("Método Lançamento 7D")).toBeInTheDocument();
    expect(within(dlg).getByText("O desconto vale também nelas")).toBeInTheDocument();
    expect(within(dlg).getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(within(dlg).getByText("Aguardando pagamento")).toBeInTheDocument();
    expect(within(dlg).getByText("Reembolsada")).toBeInTheDocument();
    expect(within(dlg).getByText("Simulada")).toBeInTheDocument();
    expect(within(dlg).getByText("38 de 100 usos")).toBeInTheDocument();
    expect(within(dlg).getByText("2 aguardando Pix")).toBeInTheDocument();
    expect(within(dlg).getByText(/5 voltaram/)).toBeInTheDocument();
    expect(within(dlg).getByText(/1 reembolso e 0 chargebacks/)).toBeInTheDocument();
    expect(within(dlg).getByText(/1 venda simulada fora das contas/)).toBeInTheDocument();
    expect(within(dlg).getByText("Liberado para o seller ativar")).toBeInTheDocument();
    expect(within(dlg).getByText("Seller corrigiu o cupom")).toBeInTheDocument();
    // cupom ativo: oferece pausar, não liberar
    expect(within(dlg).getByRole("button", { name: "Pausar cupom" })).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Liberar cupom" })).toBeNull();
  });

  it("cupom de 100% sem produto específico avisa o admin", async () => {
    handlers.get_admin_coupon_detail = () => ({
      data: detail({ coupon: { ...detail().coupon, id: "k2", code: "GRATIS100", discount_value: 100, max_uses: null }, product: null }), error: null,
    });
    wrap(<CouponsCenter />);
    await screen.findAllByText("GRATIS100");
    openRow("GRATIS100");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/quem usa leva qualquer produto do seller de graça/)).toBeInTheDocument();
    expect(within(dlg).getByText("Todos os produtos do seller")).toBeInTheDocument();
    expect(within(dlg).getByText("Sem limite")).toBeInTheDocument();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_coupon_detail = () => ({ data: null, error: { message: "cupom não encontrado" } });
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    openRow("BLACK20");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/cupom não encontrado/)).toBeInTheDocument();
    handlers.get_admin_coupon_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("Rafael Menezes")).toBeInTheDocument();
  });

  it("pausar: exige motivo, pede senha, chama a RPC e avisa", async () => {
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    openRow("BLACK20");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar cupom" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Pausar cupom?")).toBeInTheDocument();
    // sem motivo: nada é enviado e o erro aparece
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar cupom" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_set_coupon_hold")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    // chip preenche o motivo
    fireEvent.click(within(mod).getByRole("button", { name: "Autocompra do seller" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Autocompra do seller");
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar cupom" }));
    await waitFor(() => expect(calls("admin_set_coupon_hold")).toHaveLength(1));
    expect(calls("admin_set_coupon_hold")[0]).toEqual({ _id: "k1", _hold: true, _reason: "Autocompra do seller" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Pausar cupom: BLACK20, de Marina Duarte/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cupom pausado. O checkout já recusa o código."));
    await waitFor(() => expect(calls("get_admin_coupons_page").length).toBeGreaterThan(1));
  });

  it("liberar: cupom pausado pela equipe mostra o motivo e libera com motivo", async () => {
    handlers.get_admin_coupon_detail = () => ({
      data: detail({ coupon: { ...detail().coupon, id: "k3", code: "AUTOCOMPRA", state: "held", is_active: false, hold_at: ago(30), hold_reason: "Autocompra do seller" } }), error: null,
    });
    wrap(<CouponsCenter />);
    await screen.findAllByText("AUTOCOMPRA");
    openRow("AUTOCOMPRA");
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/O seller não consegue ativar de novo\./)).toBeInTheDocument();
    expect(within(dlg).getByText(/Motivo: Autocompra do seller/)).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Pausar cupom" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Liberar cupom" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Liberar cupom?")).toBeInTheDocument();
    expect(within(mod).queryByRole("button", { name: "Autocompra do seller" })).toBeNull();
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Seller explicou o uso" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Liberar cupom" }));
    await waitFor(() => expect(calls("admin_set_coupon_hold")).toHaveLength(1));
    expect(calls("admin_set_coupon_hold")[0]).toEqual({ _id: "k3", _hold: false, _reason: "Seller explicou o uso" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cupom liberado. O seller decide quando ativar."));
  });

  it("erro do servidor fica no diálogo e nada fecha", async () => {
    handlers.admin_set_coupon_hold = () => ({ data: null, error: { message: "Autenticação recente necessária" } });
    wrap(<CouponsCenter />);
    await screen.findAllByText("BLACK20");
    openRow("BLACK20");
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Pausar cupom" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Abuso do cupom" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Pausar cupom" }));
    expect(await within(mod).findByText(/Autenticação recente necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Pausar cupom?")).toBeInTheDocument();
  });
});

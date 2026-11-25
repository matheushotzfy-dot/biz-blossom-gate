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
import ProductsCenter from "@/features/admin-products/ProductsCenter";
import {
  actionEffect, actionIsDanger, actionLabel, actionNeedsReason, approvalRate, availableActions, checkReason, historyLabel, parseProductDetail, parseProductsPage, saleStatus, statusInfo,
} from "@/features/admin-products/productsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const product = (over: Record<string, unknown> = {}) => ({
  id: "p1", name: "Método Lançamento 7D", description: "Aulas e planilhas.", price: 297, status: "pending_review", classification: "white", rejection_reason: null,
  image_url: null, checkout_url: "https://exemplo.com/pay/abc", created_at: ago(50), updated_at: ago(2), deleted_at: null,
  seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com",
  attempts: 0, sales: 0, gross: 0, refunds: 0, refunded: 0, chargebacks: 0, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ live: 3, pending_review: 1, active: 1, draft: 0, inactive: 1, deleted: 1, ...over });
const classCounts = (over: Record<string, unknown> = {}) => ({ all: 3, white: 2, gray: 1, black: 0, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), class_counts: classCounts(), ...over });

const detail = (over: Record<string, unknown> = {}) => ({
  product: { id: "p1", name: "Método Lançamento 7D", description: "Aulas e planilhas.\nSem promessa de ganho.", price: 297, status: "pending_review", classification: "white", rejection_reason: null, image_url: null, checkout_url: "https://exemplo.com/pay/abc", page_url: null, created_at: ago(50), updated_at: ago(2), deleted_at: null, delivery_type: "digital", pix: true, card: true, boleto: false, timer: 15, guarantee: true, address_required: false, affiliate_enabled: true, affiliate_commission: 30, co_production_enabled: false, upsell_enabled: true, downsell_enabled: false },
  seller: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", phone: "(44) 99999-1234", document_masked: "•••••••8809", account_status: "approved", products_total: 4 },
  stats: { attempts: 120, sales: 84, gross: 8148, net: 7578.6, fees: 569.4, pending: 5, failed: 31, refunds: 3, refunded: 291, chargebacks: 1, chargeback_amount: 97 },
  methods: [{ method: "pix", count: 60, gross: 5820 }],
  recent_sales: [{ id: "t1", amount: 97, status: "approved", payment_method: "pix", created_at: ago(2), buyer: "Ana" }],
  bumps: [{ id: "b1", name: "Pacote de planilhas", price: 27, is_active: true }],
  disputes: { total: 1, open: 1, amount: 97, items: [{ id: "d1", type: "chargeback", status: "open", amount: 97, created_at: ago(70) }] },
  affiliate: { sales: 12, commission: 349.2 },
  courses: [{ id: "c1", title: "Método Lançamento 7D", is_published: true }],
  history: [{ id: "h1", action: "product_pending_review", created_at: ago(30), admin_name: "Admin", details: { reason: "Promessa irreal", from: "active", to: "pending_review" } }, { id: "h2", action: "product_blocked", created_at: ago(200), admin_name: null, details: null }],
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>);
const lastList = () => calls("get_admin_products_page").at(-1)!;

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_products_page = () => ({
    data: pageOf([
      product(),
      product({ id: "p2", name: "Planilha de Anúncios", status: "active", classification: "gray", sales: 84, attempts: 120, gross: 8148, chargebacks: 1, refunds: 3, refunded: 291, price: 97 }),
    ]), error: null,
  });
  handlers.get_admin_product_detail = () => ({ data: detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("productsModel", () => {
  it("situação em português, com apagado acima de tudo", () => {
    expect(statusInfo({ status: "active", deleted_at: null })).toEqual({ label: "Ativo", tone: "success" });
    expect(statusInfo({ status: "pending_review", deleted_at: null })).toEqual({ label: "Em revisão", tone: "warning" });
    expect(statusInfo({ status: "inactive", deleted_at: null }).label).toBe("Inativo");
    expect(statusInfo({ status: "draft", deleted_at: null }).label).toBe("Rascunho");
    expect(statusInfo({ status: "inactive", deleted_at: "2026-11-01T00:00:00Z" })).toEqual({ label: "Apagado", tone: "destructive" });
    expect(statusInfo({ status: "zzz", deleted_at: null }).label).toBe("Situação desconhecida");
  });

  it("ações que cada situação aceita (o servidor confere de novo)", () => {
    expect(availableActions({ status: "pending_review", deleted_at: null })).toEqual(["approve", "deactivate", "delete"]);
    expect(availableActions({ status: "active", deleted_at: null })).toEqual(["review", "deactivate", "delete"]);
    expect(availableActions({ status: "inactive", deleted_at: null })).toEqual(["approve", "review", "delete"]);
    expect(availableActions({ status: "draft", deleted_at: null })).toEqual(["delete"]);
    expect(availableActions({ status: "inactive", deleted_at: "2026-11-01T00:00:00Z" })).toEqual(["restore"]);
  });

  it("rótulos, motivo obrigatório e perigo", () => {
    expect(actionLabel("approve", { status: "pending_review", deleted_at: null })).toBe("Aprovar");
    expect(actionLabel("approve", { status: "inactive", deleted_at: null })).toBe("Reativar");
    expect(actionLabel("review", { status: "active", deleted_at: null })).toBe("Colocar em revisão");
    expect(actionNeedsReason("approve")).toBe(false);
    expect(["review", "deactivate", "delete", "restore"].every((a) => actionNeedsReason(a as never))).toBe(true);
    expect(actionIsDanger("deactivate")).toBe(true);
    expect(actionIsDanger("delete")).toBe(true);
    expect(actionIsDanger("review")).toBe(false);
    expect(actionEffect("delete", { status: "active", deleted_at: null })).toMatch(/dá para restaurar/);
    expect(actionEffect("approve", { status: "inactive", deleted_at: null })).toMatch(/volta ao ar/);
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("   ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Nicho não permitido")).toBeNull();
  });

  it("vendas e histórico em português, registros antigos identificados", () => {
    expect(saleStatus("approved")).toEqual({ label: "Paga", tone: "success" });
    expect(saleStatus("waiting_payment").label).toBe("Aguardando pagamento");
    expect(saleStatus("chargeback").tone).toBe("destructive");
    expect(saleStatus("???").label).toBe("Outro status");
    expect(historyLabel({ action: "product_active", from: "pending_review", to: "active" })).toBe("Aprovado");
    expect(historyLabel({ action: "product_active", from: "inactive", to: "active" })).toBe("Reativado");
    expect(historyLabel({ action: "product_classified", from: "white", to: "black" })).toBe("Classificado como Black");
    expect(historyLabel({ action: "product_blocked", from: null, to: null })).toBe("Registro antigo de desativação");
    expect(historyLabel({ action: "product_rejected", from: null, to: null })).toBe("Registro antigo de revisão");
    expect(historyLabel({ action: "outra", from: null, to: null })).toBe("Ação registrada");
  });

  it("taxa de pagamento só existe com tentativas", () => {
    expect(approvalRate(0, 0)).toBeNull();
    expect(approvalRate(84, 120)).toBe(70);
    expect(approvalRate(1, 3)).toBe(33.3);
  });

  it("lê a página e recusa resposta torta", () => {
    const p = parseProductsPage(pageOf([product({ classification: "banana", price: "12.5" })]));
    expect(p.items[0].classification).toBe("white");
    expect(p.items[0].price).toBe(12.5);
    expect(p.summary.pending_review).toBe(1);
    expect(p.classCounts.gray).toBe(1);
    expect(() => parseProductsPage(null)).toThrow(/inesperada/);
    expect(() => parseProductsPage({ nope: 1 })).toThrow();
    expect(parseProductsPage({ items: [{ id: "x" }] }).items[0].name).toBe("Produto sem nome");
  });

  it("lê o raio-X e usa o motivo da nota quando falta o motivo", () => {
    const d = parseProductDetail(detail({ history: [{ id: "h", action: "product_classified", created_at: ago(1), admin_name: "Admin", details: { classification: "black", note: "nicho sensível" } }] }));
    expect(d.history[0].to).toBe("black");
    expect(d.history[0].reason).toBe("nicho sensível");
    expect(d.stats.net).toBe(7578.6);
    expect(d.product.timer).toBe(15);
    expect(parseProductDetail(detail({ product: { ...detail().product, timer: null } })).product.timer).toBeNull();
    expect(() => parseProductDetail({})).toThrow(/inesperada/);
  });
});

/* ───────── tela ───────── */

describe("ProductsCenter", () => {
  it("carrega do servidor, mostra a fila e os números", async () => {
    wrap(<ProductsCenter />);
    expect((await screen.findAllByText("Método Lançamento 7D")).length).toBeGreaterThan(0);
    expect(lastList()).toMatchObject({ _status: "live", _class: null, _search: null, _page: 1, _page_size: 25 });
    expect(screen.getByText("1 esperando análise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Em revisão · 1/ })).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Em revisão")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Gray")).toBeInTheDocument();
    expect(within(rows[1]).getByText("1 chargeback")).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
  });

  it("filtros e busca vão para o servidor e voltam para a página 1", async () => {
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(screen.getByRole("button", { name: /Em revisão · 1/ }));
    await waitFor(() => expect(lastList()._status).toBe("pending_review"));
    fireEvent.click(screen.getByRole("button", { name: /^Gray/ }));
    await waitFor(() => expect(lastList()._class).toBe("gray"));
    fireEvent.change(screen.getByLabelText("Buscar produtos"), { target: { value: "planilha" } });
    await waitFor(() => expect(lastList()._search).toBe("planilha"));
    expect(lastList()._page).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    await waitFor(() => { expect(lastList()._status).toBe("live"); expect(lastList()._class).toBeNull(); expect(lastList()._search).toBeNull(); });
  });

  it("erro de carga mostra o motivo e tenta de novo", async () => {
    handlers.get_admin_products_page = () => ({ data: null, error: { message: "not authorized" } });
    wrap(<ProductsCenter />);
    expect(await screen.findByText("Não foi possível carregar os produtos.")).toBeInTheDocument();
    handlers.get_admin_products_page = () => ({ data: pageOf([product()]), error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((await screen.findAllByText("Método Lançamento 7D")).length).toBeGreaterThan(0);
  });

  it("sem produtos: estado vazio; com filtro: oferece limpar", async () => {
    handlers.get_admin_products_page = () => ({ data: pageOf([], { summary: summary({ live: 0, pending_review: 0, active: 0, inactive: 0, deleted: 0 }) }), error: null });
    wrap(<ProductsCenter />);
    expect(await screen.findByText("Nenhum produto cadastrado ainda")).toBeInTheDocument();
    expect(screen.getByText("Nenhum esperando análise")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar produtos"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("quem não é admin vê um aviso e nenhuma chamada sai", () => {
    wrap(<ProductsCenter isAdmin={false} />);
    expect(screen.getByText("A curadoria de produtos é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("raio-X mostra seller sem documento inteiro, financeiro e histórico antigo identificado", async () => {
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Esperando a sua análise. Enquanto isso o checkout não vende este produto.")).toBeInTheDocument();
    expect(calls("get_admin_product_detail")[0]).toEqual({ _id: "p1" });
    expect(within(dlg).getByText("•••••••8809")).toBeInTheDocument();
    expect(within(dlg).getByText(/Sem promessa de ganho/)).toBeInTheDocument();
    expect(within(dlg).getByText("84")).toBeInTheDocument();
    expect(within(dlg).getByText("70% pagas", { exact: false })).toBeInTheDocument();
    expect(within(dlg).getByText("Registro antigo de desativação")).toBeInTheDocument();
    expect(within(dlg).getByText(/Upsell e downsell ficam salvos/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Desligado: Boleto/)).toBeInTheDocument();
    // pendente: aprovar é o botão principal; desativar e excluir existem; revisão não
    expect(within(dlg).getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Desativar" })).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Colocar em revisão" })).toBeNull();
    expect(within(dlg).queryByRole("button", { name: /Abrir checkout/ })).toBeNull();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_product_detail = () => ({ data: null, error: { message: "produto não encontrado" } });
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/produto não encontrado/)).toBeInTheDocument();
    handlers.get_admin_product_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("•••••••8809")).toBeInTheDocument();
  });

  it("aprovar: pede confirmação com senha, chama a RPC certa e avisa", async () => {
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aprovar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Aprovar?")).toBeInTheDocument();
    expect(within(mod).queryByLabelText("Motivo")).toBeNull();
    fireEvent.click(within(mod).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(calls("admin_set_product_status")).toHaveLength(1));
    expect(calls("admin_set_product_status")[0]).toEqual({ _id: "p1", _status: "active", _reason: null });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Aprovar: Método Lançamento 7D, de Marina Duarte/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Produto aprovado. O checkout já pode vender."));
    await waitFor(() => expect(calls("get_admin_products_page").length).toBeGreaterThan(1));
  });

  it("colocar em revisão exige motivo; chip preenche; sem motivo nada é enviado", async () => {
    handlers.get_admin_product_detail = () => ({ data: detail({ product: { ...detail().product, status: "active" } }), error: null });
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Planilha de Anúncios" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Colocar em revisão" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.click(within(mod).getAllByRole("button", { name: "Colocar em revisão" }).at(-1)!);
    expect(await within(mod).findByText(/Escreva o motivo/)).toBeInTheDocument();
    expect(calls("admin_set_product_status")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(mod).getByRole("button", { name: "Direitos autorais" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Direitos autorais");
    fireEvent.click(within(mod).getAllByRole("button", { name: "Colocar em revisão" }).at(-1)!);
    await waitFor(() => expect(calls("admin_set_product_status")).toHaveLength(1));
    expect(calls("admin_set_product_status")[0]).toEqual({ _id: "p1", _status: "pending_review", _reason: "Direitos autorais" });
  });

  it("excluir manda o motivo para a RPC de exclusão e erro do servidor aparece dentro do diálogo", async () => {
    handlers.admin_delete_product = () => ({ data: null, error: { message: "o produto já está apagado" } });
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Excluir" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Produto duplicado" } });
    fireEvent.click(within(mod).getAllByRole("button", { name: "Excluir" }).at(-1)!);
    await waitFor(() => expect(calls("admin_delete_product")).toEqual([{ _id: "p1", _reason: "Produto duplicado" }]));
    expect(await within(mod).findByRole("alert")).toHaveTextContent("o produto já está apagado");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("apagado só oferece restaurar, e restaurar pede motivo", async () => {
    handlers.get_admin_product_detail = () => ({ data: detail({ product: { ...detail().product, status: "inactive", deleted_at: ago(100), rejection_reason: "Produto duplicado" } }), error: null });
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Último motivo registrado:/)).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Excluir" })).toBeNull();
    expect(within(dlg).queryByRole("button", { name: "Aprovar" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Restaurar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Apagado por engano" } });
    fireEvent.click(within(mod).getAllByRole("button", { name: "Restaurar" }).at(-1)!);
    await waitFor(() => expect(calls("admin_restore_product")).toEqual([{ _id: "p1", _reason: "Apagado por engano" }]));
  });

  it("classificar chama a RPC e não exige senha; erro vira aviso", async () => {
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("radio", { name: "Gray" }));
    await waitFor(() => expect(calls("admin_set_product_classification")).toEqual([{ _id: "p1", _class: "gray", _note: null }]));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Classificado como Gray."));
    handlers.admin_set_product_classification = () => ({ data: null, error: { message: "not authorized" } });
    fireEvent.click(within(dlg).getByRole("radio", { name: "Black" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para esta ação."));
  });

  it("a tela nunca escreve direto em tabela", async () => {
    wrap(<ProductsCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Analisar Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("radio", { name: "Black" }));
    await waitFor(() => expect(calls("admin_set_product_classification")).toHaveLength(1));
    expect(from).not.toHaveBeenCalled();
  });
});

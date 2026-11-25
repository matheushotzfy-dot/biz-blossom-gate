import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const from = vi.fn(() => ({}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => (from as (...x: unknown[]) => unknown)(...a), functions: { invoke: vi.fn() } },
}));

import TopProductsCenter from "@/features/admin-top-products/TopProductsCenter";
import { parseTopProducts, pct, productStateLabel, share, ticket, topProductsCSV, approval, type TopProduct } from "@/features/admin-top-products/topProductsModel";

/* ───────── dados ───────── */

const item = (over: Record<string, unknown> = {}) => ({
  product_id: "p1", name: "Planilha de Anúncios", image_url: null, price: 97, product_status: "active", deleted: false, classification: "white",
  seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com",
  rank: 1, attempts: 120, sales: 84, gross: 8148, net: 7577.64, fees: 570.36, buyers: 80, refunds: 0, refunded: 0, chargebacks: 0, chargeback_amount: 0, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ gross: 10000, sales: 100, net: 9300, fees: 700, selling: 3, without_sales: 0, refunds: 0, refunded: 0, chargebacks: 0, chargeback_amount: 0, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, page: 1, page_size: 25, summary: summary(), from: "2026-11-25", to: "2026-11-25", generated_at: "2026-11-25T12:00:00Z", ...over });

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = () => rpc.mock.calls.filter((c) => c[0] === "get_admin_top_products").map((c) => c[1] as Record<string, unknown>);
const last = () => calls().at(-1)!;
const money = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const range = (a = day(2026, 11, 25), b = day(2026, 11, 25)) => ({ from: a, to: b });

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const screenUi = (r = range()) => <TopProductsCenter dateRange={r} fmtCurrency={money} />;
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  rpc.mockReset(); from.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  handlers.get_admin_top_products = () => ({
    data: pageOf([
      item(),
      item({ product_id: "p2", name: "Curso de Tráfego", rank: 2, seller_name: "Loja do Caio", sales: 10, attempts: 40, gross: 1500, net: 1400, chargebacks: 2, refunds: 1, refunded: 97, classification: "black" }),
      item({ product_id: "p3", name: "Produto antigo", rank: 3, sales: 1, attempts: 1, gross: 47, net: 44, deleted: true, product_status: "inactive" }),
    ], { summary: summary({ chargebacks: 2, chargeback_amount: 188, refunds: 1, refunded: 97, without_sales: 2 }) }),
    error: null,
  });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: null, error: null }));
});

/* ───────── modelo ───────── */

describe("topProductsModel", () => {
  it("lê a resposta do servidor e rejeita formato inesperado", () => {
    const page = parseTopProducts(pageOf([item({ gross: "8148.5", image_url: "" })]));
    expect(page.items[0]).toMatchObject({ name: "Planilha de Anúncios", gross: 8148.5, image_url: null, classification: "white" });
    expect(page.total).toBe(1);
    expect(() => parseTopProducts(null)).toThrow();
    expect(() => parseTopProducts({ items: [] })).toThrow();
  });

  it("classificação desconhecida vira White e seller sem nome usa o e-mail", () => {
    const p = parseTopProducts(pageOf([item({ classification: "azul", seller_name: "", seller_email: "x@y.com" })])).items[0];
    expect(p.classification).toBe("white");
    expect(p.seller_name).toBe("x@y.com");
  });

  it("ticket, aprovação e participação não dividem por zero", () => {
    expect(ticket({ gross: 100, sales: 4 })).toBe(25);
    expect(ticket({ gross: 0, sales: 0 })).toBe(0);
    expect(approval({ sales: 1, attempts: 4 })).toBe(25);
    expect(approval({ sales: 0, attempts: 0 })).toBeNull();
    expect(share(250, 1000)).toBe(25);
    expect(share(1, 0)).toBe(0);
    expect(pct(null)).toBe("—");
    expect(pct(43.25)).toBe("43,3%");
  });

  it("situação só aparece quando o produto não está no ar", () => {
    expect(productStateLabel({ deleted: false, product_status: "active" })).toBeNull();
    expect(productStateLabel({ deleted: true, product_status: "inactive" })).toBe("Apagado");
    expect(productStateLabel({ deleted: false, product_status: "inactive" })).toBe("Inativo");
    expect(productStateLabel({ deleted: false, product_status: "pending_review" })).toBe("Em revisão");
  });

  it("CSV leva a posição, protege células que começam com fórmula e usa ponto e vírgula", () => {
    const rows = parseTopProducts(pageOf([item({ name: "=SOMA(A1)", seller_name: "Ana \"Loja\"" })])).items as TopProduct[];
    const csv = topProductsCSV(rows, "2026-11-25", "2026-11-25", 10000);
    const [header, line] = csv.replace("﻿", "").split("\r\n");
    expect(header.startsWith('"Posição";"Início"')).toBe(true);
    expect(line).toContain("\"'=SOMA(A1)\"");
    expect(line).toContain('"Ana ""Loja"""');
    expect(line).toContain('"8148.00"');
    expect(line).toContain('"81.5"');
  });
});

/* ───────── tela ───────── */

describe("TopProductsCenter", () => {
  it("pede o ranking do período do topo, na primeira página, ordenado por faturamento", async () => {
    wrap(screenUi(range(day(2026, 11, 19), day(2026, 11, 25))));
    await screen.findByText("Ranking completo");
    expect(last()).toMatchObject({ _from: "2026-11-19", _to: "2026-11-25", _search: null, _sort: "gross", _page: 1, _page_size: 25 });
    expect(screen.getByText(/de 19\/11\/2026 a 25\/11\/2026/)).toBeInTheDocument();
  });

  it("mostra totais, pódio e tabela com os números do servidor", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    expect(screen.getByText("R$ 10.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 9.300,00 líquido")).toBeInTheDocument();
    expect(screen.getByText(/2 produtos tiveram tentativas e nenhuma venda/)).toBeInTheDocument();
    const podium = screen.getByRole("list", { name: /três primeiros/i });
    expect(within(podium).getAllByRole("listitem")).toHaveLength(3);
    const rows = tableRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Planilha de Anúncios")).toBeInTheDocument();
    expect(within(rows[0]).getByText("R$ 8.148,00")).toBeInTheDocument();
    expect(within(rows[0]).getByText("70,0%")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2 chargebacks")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Black")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Apagado")).toBeInTheDocument();
  });

  it("trocar a ordenação volta para a página 1 e manda a ordenação ao servidor; contestações esconde o pódio", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Mais vendas" }));
    await waitFor(() => expect(last()._sort).toBe("sales"));
    fireEvent.click(screen.getByRole("button", { name: "Mais contestações" }));
    await waitFor(() => expect(last()._sort).toBe("risk"));
    await waitFor(() => expect(screen.queryByRole("list", { name: /três primeiros/i })).not.toBeInTheDocument());
    expect(last()._page).toBe(1);
  });

  it("busca vai ao servidor depois da pausa, sem pódio, e Limpar filtros volta ao padrão", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Buscar no ranking"), { target: { value: "  planilha " } });
    await waitFor(() => expect(last()._search).toBe("planilha"));
    await waitFor(() => expect(screen.queryByRole("list", { name: /três primeiros/i })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect(screen.getByLabelText("Buscar no ranking")).toHaveValue("");
    // a consulta sem busca já estava guardada: o pódio volta sem nova chamada ao servidor
    expect(await screen.findByRole("list", { name: /três primeiros/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar filtros/ })).not.toBeInTheDocument();
  });

  it("pagina pelo servidor", async () => {
    handlers.get_admin_top_products = (a) => ({ data: pageOf([item({ rank: ((a._page as number) - 1) * 25 + 1 })], { total: 60, page: a._page }), error: null });
    wrap(screenUi());
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(last()._page).toBe(2));
    expect(within(await screen.findByRole("table")).getByText("26º")).toBeInTheDocument();
  });

  it("falha do servidor mostra o erro com nova tentativa e nenhum número inventado", async () => {
    let fail = true;
    handlers.get_admin_top_products = () => (fail ? { data: null, error: new Error("falhou") } : { data: pageOf([item()]), error: null });
    wrap(screenUi());
    expect(await screen.findByText("Não foi possível carregar o ranking.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /CSV desta página/ })).toBeDisabled();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("sem venda no período explica e não mostra pódio nem tabela", async () => {
    handlers.get_admin_top_products = () => ({ data: pageOf([], { summary: summary({ gross: 0, sales: 0, net: 0, fees: 0, selling: 0 }) }), error: null });
    wrap(screenUi());
    expect(await screen.findByText("Nenhuma venda no período", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /três primeiros/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV desta página/ })).toBeDisabled();
  });

  it("busca sem resultado diz isso e oferece limpar", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    handlers.get_admin_top_products = () => ({ data: pageOf([]), error: null });
    fireEvent.change(screen.getByLabelText("Buscar no ranking"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Limpar filtros/ }).length).toBeGreaterThan(0);
  });

  it("trocar o período pede de novo, com as novas datas", async () => {
    const view = wrap(screenUi(range(day(2026, 11, 25), day(2026, 11, 25))));
    await screen.findByRole("table");
    view.rerender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{screenUi(range(day(2026, 10, 26), day(2026, 11, 25)))}</QueryClientProvider>);
    await waitFor(() => expect(last()).toMatchObject({ _from: "2026-10-26", _to: "2026-11-25", _page: 1 }));
  });

  it("Atualizar consulta de novo", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    const before = calls().length;
    fireEvent.click(screen.getByRole("button", { name: /Atualizar/ }));
    await waitFor(() => expect(calls().length).toBeGreaterThan(before));
  });

  it("CSV desta página baixa o que está na tela", async () => {
    const created: Blob[] = [];
    // o jsdom não implementa essas duas funções
    (URL as unknown as Record<string, unknown>).createObjectURL = (b: Blob) => { created.push(b); return "blob:x"; };
    (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
    const urlSpy = vi.spyOn(URL, "createObjectURL");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    wrap(screenUi());
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /CSV desta página/ }));
    expect(created).toHaveLength(1);
    expect(click).toHaveBeenCalledTimes(1);
    const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(created[0]); });
    expect(text).toContain("Planilha de Anúncios");
    expect(text).toContain("Curso de Tráfego");
    urlSpy.mockRestore(); revoke.mockRestore(); click.mockRestore();
  });

  it("só lê por RPC: nunca consulta nem escreve em tabela", async () => {
    wrap(screenUi());
    await screen.findByRole("table");
    expect(from).not.toHaveBeenCalled();
    expect(rpc.mock.calls.every((c) => c[0] === "get_admin_top_products")).toBe(true);
  });
});

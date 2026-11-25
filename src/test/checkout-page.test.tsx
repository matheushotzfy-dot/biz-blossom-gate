import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType } from "react";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  errors: {} as Record<string, { message: string } | null>,
  rpcs: {} as Record<string, (args: Record<string, unknown>) => unknown>,
  calls: [] as Array<[string, Record<string, unknown>]>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain; builder.or = chain; builder.limit = chain; builder.order = chain; builder.maybeSingle = chain; builder.single = chain;
    builder.eq = (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; };
    builder.in = (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; };
    builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: db.errors[table] ? null : (db.tables[table] ?? []).filter((row) => filters.every((f) => f(row))), error: db.errors[table] ?? null });
    return builder;
  };
  const rpc = (name: string, args: Record<string, unknown>) => {
    db.calls.push([name, args]);
    const fn = db.rpcs[name];
    return Promise.resolve(fn ? { data: fn(args), error: null } : { data: null, error: null });
  };
  return { supabase: { from, rpc } };
});

import { CheckoutPage } from "@/features/public-checkout/CheckoutPage";
import type { CardFieldsProps, CheckoutAttempt, CheckoutProcessor } from "@/features/public-checkout/paymentContract";
import { unavailableProcessor } from "@/features/public-checkout/processor";

const PRODUCT: Row = {
  id: "p1", name: "Método Escala 10x", description: "Passo a passo completo.", price: 297, status: "active", image_url: null,
  checkout_url: "https://app.example/pay/esc10x", display_name: "Marina Alves", checkout_button_color: "#10b981", checkout_theme: "gray",
  checkout_pix_enabled: true, checkout_credit_card_enabled: true, checkout_boleto_enabled: true, checkout_timer_enabled: false, checkout_timer_minutes: 15,
  checkout_guarantee_enabled: true, checkout_address_required: false, checkout_email_confirm: false,
};

const PIX_PAYLOAD = { qrCodeText: "00020126580014br.gov.bcb.pix0136abc-123", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };

function fakeProcessor(createPayment?: CheckoutProcessor["createPayment"], extra: Partial<CheckoutProcessor> = {}) {
  const attempts: CheckoutAttempt[] = [];
  const processor: CheckoutProcessor = {
    available: true,
    createPayment: async (attempt) => {
      attempts.push(attempt);
      return createPayment ? createPayment(attempt) : { status: "pending", transactionId: "tx-1", paymentPayload: PIX_PAYLOAD };
    },
    ...extra,
  };
  return { processor, attempts };
}

function renderCheckout(processor: CheckoutProcessor = unavailableProcessor, url = "/pay/esc10x") {
  window.history.pushState({}, "", url);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <CheckoutPage slug="esc10x" processor={processor} />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fillCustomer() {
  type("Nome completo", "Maria Souza Lima");
  type("E-mail", "Maria@Exemplo.com");
  type("CPF ou CNPJ", "52998224725");
  type(/WhatsApp/, "44999991234");
}
const nbsp = new RegExp(String.fromCharCode(160), "g");
const text = (node: HTMLElement) => (node.textContent ?? "").replace(nbsp, " ");
const submitButton = () => screen.getByRole("button", { name: /Pagar com|Gerar boleto|Pagamento indisponível|Processando/ });

beforeEach(() => {
  db.tables = { products_public: [PRODUCT], product_pixels_public: [], order_bumps: [] };
  db.errors = {};
  db.calls = [];
  db.rpcs = { get_checkout_status: () => "pending", register_affiliate_click: () => true, get_product_link_status: () => null };
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.scrollTo = vi.fn();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("checkout público: abertura", () => {
  it("mostra o produto, o resumo e a garantia", async () => {
    renderCheckout();
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
    expect(screen.getByText("Vendido por Marina Alves")).toBeInTheDocument();
    const summary = screen.getByLabelText("Resumo do pedido");
    expect(text(summary)).toContain("R$ 297,00");
    expect(text(summary)).toContain("Garantia de 7 dias");
  });

  it("sem adquirente avisa de frente e o botão fica desligado, mesmo com tudo preenchido", async () => {
    renderCheckout();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText(/indisponíve/i).length).toBeGreaterThan(0);
    fillCustomer();
    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(/indisponíveis agora/);
  });

  it("só oferece as formas de pagamento que o produto liga", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_credit_card_enabled: false, checkout_boleto_enabled: false }];
    renderCheckout();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("radio", { name: /Pix/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Cartão/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Boleto/ })).toBeNull();
  });

  it("produto sem nenhuma forma de pagamento mostra o motivo", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_pix_enabled: false, checkout_credit_card_enabled: false, checkout_boleto_enabled: false }];
    renderCheckout(fakeProcessor().processor);
    expect(await screen.findByText("Nenhuma forma de pagamento ativa")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("link de outro produto com final parecido não abre (o _ do LIKE é curinga)", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_url: "https://app.example/pay/esc_0x" }];
    renderCheckout();
    expect(await screen.findByText("Produto não encontrado")).toBeInTheDocument();
  });

  it.each([
    ["pending_review", "Produto em análise"],
    ["draft", "Produto em rascunho"],
    ["inactive", "Produto indisponível"],
  ])("link fechado (%s) explica o motivo sem mostrar dados do produto", async (status, title) => {
    db.tables.products_public = [];
    db.rpcs.get_product_link_status = () => status;
    renderCheckout();
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Método Escala 10x")).toBeNull();
  });

  it("erro de rede não vira 'produto não encontrado': oferece tentar de novo", async () => {
    db.errors.products_public = { message: "fetch failed" };
    renderCheckout();
    expect(await screen.findByRole("heading", { name: "Não foi possível abrir o checkout" }, { timeout: 4000 })).toBeInTheDocument();
    db.errors.products_public = null;
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
  });

  it("pixel ou oferta que falham não derrubam o checkout", async () => {
    db.errors.order_bumps = { message: "denied" };
    db.errors.product_pixels_public = { message: "denied" };
    renderCheckout();
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
  });
});

describe("checkout público: preenchimento", () => {
  it("só mostra o erro do campo depois que a pessoa sai dele", async () => {
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Informe um e-mail válido")).toBeNull();
    const email = screen.getByLabelText("E-mail");
    fireEvent.change(email, { target: { value: "maria" } });
    expect(screen.queryByText("Informe um e-mail válido")).toBeNull();
    fireEvent.blur(email);
    expect(screen.getByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Informe um e-mail válido");
  });

  it("ao enviar com problema, mostra todos, leva o foco ao primeiro e não chama o processador", async () => {
    const { processor, attempts } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    type("Nome completo", "Maria Souza Lima");
    fireEvent.click(submitButton());
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(screen.getByText("Informe um e-mail válido")).toBeInTheDocument();
    expect(screen.getByText("Informe seu CPF ou CNPJ")).toBeInTheDocument();
    expect(screen.getByText("Há 3 campos para corrigir.")).toBeInTheDocument();
    expect(attempts).toHaveLength(0);
  });

  it("formata CPF e telefone enquanto digita", async () => {
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    type("CPF ou CNPJ", "52998224725");
    type(/WhatsApp/, "44999991234");
    expect(screen.getByLabelText("CPF ou CNPJ")).toHaveValue("529.982.247-25");
    expect(screen.getByLabelText(/WhatsApp/)).toHaveValue("(44) 99999-1234");
  });

  it("pede a confirmação do e-mail quando o vendedor liga", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_email_confirm: true }];
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    type("Confirme o e-mail", "outro@exemplo.com");
    fireEvent.click(submitButton());
    expect(screen.getByText("Os e-mails não coincidem")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirme o e-mail")).toHaveFocus();
  });
});

describe("checkout público: endereço", () => {
  it("busca o CEP, preenche o endereço e leva o foco ao número", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_address_required: true }];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: "Av. Brasil", bairro: "Zona 1", localidade: "Maringá", uf: "PR" }) })));
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { name: "Endereço" });
    const cep = screen.getByLabelText("CEP");
    cep.focus();
    fireEvent.change(cep, { target: { value: "87013000" } });
    await waitFor(() => expect(screen.getByLabelText("Rua ou avenida")).toHaveValue("Av. Brasil"));
    expect(screen.getByLabelText("Bairro")).toHaveValue("Zona 1");
    expect(screen.getByLabelText("Cidade")).toHaveValue("Maringá");
    expect(screen.getByLabelText("UF")).toHaveValue("PR");
    expect(screen.getByLabelText("Número")).toHaveFocus();
    expect(screen.getByText(/Endereço encontrado/)).toBeInTheDocument();
  });

  it("CEP que ninguém conhece deixa preencher na mão", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_address_required: true }];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("viacep") ? { ok: true, json: async () => ({ erro: true }) } : { ok: false, status: 404, json: async () => ({}) })));
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { name: "Endereço" });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "00000000" } });
    expect(await screen.findByText(/Não achamos esse CEP/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Rua ou avenida"), { target: { value: "Rua Manual" } });
    expect(screen.getByLabelText("Rua ou avenida")).toHaveValue("Rua Manual");
  });

  it("rede fora do ar na busca do CEP não trava o formulário", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_address_required: true }];
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { name: "Endereço" });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "87013000" } });
    expect(await screen.findByText(/Não deu para buscar o CEP/)).toBeInTheDocument();
  });

  it("envia o endereço só com números no CEP e só quando o vendedor pede", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_address_required: true }];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ logradouro: "Av. Brasil", bairro: "Zona 1", localidade: "Maringá", uf: "PR" }) })));
    const { processor, attempts } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { name: "Endereço" });
    fillCustomer();
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "87013-000" } });
    await waitFor(() => expect(screen.getByLabelText("Cidade")).toHaveValue("Maringá"));
    type("Número", "1200");
    fireEvent.click(submitButton());
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(attempts[0].address).toEqual({ cep: "87013000", street: "Av. Brasil", number: "1200", complement: "", neighborhood: "Zona 1", city: "Maringá", state: "PR" });
  });
});

describe("checkout público: ofertas, cupom e parcelas", () => {
  beforeEach(() => {
    db.tables.products_public = [PRODUCT, { id: "p3", name: "E-book Criativos", description: "Modelos testados.", price: 47.9, status: "active", image_url: null }];
    db.tables.order_bumps = [{ id: "b1", product_id: "p1", bump_product_id: "p3", is_active: true }];
    db.rpcs.validate_coupon = (args) => (String(args._code).toUpperCase() === "BLACK20"
      ? [{ valid: true, coupon_id: "c1", discount_amount: 59.4, discount_type: "percentage", discount_value: 20, apply_to_bumps: false, error: null }]
      : [{ valid: false, error: "Cupom inválido" }]);
  });

  it("a oferta soma no pedido e sai quando desmarcada", async () => {
    renderCheckout(fakeProcessor().processor);
    const bump = await screen.findByRole("checkbox", { name: /E-book Criativos/ });
    const summary = screen.getByLabelText("Resumo do pedido");
    expect(text(within(summary).getByText("Total").parentElement as HTMLElement)).toContain("R$ 297,00");
    fireEvent.click(bump);
    expect(bump).toBeChecked();
    expect(text(within(summary).getByText("Total").parentElement as HTMLElement)).toContain("R$ 344,90");
    expect(text(summary)).toContain("E-book Criativos");
    fireEvent.click(bump);
    expect(text(within(summary).getByText("Total").parentElement as HTMLElement)).toContain("R$ 297,00");
  });

  it("cupom válido abate do total, cupom inválido mostra o motivo, e dá para remover", async () => {
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Tenho um cupom" }));
    const field = screen.getByLabelText("Cupom de desconto");
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "errado" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cupom inválido");
    fireEvent.change(field, { target: { value: "black20" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const summary = screen.getByLabelText("Resumo do pedido");
    await waitFor(() => expect(text(summary)).toContain("R$ 237,60"));
    expect(text(summary)).toContain("− R$ 59,40");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(text(summary)).toContain("R$ 297,00");
    expect(text(summary)).not.toContain("− R$");
    expect(db.calls.filter(([name]) => name === "validate_coupon").every(([, args]) => args._product_id === "p1" && args._amount === 297)).toBe(true);
  });

  it("?cupom= aplica sozinho, mas sempre passa pelo servidor", async () => {
    renderCheckout(fakeProcessor().processor, "/pay/esc10x?cupom=black20");
    const summary = await screen.findByLabelText("Resumo do pedido");
    await waitFor(() => expect(text(summary)).toContain("R$ 237,60"));
    expect(db.calls.some(([name, args]) => name === "validate_coupon" && args._code === "BLACK20")).toBe(true);
  });

  it("?cupom= inválido não quebra nada e o preço fica cheio", async () => {
    renderCheckout(fakeProcessor().processor, "/pay/esc10x?cupom=zzz");
    const summary = await screen.findByLabelText("Resumo do pedido");
    await waitFor(() => expect(db.calls.some(([name]) => name === "validate_coupon")).toBe(true));
    expect(text(summary)).toContain("R$ 297,00");
  });

  it("parcelar no cartão mostra o acréscimo e o total que a pessoa vai pagar", async () => {
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Cartão/ }));
    const select = screen.getByLabelText("Parcelas") as HTMLSelectElement;
    expect(select.options).toHaveLength(12);
    fireEvent.change(select, { target: { value: "12" } });
    const summary = screen.getByLabelText("Resumo do pedido");
    // 297 × (1 + 0,0199 × 11) / 12 = 30,17 por parcela; 12 × 30,17 = 362,04
    expect(text(summary)).toContain("12x de R$ 30,17");
    expect(text(summary)).toContain("R$ 362,04");
    expect(screen.getByText(/Parcelar tem acréscimo/)).toHaveTextContent("R$ 297,00 para R$ 362,04");
  });
});

describe("checkout público: pagamento", () => {
  it("envia ao servidor só o que o servidor precisa, com afiliado, cupom, ofertas e origem da página", async () => {
    db.tables.products_public = [PRODUCT, { id: "p3", name: "E-book Criativos", price: 47.9, status: "active", image_url: null }];
    db.tables.order_bumps = [{ id: "b1", product_id: "p1", bump_product_id: "p3", is_active: true }];
    db.rpcs.validate_coupon = () => [{ valid: true, coupon_id: "c1", discount_amount: 59.4, discount_type: "percentage", discount_value: 20, apply_to_bumps: false }];
    const { processor, attempts } = fakeProcessor();
    renderCheckout(processor, "/pay/esc10x?aff=aff-1a2b3c4d5e&utm_source=meta&cupom=BLACK20");
    fireEvent.click(await screen.findByRole("checkbox", { name: /E-book Criativos/ }));
    fillCustomer();
    await waitFor(() => expect(screen.getByLabelText("Resumo do pedido")).toHaveTextContent("Cupom BLACK20"));
    fireEvent.click(submitButton());
    await waitFor(() => expect(attempts).toHaveLength(1));
    const attempt = attempts[0];
    expect(attempt).toMatchObject({
      productId: "p1", method: "pix", selectedBumpIds: ["b1"], couponCode: "BLACK20", affiliateSlug: "aff-1a2b3c4d5e",
      customer: { name: "Maria Souza Lima", email: "maria@exemplo.com", document: "52998224725", phone: "44999991234" },
    });
    expect(attempt.checkoutSessionId).toContain("utm_source=meta");
    expect(attempt.installments).toBeUndefined();
    expect(attempt.address).toBeUndefined();
    expect(Object.keys(attempt)).not.toContain("price");
    expect(Object.keys(attempt)).not.toContain("amount");
  });

  it("Pix: mostra QR Code e código, copia, e vira 'confirmado' quando o servidor aprova", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { processor } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
    expect(screen.getByLabelText("Código Pix copia e cola")).toHaveValue(PIX_PAYLOAD.qrCodeText);
    expect(screen.getByRole("status")).toHaveTextContent("Aguardando o pagamento");
    expect(window.scrollTo).toHaveBeenCalled();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copiar código Pix/ })); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(PIX_PAYLOAD.qrCodeText);
    expect(await screen.findByRole("button", { name: /Código copiado/ })).toBeInTheDocument();

    db.rpcs.get_checkout_status = () => "completed";
    await act(async () => { await vi.advanceTimersByTimeAsync(3200); });
    expect(await screen.findByRole("heading", { name: "Pagamento confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalhes da compra" })).toHaveAttribute("href", "/obrigado?tx=tx-1");
    expect(screen.getByText("maria@exemplo.com")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vp-ck-pending:p1")).toBeNull();
  });

  it("recarregar a página com o Pix aberto volta para o Pix (e confere o status na hora)", async () => {
    window.sessionStorage.setItem("vp-ck-pending:p1", JSON.stringify({ transactionId: "tx-9", method: "pix", payload: PIX_PAYLOAD, total: 297, email: "maria@exemplo.com", savedAt: Date.now() }));
    db.rpcs.get_checkout_status = () => "completed";
    renderCheckout(fakeProcessor().processor);
    expect(await screen.findByRole("heading", { name: "Pagamento confirmado" }, { timeout: 3000 })).toBeInTheDocument();
    expect(db.calls.some(([name, args]) => name === "get_checkout_status" && args._transaction_id === "tx-9")).toBe(true);
  });

  it("cobrança antiga demais não volta (3 h)", async () => {
    window.sessionStorage.setItem("vp-ck-pending:p1", JSON.stringify({ transactionId: "tx-9", method: "pix", payload: PIX_PAYLOAD, total: 297, email: "a@b.com", savedAt: Date.now() - 4 * 3600_000 }));
    renderCheckout(fakeProcessor().processor);
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pague com Pix" })).toBeNull();
  });

  it("status desconhecido nunca aprova", async () => {
    window.sessionStorage.setItem("vp-ck-pending:p1", JSON.stringify({ transactionId: "tx-9", method: "pix", payload: PIX_PAYLOAD, total: 297, email: "a@b.com", savedAt: Date.now() }));
    db.rpcs.get_checkout_status = () => "algo-novo";
    renderCheckout(fakeProcessor().processor);
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
    await waitFor(() => expect(db.calls.some(([name]) => name === "get_checkout_status")).toBe(true));
    expect(screen.queryByRole("heading", { name: "Pagamento confirmado" })).toBeNull();
  });

  it("boleto: só abre link https e mostra o código de barras", async () => {
    const { processor } = fakeProcessor(async () => ({ status: "pending", transactionId: "tx-b", paymentPayload: { url: "https://banco.com/b.pdf", barCode: "34191.79001 01043" } }));
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Boleto/ }));
    fillCustomer();
    fireEvent.click(submitButton());
    const link = await screen.findByRole("link", { name: /Abrir boleto/ });
    expect(link).toHaveAttribute("href", "https://banco.com/b.pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByLabelText("Código de barras do boleto")).toHaveValue("34191.79001 01043");
  });

  it("boleto com link perigoso não vira link", async () => {
    const { processor } = fakeProcessor(async () => ({ status: "pending", transactionId: "tx-b", paymentPayload: { url: "javascript:alert(1)", barCode: "3419" } }));
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Boleto/ }));
    fillCustomer();
    fireEvent.click(submitButton());
    await screen.findByRole("heading", { name: "Seu boleto foi gerado" });
    expect(screen.queryByRole("link", { name: /Abrir boleto/ })).toBeNull();
  });

  it("aprovação imediata vai direto para a confirmação", async () => {
    const { processor } = fakeProcessor(async () => ({ status: "approved", transactionId: "tx-a" }));
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Pagamento confirmado" })).toBeInTheDocument();
  });

  it("não aprovado e expirado têm tela própria e voltam ao formulário", async () => {
    const { processor } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    db.rpcs.get_checkout_status = () => "failed";
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(submitButton());
    await screen.findByRole("heading", { name: "Pague com Pix" });
    await act(async () => { await vi.advanceTimersByTimeAsync(3200); });
    expect(await screen.findByRole("heading", { name: "Pagamento não aprovado" })).toBeInTheDocument();
    expect(screen.getByText(/nada foi cobrado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao checkout" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
  });

  it("cancelar o Pix volta ao formulário e apaga a cobrança guardada", async () => {
    const { processor } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    await screen.findByRole("heading", { name: "Pague com Pix" });
    expect(window.sessionStorage.getItem("vp-ck-pending:p1")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar e escolher outra forma/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Método Escala 10x" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vp-ck-pending:p1")).toBeNull();
  });

  it("falha do processador não cobra, avisa e deixa tentar de novo", async () => {
    let calls = 0;
    const { processor } = fakeProcessor(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return { status: "pending", transactionId: "tx-2", paymentPayload: PIX_PAYLOAD };
    });
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Nada foi cobrado");
    expect(submitButton()).not.toBeDisabled();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
  });

  it("processador que responde 'indisponível' avisa e mantém o formulário", async () => {
    const { processor } = fakeProcessor(async () => ({ status: "unavailable", reason: "acquirer_not_configured" }));
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("indisponíveis agora");
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Maria Souza Lima");
  });

  it("clique duplo não abre duas cobranças", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { processor, attempts } = fakeProcessor(async () => { await gate; return { status: "pending", transactionId: "tx-1", paymentPayload: PIX_PAYLOAD }; });
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    fireEvent.click(submitButton());
    await waitFor(() => expect(screen.getByRole("button", { name: /Processando/ })).toBeDisabled());
    fireEvent.submit(screen.getByRole("form", { name: "Finalizar compra" }));
    release();
    await screen.findByRole("heading", { name: "Pague com Pix" });
    expect(attempts).toHaveLength(1);
  });
});

describe("checkout público: cartão", () => {
  const CardFields: ComponentType<CardFieldsProps> = ({ onToken }) => (
    <button type="button" onClick={() => onToken("tok_abc")}>Preencher cartão de teste</button>
  );

  it("sem formulário do adquirente o cartão não cobra e diz por quê", async () => {
    renderCheckout(fakeProcessor().processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Cartão/ }));
    expect(screen.getByText("Cartão indisponível")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("com o formulário do adquirente, só paga depois do token e envia parcelas e token (nunca o número)", async () => {
    const { processor, attempts } = fakeProcessor(async () => ({ status: "approved", transactionId: "tx-c" }), { CardFields });
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Cartão/ }));
    fillCustomer();
    expect(submitButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Parcelas"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Preencher cartão de teste" }));
    expect(submitButton()).not.toBeDisabled();
    fireEvent.click(submitButton());
    expect(await screen.findByRole("heading", { name: "Pagamento confirmado" })).toBeInTheDocument();
    expect(attempts[0]).toMatchObject({ method: "credit_card", installments: 3, cardToken: "tok_abc" });
    expect(JSON.stringify(attempts[0])).not.toMatch(/cvv|cardNumber|pan/i);
    expect(screen.getByText(/R\$/, { selector: ".ck-num" })).toBeTruthy();
  });

  it("trocar de cartão para Pix descarta o token", async () => {
    const { processor, attempts } = fakeProcessor(undefined, { CardFields });
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: /Cartão/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preencher cartão de teste" }));
    fireEvent.click(screen.getByRole("radio", { name: /Pix/ }));
    fillCustomer();
    fireEvent.click(submitButton());
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(attempts[0].cardToken).toBeUndefined();
    expect(attempts[0].installments).toBeUndefined();
  });
});

describe("checkout público: tema e afiliado", () => {
  it("usa o tema e a cor do vendedor, e ignora cor inválida", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_theme: "dark", checkout_button_color: "#ff5a1f" }];
    const view = renderCheckout();
    await screen.findByRole("heading", { level: 1 });
    const root = view.container.querySelector(".ck") as HTMLElement;
    expect(root.dataset.ckTheme).toBe("dark");
    expect(root.style.getPropertyValue("--ck-accent")).toBe("#ff5a1f");
    cleanup();
    db.tables.products_public = [{ ...PRODUCT, checkout_button_color: "url(javascript:1)" }];
    const second = renderCheckout();
    await screen.findByRole("heading", { level: 1 });
    expect((second.container.querySelector(".ck") as HTMLElement).style.getPropertyValue("--ck-accent")).toBe("#10b981");
  });

  it("conta o clique do afiliado uma vez por visita e lembra o link nas visitas seguintes", async () => {
    renderCheckout(unavailableProcessor, "/pay/esc10x?aff=aff-1a2b3c4d5e");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(db.calls.filter(([name]) => name === "register_affiliate_click")).toHaveLength(1));
    expect(db.calls.find(([name]) => name === "register_affiliate_click")?.[1]).toEqual({ _product_id: "p1", _slug: "aff-1a2b3c4d5e" });
    cleanup();
    renderCheckout(unavailableProcessor, "/pay/esc10x?aff=aff-1a2b3c4d5e");
    await screen.findByRole("heading", { level: 1 });
    expect(db.calls.filter(([name]) => name === "register_affiliate_click")).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem("vp-aff:p1") ?? "{}").slug).toBe("aff-1a2b3c4d5e");
  });

  it("sem ?aff= usa o afiliado lembrado, e slug inválido na URL não conta nem grava", async () => {
    window.localStorage.setItem("vp-aff:p1", JSON.stringify({ slug: "aff-lembrado01", savedAt: Date.now() }));
    const { processor, attempts } = fakeProcessor();
    renderCheckout(processor);
    await screen.findByRole("heading", { level: 1 });
    fillCustomer();
    await waitFor(() => expect(submitButton()).not.toBeDisabled());
    fireEvent.click(submitButton());
    await waitFor(() => expect(attempts).toHaveLength(1));
    expect(attempts[0].affiliateSlug).toBe("aff-lembrado01");
    cleanup();
    window.localStorage.clear();
    db.calls = [];
    renderCheckout(unavailableProcessor, "/pay/esc10x?aff=a%20b;x");
    await screen.findByRole("heading", { level: 1 });
    expect(db.calls.some(([name]) => name === "register_affiliate_click")).toBe(false);
  });

  it("a oferta por tempo mostra o relógio e não reinicia ao recarregar", async () => {
    db.tables.products_public = [{ ...PRODUCT, checkout_timer_enabled: true, checkout_timer_minutes: 10 }];
    renderCheckout();
    const clock = await screen.findByRole("timer");
    expect(clock).toHaveTextContent(/^(09:5\d|10:00)$/);
    const saved = Number(window.sessionStorage.getItem("vp-ck-timer:p1:10"));
    expect(saved).toBeGreaterThan(Date.now());
    cleanup();
    window.sessionStorage.setItem("vp-ck-timer:p1:10", String(Date.now() + 2 * 60_000));
    renderCheckout();
    expect(await screen.findByRole("timer")).toHaveTextContent(/^0[12]:\d\d$/);
  });
});

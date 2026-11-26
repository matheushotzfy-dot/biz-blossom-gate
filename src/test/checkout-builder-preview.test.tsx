import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

const calls = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => { calls.push([name, args]); return Promise.resolve({ data: null, error: null }); },
    from: () => { throw new Error("a prévia não lê tabelas"); },
  },
}));

import { CheckoutLivePreview } from "@/components/products/CheckoutLivePreview";
import { MAX_ORDER_BUMPS, orderBumpError, withVersion } from "@/components/products/orderBumps";
import { checkoutMethods } from "@/components/products/productPresentation";
import { CheckoutExperience } from "@/features/public-checkout/CheckoutPage";
import { CheckoutPreviewFrame } from "@/features/public-checkout/PreviewFrame";
import { methodsText } from "@/features/public-checkout/PaymentLinkPage";
import { checkoutCustomerSchema } from "@/features/public-checkout/checkoutSchema";
import { PREVIEW_PATH, PREVIEW_READY, PREVIEW_UPDATE, isTrustedPreviewMessage, readPreviewUpdate, type PreviewUpdate } from "@/features/public-checkout/previewProtocol";
import { unavailableProcessor } from "@/features/public-checkout/processor";
import type { CheckoutProduct } from "@/features/public-checkout/types";

const ROW: PreviewUpdate["product"] = {
  id: "p1", name: "Método Escala 10x", description: "Passo a passo.", price: 297, image_url: null, display_name: "Lucker",
  checkout_button_color: "#f97316", checkout_theme: "dark", checkout_timer_enabled: true, checkout_timer_minutes: 20,
  checkout_banner_desktop_url: null, checkout_banner_mobile_url: null, checkout_guarantee_enabled: true,
  checkout_address_required: false, checkout_email_confirm: true,
  checkout_pix_enabled: true, checkout_credit_card_enabled: true, checkout_boleto_enabled: false,
};
const update = (over: Partial<PreviewUpdate> = {}): PreviewUpdate => ({ type: PREVIEW_UPDATE, product: ROW, bumps: [], ...over });

beforeEach(() => { calls.length = 0; });
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("conversa construtor → prévia", () => {
  it("passa o produto pelas mesmas regras do checkout público", () => {
    const data = readPreviewUpdate(update({ product: { ...ROW, checkout_timer_minutes: 999, checkout_button_color: "vermelho", checkout_theme: "azul" } }));
    expect(data?.product).toMatchObject({ id: "p1", name: "Método Escala 10x", sellerName: "Lucker", timerMinutes: 15, buttonColor: "vermelho", theme: "gray", methods: ["pix", "credit_card"], emailConfirm: true });
  });

  it("ofertas: só com preço, nunca o próprio produto e no máximo 5", () => {
    const bump = (n: number, price = 10) => ({ bumpId: `b${n}`, id: `x${n}`, name: `Oferta ${n}`, description: null, price, image_url: null });
    const data = readPreviewUpdate(update({ bumps: [bump(1), { ...bump(2), id: "p1" }, bump(3, 0), bump(4), bump(5), bump(6), bump(7)] }));
    expect(data?.bumps.map((b) => b.id)).toEqual(["b1", "b4", "b5"]);
    expect(data?.bumps[0]).toMatchObject({ productId: "x1", name: "Oferta 1", price: 10 });
  });

  it("ignora o que não é uma atualização da prévia", () => {
    expect(readPreviewUpdate(null)).toBeNull();
    expect(readPreviewUpdate({ type: "outra", product: ROW })).toBeNull();
    expect(readPreviewUpdate({ type: PREVIEW_UPDATE, product: { name: "sem id" } })).toBeNull();
  });

  it("só confia na página que abriu a prévia, na mesma origem", () => {
    const parent = {};
    expect(isTrustedPreviewMessage({ origin: "https://hotzfy.com.br", source: parent as Window }, { origin: "https://hotzfy.com.br", parent })).toBe(true);
    expect(isTrustedPreviewMessage({ origin: "https://evil.com", source: parent as Window }, { origin: "https://hotzfy.com.br", parent })).toBe(false);
    expect(isTrustedPreviewMessage({ origin: "https://hotzfy.com.br", source: {} as Window }, { origin: "https://hotzfy.com.br", parent })).toBe(false);
  });
});

describe("prévia ao vivo no construtor", () => {
  it("abre a página de prévia e manda o estado quando ela avisa que está pronta", () => {
    render(<CheckoutLivePreview device="mobile" payload={update()} host="hotzfy.com.br/pay/esc10x" />);
    const frame = screen.getByTitle("Prévia do checkout no celular") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe(PREVIEW_PATH);
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    act(() => { window.dispatchEvent(new MessageEvent("message", { data: { type: PREVIEW_READY }, origin: window.location.origin, source: frame.contentWindow })); });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: PREVIEW_UPDATE, product: expect.objectContaining({ id: "p1" }) }), window.location.origin);

    post.mockClear();
    act(() => { window.dispatchEvent(new MessageEvent("message", { data: { type: PREVIEW_READY }, origin: "https://evil.com", source: frame.contentWindow })); });
    expect(post).not.toHaveBeenCalled();
  });

  it("computador mostra a barra com o endereço do checkout", () => {
    render(<CheckoutLivePreview device="desktop" payload={update()} host="hotzfy.com.br/pay/esc10x" />);
    expect(screen.getByTitle("Prévia do checkout no computador")).toBeInTheDocument();
    expect(screen.getByText("hotzfy.com.br/pay/esc10x")).toBeInTheDocument();
  });

  it("aberta fora do construtor, a página só explica para que serve", () => {
    render(<HelmetProvider><MemoryRouter><CheckoutPreviewFrame /></MemoryRouter></HelmetProvider>);
    expect(screen.getByRole("heading", { name: "Prévia do checkout" })).toBeInTheDocument();
    expect(screen.getByText(/só funciona dentro do construtor/)).toBeInTheDocument();
  });
});

describe("checkout em modo prévia", () => {
  const product = (over: Partial<CheckoutProduct> = {}): CheckoutProduct => ({
    id: "p1", name: "Método Escala 10x", description: null, price: 297, imageUrl: null, sellerName: "Lucker", buttonColor: "#10b981",
    theme: "gray", timerEnabled: false, timerMinutes: 15, bannerDesktopUrl: null, bannerMobileUrl: null, guaranteeEnabled: true,
    addressRequired: false, emailConfirm: false, methods: ["pix", "credit_card"], ...over,
  });
  const show = (p: CheckoutProduct) => (
    <HelmetProvider><MemoryRouter><CheckoutExperience slug="preview" product={p} bumps={[]} pixels={[]} processor={unavailableProcessor} preview /></MemoryRouter></HelmetProvider>
  );

  it("não conta clique de afiliado nem aplica cupom do link", async () => {
    window.history.replaceState(null, "", "/checkout-preview?aff=parceiro1&cupom=BLACK20");
    render(show(product()));
    expect(await screen.findByText("Pagamentos indisponíveis agora")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(calls.map(([name]) => name)).toEqual([]);
  });

  it("se o vendedor desliga a forma escolhida, a prévia passa para a que sobrou", () => {
    const { rerender } = render(show(product()));
    expect(screen.getByRole("radio", { name: /Pix/ })).toBeChecked();
    rerender(show(product({ methods: ["credit_card"] })));
    expect(screen.getByRole("radio", { name: /Cartão de crédito/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Pix/ })).toBeNull();
  });
});

describe("regras do checkout no painel", () => {
  it("formas que o comprador vê = produto E conta", () => {
    const p = { checkout_pix_enabled: true, checkout_credit_card_enabled: true, checkout_boleto_enabled: true };
    expect(checkoutMethods(p, { pix: true, card: false, boleto: true })).toEqual(["Pix", "Boleto"]);
    expect(checkoutMethods(p, null)).toEqual(["Pix", "Cartão", "Boleto"]);
    expect(checkoutMethods({ ...p, checkout_pix_enabled: false }, { pix: true, card: false, boleto: false })).toEqual([]);
  });

  it("recusas do banco ao adicionar order bump viram frase", () => {
    expect(orderBumpError({ message: "order_bump_limit" })).toMatch(new RegExp(`até ${MAX_ORDER_BUMPS}`));
    expect(orderBumpError({ message: "order_bump_not_owner" })).toMatch(/sua conta/);
    expect(orderBumpError({ message: "order_bump_self" })).toMatch(/dele mesmo/);
    expect(orderBumpError({ code: "23505", message: "duplicate key value" })).toMatch(/já está/);
    expect(orderBumpError(null)).toMatch(/Tente de novo/);
  });

  it("banner regravado no mesmo caminho ganha versão nova", () => {
    expect(withVersion("https://x.supabase.co/storage/v1/object/public/checkout-banners/u/p-desktop.jpg", 123)).toBe("https://x.supabase.co/storage/v1/object/public/checkout-banners/u/p-desktop.jpg?v=123");
    expect(withVersion("https://x/a.jpg?v=1", 2)).toBe("https://x/a.jpg?v=2");
  });

  it("estado só com sigla real", () => {
    const base = { name: "Ana Souza", email: "ana@x.com", document: "529.982.247-25", phone: "(44) 99999-0000", addressRequired: true, cep: "87013-000", street: "Av. Brasil", number: "10", neighborhood: "Centro", city: "Maringá" };
    expect(checkoutCustomerSchema.safeParse({ ...base, state: "PR" }).success).toBe(true);
    const bad = checkoutCustomerSchema.safeParse({ ...base, state: "XX" });
    expect(bad.success).toBe(false);
    expect(bad.success ? "" : bad.error.issues.map((i) => i.message)).toContain("Use a sigla do estado (ex.: SP)");
  });

  it("link de pagamento diz as formas sem inventar Pix", () => {
    expect(methodsText({ acceptPix: true, acceptCard: true })).toBe("Aceita Pix ou cartão de crédito");
    expect(methodsText({ acceptPix: false, acceptCard: true })).toBe("Aceita cartão de crédito");
    expect(methodsText({ acceptPix: false, acceptCard: false })).toBe("Nenhuma forma de pagamento liberada");
  });
});

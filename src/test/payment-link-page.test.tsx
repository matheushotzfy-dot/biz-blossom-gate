import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

const rpc = vi.hoisted(() => ({ handlers: {} as Record<string, (args: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null }>, calls: [] as Array<[string, Record<string, unknown>]> }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpc.calls.push([name, args]);
      const result = rpc.handlers[name]?.(args) ?? { data: null, error: null };
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  },
}));

import { PaymentLinkPage } from "@/features/public-checkout/PaymentLinkPage";
import { classifyPaymentLink, normalizePaymentLink } from "@/features/public-checkout/loadPaymentLink";

const ROW = {
  id: "l1", slug: "consultoria-premium", title: "Consultoria premium", description: "Sessão de 90 minutos.", cover_url: null, amount: 450,
  is_active: true, accept_pix: true, accept_card: true, max_uses: null, current_uses: 2, expires_at: null,
};
const nbsp = new RegExp(String.fromCharCode(160), "g");

function renderLink(slug: string | undefined = "consultoria-premium") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<HelmetProvider><QueryClientProvider client={client}><PaymentLinkPage slug={slug} /></QueryClientProvider></HelmetProvider>);
}

beforeEach(() => {
  rpc.calls = [];
  rpc.handlers = { get_public_payment_link: () => ({ data: [ROW] }), increment_payment_link_clicks: () => ({ data: null }) };
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("link de pagamento: modelo", () => {
  it("normaliza o que vem do servidor", () => {
    const link = normalizePaymentLink({ ...ROW, amount: "450.5", description: "  ", max_uses: 0, expires_at: "2030-01-01T00:00:00Z", accept_card: null });
    expect(link).toMatchObject({ amount: 450.5, description: null, maxUses: null, acceptCard: false, acceptPix: true });
    expect(link.expiresAt).toBe(Date.parse("2030-01-01T00:00:00Z"));
    expect(normalizePaymentLink({ ...ROW, amount: "abc", title: "" })).toMatchObject({ amount: 0, title: "Cobrança" });
  });

  it("vencido e esgotado são só informativos (o servidor é quem barra)", () => {
    const base = normalizePaymentLink(ROW);
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(classifyPaymentLink({ ...base, expiresAt: now - 1 }, now).kind).toBe("expired");
    expect(classifyPaymentLink({ ...base, expiresAt: now + 1000 }, now).kind).toBe("ready");
    expect(classifyPaymentLink({ ...base, maxUses: 5, currentUses: 5 }, now).kind).toBe("exhausted");
    expect(classifyPaymentLink({ ...base, maxUses: 5, currentUses: 4 }, now).kind).toBe("ready");
  });
});

describe("link de pagamento: página", () => {
  it("mostra título, descrição, valor e avisa que o pagamento está indisponível", async () => {
    renderLink();
    expect(await screen.findByRole("heading", { level: 1, name: "Consultoria premium" })).toBeInTheDocument();
    expect(screen.getByText("Sessão de 90 minutos.")).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => (node?.textContent ?? "").replace(nbsp, " ") === "R$ 450,00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Aceita Pix ou cartão de crédito/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Pagamentos indisponíveis agora");
    expect(screen.getByRole("button", { name: "Pagamento indisponível" })).toBeDisabled();
    expect(screen.queryByLabelText(/CPF/)).toBeNull();
  });

  it("conta o clique uma vez por visita", async () => {
    renderLink();
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(rpc.calls.filter(([name]) => name === "increment_payment_link_clicks")).toHaveLength(1));
    cleanup();
    renderLink();
    await screen.findByRole("heading", { level: 1 });
    expect(rpc.calls.filter(([name]) => name === "increment_payment_link_clicks")).toHaveLength(1);
  });

  it("link inexistente ou desativado não conta clique", async () => {
    rpc.handlers.get_public_payment_link = () => ({ data: [] });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Link não encontrado" })).toBeInTheDocument();
    expect(rpc.calls.some(([name]) => name === "increment_payment_link_clicks")).toBe(false);
    cleanup();
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, is_active: false }] });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Link não encontrado" })).toBeInTheDocument();
  });

  it("slug fora do formato nem chega ao servidor", async () => {
    renderLink("a;b");
    expect(await screen.findByRole("heading", { name: "Link não encontrado" })).toBeInTheDocument();
    expect(rpc.calls.some(([name]) => name === "get_public_payment_link")).toBe(false);
  });

  it("vencido e esgotado têm mensagem própria", async () => {
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, expires_at: "2020-01-01T00:00:00Z" }] });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Este link venceu" })).toBeInTheDocument();
    cleanup();
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, max_uses: 3, current_uses: 3 }] });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Este link esgotou" })).toBeInTheDocument();
  });

  it("link bloqueado pela plataforma não mostra título nem valor e não conta clique", async () => {
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, admin_status: "blocked" }] });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Este link está indisponível" })).toBeInTheDocument();
    expect(screen.queryByText("Consultoria premium")).toBeNull();
    expect(rpc.calls.some(([name]) => name === "increment_payment_link_clicks")).toBe(false);
    cleanup();
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, admin_status: "review" }] });
    renderLink();
    expect(await screen.findByRole("heading", { level: 1, name: "Consultoria premium" })).toBeInTheDocument();
  });

  it("erro do servidor não vira 'não encontrado': oferece tentar de novo", async () => {
    rpc.handlers.get_public_payment_link = () => ({ error: { message: "boom" } });
    renderLink();
    expect(await screen.findByRole("heading", { name: "Não foi possível abrir o link" }, { timeout: 4000 })).toBeInTheDocument();
    rpc.handlers.get_public_payment_link = () => ({ data: [ROW] });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Consultoria premium" })).toBeInTheDocument();
  });

  it("mostra quantas vagas restam quando o link tem limite", async () => {
    rpc.handlers.get_public_payment_link = () => ({ data: [{ ...ROW, max_uses: 10, current_uses: 9, accept_card: false }] });
    renderLink();
    expect(await screen.findByText(/Aceita Pix · 1 vaga/)).toBeInTheDocument();
  });
});

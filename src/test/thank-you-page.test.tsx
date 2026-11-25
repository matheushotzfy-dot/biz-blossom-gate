import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

const db = vi.hoisted(() => ({ summary: vi.fn(), product: { name: "Método Escala 10x" } as { name: string } | null, calls: [] as string[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => { db.calls.push(`${name}:${String(args._tx_id)}`); return Promise.resolve(db.summary()); },
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder; builder.eq = () => builder;
      builder.maybeSingle = () => Promise.resolve({ data: db.product, error: null });
      return builder;
    },
  },
}));

import { ThankYouPage } from "@/features/public-checkout/ThankYouPage";
import { parseTransactionId, purchaseOutcome } from "@/features/public-checkout/loadThankYou";

const TX = "11111111-2222-4333-8444-555555555555";
const row = (status: string, extra: Record<string, unknown> = {}) => ({ data: [{ amount: 1297.5, payment_method: "pix", customer_first_name: "Maria", customer_email_masked: "ma***@exemplo.com", status, product_id: "p1", ...extra }], error: null });

function renderPage(tx: string | null = TX) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<HelmetProvider><QueryClientProvider client={client}><MemoryRouter><ThankYouPage transactionParam={tx} /></MemoryRouter></QueryClientProvider></HelmetProvider>);
}
const nbsp = new RegExp(String.fromCharCode(160), "g");

beforeEach(() => { db.calls = []; db.product = { name: "Método Escala 10x" }; db.summary.mockReset(); });
afterEach(() => cleanup());

describe("página de obrigado", () => {
  it("só aceita UUID como código da compra", () => {
    expect(parseTransactionId(TX)).toBe(TX);
    expect(parseTransactionId(` ${TX.toUpperCase()} `)).toBe(TX.toUpperCase());
    expect(parseTransactionId("123")).toBeNull();
    expect(parseTransactionId(`${TX}' or 1=1`)).toBeNull();
    expect(parseTransactionId(null)).toBeNull();
  });

  it("separa reembolso de pendente e nunca aprova status desconhecido", () => {
    expect(purchaseOutcome("completed")).toBe("approved");
    expect(purchaseOutcome("refunded")).toBe("refunded");
    expect(purchaseOutcome("chargeback")).toBe("refunded");
    expect(purchaseOutcome("partially_refunded")).toBe("refunded");
    expect(purchaseOutcome("failed")).toBe("failed");
    expect(purchaseOutcome("expired")).toBe("expired");
    expect(purchaseOutcome("pending")).toBe("pending");
    expect(purchaseOutcome("algo-novo")).toBe("pending");
  });

  it("compra aprovada mostra o resumo e leva à área de membros", async () => {
    db.summary.mockReturnValue(row("completed"));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Compra confirmada" })).toBeInTheDocument();
    expect(screen.getByText("Maria, seu pagamento foi aprovado.")).toBeInTheDocument();
    expect(screen.getByText("Método Escala 10x")).toBeInTheDocument();
    expect(screen.getByText((_, node) => (node?.textContent ?? "").replace(nbsp, " ") === "R$ 1.297,50" && node?.tagName === "DD")).toBeInTheDocument();
    expect(screen.getByText("ma***@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acessar a área de membros/ })).toHaveAttribute("href", "/membros-area/login");
    expect(screen.queryByText(/Recibo enviado/)).toBeNull();
    expect(screen.queryByText(/apenas agora|Oferta exclusiva/i)).toBeNull();
  });

  it("compra pendente NÃO diz que foi confirmada", async () => {
    db.summary.mockReturnValue(row("pending"));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Aguardando o pagamento" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Compra confirmada" })).toBeNull();
    expect(screen.queryByRole("link", { name: /área de membros/ })).toBeNull();
  });

  it("'Conferir agora' consulta de novo e vira confirmada quando o servidor aprova", async () => {
    db.summary.mockReturnValueOnce(row("pending")).mockReturnValue(row("completed"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Conferir agora/ }));
    expect(await screen.findByRole("heading", { name: "Compra confirmada" })).toBeInTheDocument();
  });

  it.each([["failed", "Pagamento não concluído"], ["expired", "O prazo do pagamento acabou"], ["refunded", "Compra reembolsada"]])("%s tem tela própria e não libera acesso", async (status, title) => {
    db.summary.mockReturnValue(row(status));
    renderPage();
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /área de membros/ })).toBeNull();
  });

  it("compra que não existe, ou código inválido, é 'não encontrada' (e código inválido nem chama o servidor)", async () => {
    db.summary.mockReturnValue({ data: [], error: null });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Compra não encontrada" })).toBeInTheDocument();
    cleanup();
    db.calls = [];
    renderPage("não-é-uuid");
    expect(await screen.findByRole("heading", { name: "Compra não encontrada" })).toBeInTheDocument();
    renderPage(null);
    expect(db.calls).toHaveLength(0);
  });

  it("erro do servidor oferece tentar de novo em vez de dizer que a compra não existe", async () => {
    db.summary.mockReturnValueOnce({ data: null, error: { message: "boom" } });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Não foi possível abrir sua compra" }, { timeout: 4000 })).toBeInTheDocument();
    db.summary.mockReturnValue(row("completed"));
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByRole("heading", { name: "Compra confirmada" })).toBeInTheDocument();
  });

  it("sem o nome do produto a confirmação continua valendo", async () => {
    db.product = null;
    db.summary.mockReturnValue(row("completed", { customer_first_name: "" }));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Compra confirmada" })).toBeInTheDocument();
    expect(screen.getByText("Seu pagamento foi aprovado.")).toBeInTheDocument();
    expect(screen.getByText("Seu pedido")).toBeInTheDocument();
    await waitFor(() => expect(db.calls).toContain(`get_thank_you_summary:${TX}`));
  });
});

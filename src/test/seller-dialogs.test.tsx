import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SellerRefundDialog } from "@/components/transactions/SellerRefundDialog";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { trackingParams } from "@/components/transactions/detailMeta";
import { SalesExportDialog } from "@/components/transactions/SalesExportDialog";
import { exportStatusId } from "@/components/transactions/exportMeta";
import type { Tables } from "@/integrations/supabase/types";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock("@/components/transactions/TransactionTimeline", () => ({ TransactionTimeline: () => <p>linha do tempo</p> }));
vi.mock("sonner", () => ({ toast: { success: mock.success, error: vi.fn() } }));

const tx = (over: Partial<Tables<"transactions">> = {}) => ({ id: "t-1", amount: 297, refunded_amount: 0, ...over }) as Tables<"transactions">;
const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
const amountInput = () => screen.getByLabelText("Quanto devolver") as HTMLInputElement;
const reasonInput = () => screen.getByLabelText("Motivo") as HTMLTextAreaElement;
const submitBtn = () => screen.getByRole("button", { name: /^Reembolsar/ });

beforeEach(() => { mock.rpc.mockReset(); mock.success.mockReset(); });

describe("reembolso do seller", () => {
  it("mostra quanto ainda dá para devolver, já descontando o que foi reembolsado", () => {
    render(wrap(<SellerRefundDialog tx={tx({ refunded_amount: 97 })} onClose={() => {}} />));
    expect(screen.getByText(/Disponível para reembolso/)).toBeTruthy();
    expect(screen.getByText("R$ 200,00", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/Já devolvido: R\$ 97,00/)).toBeTruthy();
    expect((submitBtn().textContent ?? "").replace(/\u00a0/g, " ")).toContain("R$ 200,00");
  });

  it("valor acima do restante e motivo curto são barrados antes de chamar o servidor", () => {
    render(wrap(<SellerRefundDialog tx={tx()} onClose={() => {}} />));
    fireEvent.change(amountInput(), { target: { value: "99999" } });
    fireEvent.change(reasonInput(), { target: { value: "abc" } });
    fireEvent.click(submitBtn());
    expect(screen.getByText("O máximo para esta venda é R$ 297,00.")).toBeTruthy();
    expect(screen.getByText("Escreva pelo menos 5 caracteres.")).toBeTruthy();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("campo vazio é reembolso total e avisa que o acesso do comprador some", async () => {
    mock.rpc.mockResolvedValue({ error: null });
    const onClose = vi.fn(); const onDone = vi.fn();
    render(wrap(<SellerRefundDialog tx={tx()} onClose={onClose} onDone={onDone} />));
    expect(screen.getByText(/perde o acesso ao produto/)).toBeTruthy();
    fireEvent.change(reasonInput(), { target: { value: "Pedido pelo suporte" } });
    fireEvent.click(submitBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.rpc).toHaveBeenCalledWith("seller_refund_transaction", { _transaction_id: "t-1", _amount: 297, _reason: "Pedido pelo suporte" });
    expect(mock.success).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("valor parcial usa a máscara em reais e avisa que o acesso continua", async () => {
    mock.rpc.mockResolvedValue({ error: null });
    render(wrap(<SellerRefundDialog tx={tx()} onClose={() => {}} />));
    fireEvent.change(amountInput(), { target: { value: "5000" } });
    expect(amountInput().value).toBe("50,00");
    expect(screen.getByText(/o acesso do comprador continua/)).toBeTruthy();
    fireEvent.change(reasonInput(), { target: { value: "Desconto combinado" } });
    fireEvent.click(submitBtn());
    await waitFor(() => expect(mock.rpc).toHaveBeenCalled());
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ _amount: 50 });
    fireEvent.click(screen.getByRole("button", { name: /Devolver tudo/ }));
    expect(amountInput().value).toBe("");
  });

  it("erro do servidor aparece no diálogo, sem a sigla técnica, e o diálogo continua aberto", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "P0001: Saldo insuficiente para o reembolso" } });
    const onClose = vi.fn();
    render(wrap(<SellerRefundDialog tx={tx()} onClose={onClose} />));
    fireEvent.change(reasonInput(), { target: { value: "Pedido pelo suporte" } });
    fireEvent.click(submitBtn());
    await waitFor(() => expect(screen.getByText("Saldo insuficiente para o reembolso")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("confirmação de senha", () => {
  it("só libera com 6 caracteres e entrega a senha a quem pediu", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ReauthenticationDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
    const btn = screen.getByRole("button", { name: "Confirmar e continuar" }) as HTMLButtonElement;
    const input = screen.getByLabelText("Senha atual") as HTMLInputElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "12345" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "123456" } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("123456"));
  });

  it("mostrar/ocultar senha e usa o texto que cada fluxo passou", () => {
    render(<ReauthenticationDialog open title="Confirmar saque" description="Autorize o saque de R$ 50,00." onOpenChange={() => {}} onConfirm={async () => {}} />);
    const input = screen.getByLabelText("Senha atual") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(input.type).toBe("text");
    expect(screen.getByText("Confirmar saque")).toBeTruthy();
    expect(screen.getByText("Autorize o saque de R$ 50,00.")).toBeTruthy();
  });

  it("ocupado: não deixa fechar nem enviar de novo", () => {
    const onOpenChange = vi.fn();
    render(<ReauthenticationDialog open busy onOpenChange={onOpenChange} onConfirm={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Confirmando/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a senha digitada some quando o diálogo fecha", () => {
    const { rerender } = render(<ReauthenticationDialog open onOpenChange={() => {}} onConfirm={async () => {}} />);
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "segredo123" } });
    rerender(<ReauthenticationDialog open={false} onOpenChange={() => {}} onConfirm={async () => {}} />);
    rerender(<ReauthenticationDialog open onOpenChange={() => {}} onConfirm={async () => {}} />);
    expect((screen.getByLabelText("Senha atual") as HTMLInputElement).value).toBe("");
  });
});

describe("detalhe da venda", () => {
  const sale = (over: Partial<Tables<"transactions">> = {}) => tx({
    customer_name: "Marina Alves", customer_email: "marina@exemplo.com", customer_phone: "(44) 99999-1234", customer_document: "12345678900",
    status: "completed", payment_method: "pix", fee_amount: 17, net_amount: 280, created_at: "2026-11-24T15:00:00Z", product_id: "p1", ...over,
  });

  it("mostra valores, cliente e produto, e oferece reembolso só da venda paga do seller", () => {
    const onRefund = vi.fn();
    render(<TransactionDetailPanel tx={sale()} products={{ p1: "Mentoria Black" }} onClose={() => {}} onRefund={onRefund} />);
    expect(screen.getByText("Marina Alves", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("Mentoria Black")).toBeTruthy();
    expect(screen.getAllByText("Paga").length).toBeGreaterThan(0);
    expect(screen.getByText(/280,00/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe("https://wa.me/5544999991234");
    fireEvent.click(screen.getByRole("button", { name: /Reembolsar/ }));
    expect(onRefund).toHaveBeenCalledWith(expect.objectContaining({ id: "t-1" }));
  });

  it("venda que não foi paga não tem reembolso, e o admin nunca reembolsa por aqui", () => {
    const { rerender } = render(<TransactionDetailPanel tx={sale({ status: "pending", created_at: new Date().toISOString() })} products={{}} onClose={() => {}} onRefund={() => {}} />);
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).toBeNull();
    rerender(<TransactionDetailPanel tx={sale()} products={{}} onClose={() => {}} onRefund={() => {}} variant="admin" />);
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).toBeNull();
    expect(screen.getByText("Margem da taxa")).toBeTruthy();
  });

  it("reembolso parcial e valor retido aparecem; telefone com 55 não vira 5555", () => {
    render(<TransactionDetailPanel tx={sale({ refunded_amount: 50, retained_amount: 100, retention_released: false, retained_until: "2026-12-05T12:00:00Z", customer_phone: "5544999991234" })} products={{}} onClose={() => {}} />);
    expect(screen.getByText("Já reembolsado")).toBeTruthy();
    expect(screen.getByText(/libera em 05\/12\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe("https://wa.me/5544999991234");
  });

  it("some quando tx vira null, e Esc/X chamam onClose", () => {
    const onClose = vi.fn();
    const { rerender } = render(<TransactionDetailPanel tx={sale()} products={{}} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    rerender(<TransactionDetailPanel tx={null} products={{}} onClose={onClose} />);
    expect(screen.queryByText("Marina Alves", { selector: "h2" })).toBeNull();
  });

  it("lê as utms do endereço de origem e ignora lixo", () => {
    expect(trackingParams("https://loja.com/pay?utm_source=fb&utm_campaign=black&x=1&sck=abc")).toEqual([["utm_source", "fb"], ["utm_campaign", "black"], ["sck", "abc"]]);
    expect(trackingParams("não é url")).toEqual([]);
    expect(trackingParams(null)).toEqual([]);
  });
});

describe("exportar vendas", () => {
  const base = { open: true, onOpenChange: () => {}, rangeLabel: "Hoje", products: [{ id: "p1", name: "Método Escala 10x" }], filters: {}, onFilters: () => {}, exporting: false, progress: 0, error: null as string | null, onCsv: () => {}, onXlsx: () => {} };

  it("reconhece a opção de status pelo filtro guardado, inclusive Pagos", () => {
    expect(exportStatusId(undefined)).toBe("all");
    expect(exportStatusId([])).toBe("all");
    expect(exportStatusId(["approved", "completed", "paid"])).toBe("paid");
    expect(exportStatusId(["refunded"])).toBe("refunded");
    expect(exportStatusId(["qualquer"])).toBe("all");
  });

  it("mostra o período e dispara CSV e Excel pelos botões", () => {
    const onCsv = vi.fn(); const onXlsx = vi.fn();
    render(<SalesExportDialog {...base} onCsv={onCsv} onXlsx={onXlsx} />);
    expect(screen.getByText(/Período: Hoje/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Baixar CSV/ }));
    fireEvent.click(screen.getByRole("button", { name: /Baixar Excel/ }));
    expect(onCsv).toHaveBeenCalledTimes(1);
    expect(onXlsx).toHaveBeenCalledTimes(1);
  });

  it("mostra o erro dentro do diálogo e trava tudo enquanto exporta", () => {
    const { rerender } = render(<SalesExportDialog {...base} error="Nenhuma venda com esses filtros no período." />);
    expect(screen.getByRole("alert").textContent).toContain("Nenhuma venda");
    rerender(<SalesExportDialog {...base} exporting progress={1250} />);
    expect(screen.getByRole("status").textContent).toContain("1.250");
    expect((screen.getByRole("button", { name: /Baixar CSV/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("guarda o que foi digitado nos filtros", () => {
    const onFilters = vi.fn();
    render(<SalesExportDialog {...base} filters={{ search: "" }} onFilters={onFilters} />);
    fireEvent.change(screen.getByLabelText("Nome do cliente"), { target: { value: "Marina" } });
    expect(onFilters).toHaveBeenCalledWith({ search: "", customerName: "Marina" });
  });
});

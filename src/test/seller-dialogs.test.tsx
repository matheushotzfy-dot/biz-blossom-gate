import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SellerRefundDialog } from "@/components/transactions/SellerRefundDialog";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import type { Tables } from "@/integrations/supabase/types";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
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

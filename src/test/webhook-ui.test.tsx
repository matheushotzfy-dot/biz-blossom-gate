import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PulseStrip } from "@/components/integrations/PulseStrip";
import { TestTracker } from "@/components/integrations/TestTracker";
import type { DeliveryRow } from "@/components/integrations/webhookMeta";

const delivery = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  id: "d1", webhook_config_id: "w1", transaction_id: null, event: "payment.approved", attempt: 0, status: "pending",
  response_status: null, error: null, next_retry_at: null, delivered_at: null, created_at: new Date().toISOString(), ...over,
});

const tracker = (row: DeliveryRow | null, extra: Partial<Parameters<typeof TestTracker>[0]> = {}) =>
  render(<TestTracker row={row} event="payment.approved" verb="Teste" onOpen={() => {}} onDismiss={() => {}} {...extra} />);

describe("TestTracker", () => {
  it("sem a entrega ainda lida, mostra na fila", () => {
    tracker(null);
    expect(screen.getByText("Teste: Pagamento aprovado")).toBeTruthy();
    expect(screen.getByText(/Na fila. O envio sai em até 1 minuto/)).toBeTruthy();
  });
  it("enviando", () => {
    tracker(delivery({ status: "processing" }));
    expect(screen.getByText(/Enviando para o seu servidor/)).toBeTruthy();
  });
  it("entregue mostra a resposta e abre os detalhes", () => {
    const onOpen = vi.fn();
    tracker(delivery({ status: "success", attempt: 1, response_status: 200 }), { onOpen });
    expect(screen.getByText(/Chegou. Seu servidor respondeu 200/)).toBeTruthy();
    fireEvent.click(screen.getByText("Ver o que enviamos e a resposta"));
    expect(onOpen).toHaveBeenCalled();
  });
  it("nova tentativa avisa quando sai a próxima", () => {
    tracker(delivery({ status: "pending", attempt: 1, response_status: 500, next_retry_at: new Date(Date.now() + 30_000).toISOString() }));
    expect(screen.getByText(/Seu servidor respondeu 500\. Nova tentativa em \d+ s\./)).toBeTruthy();
  });
  it("esgotada diz que não chegou", () => {
    tracker(delivery({ status: "exhausted", attempt: 5, response_status: 404 }), { verb: "Reenvio" });
    expect(screen.getByText("Reenvio: Pagamento aprovado")).toBeTruthy();
    expect(screen.getByText(/Não chegou. Seu servidor respondeu 404/)).toBeTruthy();
  });
  it("fecha pelo botão", () => {
    const onDismiss = vi.fn();
    tracker(delivery(), { onDismiss });
    fireEvent.click(screen.getByLabelText("Fechar acompanhamento"));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("PulseStrip", () => {
  it("descreve as entregas para leitor de tela", () => {
    render(<PulseStrip rows={[{ status: "success", attempt: 1 }, { status: "exhausted", attempt: 5 }]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Últimas entregas: 1 de 2 entregues");
  });
});

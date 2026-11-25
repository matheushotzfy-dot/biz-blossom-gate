import type { CheckoutProcessor } from "./paymentContract";

/**
 * Hoje não há adquirente nem função de cobrança no servidor, então o checkout falha fechado:
 * mostra o pedido e avisa que o pagamento está indisponível, sem fingir que cobra.
 * Quando a função existir, o processador de verdade entra aqui (chama a função do servidor com o CheckoutAttempt).
 */
export const unavailableProcessor: CheckoutProcessor = {
  available: false,
  async createPayment() {
    return { status: "unavailable", reason: "acquirer_not_configured" };
  },
};

export const defaultCheckoutProcessor: CheckoutProcessor = unavailableProcessor;

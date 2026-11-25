import type { CheckoutProcessor } from "./paymentContract";

/**
 * Hoje não há adquirente nem função de cobrança no servidor, então o checkout falha fechado:
 * mostra o pedido e avisa que o pagamento está indisponível, sem fingir que cobra.
 * Quando a função existir, o processador de verdade entra aqui (chama a função do servidor com o CheckoutAttempt).
 * Essa função do servidor DEVE chamar `screen_checkout_attempt` (service_role) antes de cobrar: é ela que aplica a blacklist e as regras
 * de velocidade do admin e grava o bloqueio na trilha. Quando isso estiver ligado, remova o aviso "checkout ainda não cobra" de
 * `AdminRiskComplianceTab`.
 */
export const unavailableProcessor: CheckoutProcessor = {
  available: false,
  async createPayment() {
    return { status: "unavailable", reason: "acquirer_not_configured" };
  },
};

export const defaultCheckoutProcessor: CheckoutProcessor = unavailableProcessor;

export type SupportedCheckoutMethod = "pix" | "credit_card" | "boleto";

export interface CheckoutAttempt {
  productId: string;
  checkoutSessionId: string;
  method: SupportedCheckoutMethod;
  selectedBumpIds: string[];
  couponCode?: string;
  installments?: number;
  cardToken?: string;
  customer: {
    name: string;
    email: string;
    document: string;
    phone: string;
  };
}

export type CheckoutCreationResult =
  | { status: "pending"; transactionId: string; paymentPayload: Record<string, unknown> }
  | { status: "approved"; transactionId: string }
  | { status: "unavailable"; reason: "acquirer_not_configured" | "method_not_supported" };

/**
 * Future acquirer adapters must implement this contract server-side.
 * The browser must never provide price, seller id, fee, card PAN or CVV.
 */
export interface CheckoutProcessor {
  createPayment(attempt: CheckoutAttempt): Promise<CheckoutCreationResult>;
}
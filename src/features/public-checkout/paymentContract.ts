import type { ComponentType } from "react";

export type SupportedCheckoutMethod = "pix" | "credit_card" | "boleto";

export interface CheckoutAddress {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * O que o navegador envia ao servidor para abrir uma cobrança.
 *
 * O servidor NUNCA confia em preço, vendedor, taxa ou desconto vindos daqui: recalcula tudo a partir de
 * `productId`, `selectedBumpIds` e `couponCode` (e confere que cada bump pertence ao mesmo vendedor do produto).
 * `affiliateSlug` é só uma dica: o servidor resolve com `resolve_affiliate_link(productId, slug)` e grava o resultado em
 * `transactions.affiliate_link_id`; se o link não valer, a venda segue sem comissão. `checkoutSessionId` é o endereço de
 * origem da página (com UTMs), que o painel de vendas lê em `trackingParams`.
 * Número do cartão e CVV nunca passam por aqui: só `cardToken`, gerado pelo formulário do adquirente.
 */
export interface CheckoutAttempt {
  productId: string;
  checkoutSessionId: string;
  method: SupportedCheckoutMethod;
  selectedBumpIds: string[];
  couponCode?: string;
  affiliateSlug?: string;
  installments?: number;
  cardToken?: string;
  customer: {
    name: string;
    email: string;
    document: string;
    phone: string;
  };
  address?: CheckoutAddress;
}

export type CheckoutCreationResult =
  | { status: "pending"; transactionId: string; paymentPayload: Record<string, unknown> }
  | { status: "approved"; transactionId: string }
  | { status: "unavailable"; reason: "acquirer_not_configured" | "method_not_supported" };

export interface CardFieldsProps {
  /** O formulário do adquirente chama com o token quando o cartão está completo e válido, ou com null enquanto não está. */
  onToken: (token: string | null) => void;
  disabled?: boolean;
}

/**
 * Cada adquirente implementa este contrato no servidor (uma função que cria a cobrança) e o navegador só a chama.
 * `available: false` mantém o checkout aberto para o comprador ver o pedido, mas sem botão de pagar.
 * `CardFields` é o formulário seguro do adquirente (campos hospedados por ele); sem ele o cartão não é cobrável.
 */
export interface CheckoutProcessor {
  readonly available: boolean;
  readonly CardFields?: ComponentType<CardFieldsProps>;
  createPayment(attempt: CheckoutAttempt): Promise<CheckoutCreationResult>;
}

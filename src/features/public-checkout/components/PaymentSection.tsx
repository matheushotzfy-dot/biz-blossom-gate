import { ChevronDown, CreditCard, FileText, QrCode, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { CardFieldsProps } from "../paymentContract";
import { formatBRL, type InstallmentOption } from "../pricing";
import type { CheckoutMethod } from "../types";

const METHODS: Record<CheckoutMethod, { title: string; text: string; icon: LucideIcon }> = {
  pix: { title: "Pix", text: "QR Code e código copia e cola", icon: QrCode },
  credit_card: { title: "Cartão de crédito", text: "Em até 12 parcelas", icon: CreditCard },
  boleto: { title: "Boleto", text: "Compensa em até 3 dias úteis", icon: FileText },
};

interface PaymentSectionProps {
  step: number;
  methods: CheckoutMethod[];
  method: CheckoutMethod;
  onMethod: (method: CheckoutMethod) => void;
  installments: number;
  installmentOptions: InstallmentOption[];
  onInstallments: (count: number) => void;
  CardFields?: ComponentType<CardFieldsProps>;
  onCardToken: (token: string | null) => void;
  processorAvailable: boolean;
  disabled: boolean;
}

export function PaymentSection(props: PaymentSectionProps) {
  const { step, methods, method, onMethod, installments, installmentOptions, onInstallments, CardFields, onCardToken, processorAvailable, disabled } = props;

  if (methods.length === 0) {
    return (
      <section className="ck-card" aria-labelledby="ck-h-pay">
        <div className="ck-card-head"><span className="ck-step" aria-hidden="true">{step}</span><h2 id="ck-h-pay">Pagamento</h2></div>
        <div className="ck-note" data-tone="warn" role="status">
          <TriangleAlert size={20} aria-hidden="true" />
          <div><strong>Nenhuma forma de pagamento ativa</strong><p>O vendedor ainda não liberou Pix, cartão nem boleto para este produto.</p></div>
        </div>
      </section>
    );
  }

  return (
    <section className="ck-card" aria-labelledby="ck-h-pay">
      <div className="ck-card-head">
        <span className="ck-step" aria-hidden="true">{step}</span>
        <div>
          <h2 id="ck-h-pay">Pagamento</h2>
          <p className="ck-card-sub">Escolha como prefere pagar.</p>
        </div>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend className="ck-sr">Forma de pagamento</legend>
        <div className="ck-choices" data-cols={methods.length >= 3 ? "3" : methods.length === 2 ? "2" : undefined}>
          {methods.map((id) => {
            const item = METHODS[id];
            const Icon = item.icon;
            const checked = id === method;
            return (
              <label key={id} className="ck-choice" data-checked={checked}>
                <input type="radio" name="ck-method" value={id} checked={checked} onChange={() => onMethod(id)} disabled={disabled} />
                <span className="ck-choice-icon" aria-hidden="true"><Icon size={20} /></span>
                <span className="ck-choice-body">
                  <span className="ck-choice-title">{item.title}</span>
                  <span className="ck-choice-text">{item.text}</span>
                </span>
                <span className="ck-mark" data-shape="round" aria-hidden="true" />
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="ck-method-body">
        {method === "pix" && <p className="ck-msg">Ao finalizar, mostramos o QR Code e o código Pix para você pagar no app do seu banco.</p>}
        {method === "boleto" && <p className="ck-msg">O boleto é gerado ao finalizar. O acesso é liberado depois que o banco confirmar o pagamento.</p>}
        {method === "credit_card" && (
          <div className="ck-fields">
            {CardFields ? <CardFields onToken={onCardToken} disabled={disabled} /> : processorAvailable && (
              <div className="ck-note" data-tone="warn" role="status">
                <TriangleAlert size={20} aria-hidden="true" />
                <div><strong>Cartão indisponível</strong><p>O pagamento por cartão ainda não está ativo neste checkout. Escolha outra forma de pagamento.</p></div>
              </div>
            )}
            <div className="ck-field">
              <label className="ck-label" htmlFor="ck-installments">Parcelas</label>
              <div className="ck-select-wrap">
                <select id="ck-installments" className="ck-input" value={installments} onChange={(event) => onInstallments(Number(event.target.value))} disabled={disabled}>
                  {installmentOptions.map((option) => (
                    <option key={option.count} value={option.count}>
                      {option.count === 1
                        ? `À vista, ${formatBRL(option.total)}`
                        : `${option.count}x de ${formatBRL(option.perInstallment)} (${formatBRL(option.total)} no total)`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              {installments > 1 && <p className="ck-msg">Parcelar tem acréscimo: o total passa de {formatBRL(installmentOptions[0].total)} para {formatBRL(installmentOptions[installments - 1].total)}.</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

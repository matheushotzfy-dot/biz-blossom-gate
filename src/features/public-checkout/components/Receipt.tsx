import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cleanCouponCode } from "../coupon";
import { formatBRL, type InstallmentOption, type OrderTotals } from "../pricing";
import type { AppliedCoupon, CheckoutBump, CheckoutMethod, CheckoutProduct } from "../types";

export interface CouponApi {
  applied: AppliedCoupon | null;
  busy: boolean;
  error: string | null;
  apply: (code: string) => Promise<boolean>;
  remove: () => void;
}

interface ReceiptProps {
  product: CheckoutProduct;
  bumps: CheckoutBump[];
  totals: OrderTotals;
  coupon: CouponApi;
  method: CheckoutMethod;
  installment: InstallmentOption;
  submitting: boolean;
  /** Por que o botão está desligado, em palavras (aparece abaixo dele). Null = pode pagar. */
  blockedReason: string | null;
}

const CTA_LABEL: Record<CheckoutMethod, string> = { pix: "Pagar com Pix", credit_card: "Pagar com cartão", boleto: "Gerar boleto" };

function Line({ name, price, kind }: { name: string; price: string; kind?: "discount" }) {
  return (
    <li className="ck-line" data-kind={kind}>
      <span className="ck-line-name">{name}</span>
      <span className="ck-leader" aria-hidden="true" />
      <span className="ck-line-price ck-num">{price}</span>
    </li>
  );
}

function CouponBox({ coupon, discount }: { coupon: CouponApi; discount: number }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (coupon.applied) {
    return (
      <div className="ck-coupon">
        <div className="ck-applied">
          <span>Cupom <strong>{coupon.applied.code}</strong>{discount > 0 ? ` (− ${formatBRL(discount)})` : ""}</span>
          <button type="button" className="ck-link-btn" onClick={coupon.remove}>Remover</button>
        </div>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="ck-coupon">
        <button type="button" className="ck-link-btn" onClick={() => setOpen(true)}>Tenho um cupom</button>
      </div>
    );
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (await coupon.apply(code)) { setCode(""); setOpen(false); }
  };
  return (
    <div className="ck-coupon">
      <label className="ck-label" htmlFor="ck-coupon">Cupom de desconto</label>
      <div className="ck-coupon-row" role="group" aria-label="Aplicar cupom">
        <input
          ref={input} id="ck-coupon" className="ck-input ck-input-mono" value={code} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          aria-invalid={coupon.error ? true : undefined} aria-describedby={coupon.error ? "ck-coupon-msg" : undefined}
          onChange={(event) => setCode(cleanCouponCode(event.target.value))}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(event); }}
          placeholder="CODIGO"
        />
        <button type="button" className="ck-btn" disabled={coupon.busy || code.length < 3} onClick={(event) => void submit(event)}>
          {coupon.busy ? <Loader2 size={16} className="ck-spin-inline" aria-hidden="true" /> : null}Aplicar
        </button>
      </div>
      {coupon.error && <p id="ck-coupon-msg" className="ck-msg" data-tone="error" role="alert">{coupon.error}</p>}
    </div>
  );
}

export function Receipt({ product, bumps, totals, coupon, method, installment, submitting, blockedReason }: ReceiptProps) {
  const showInstallments = method === "credit_card" && installment.count > 1;
  const label = submitting ? "Processando…" : blockedReason ? "Pagamento indisponível" : CTA_LABEL[method];
  return (
    <div className="ck-slip">
      <div className="ck-receipt">
        <h2>Resumo do pedido</h2>
        <ul className="ck-lines">
          <Line name={product.name} price={formatBRL(totals.price)} />
          {bumps.map((bump) => <Line key={bump.id} name={bump.name} price={formatBRL(bump.price)} />)}
          {totals.discount > 0 && <Line name={`Cupom ${coupon.applied?.code ?? ""}`.trim()} price={`− ${formatBRL(totals.discount)}`} kind="discount" />}
        </ul>
        <div className="ck-cut" aria-hidden="true" />
        <div className="ck-total" aria-live="polite">
          <span className="ck-total-label">Total</span>
          <span className="ck-total-value ck-num">{formatBRL(showInstallments ? installment.total : totals.total)}</span>
        </div>
        {showInstallments && <p className="ck-total-sub ck-num">{installment.count}x de {formatBRL(installment.perInstallment)}</p>}

        <CouponBox coupon={coupon} discount={totals.discount} />

        <div style={{ marginTop: 18 }}>
          <button type="submit" className="ck-cta" disabled={submitting || blockedReason !== null} data-busy={submitting} aria-describedby={blockedReason ? "ck-cta-help" : undefined}>
            {submitting ? <Loader2 size={20} className="ck-spin-inline" aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
            {label}
          </button>
          {blockedReason && <p id="ck-cta-help" className="ck-cta-help">{blockedReason}</p>}
        </div>

        <div className="ck-trust">
          {product.guaranteeEnabled && (
            <div className="ck-guarantee">
              <ShieldCheck size={22} aria-hidden="true" />
              <div><strong>Garantia de 7 dias</strong><span>Se não for o que você esperava, peça o reembolso em até 7 dias depois da compra.</span></div>
            </div>
          )}
          <p className="ck-secure"><Lock size={14} aria-hidden="true" /> Conexão criptografada (HTTPS)</p>
        </div>
        <p className="ck-legal">
          Ao continuar, você concorda com os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e a{" "}
          <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
        </p>
      </div>
    </div>
  );
}

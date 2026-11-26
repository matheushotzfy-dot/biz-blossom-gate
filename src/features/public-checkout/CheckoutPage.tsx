import { useQuery } from "@tanstack/react-query";
import { ImageIcon, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Seo } from "@/components/Seo";
import type { PixelConfig } from "@/lib/pixelTracking";
import { AddressSection } from "./components/AddressSection";
import { BumpsSection } from "./components/BumpsSection";
import { Banner, CheckoutShell, TimerBar } from "./components/CheckoutShell";
import { CustomerSection, type FieldApi } from "./components/CustomerSection";
import { PaymentSection } from "./components/PaymentSection";
import { Receipt, type CouponApi } from "./components/Receipt";
import { ApprovedScreen, CheckoutSkeleton, ClosedScreen, FailedScreen, LoadErrorScreen, PendingScreen } from "./components/Screens";
import { checkCoupon, cleanCouponCode } from "./coupon";
import { resolveAffiliateForVisit } from "./affiliate";
import { loadCheckout } from "./loadCheckout";
import type { CheckoutAttempt, CheckoutProcessor } from "./paymentContract";
import { defaultCheckoutProcessor } from "./processor";
import { formatBRL, installmentOptions, orderTotals } from "./pricing";
import { safeCheckoutSlug } from "./slug";
import type { AppliedCoupon, CheckoutBump, CheckoutMethod, CheckoutProduct } from "./types";
import { FIELD_ORDER, useCheckoutForm, type FieldName } from "./useCheckoutForm";
import { useCheckoutFlow } from "./useCheckoutFlow";
import { useCheckoutTracking } from "./useCheckoutTracking";
import { useOfferTimer } from "./useOfferTimer";

export const CHECKOUT_QUERY_KEY = "public-checkout";

export function CheckoutPage({ slug, processor = defaultCheckoutProcessor }: { slug: string | undefined; processor?: CheckoutProcessor }) {
  const safeSlug = safeCheckoutSlug(slug);
  const query = useQuery({
    queryKey: [CHECKOUT_QUERY_KEY, safeSlug],
    queryFn: () => loadCheckout(safeSlug ?? undefined),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (query.isPending) return <CheckoutSkeleton />;
  if (query.isError) return <LoadErrorScreen onRetry={() => void query.refetch()} />;
  if (query.data.kind === "closed") return <ClosedScreen linkStatus={query.data.linkStatus} />;
  const { product, bumps, pixels } = query.data;
  return <CheckoutExperience key={product.id} slug={safeSlug ?? ""} product={product} bumps={bumps} pixels={pixels} processor={processor} />;
}

interface ExperienceProps {
  slug: string;
  product: CheckoutProduct;
  bumps: CheckoutBump[];
  pixels: PixelConfig[];
  processor: CheckoutProcessor;
}

function CheckoutExperience({ slug, product, bumps, pixels, processor }: ExperienceProps) {
  const form = useCheckoutForm({ addressRequired: product.addressRequired, emailConfirm: product.emailConfirm });
  const flow = useCheckoutFlow({ product, pixels, processor });
  const timer = useOfferTimer(product.id, product.timerEnabled, product.timerMinutes);
  useCheckoutTracking(product, pixels);

  const [method, setMethod] = useState<CheckoutMethod>(product.methods[0] ?? "pix");
  const [installments, setInstallments] = useState(1);
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [affiliateSlug, setAffiliateSlug] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  // Afiliado: guarda o link que trouxe o comprador e conta o clique uma vez por visita.
  useEffect(() => { setAffiliateSlug(resolveAffiliateForVisit(product.id, window.location.search)); }, [product.id]);

  /* ── Cupom ── */
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const applyCoupon = useCallback(async (raw: string) => {
    setCouponBusy(true);
    setCouponError(null);
    const result = await checkCoupon(raw, product.id, product.price);
    setCouponBusy(false);
    if ("coupon" in result) { setCoupon(result.coupon); return true; }
    setCouponError(result.message);
    return false;
  }, [product.id, product.price]);
  const removeCoupon = useCallback(() => { setCoupon(null); setCouponError(null); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = cleanCouponCode(params.get("cupom") || params.get("coupon"));
    if (code.length >= 3) void applyCoupon(code); // o servidor valida; se falhar, a pessoa ainda pode digitar o código
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no primeiro carregamento
  }, []);
  const couponApi: CouponApi = { applied: coupon, busy: couponBusy, error: couponError, apply: applyCoupon, remove: removeCoupon };

  /* ── Valores ── */
  const chosenBumps = useMemo(() => bumps.filter((bump) => selectedBumps.has(bump.id)), [bumps, selectedBumps]);
  const totals = useMemo(() => orderTotals(product.price, chosenBumps.map((bump) => bump.price), coupon), [product.price, chosenBumps, coupon]);
  const options = useMemo(() => installmentOptions(totals.total), [totals.total]);
  const installment = options[Math.min(Math.max(installments, 1), options.length) - 1];
  const teaser = product.methods.includes("credit_card") ? installmentOptions(product.price)[options.length - 1] : null;

  const toggleBump = useCallback((id: string) => setSelectedBumps((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const changeMethod = (next: CheckoutMethod) => { setMethod(next); setCardToken(null); };

  /* ── Campos ── */
  const elements = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({});
  const registers = useMemo(() => Object.fromEntries(FIELD_ORDER.map((field) => [field, (element: HTMLInputElement | null) => { elements.current[field] = element; }])) as Record<FieldName, (element: HTMLInputElement | null) => void>, []);
  const fieldApi: FieldApi = { values: form.values, errors: form.errors, setValue: form.setValue, touch: form.touch, register: (field) => registers[field] };

  /* ── Envio ── */
  const CardFields = processor.CardFields;
  const blockedReason = (() => {
    if (!processor.available) return "Os pagamentos deste produto estão indisponíveis agora.";
    if (product.methods.length === 0) return "O vendedor ainda não liberou nenhuma forma de pagamento.";
    if (method === "credit_card" && !CardFields) return "O pagamento por cartão ainda não está ativo. Escolha outra forma de pagamento.";
    if (method === "credit_card" && !cardToken) return "Preencha os dados do cartão para continuar.";
    return null;
  })();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (flow.submitting) return;
    flow.dismissNotice();
    const checked = form.validate();
    if ("first" in checked) {
      setAnnounce(checked.count === 1 ? "Há 1 campo para corrigir." : `Há ${checked.count} campos para corrigir.`);
      elements.current[checked.first]?.focus();
      return;
    }
    setAnnounce("");
    if (blockedReason) return;
    const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");
    const customer = checked.customer;
    const attempt: CheckoutAttempt = {
      productId: product.id,
      checkoutSessionId: window.location.href.split("#")[0].slice(0, 2000),
      method,
      selectedBumpIds: chosenBumps.map((bump) => bump.id),
      couponCode: coupon?.code,
      affiliateSlug: affiliateSlug ?? undefined,
      installments: method === "credit_card" ? installment.count : undefined,
      cardToken: method === "credit_card" ? cardToken ?? undefined : undefined,
      customer: { name: customer.name, email: customer.email, document: digits(customer.document), phone: digits(customer.phone) },
      address: product.addressRequired
        ? { cep: digits(customer.cep), street: customer.street ?? "", number: customer.number ?? "", complement: customer.complement ?? "", neighborhood: customer.neighborhood ?? "", city: customer.city ?? "", state: customer.state ?? "" }
        : undefined,
    };
    void flow.submit(attempt, { total: method === "credit_card" ? installment.total : totals.total });
  };

  const state = flow.state;
  // Ao trocar de tela (formulário → Pix, resultado…), volta ao topo: a nova tela é mais curta que o formulário.
  const lastPhase = useRef(state.phase);
  useEffect(() => {
    if (lastPhase.current === state.phase) return;
    lastPhase.current = state.phase;
    window.scrollTo({ top: 0 });
  }, [state.phase]);
  const head = (
    <Seo title={`${product.name} · Checkout`} description={(product.description || `Compre ${product.name} com pagamento seguro.`).slice(0, 155)} path={`/pay/${slug}`} noindex image={/^https:\/\//i.test(product.imageUrl ?? "") ? product.imageUrl : undefined} />
  );

  if (state.phase !== "form") {
    return (
      <CheckoutShell mode={product.theme} buttonColor={product.buttonColor}>
        {head}
        {state.phase === "pending" && <PendingScreen product={product} record={state.record} onChangeMethod={flow.reset} />}
        {state.phase === "approved" && <ApprovedScreen product={product} record={state.record} />}
        {(state.phase === "failed" || state.phase === "expired") && <FailedScreen kind={state.phase} onRetry={flow.reset} />}
      </CheckoutShell>
    );
  }

  const paymentStep = product.addressRequired ? 3 : 2;
  return (
    <CheckoutShell mode={product.theme} buttonColor={product.buttonColor}>
      {head}
      {product.timerEnabled && <TimerBar secondsLeft={timer.secondsLeft} expired={timer.expired} />}
      <Banner desktop={product.bannerDesktopUrl} mobile={product.bannerMobileUrl} />
      <div className="ck-wrap">
        <header className="ck-head">
          <div className="ck-thumb" aria-hidden="true">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <ImageIcon size={26} />}</div>
          <div className="ck-head-text">
            <h1 className="ck-title">{product.name}</h1>
            {product.sellerName && <p className="ck-seller">Vendido por {product.sellerName}</p>}
          </div>
          <div className="ck-head-price ck-num">
            <strong>{formatBRL(product.price)}</strong>
            {teaser && teaser.count > 1 && <span>ou {teaser.count}x de {formatBRL(teaser.perInstallment)}</span>}
          </div>
        </header>

        {!processor.available && (
          <div className="ck-note" data-tone="warn" role="status" style={{ marginBottom: 16 }}>
            <TriangleAlert className="ck-note-icon" size={20} aria-hidden="true" />
            <div><strong>Pagamentos indisponíveis agora</strong><p>Você pode ver o pedido, mas este produto ainda não está recebendo pagamentos. Nada será cobrado.</p></div>
          </div>
        )}
        {state.notice && (
          <div className="ck-note" data-tone="error" role="alert" style={{ marginBottom: 16 }}>
            <TriangleAlert className="ck-note-icon" size={20} aria-hidden="true" />
            <div><strong>{state.notice}</strong></div>
          </div>
        )}

        <form className="ck-grid" onSubmit={onSubmit} noValidate aria-label="Finalizar compra">
          <div className="ck-main">
            <CustomerSection api={fieldApi} confirmEmail={product.emailConfirm} />
            {product.addressRequired && <AddressSection api={fieldApi} step={2} fillAddress={form.fillAddress} />}
            <BumpsSection bumps={bumps} selected={selectedBumps} onToggle={toggleBump} />
            <PaymentSection
              step={paymentStep} methods={product.methods} method={method} onMethod={changeMethod}
              installments={installment.count} installmentOptions={options} onInstallments={setInstallments}
              CardFields={CardFields} onCardToken={setCardToken} processorAvailable={processor.available} disabled={flow.submitting}
            />
          </div>
          <aside className="ck-aside" aria-label="Resumo do pedido">
            <Receipt product={product} bumps={chosenBumps} totals={totals} coupon={couponApi} method={method} installment={installment} submitting={flow.submitting} blockedReason={blockedReason} />
          </aside>
        </form>

        <div className="ck-sr" role="status" aria-live="polite">{announce}</div>
        <footer className="ck-foot">
          <span>Checkout Vemprapay</span>
          <span className="ck-foot-links">
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
          </span>
        </footer>
      </div>
    </CheckoutShell>
  );
}

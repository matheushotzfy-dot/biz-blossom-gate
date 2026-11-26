import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { firePixelEvent, type PixelConfig } from "@/lib/pixelTracking";
import type { CheckoutAttempt, CheckoutProcessor } from "./paymentContract";
import { outcomeFromStatus, type CheckoutOutcome } from "./status";
import { readJson, removeKey, writeJson } from "./storage";
import type { CheckoutMethod, CheckoutProduct } from "./types";

/** Cobrança aberta: guardada na sessão para que recarregar a página não perca o QR Code nem a consulta. */
export interface PaymentRecord {
  transactionId: string;
  method: CheckoutMethod;
  payload: Record<string, unknown>;
  total: number;
  email: string;
  savedAt: number;
}

export type FlowState =
  | { phase: "form"; notice: string | null }
  | { phase: "pending"; record: PaymentRecord; restored: boolean }
  | { phase: "approved" | "failed" | "expired"; record: PaymentRecord };

const KEEP_PENDING_MS = 3 * 60 * 60 * 1000;
const pendingKey = (productId: string) => `vp-ck-pending:${productId}`;
const firedKey = (event: string, transactionId: string) => `vp-ck-fired:${event}:${transactionId}`;

export const GENERIC_ERROR = "Não foi possível iniciar o pagamento. Nada foi cobrado. Confira os dados e tente de novo.";
export const UNAVAILABLE_NOTICE = "Os pagamentos deste produto estão indisponíveis agora. Nada foi cobrado.";

function fireOnce(pixels: PixelConfig[], event: string, product: CheckoutProduct, record: PaymentRecord) {
  if (readJson<boolean>("session", firedKey(event, record.transactionId))) return;
  writeJson("session", firedKey(event, record.transactionId), true);
  firePixelEvent(pixels, event, { content_name: product.name, content_id: product.id, value: record.total, session_key: record.transactionId });
}

export function useCheckoutFlow(opts: { product: CheckoutProduct; pixels: PixelConfig[]; processor: CheckoutProcessor; restore?: boolean }) {
  const { product, pixels, processor, restore = true } = opts;
  const [state, setState] = useState<FlowState>(() => {
    const saved = restore ? readJson<PaymentRecord>("session", pendingKey(product.id)) : null;
    if (saved && typeof saved.transactionId === "string" && Date.now() - saved.savedAt < KEEP_PENDING_MS) {
      return { phase: "pending", record: saved, restored: true };
    }
    return { phase: "form", notice: null };
  });
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;

  const settle = useCallback((outcome: Exclude<CheckoutOutcome, "pending">, record: PaymentRecord) => {
    removeKey("session", pendingKey(product.id));
    if (outcome === "approved") fireOnce(pixelsRef.current, "Purchase", product, record);
    setState({ phase: outcome, record });
  }, [product]);

  const submit = useCallback(async (attempt: CheckoutAttempt, meta: { total: number }) => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      const result = await processor.createPayment(attempt);
      if (result.status === "unavailable") {
        setState({ phase: "form", notice: UNAVAILABLE_NOTICE });
        return;
      }
      const record: PaymentRecord = {
        transactionId: result.transactionId,
        method: attempt.method,
        payload: result.status === "pending" ? result.paymentPayload : {},
        total: meta.total,
        email: attempt.customer.email,
        savedAt: Date.now(),
      };
      if (result.status === "approved") { settle("approved", record); return; }
      writeJson("session", pendingKey(product.id), record);
      if (record.method === "pix") fireOnce(pixelsRef.current, "PixGenerated", product, record);
      if (record.method === "boleto") fireOnce(pixelsRef.current, "BoletoGenerated", product, record);
      setState({ phase: "pending", record, restored: false });
    } catch {
      setState({ phase: "form", notice: GENERIC_ERROR });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [processor, product, settle]);

  const reset = useCallback(() => {
    removeKey("session", pendingKey(product.id));
    setState({ phase: "form", notice: null });
  }, [product.id]);

  const dismissNotice = useCallback(() => setState((prev) => (prev.phase === "form" && prev.notice ? { phase: "form", notice: null } : prev)), []);

  // Consulta o status enquanto há cobrança aberta: 5 s no começo, 15 s depois de ~5 min, e para em ~1 h.
  const pendingId = state.phase === "pending" ? state.record.transactionId : null;
  const pendingRecord = state.phase === "pending" ? state.record : null;
  const restored = state.phase === "pending" ? state.restored : false;
  useEffect(() => {
    if (!pendingId || !pendingRecord) return;
    let stopped = false;
    let inFlight = false;
    let count = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      count += 1;
      let outcome: CheckoutOutcome = "pending";
      try {
        const { data, error } = await supabase.rpc("get_checkout_status", { _transaction_id: pendingId });
        if (!error) outcome = outcomeFromStatus(data);
      } catch { /* sem rede agora: tenta de novo */ }
      inFlight = false;
      if (stopped) return;
      if (outcome !== "pending") { settle(outcome, pendingRecord); return; }
      if (count >= 300) return;
      timer = setTimeout(tick, count > 60 ? 15_000 : 5_000);
    };

    timer = setTimeout(tick, restored ? 0 : 3_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pendingId, pendingRecord, restored, settle]);

  return { state, submitting, submit, reset, dismissNotice };
}

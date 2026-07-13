export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Map PodPay status to internal status. Exported for tests. */
export const STATUS_MAP: Record<string, string> = {
  'waiting_payment': 'pending',
  'pending': 'pending',
  'authorized': 'pending',
  'approved': 'completed',
  'paid': 'completed',
  'refused': 'failed',
  'failed': 'failed',
  'cancelled': 'cancelled',
  'refunded': 'refunded',
  'chargeback': 'chargeback',
  'in_protest': 'dispute',
};

/** Enforce platform business rules by payment method. Exported for tests. */
export function normalizeTransactionStatus(status: string, paymentMethod?: string | null, createdAt?: string | null, pixExpiresAt?: string | null): string {
  const raw = String(status || '').trim().toLowerCase();
  const method = String(paymentMethod || '').trim().toLowerCase();
  const isPix = method === 'pix';
  const isCard = method === 'credit_card' || method === 'card';
  const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
  const ageHours = Number.isFinite(createdMs) ? (Date.now() - createdMs) / 3_600_000 : 0;
  const pixExpiresMs = pixExpiresAt ? new Date(pixExpiresAt).getTime() : NaN;
  const expiredByTime = ageHours >= 24 || (Number.isFinite(pixExpiresMs) && pixExpiresMs < Date.now());

  if (raw === 'completed' || raw === 'approved' || raw === 'paid') return 'completed';
  if (raw === 'refunded' || raw === 'partially_refunded') return 'refunded';
  if (raw === 'expired') return 'expired';
  if (raw === 'pending' || raw === 'processing' || raw === 'waiting_payment' || raw === 'authorized') {
    return expiredByTime ? 'expired' : 'pending';
  }
  if (raw === 'chargeback' || raw === 'chargedback' || raw === 'charged_back') {
    if (isCard) return 'chargeback';
    if (isPix && expiredByTime) return 'expired';
    if (isPix) return 'dispute';
    return 'failed';
  }
  if (raw === 'med' || raw === 'mediation' || raw === 'dispute' || raw === 'disputed' || raw === 'in_protest') {
    if (isPix) return 'dispute';
    if (isCard) return 'chargeback';
    return 'failed';
  }
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (raw === 'failed' || raw === 'error' || raw === 'rejected' || raw === 'refused') return 'failed';
  return raw || 'pending';
}

/** Compute HMAC-SHA256 signature as lowercase hex. Exported for tests. */
export async function computeHmacHex(rawBody: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time hex signature compare. Exported for tests. */
export async function verifySignature(rawBody: string, signatureHex: string, secret: string): Promise<boolean> {
  if (!signatureHex || !/^[0-9a-fA-F]+$/.test(signatureHex) || signatureHex.length % 2 !== 0) return false;
  const expected = await computeHmacHex(rawBody, secret);
  if (expected.length !== signatureHex.length) return false;
  let mismatch = 0;
  const a = signatureHex.toLowerCase();
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ a.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Compute split amount given net amount (cents/units) and percentage (0-100). Exported for tests. */
export function computeSplitAmount(amount: number, pct: number): number {
  return Math.round(amount * pct) / 100;
}

/** Log only safe fields — never PII or full payloads */
function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED_KEYS = ['transactionId', 'eventId', 'status', 'podpayPaymentId', 'productId', 'error'];
  for (const key of ALLOWED_KEYS) {
    if (key in context) safe[key] = context[key];
  }
  console.log(`[podpay-postback] ${message}`, JSON.stringify(safe));
}

// NOTE: Splits (coprodução + afiliado) são aplicados automaticamente pelo trigger
// public.ledger_on_transaction_change → apply_transaction_splits(tx.id) no banco.
// Não duplicar essa lógica aqui — risco de débito/crédito em dobro.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Signature verification ===
    const signature = req.headers.get('x-podpay-signature') || req.headers.get('x-signature');
    const webhookSecret = Deno.env.get('PODPAY_SECRET_KEY');

    // SECURITY: Signature verification is MANDATORY — reject if secret is missing
    if (!webhookSecret) {
      safeLog('CRITICAL: PODPAY_SECRET_KEY not configured — rejecting webhook');
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      safeLog('Missing webhook signature');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hex validation — empty/odd/non-hex would crash signature.match below
    if (!/^[0-9a-fA-F]+$/.test(signature) || signature.length % 2 !== 0) {
      safeLog('Invalid webhook signature format');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const valid = await verifySignature(rawBody, signature, webhookSecret);
    if (!valid) {
      safeLog('Invalid webhook signature');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Replay protection: reject events older than 5 min based on PodPay timestamp ===
    const tsHeader = req.headers.get('x-podpay-timestamp') || req.headers.get('x-timestamp');
    if (tsHeader) {
      const tsSec = Number(tsHeader);
      if (Number.isFinite(tsSec)) {
        const ageSec = Math.abs(Math.floor(Date.now() / 1000) - tsSec);
        if (ageSec > 300) {
          safeLog('Webhook rejected: stale timestamp', { eventId: String(payload.event_id ?? '') });
          return new Response(
            JSON.stringify({ success: false, error: 'Stale event' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const eventId = payload.event_id ? String(payload.event_id) : null;
    safeLog('Postback received', { eventId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const data = (payload.data || payload) as Record<string, unknown>;
    const podpayStatus = data.status as string;
    const podpayPaymentId = data.id ? String(data.id) : null;
    const podpayEventId = eventId;
    const externalRef = data.externalRef as string | undefined;

    // === Persist raw webhook payload for audit (fire-and-forget bookkeeping) ===
    const webhookLogId = crypto.randomUUID();
    const relevantHeaders: Record<string, string> = {};
    for (const h of ['x-podpay-signature', 'x-signature', 'x-podpay-timestamp', 'x-timestamp', 'user-agent', 'content-type']) {
      const v = req.headers.get(h);
      if (v) relevantHeaders[h] = v;
    }
    await supabase.from('podpay_webhook_events').insert({
      id: webhookLogId,
      event_id: podpayEventId,
      podpay_payment_id: podpayPaymentId,
      signature: signature,
      signature_valid: true,
      raw_payload: payload,
      headers: relevantHeaders,
      processing_result: 'received',
    });

    const finishLog = async (result: string, txId: string | null, error?: string) => {
      try {
        await supabase.from('podpay_webhook_events')
          .update({ processing_result: result, transaction_id: txId, error: error ?? null })
          .eq('id', webhookLogId);
      } catch (_) {}
    };

    // === IDEMPOTENCY ===
    // Primary key: podpay event_id (when provided).
    // Fallback: (payment_id + mapped_status) — prevents replay when PodPay omits event_id
    // (previous code did .eq('podpay_event_id', null) which never matches, allowing double-credit).
    const dedupeMappedStatus = STATUS_MAP[podpayStatus] || 'pending';
    let dedupeQuery = supabase.from('transactions').select('id, status').limit(1);
    if (podpayEventId) {
      dedupeQuery = dedupeQuery.eq('podpay_event_id', podpayEventId);
    } else if (podpayPaymentId) {
      dedupeQuery = dedupeQuery
        .eq('podpay_payment_id', podpayPaymentId)
        .eq('status', dedupeMappedStatus);
    } else {
      // No event_id AND no payment_id => cannot dedupe safely; reject to avoid double-credit.
      await finishLog('rejected_no_identifier', null, 'Missing event_id and payment_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing event_id and payment_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { data: existingEvent } = await dedupeQuery.maybeSingle();
    if (existingEvent) {
      safeLog('Event already processed, skipping', { eventId: podpayEventId, paymentId: podpayPaymentId });
      await finishLog('duplicate_event', existingEvent.id);
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mappedStatus = STATUS_MAP[podpayStatus] || 'pending';

    // Helper: extract normalized amount from payload (reais)
    const extractAmount = (): number | null => {
      const pAny = payload as any;
      const dAny = data as any;
      const raw = dAny?.amount ?? pAny?.amount ?? pAny?.value ?? pAny?.transaction?.amount;
      let n = Number(raw);
      if (!Number.isFinite(n)) return null;
      if (Number.isInteger(n) && n >= 100) n = n / 100;
      return n;
    };

    // === Find transaction by podpay_payment_id first, then fallback to product_id ===
    let transactionId: string | null = null;

    if (podpayPaymentId) {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, status, amount, payment_method, created_at, pix_expires_at')
        .eq('podpay_payment_id', podpayPaymentId)
        .maybeSingle();

      if (tx) {
        transactionId = tx.id;

        // Don't downgrade completed status (idempotency)
        const ourStatus = normalizeTransactionStatus(mappedStatus, tx.payment_method, tx.created_at, tx.pix_expires_at);

        const finalStatuses = ['completed', 'refunded', 'chargeback', 'expired'];
        if (finalStatuses.includes(tx.status) && !finalStatuses.includes(ourStatus)) {
          safeLog('Skipping status downgrade', { transactionId: tx.id, status: `${tx.status} -> ${ourStatus}` });
          await finishLog('skipped_downgrade', tx.id);
          return new Response(
            JSON.stringify({ success: true, message: 'Status not downgraded' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ===== Amount validation (only when marking as paid) =====
        if (ourStatus === 'completed') {
          const payloadAmount = extractAmount();
          if (payloadAmount != null && Math.abs(payloadAmount - Number(tx.amount)) > 0.01) {
            safeLog('Amount mismatch — rejecting', { transactionId: tx.id, error: `payload=${payloadAmount} tx=${tx.amount}` });
            await finishLog('rejected_amount_mismatch', tx.id, `payload=${payloadAmount} tx=${tx.amount}`);
            return new Response(
              JSON.stringify({ success: false, error: 'Amount mismatch' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // ===== Expiration guard (only for pending → completed transitions) =====
          if (tx.status === 'pending' && tx.pix_expires_at) {
            const expiresAt = new Date(tx.pix_expires_at as unknown as string).getTime();
            if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
              safeLog('Transaction expired — rejecting late payment', { transactionId: tx.id });
              await finishLog('rejected_expired', tx.id);
              return new Response(
                JSON.stringify({ success: false, error: 'Transaction expired' }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        const updateData: Record<string, unknown> = { status: ourStatus };
        if (podpayEventId) updateData.podpay_event_id = podpayEventId;

        const { error } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', tx.id);

        if (error) {
          safeLog('Error updating transaction', { transactionId: tx.id, error: error.message });
          await finishLog('update_error', tx.id, error.message);
        } else {
          safeLog('Transaction updated', { transactionId: tx.id, status: ourStatus });
          await finishLog('updated', tx.id);
          // Splits (coprodução + afiliado) são aplicados automaticamente pelo trigger
          // ledger_on_transaction_change → apply_transaction_splits(tx.id) no banco.
        }
      }
    }

    // Fallback: update by product_id + amount + customer_email to avoid wrong-customer match.
    // Only used when no podpay_payment_id correlation exists. Requires strict triple-match.
    if (!transactionId && externalRef) {
      const pAny = payload as any;
      const dAny = data as any;
      const fallbackEmail = (
        dAny?.customer?.email ?? pAny?.customer?.email ?? pAny?.payer?.email ?? ''
      ).toString().trim().toLowerCase();
      const fallbackAmountRaw = dAny?.amount ?? pAny?.amount ?? pAny?.value ?? pAny?.transaction?.amount;
      // PodPay sends amount in cents — normalize to reais if it's an integer >= 100
      let fallbackAmount = Number(fallbackAmountRaw);
      if (Number.isFinite(fallbackAmount) && Number.isInteger(fallbackAmount) && fallbackAmount >= 100) {
        fallbackAmount = fallbackAmount / 100;
      }


      if (fallbackEmail && Number.isFinite(fallbackAmount) && fallbackAmount > 0) {
        const { data: pendingTx } = await supabase
          .from('transactions')
          .select('id, payment_method, created_at, pix_expires_at')
          .eq('product_id', externalRef)
          .eq('status', 'pending')
          .eq('customer_email', fallbackEmail)
          .eq('amount', fallbackAmount)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingTx) {
          const fallbackStatus = normalizeTransactionStatus(mappedStatus, pendingTx.payment_method, pendingTx.created_at, pendingTx.pix_expires_at);
          const updateData: Record<string, unknown> = { status: fallbackStatus };
          if (podpayPaymentId) updateData.podpay_payment_id = podpayPaymentId;
          if (podpayEventId) updateData.podpay_event_id = podpayEventId;

          const { error } = await supabase
            .from('transactions')
            .update(updateData)
            .eq('id', pendingTx.id);

          if (error) {
            safeLog('Error updating transaction by strict fallback', { productId: externalRef, error: error.message });
          } else {
            transactionId = pendingTx.id;
            safeLog('Transaction updated via strict fallback (product+email+amount)', { transactionId: pendingTx.id, status: fallbackStatus });
          }
        } else {
          safeLog('Strict fallback found no match — postback ignored to prevent wrong-customer credit', { productId: externalRef });
        }
      } else {
        safeLog('Fallback skipped — missing email or amount in postback', { productId: externalRef });
      }
    }

    // === Trigger central webhook dispatcher (queue-based with retries & HMAC) ===
    // Delivery rows are auto-created by the enqueue_webhook_on_tx_change trigger.
    // We just nudge the worker to flush the queue immediately.
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      };
      // Await both nudges: serverless runtimes may cancel fire-and-forget fetches
      // as soon as the response is returned, leaving delivery rows pending.
      const [webhookNudge, appsNudge] = await Promise.allSettled([
        fetch(`${supabaseUrl}/functions/v1/webhook-dispatcher`, { method: 'POST', headers, body: '{}' }),
        fetch(`${supabaseUrl}/functions/v1/apps-dispatcher`, { method: 'POST', headers, body: '{}' }),
      ]);
      if (webhookNudge.status === 'rejected') {
        safeLog('Webhook dispatcher nudge failed (non-fatal)', { error: webhookNudge.reason instanceof Error ? webhookNudge.reason.message : 'unknown' });
      }
      if (appsNudge.status === 'rejected') {
        safeLog('Apps dispatcher nudge failed (non-fatal)', { error: appsNudge.reason instanceof Error ? appsNudge.reason.message : 'unknown' });
      }
    } catch (e) {
      // never break postback on dispatcher hiccup — cron fallback will catch up
      safeLog('Dispatcher nudge failed (non-fatal)', { error: e instanceof Error ? e.message : 'unknown' });
    }


    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    safeLog('Postback error', { error: error instanceof Error ? error.message : 'unknown' });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

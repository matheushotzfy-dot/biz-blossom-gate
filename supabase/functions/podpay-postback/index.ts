const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Log only safe fields — never PII or full payloads */
function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED_KEYS = ['transactionId', 'eventId', 'status', 'podpayPaymentId', 'productId', 'error'];
  for (const key of ALLOWED_KEYS) {
    if (key in context) safe[key] = context[key];
  }
  console.log(`[podpay-postback] ${message}`, JSON.stringify(safe));
}

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

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    
    // Constant-time comparison to prevent timing attacks
    const signatureBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const computedBytes = new Uint8Array(mac);
    
    if (signatureBytes.length !== computedBytes.length) {
      safeLog('Invalid webhook signature (length mismatch)');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Constant-time compare
    let mismatch = 0;
    for (let i = 0; i < signatureBytes.length; i++) {
      mismatch |= signatureBytes[i] ^ computedBytes[i];
    }
    
    if (mismatch !== 0) {
      safeLog('Invalid webhook signature');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // === IDEMPOTENCY: Check if this event was already processed ===
    if (podpayEventId) {
      const { data: existingEvent } = await supabase
        .from('transactions')
        .select('id')
        .eq('podpay_event_id', podpayEventId)
        .maybeSingle();

      if (existingEvent) {
        safeLog('Event already processed, skipping', { eventId: podpayEventId });
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Map PodPay status to our status
    const statusMap: Record<string, string> = {
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

    const ourStatus = statusMap[podpayStatus] || 'pending';

    // === Find transaction by podpay_payment_id first, then fallback to product_id ===
    let transactionId: string | null = null;

    if (podpayPaymentId) {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('podpay_payment_id', podpayPaymentId)
        .maybeSingle();

      if (tx) {
        transactionId = tx.id;
        
        // Don't downgrade completed status (idempotency)
        const finalStatuses = ['completed', 'refunded', 'chargeback'];
        if (finalStatuses.includes(tx.status) && !finalStatuses.includes(ourStatus)) {
          safeLog('Skipping status downgrade', { transactionId: tx.id, status: `${tx.status} -> ${ourStatus}` });
          return new Response(
            JSON.stringify({ success: true, message: 'Status not downgraded' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, unknown> = { status: ourStatus };
        if (podpayEventId) updateData.podpay_event_id = podpayEventId;

        const { error } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', tx.id);

        if (error) {
          safeLog('Error updating transaction', { transactionId: tx.id, error: error.message });
        } else {
          safeLog('Transaction updated', { transactionId: tx.id, status: ourStatus });
        }
      }
    }

    // Fallback: update by product_id if no podpay_payment_id match
    if (!transactionId && externalRef) {
      const updateData: Record<string, unknown> = { status: ourStatus };
      if (podpayPaymentId) updateData.podpay_payment_id = podpayPaymentId;
      if (podpayEventId) updateData.podpay_event_id = podpayEventId;

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('product_id', externalRef)
        .eq('status', 'pending');

      if (error) {
        safeLog('Error updating transaction by product_id', { productId: externalRef, error: error.message });
      } else {
        safeLog('Transaction updated via product_id fallback', { productId: externalRef, status: ourStatus });
      }
    }

    // === Forward to user's webhook if configured ===
    const productId = externalRef;
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('user_id')
        .eq('id', productId)
        .single();

      if (product) {
        const { data: webhooks } = await supabase
          .from('webhook_configs')
          .select('*')
          .eq('user_id', product.user_id)
          .eq('is_active', true);

        if (webhooks) {
          for (const webhook of webhooks) {
            const eventType = `payment.${ourStatus}`;
            if (webhook.events.length === 0 || webhook.events.includes(eventType)) {
              try {
                await fetch(webhook.url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: eventType,
                    data: {
                      transaction_id: transactionId,
                      podpay_payment_id: podpayPaymentId,
                      status: ourStatus,
                      product_id: productId,
                    },
                    timestamp: new Date().toISOString(),
                  }),
                });
              } catch (e) {
                safeLog('Webhook dispatch error', { error: e instanceof Error ? e.message : 'unknown' });
              }
            }
          }
        }
      }
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

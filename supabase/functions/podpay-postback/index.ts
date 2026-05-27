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

/**
 * Auto-split: when a transaction completes, check if the product has an active
 * co-production and credit the co-producer's ledger with their share.
 */
async function processCoProductionSplit(supabase: any, transactionId: string) {
  try {
    const { data: tx } = await supabase
      .from('transactions')
      .select('id, product_id, net_amount, user_id')
      .eq('id', transactionId)
      .single();

    if (!tx?.product_id) return;

    // Check for active co-production on this product
    const { data: coProd } = await supabase
      .from('co_productions')
      .select('id, co_producer_user_id, split_percentage, owner_user_id')
      .eq('product_id', tx.product_id)
      .eq('status', 'accepted')
      .maybeSingle();

    if (!coProd || !coProd.co_producer_user_id) return;

    const splitAmount = Math.round(tx.net_amount * coProd.split_percentage) / 100;
    if (splitAmount <= 0) return;

    const idemKey = `split_${transactionId}_${coProd.id}`;

    const { data: existing } = await supabase
      .from('financial_ledger')
      .select('id')
      .eq('idempotency_key', idemKey)
      .maybeSingle();

    if (existing) return;

    const { data: balanceResult } = await supabase.rpc('get_ledger_balance', { _user_id: coProd.co_producer_user_id });
    const coProducerBalance = Number(balanceResult) || 0;

    await supabase.from('financial_ledger').insert({
      user_id: coProd.co_producer_user_id,
      transaction_id: transactionId,
      entry_type: 'credit',
      amount: splitAmount,
      balance_after: coProducerBalance + splitAmount,
      description: `Coprodução: ${coProd.split_percentage}% da venda`,
      idempotency_key: idemKey,
    });

    const { data: ownerBalance } = await supabase.rpc('get_ledger_balance', { _user_id: coProd.owner_user_id });
    const ownerBal = Number(ownerBalance) || 0;

    await supabase.from('financial_ledger').insert({
      user_id: coProd.owner_user_id,
      transaction_id: transactionId,
      entry_type: 'split_debit',
      amount: splitAmount,
      balance_after: ownerBal - splitAmount,
      description: `Split coprodução: ${coProd.split_percentage}% para co-produtor`,
      idempotency_key: `split_debit_${transactionId}_${coProd.id}`,
    });

    safeLog('Co-production split processed', { transactionId, status: `split ${coProd.split_percentage}%` });
  } catch (err) {
    safeLog('Co-production split error', { error: err instanceof Error ? err.message : 'unknown' });
  }
}

/**
 * Auto-split: when a transaction completes, check if the sale came through
 * an affiliate link and credit the affiliate's ledger with their commission.
 */
async function processAffiliateSplit(supabase: any, transactionId: string) {
  try {
    const { data: tx } = await supabase
      .from('transactions')
      .select('id, product_id, net_amount, user_id, amount, checkout_session_id')
      .eq('id', transactionId)
      .single();

    if (!tx?.product_id) return;

    // Check if an affiliate sale was already recorded for this transaction
    const { data: existingSale } = await supabase
      .from('affiliate_sales')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingSale) return; // Already processed

    // Find active affiliate links for this product
    const { data: affiliateLinks } = await supabase
      .from('affiliate_links')
      .select('id, affiliate_user_id, commission_pct, owner_user_id')
      .eq('product_id', tx.product_id)
      .eq('is_active', true);

    if (!affiliateLinks || affiliateLinks.length === 0) return;

    // For now, match the first active affiliate link for this product
    // In production, match via checkout_session_id or UTM tracking
    const link = affiliateLinks[0];
    if (link.owner_user_id !== tx.user_id) return; // Link must belong to the product owner

    const commissionAmount = Math.round(tx.amount * link.commission_pct) / 100;
    if (commissionAmount <= 0) return;

    const idemKey = `affiliate_${transactionId}_${link.id}`;

    const { data: existingLedger } = await supabase
      .from('financial_ledger')
      .select('id')
      .eq('idempotency_key', idemKey)
      .maybeSingle();

    if (existingLedger) return;

    // Record affiliate sale
    await supabase.from('affiliate_sales').insert({
      affiliate_link_id: link.id,
      affiliate_user_id: link.affiliate_user_id,
      seller_user_id: tx.user_id,
      product_id: tx.product_id,
      transaction_id: transactionId,
      sale_amount: tx.amount,
      commission_pct: link.commission_pct,
      commission_amount: commissionAmount,
      status: 'approved',
    });

    // Credit affiliate's ledger
    const { data: affBalance } = await supabase.rpc('get_ledger_balance', { _user_id: link.affiliate_user_id });
    const affiliateBalance = Number(affBalance) || 0;

    await supabase.from('financial_ledger').insert({
      user_id: link.affiliate_user_id,
      transaction_id: transactionId,
      entry_type: 'credit',
      amount: commissionAmount,
      balance_after: affiliateBalance + commissionAmount,
      description: `Comissão de afiliado: ${link.commission_pct}% da venda`,
      idempotency_key: idemKey,
    });

    // Debit seller
    const { data: sellerBal } = await supabase.rpc('get_ledger_balance', { _user_id: tx.user_id });
    const sellerBalance = Number(sellerBal) || 0;

    await supabase.from('financial_ledger').insert({
      user_id: tx.user_id,
      transaction_id: transactionId,
      entry_type: 'affiliate_debit',
      amount: commissionAmount,
      balance_after: sellerBalance - commissionAmount,
      description: `Comissão afiliado: ${link.commission_pct}%`,
      idempotency_key: `affiliate_debit_${transactionId}_${link.id}`,
    });

    safeLog('Affiliate split processed', { transactionId, status: `commission ${link.commission_pct}%` });
  } catch (err) {
    safeLog('Affiliate split error', { error: err instanceof Error ? err.message : 'unknown' });
  }
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
          // === AUTO SPLIT: process co-production split on completed payment ===
          if (ourStatus === 'completed') {
            await processCoProductionSplit(supabase, tx.id);
            await processAffiliateSplit(supabase, tx.id);
          }
        }
      }
    }

    // Fallback: update by product_id if no podpay_payment_id match
    // FIX: Use .order + .limit(1) to avoid updating multiple pending transactions
    if (!transactionId && externalRef) {
      const { data: pendingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('product_id', externalRef)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingTx) {
        const updateData: Record<string, unknown> = { status: ourStatus };
        if (podpayPaymentId) updateData.podpay_payment_id = podpayPaymentId;
        if (podpayEventId) updateData.podpay_event_id = podpayEventId;

        const { error } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', pendingTx.id);

        if (error) {
          safeLog('Error updating transaction by product_id', { productId: externalRef, error: error.message });
        } else {
          transactionId = pendingTx.id;
          safeLog('Transaction updated via product_id fallback', { transactionId: pendingTx.id, status: ourStatus });
        }
      }
    }

    // === Trigger central webhook dispatcher (queue-based with retries & HMAC) ===
    // Delivery rows are auto-created by the enqueue_webhook_on_tx_change trigger.
    // We just nudge the worker to flush the queue immediately.
    try {
      const dispatcherUrl = `${supabaseUrl}/functions/v1/webhook-dispatcher`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      // fire-and-forget
      fetch(dispatcherUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: '{}',
      }).catch(() => {});
    } catch (_e) {
      // never break postback on dispatcher hiccup
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

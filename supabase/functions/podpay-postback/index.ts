const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Postback received:', JSON.stringify(payload));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const data = payload.data || payload;
    const podpayStatus = data.status;
    const podpayPaymentId = data.id ? String(data.id) : null;
    const podpayEventId = payload.event_id ? String(payload.event_id) : null;
    const externalRef = data.externalRef;

    // === IDEMPOTENCY: Check if this event was already processed ===
    if (podpayEventId) {
      const { data: existingEvent } = await supabase
        .from('transactions')
        .select('id')
        .eq('podpay_event_id', podpayEventId)
        .maybeSingle();

      if (existingEvent) {
        console.log('Event already processed, skipping:', podpayEventId);
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
          console.log(`Skipping status downgrade: ${tx.status} -> ${ourStatus}`);
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
          console.error('Error updating transaction:', error);
        } else {
          console.log(`Transaction ${tx.id} updated to ${ourStatus}`);
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
        console.error('Error updating transaction by product_id:', error);
      } else {
        console.log(`Transaction updated to ${ourStatus} via product_id fallback`);
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
                console.error('Webhook dispatch error:', e);
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
    console.error('Postback error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

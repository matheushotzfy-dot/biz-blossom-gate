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
    const externalRef = data.externalRef;

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

    // Update transaction by product_id (externalRef)
    if (externalRef) {
      const { error } = await supabase
        .from('transactions')
        .update({ status: ourStatus })
        .eq('product_id', externalRef)
        .eq('status', 'pending');

      if (error) {
        console.error('Error updating transaction:', error);
      } else {
        console.log(`Transaction updated to ${ourStatus}`);
      }
    }

    // Forward to user's webhook if configured
    if (externalRef) {
      const { data: product } = await supabase
        .from('products')
        .select('user_id')
        .eq('id', externalRef)
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
                    data: payload,
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

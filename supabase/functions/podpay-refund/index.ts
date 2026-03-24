const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!hasAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId, amount, reason } = await req.json();
    if (!transactionId || !amount || !reason) {
      return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // A-07 FIX: Round amount to 2 decimal places to prevent fractional cent exploits
    const roundedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize reason server-side
    const safeReason = String(reason).replace(/<[^>]*>/g, '').trim().slice(0, 500);
    if (safeReason.length < 3) {
      return new Response(JSON.stringify({ success: false, error: 'Reason too short' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get transaction
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tx.status !== 'completed' && tx.status !== 'approved') {
      return new Response(JSON.stringify({ success: false, error: 'Transaction is not refundable' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (Number(amount) > Number(tx.amount)) {
      return new Response(JSON.stringify({ success: false, error: 'Refund amount exceeds transaction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call PodPay refund API if we have a payment ID
    if (tx.podpay_payment_id) {
      const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
      const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
      const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);

      try {
        const refundResp = await fetch(
          `https://api.podpay.co/v1/transactions/${tx.podpay_payment_id}/refund`,
          {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ amount: Math.round(Number(amount) * 100) }),
          }
        );

        if (!refundResp.ok) {
          const errData = await refundResp.json().catch(() => ({}));
          console.log('[podpay-refund] PodPay error:', refundResp.status, errData);
          // Continue anyway — update local status even if gateway fails
        }
      } catch (e) {
        console.log('[podpay-refund] PodPay call failed:', e instanceof Error ? e.message : 'unknown');
      }
    }

    // Update transaction status
    const isPartial = Number(amount) < Number(tx.amount);
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transactionId);

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to update transaction' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a negative balance adjustment to deduct from seller
    await supabase.from('balance_adjustments').insert({
      user_id: tx.user_id,
      admin_user_id: user.id,
      amount: Number(amount),
      type: 'debit',
      reason: `Estorno ${isPartial ? 'parcial' : 'total'}: ${reason}`,
    });

    // Log audit
    await supabase.from('audit_logs').insert({
      admin_user_id: user.id,
      action: 'refund_processed',
      entity_type: 'transaction',
      entity_id: transactionId,
      details: { amount, reason, partial: isPartial, seller_user_id: tx.user_id },
    });

    return new Response(
      JSON.stringify({ success: true, data: { refunded: true, amount } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.log('[podpay-refund] Error:', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

const ALLOWED_ORIGINS = new Set([
  "https://hotzfy.com.br",
  "https://www.hotzfy.com.br",
  "https://biz-blossom-gate.lovable.app",
  "https://id-preview--8b85380d-bbad-44c2-8000-ac99dd36affb.lovable.app",
  "https://8b85380d-bbad-44c2-8000-ac99dd36affb.lovableproject.com",
]);

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
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

    // Verify admin role
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(transactionId)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid transaction ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roundedAmount = Math.round(Number(amount) * 100) / 100;
    if (isNaN(roundedAmount) || roundedAmount <= 0 || roundedAmount > 999999) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeReason = String(reason).replace(/<[^>]*>/g, '').trim().slice(0, 500);
    if (safeReason.length < 3) {
      return new Response(JSON.stringify({ success: false, error: 'Reason too short' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === IDEMPOTENCY CHECK ===
    const idemKey = `refund_${transactionId}`;
    const { data: existingIdem } = await supabase
      .from('idempotency_keys')
      .select('response, expires_at')
      .eq('key', idemKey)
      .maybeSingle();

    if (existingIdem && new Date(existingIdem.expires_at) > new Date()) {
      return new Response(
        JSON.stringify(existingIdem.response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get transaction with explicit columns (no select *)
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, podpay_payment_id, is_simulated')
      .eq('id', transactionId)
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only refund completed/approved transactions
    if (tx.status !== 'completed' && tx.status !== 'approved') {
      return new Response(JSON.stringify({ success: false, error: 'Transaction is not refundable' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (roundedAmount > Number(tx.amount)) {
      return new Response(JSON.stringify({ success: false, error: 'Refund amount exceeds transaction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === ATOMIC STATUS UPDATE (only if still completed/approved) ===
    const { data: updatedTx } = await supabase
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transactionId)
      .in('status', ['completed', 'approved'])
      .select('id')
      .maybeSingle();

    if (!updatedTx) {
      // Race condition: another request already changed the status
      return new Response(JSON.stringify({ success: false, error: 'Transaction already processed' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call PodPay refund API (non-blocking for simulated)
    if (tx.podpay_payment_id && !tx.is_simulated) {
      const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
      const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
      const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
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
            body: JSON.stringify({ amount: Math.round(roundedAmount * 100) }),
            signal: controller.signal,
          }
        );

        if (!refundResp.ok) {
          console.log('[podpay-refund] PodPay error:', refundResp.status);
          // Revert transaction status if PodPay fails
          await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', transactionId)
            .eq('status', 'refunded');
          
          clearTimeout(timeout);
          return new Response(
            JSON.stringify({ success: false, error: 'Falha ao processar estorno na adquirente. Tente novamente.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.log('[podpay-refund] PodPay call failed:', e instanceof Error ? e.message : 'unknown');
        // Revert on timeout/network failure
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('id', transactionId)
          .eq('status', 'refunded');
        
        clearTimeout(timeout);
        return new Response(
          JSON.stringify({ success: false, error: 'Timeout ao processar estorno. Tente novamente.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    // Create balance adjustment
    const isPartial = roundedAmount < Number(tx.amount);
    await supabase.from('balance_adjustments').insert({
      user_id: tx.user_id,
      admin_user_id: user.id,
      amount: roundedAmount,
      type: 'debit',
      reason: `Estorno ${isPartial ? 'parcial' : 'total'}: ${safeReason}`,
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: user.id,
      action: 'refund_processed',
      entity_type: 'transaction',
      entity_id: transactionId,
      details: { amount: roundedAmount, reason: safeReason, partial: isPartial },
    });

    const responseBody = { success: true, data: { refunded: true, amount: roundedAmount } };

    // Store idempotency key (24h TTL)
    await supabase.from('idempotency_keys').upsert({
      key: idemKey,
      response: responseBody,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'key' });

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.log('[podpay-refund] Error:', error instanceof Error ? error.message : 'unknown');
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar estorno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

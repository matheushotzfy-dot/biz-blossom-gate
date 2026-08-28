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

    // Admins bypass permission checks; managers/employees need `transactions.refund`
    const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!hasAdmin) {
      const { data: canRefund } = await supabase.rpc('has_staff_permission', {
        _user_id: user.id, _key: 'transactions.refund',
      });
      if (!canRefund) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
    // Get transaction with explicit columns (no select *)
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, refunded_amount, podpay_payment_id, is_simulated, metadata')
      .eq('id', transactionId)
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['completed', 'approved', 'paid', 'partially_refunded'].includes(tx.status)) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction is not refundable' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentRefunded = Number(tx.refunded_amount || 0);
    const remainingAmount = Number(tx.amount) - currentRefunded;
    if (roundedAmount > remainingAmount) {
      return new Response(JSON.stringify({ success: false, error: 'Refund amount exceeds transaction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The cumulative amount makes retries idempotent while still allowing
    // multiple legitimate partial refunds for the same transaction.
    const targetRefunded = Math.round((currentRefunded + roundedAmount) * 100) / 100;
    const idemKey = `refund_${transactionId}_${targetRefunded.toFixed(2)}`;
    const { error: claimError } = await supabase.from('idempotency_keys').insert({
      key: idemKey,
      response: { success: false, processing: true },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (claimError) {
      const { data: existingIdem } = await supabase
        .from('idempotency_keys').select('response').eq('key', idemKey).maybeSingle();
      return new Response(JSON.stringify(existingIdem?.response || { success: false, error: 'Refund already processing' }), {
        status: existingIdem?.response && (existingIdem.response as Record<string, unknown>).success ? 200 : 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const txMetadata = tx.metadata && typeof tx.metadata === 'object'
      ? tx.metadata as Record<string, unknown>
      : {};
    const acquirer = String(txMetadata.acquirer || 'podpay').toLowerCase();

    if (tx.podpay_payment_id && !tx.is_simulated) {
      if (acquirer !== 'podpay') {
        return new Response(
          JSON.stringify({ success: false, error: 'Estorno automático ainda não está disponível para esta adquirente.' }),
          { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: podpayAcquirer } = await supabase
        .from('acquirers')
        .select('is_active')
        .eq('slug', 'podpay')
        .maybeSingle();

      if (podpayAcquirer?.is_active !== true) {
        return new Response(
          JSON.stringify({ success: false, error: 'PodPay está desativada no painel de adquirentes.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // The acquirer must confirm before local financial state changes.
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
          await supabase.from('idempotency_keys').delete().eq('key', idemKey);
          
          clearTimeout(timeout);
          return new Response(
            JSON.stringify({ success: false, error: 'Falha ao processar estorno na adquirente. Tente novamente.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.log('[podpay-refund] PodPay call failed:', e instanceof Error ? e.message : 'unknown');
        await supabase.from('idempotency_keys').delete().eq('key', idemKey);
        
        clearTimeout(timeout);
        return new Response(
          JSON.stringify({ success: false, error: 'Timeout ao processar estorno. Tente novamente.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    const isPartial = targetRefunded < Number(tx.amount);
    const { data: recorded, error: recordError } = await supabase.rpc('record_transaction_refund', {
      _transaction_id: transactionId,
      _amount: roundedAmount,
      _reason: safeReason,
      _admin_user_id: user.id,
    });
    if (recordError) {
      await supabase.from('idempotency_keys').delete().eq('key', idemKey);
      throw new Error(`Refund confirmed by acquirer but local reconciliation failed: ${recordError.message}`);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: user.id,
      action: 'refund_processed',
      entity_type: 'transaction',
      entity_id: transactionId,
      details: { amount: roundedAmount, reason: safeReason, partial: isPartial },
    });

    const responseBody = { success: true, data: { refunded: true, amount: roundedAmount, reconciliation: recorded } };

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

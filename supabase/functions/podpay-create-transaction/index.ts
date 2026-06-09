const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Log only safe fields — never PII, card data, or full payloads */
function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED_KEYS = ['transactionId', 'productId', 'status', 'amount', 'paymentMethod', 'podpayId', 'error', 'code', 'resumed'];
  for (const key of ALLOWED_KEYS) {
    if (key in context) safe[key] = context[key];
  }
  console.log(`[podpay-create-transaction] ${message}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      productId,
      paymentMethod,
      installments,
      customerName,
      customerEmail,
      customerDocument,
      customerPhone,
      cardToken,
      ip,
      checkoutSessionId,
      idempotencyKey,
      couponCode,
    } = body;


    if (!productId || !paymentMethod || !customerName || !customerEmail || !customerDocument) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX #65: Validate paymentMethod against allowed values
    const ALLOWED_METHODS = ['pix', 'credit_card', 'boleto'];
    if (!ALLOWED_METHODS.includes(paymentMethod)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payment method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX #66: Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX #67: Validate document (CPF 11 digits or CNPJ 14 digits)
    const cleanDoc = String(customerDocument).replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX #68: Sanitize string inputs (max lengths)
    const safeName = String(customerName).slice(0, 200).trim();
    const safeEmail = String(customerEmail).slice(0, 255).trim().toLowerCase();
    const safePhone = customerPhone ? String(customerPhone).replace(/\D/g, '').slice(0, 11) : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // === IDEMPOTENCY KEY CHECK (prevents duplicate payments from retries/replays) ===
    if (idempotencyKey) {
      const safeIdemKey = String(idempotencyKey).slice(0, 255);
      const { data: existingIdem } = await supabase
        .from('idempotency_keys')
        .select('response, expires_at')
        .eq('key', safeIdemKey)
        .maybeSingle();

      if (existingIdem && new Date(existingIdem.expires_at) > new Date()) {
        safeLog('Idempotent request - returning cached response', { productId });
        return new Response(
          JSON.stringify(existingIdem.response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === ANTI-FRAUD: Blacklist Check ===
    const requestIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    const { data: blCheck } = await supabase.rpc('check_blacklist', {
      _email: safeEmail,
      _document: cleanDoc,
      _ip: requestIp,
    });
    if (blCheck && blCheck.length > 0 && blCheck[0].blocked) {
      // Log to fraud_logs
      await supabase.from('fraud_logs').insert({
        block_type: 'blacklist',
        block_reason: blCheck[0].block_reason,
        matched_type: blCheck[0].matched_type,
        matched_value: blCheck[0].matched_value,
        customer_email: safeEmail,
        customer_document: cleanDoc,
        customer_ip: requestIp,
        product_id: productId,
      });
      safeLog('Blocked by blacklist', { productId });
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível processar o pagamento. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === ANTI-FRAUD: Velocity Checks ===
    const velocityChecks = ['ip_card_fail', 'ip_attempts', 'email_high_value'];
    for (const ruleType of velocityChecks) {
      const { data: velCheck } = await supabase.rpc('check_velocity', {
        _email: safeEmail,
        _ip: requestIp,
        _rule_type: ruleType,
      });
      if (velCheck && velCheck.length > 0 && velCheck[0].blocked) {
        await supabase.from('fraud_logs').insert({
          block_type: 'velocity',
          block_reason: velCheck[0].block_reason,
          customer_email: safeEmail,
          customer_document: cleanDoc,
          customer_ip: requestIp,
          product_id: productId,
          metadata: { rule_type: ruleType, attempt_count: velCheck[0].attempt_count },
        });
        safeLog('Blocked by velocity check', { productId });
        return new Response(
          JSON.stringify({ success: false, error: 'Não foi possível processar o pagamento. Tente novamente.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === IDEMPOTENCY: Check for existing pending transaction with same session ===
    if (checkoutSessionId) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('*')
        .eq('checkout_session_id', checkoutSessionId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing && existing.podpay_payment_id) {
        safeLog('Resuming existing pending transaction', { transactionId: existing.id, resumed: true });
        let pixData = null;
        let boletoData = null;
        try {
          const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
          const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
          const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);
          const txResp = await fetch(`https://api.podpay.co/v1/transactions/${existing.podpay_payment_id}`, {
            headers: { 'Authorization': auth, 'Accept': 'application/json' },
          });
          if (txResp.ok) {
            const txData = await txResp.json();
            pixData = txData.data?.pix || txData.pix || null;
            boletoData = txData.data?.boleto || txData.boleto || null;
          }
        } catch (e) {
          safeLog('Error fetching PodPay transaction', { error: e instanceof Error ? e.message : 'unknown' });
        }

        return new Response(
          JSON.stringify({
            success: true,
            resumed: true,
            data: {
              transactionId: existing.id,
              podpayId: existing.podpay_payment_id,
              status: 'pending',
              pix: pixData,
              boleto: boletoData,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === Get product ===
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, user_id, status')
      .eq('id', productId)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountInCents = Math.round(Number(product.price) * 100);

    // === Calculate fees from DB (payment-method-specific) ===
    const { data: fees, error: feesError } = await supabase.from('fees').select('*');
    if (feesError || !fees || fees.length === 0) {
      safeLog('Fee configuration missing', { error: feesError?.message || 'no fees found' });
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de taxas indisponível. Contate o suporte.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map payment method to fee names
    const feeNameMap: Record<string, string> = {
      pix: 'Taxa PIX',
      credit_card: 'Taxa Cartão',
      boleto: 'Taxa Boleto',
    };
    const methodFeeName = feeNameMap[paymentMethod] || 'Taxa PIX';
    const methodFee = fees.find(f => f.name === methodFeeName);
    const fixedFee = fees.find(f => f.name === 'Taxa Fixa por Transação' && f.fee_type === 'fixed');

    // Method-specific fee (percentage for pix/card, fixed for boleto)
    let feeAmount = 0;
    if (methodFee) {
      if (methodFee.fee_type === 'percentage') {
        feeAmount = Number(product.price) * Number(methodFee.value) / 100;
      } else {
        feeAmount = Number(methodFee.value);
      }
    }
    // Add fixed per-transaction fee if exists
    if (fixedFee) {
      feeAmount += Number(fixedFee.value);
    }

    // Validate fee range
    if (feeAmount < 0 || feeAmount >= Number(product.price)) {
      safeLog('Fee values out of safe range', { feeAmount, productPrice: product.price });
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na configuração de taxas. Contate o suporte.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    feeAmount = Math.round(feeAmount * 100) / 100;
    const netAmount = Math.round((Number(product.price) - feeAmount) * 100) / 100;

    // === Build PodPay payload ===
    const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
    const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
    const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);

    const podpayPayload: Record<string, unknown> = {
      amount: amountInCents,
      paymentMethod,
      items: [{
        externalRef: product.id,
        title: product.name,
        unitPrice: amountInCents,
        quantity: 1,
        tangible: false,
      }],
      customer: {
        name: safeName,
        email: safeEmail,
        document: {
          number: cleanDoc,
          type: cleanDoc.length > 11 ? 'cnpj' : 'cpf',
        },
      },
      postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
      externalRef: product.id,
      // FIX #69: Never trust client-provided IP — use request header
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0',
    };

    if (paymentMethod === 'credit_card') {
      podpayPayload.installments = installments || 1;
      if (cardToken) {
        podpayPayload.card = { id: cardToken };
      }
    }

    if (paymentMethod === 'pix') {
      podpayPayload.pix = { expiresInMinutes: 30 };
    }

    if (paymentMethod === 'boleto') {
      podpayPayload.boleto = { expiresInDays: 3 };
    }

    safeLog('Creating PodPay transaction', { productId: product.id, paymentMethod, amount: amountInCents });

    const controller = new AbortController();
    const podpayTimeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch('https://api.podpay.co/v1/transactions', {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(podpayPayload),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(podpayTimeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        safeLog('PodPay timeout after 15s', { productId: product.id });
        return new Response(
          JSON.stringify({ success: false, error: 'Processando pagamento. Aguarde e tente novamente.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(podpayTimeout);
    }

    const podpayData = await response.json();

    if (!response.ok) {
      safeLog('PodPay error', { status: response.status, error: podpayData.message || 'Payment failed' });
      // FIX #3: Never leak raw PodPay response to client
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível processar o pagamento. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const podpayId = podpayData.data?.id || podpayData.id;
    safeLog('PodPay transaction created', { podpayId, status: podpayData.data?.status || podpayData.status });

    // === Save transaction ===
    const { data: transaction, error: txError } = await supabase.from('transactions').insert({
      user_id: product.user_id,
      product_id: product.id,
      amount: Number(product.price),
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: 'pending',
      payment_method: paymentMethod,
      customer_name: safeName,
      customer_email: safeEmail,
      customer_document: cleanDoc,
      customer_phone: safePhone,
      podpay_payment_id: podpayId ? String(podpayId) : null,
      checkout_session_id: checkoutSessionId || null,
    }).select().single();

    if (txError) {
      safeLog('DB error saving transaction', { error: txError.message, code: txError.code });
      if (txError.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment already exists for this session' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const responseBody = {
      success: true,
      data: {
        transactionId: transaction?.id,
        podpayId,
        status: podpayData.data?.status || podpayData.status,
        pix: podpayData.data?.pix || podpayData.pix || null,
        boleto: podpayData.data?.boleto || podpayData.boleto || null,
        secureUrl: podpayData.data?.secureUrl || podpayData.secureUrl || null,
      },
    };

    // Store idempotency key for replay protection (24h TTL)
    if (idempotencyKey) {
      await supabase.from('idempotency_keys').upsert({
        key: String(idempotencyKey).slice(0, 255),
        response: responseBody,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'key' });
    }

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    safeLog('Internal error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar pagamento. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

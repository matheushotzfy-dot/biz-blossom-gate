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
    const {
      productId,
      paymentMethod,
      installments,
      customerName,
      customerEmail,
      customerDocument,
      cardToken,
      ip,
      checkoutSessionId,
    } = await req.json();

    if (!productId || !paymentMethod || !customerName || !customerEmail || !customerDocument) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // === IDEMPOTENCY: Check for existing pending transaction with same session ===
    if (checkoutSessionId) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('*')
        .eq('checkout_session_id', checkoutSessionId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing && existing.podpay_payment_id) {
        // Return existing payment data - don't create duplicate
        console.log('Returning existing pending transaction:', existing.id);
        return new Response(
          JSON.stringify({
            success: true,
            resumed: true,
            data: {
              transactionId: existing.id,
              podpayId: existing.podpay_payment_id,
              status: 'pending',
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // === Get product (price comes from DB, NEVER from frontend) ===
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
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

    // === Calculate fees from DB ===
    const { data: fees } = await supabase.from('fees').select('*');
    const percentageFee = fees?.find(f => f.name === 'Taxa por Transação' && f.fee_type === 'percentage');
    const fixedFee = fees?.find(f => f.name === 'Taxa Fixa por Transação' && f.fee_type === 'fixed');
    
    const feePercentage = percentageFee ? Number(percentageFee.value) : 4.99;
    const feeFixed = fixedFee ? Number(fixedFee.value) : 2.50;
    const feeAmount = (Number(product.price) * feePercentage / 100) + feeFixed;
    const netAmount = Number(product.price) - feeAmount;

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
        name: customerName,
        email: customerEmail,
        document: {
          number: customerDocument.replace(/\D/g, ''),
          type: customerDocument.replace(/\D/g, '').length > 11 ? 'cnpj' : 'cpf',
        },
      },
      postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
      externalRef: product.id,
      ip: ip || '0.0.0.0',
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

    console.log('Creating PodPay transaction:', JSON.stringify(podpayPayload));

    const response = await fetch('https://api.podpay.co/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(podpayPayload),
    });

    const podpayData = await response.json();

    if (!response.ok) {
      console.error('PodPay error:', JSON.stringify(podpayData));
      return new Response(
        JSON.stringify({ success: false, error: podpayData.message || 'Payment failed', details: podpayData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PodPay response:', JSON.stringify(podpayData));

    const podpayId = podpayData.data?.id || podpayData.id;

    // === Save transaction with idempotency keys ===
    const { data: transaction, error: txError } = await supabase.from('transactions').insert({
      user_id: product.user_id,
      product_id: product.id,
      amount: Number(product.price),
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: 'pending',
      payment_method: paymentMethod,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_document: customerDocument,
      podpay_payment_id: podpayId ? String(podpayId) : null,
      checkout_session_id: checkoutSessionId || null,
    }).select().single();

    if (txError) {
      console.error('DB error:', txError);
      // If it's a unique constraint violation, payment was already created
      if (txError.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment already exists for this session' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          transactionId: transaction?.id,
          podpayId,
          status: podpayData.data?.status || podpayData.status,
          pix: podpayData.data?.pix || podpayData.pix || null,
          boleto: podpayData.data?.boleto || podpayData.boleto || null,
          secureUrl: podpayData.data?.secureUrl || podpayData.secureUrl || null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

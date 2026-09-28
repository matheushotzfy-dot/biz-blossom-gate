import { computeFee, computeNet } from "../_shared/fees.ts";
const _baseCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientIp, buildCorsHeaders } from "../_shared/security.ts";
import { createVeopagDeposit, resolveAcquirerSlug } from "../_shared/veopag.ts";

/** Log only safe fields — never PII, card data, or full payloads */
function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED_KEYS = ['transactionId', 'productId', 'status', 'amount', 'paymentMethod', 'podpayId', 'error', 'code', 'resumed', 'acquirer', 'previousAcquirer'];
  for (const key of ALLOWED_KEYS) {
    if (key in context) safe[key] = context[key];
  }
  console.log(`[podpay-create-transaction] ${message}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  const corsHeaders = { ...buildCorsHeaders(req), "Access-Control-Allow-Headers": _baseCors["Access-Control-Allow-Headers"] };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== Rate limit: 20 tx/min por IP + 60 tx/min por email =====
    // Bloqueia bots que tentam gerar PIX em loop no checkout.
    const supabaseUrlRL = Deno.env.get("SUPABASE_URL")!;
    const serviceKeyRL = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rlAdmin = createClient(supabaseUrlRL, serviceKeyRL, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ip = clientIp(req);
    const bodyPreview = await req.clone().json().catch(() => ({}));
    const emailKey = String((bodyPreview as any)?.customerEmail ?? "").trim().toLowerCase() || "anon";
    const [ipRl, emailRl] = await Promise.all([
      rlAdmin.rpc("bump_rate_limit", { _bucket_key: `podpay_tx_ip:${ip}`, _window_seconds: 60, _max_count: 20 }),
      rlAdmin.rpc("bump_rate_limit", { _bucket_key: `podpay_tx_email:${emailKey}`, _window_seconds: 60, _max_count: 60 }),
    ]);
    const ipAllowed = Array.isArray(ipRl.data) ? (ipRl.data[0]?.allowed ?? true) : true;
    const emailAllowed = Array.isArray(emailRl.data) ? (emailRl.data[0]?.allowed ?? true) : true;
    if (!ipAllowed || !emailAllowed) {
      safeLog("Rate limited", { error: !ipAllowed ? "ip" : "email" });
      return new Response(
        JSON.stringify({ success: false, error: "Muitas tentativas. Aguarde um instante." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    const body = bodyPreview as Record<string, unknown>;
    const {
      productId,
      paymentMethod,
      installments,
      customerName,
      customerEmail,
      customerDocument,
      customerPhone,
      cardToken,
      checkoutSessionId,
      idempotencyKey,
      couponCode,
      affiliateSlug,
      selectedBumpIds,
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

    // === Get product ===
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, user_id, status, checkout_pix_enabled, checkout_boleto_enabled, checkout_credit_card_enabled')
      .eq('id', productId)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce GLOBAL payment-method toggles (platform-wide kill switch)
    try {
      const { data: toggles } = await supabase.rpc('get_global_payment_toggles');
      const g = Array.isArray(toggles) ? toggles[0] : toggles;
      const globallyOff =
        (paymentMethod === 'pix'         && g?.pix === false) ||
        (paymentMethod === 'credit_card' && g?.credit_card === false) ||
        (paymentMethod === 'boleto'      && g?.boleto === false);
      if (globallyOff) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este método de pagamento está temporariamente indisponível.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (_) { /* fail-open if RPC is missing so checkout doesn't break */ }

    // Enforce per-product payment method toggles (server-side authority)
    const methodAllowed =
      (paymentMethod === 'pix'         && product.checkout_pix_enabled !== false) ||
      (paymentMethod === 'credit_card' && product.checkout_credit_card_enabled !== false) ||
      (paymentMethod === 'boleto'      && product.checkout_boleto_enabled !== false);
    if (!methodAllowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Método de pagamento desabilitado para este produto' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const acquirerSlug = await resolveAcquirerSlug(supabase, product.user_id);

    // === IDEMPOTENCY: Check for existing pending transaction with same session ===
    // Must run after resolving the seller's current acquirer; otherwise an old
    // browser session created on PodPay keeps returning a stale PodPay charge
    // after the seller is moved to VeoPag.
    if (checkoutSessionId) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('*')
        .eq('checkout_session_id', checkoutSessionId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        const existingMetadata = (existing.metadata && typeof existing.metadata === 'object')
          ? existing.metadata as Record<string, unknown>
          : {};
        const existingAcquirer = String(existingMetadata.acquirer || 'podpay');
        const sameProduct = !existing.product_id || existing.product_id === product.id;

        if (!sameProduct || existingAcquirer !== acquirerSlug) {
          await supabase
            .from('transactions')
            .update({
              checkout_session_id: null,
              metadata: {
                ...existingMetadata,
                superseded_by_acquirer: acquirerSlug,
                superseded_at: new Date().toISOString(),
              },
            })
            .eq('id', existing.id);
          try {
            await supabase.rpc('log_transaction_event', {
              _transaction_id: existing.id,
              _event_type: 'acquirer_switched',
              _description: `Adquirente alterada: ${String(existingAcquirer).toUpperCase()} → ${acquirerSlug.toUpperCase()}`,
              _actor: 'system',
              _acquirer_slug: acquirerSlug,
              _visibility: 'public',
              _metadata: { from: existingAcquirer, to: acquirerSlug, reason: sameProduct ? 'acquirer_config_changed' : 'different_product' },
            });
          } catch (_e) { /* non-blocking */ }
          safeLog('Detached stale checkout session', {
            transactionId: existing.id,
            previousAcquirer: existingAcquirer,
            acquirer: acquirerSlug,
          });
        } else if (existing.podpay_payment_id) {
          safeLog('Resuming existing pending transaction', { transactionId: existing.id, resumed: true, acquirer: existingAcquirer });

          if (existingAcquirer === 'veopag') {
            const pixCode = existing.pix_copy_paste || existing.pix_qrcode || null;
            return new Response(
              JSON.stringify({
                success: true,
                resumed: true,
                data: {
                  transactionId: existing.id,
                  podpayId: existing.podpay_payment_id,
                  gatewayId: existing.podpay_payment_id,

                  status: 'pending',
                  pix: pixCode ? { qrcode: pixCode, expiresAt: existing.pix_expires_at || null } : null,
                  boleto: null,
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          let pixData = null;
          let boletoData = null;
          try {
            const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
            const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
            const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);
            const txResp = await fetch(`https://api.podpay.co/v1/transactions/${existing.podpay_payment_id}`, {
              headers: { 'Authorization': auth, 'Accept': 'application/json' },
              signal: AbortSignal.timeout(15000),
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
                gatewayId: existing.podpay_payment_id,

                status: 'pending',
                pix: pixData,
                boleto: boletoData,
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }


    // === Validate & apply coupon (server-authoritative) ===
    let couponId: string | null = null;
    let discountAmount = 0;
    let finalPrice = Number(product.price);
    if (couponCode && typeof couponCode === 'string' && couponCode.trim().length > 0) {
      const { data: cv, error: cvErr } = await supabase.rpc('validate_coupon', {
        _code: couponCode.trim(),
        _product_id: product.id,
        _amount: Number(product.price),
      });
      if (!cvErr && Array.isArray(cv) && cv[0]?.valid) {
        discountAmount = Math.round(Number(cv[0].discount_amount) * 100) / 100;
        couponId = cv[0].coupon_id;
        finalPrice = Math.round((Number(product.price) - discountAmount) * 100) / 100;
      }
    }

    // === Order bumps (server-authoritative) ===
    // Cliente só envia IDs; preço é SEMPRE buscado no banco e validado contra order_bumps ativas do produto.
    const validBumpIds: string[] = [];
    let bumpsTotal = 0;
    if (Array.isArray(selectedBumpIds) && selectedBumpIds.length > 0) {
      const cleanIds = Array.from(new Set(
        selectedBumpIds.filter((v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
      )) as string[];
      if (cleanIds.length > 0) {
        // Confirmar que cada bump_product_id pertence a uma order_bump ativa deste produto
        const { data: activeBumps } = await supabase
          .from('order_bumps')
          .select('bump_product_id')
          .eq('product_id', product.id)
          .eq('is_active', true)
          .in('bump_product_id', cleanIds);
        const allowedSet = new Set((activeBumps || []).map(b => b.bump_product_id));
        const allowedIds = cleanIds.filter(id => allowedSet.has(id));
        if (allowedIds.length > 0) {
          const { data: bumpProducts } = await supabase
            .from('products')
            .select('id, price')
            .in('id', allowedIds)
            .eq('status', 'active');
          for (const bp of bumpProducts || []) {
            validBumpIds.push(bp.id);
            bumpsTotal += Number(bp.price);
          }
        }
      }
    }
    bumpsTotal = Math.round(bumpsTotal * 100) / 100;
    finalPrice = Math.round((finalPrice + bumpsTotal) * 100) / 100;

    const amountInCents = Math.round(finalPrice * 100);


    // === Calculate fees: per-method, with custom_user_fees override ===
    const { data: fees, error: feesError } = await supabase.from('fees').select('*');
    if (feesError || !fees || fees.length === 0) {
      safeLog('Fee configuration missing', { error: feesError?.message || 'no fees found' });
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração de taxas indisponível. Contate o suporte.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Platform defaults from fees table
    const getFee = (name: string) => Number(fees.find(f => f.name === name)?.value ?? 0);
    const platformPixPct   = getFee('Taxa PIX');
    const platformPixFixed = getFee('Taxa Fixa PIX');
    const platformCardPct  = getFee('Taxa Cartão');
    const platformBoleto   = getFee('Taxa Boleto');
    const platformExtraFx  = getFee('Taxa Fixa por Transação');

    // Per-seller overrides
    const { data: cuf } = await supabase
      .from('custom_user_fees')
      .select('pix_percentage, pix_fixed, card_percentage, card_fixed, transaction_percentage, transaction_fixed')
      .eq('user_id', product.user_id)
      .maybeSingle();

    let pct = 0;
    let fixed = 0;
    if (paymentMethod === 'pix') {
      pct   = Number(cuf?.pix_percentage ?? cuf?.transaction_percentage ?? platformPixPct);
      fixed = Number(cuf?.pix_fixed      ?? platformPixFixed) + platformExtraFx;
    } else if (paymentMethod === 'credit_card') {
      pct   = Number(cuf?.card_percentage ?? cuf?.transaction_percentage ?? platformCardPct);
      fixed = Number(cuf?.card_fixed      ?? cuf?.transaction_fixed      ?? 0) + platformExtraFx;
    } else { // boleto
      pct   = 0;
      fixed = platformBoleto + platformExtraFx;
    }

    let feeAmount = computeFee(finalPrice, pct, fixed);
    if (feeAmount < 0 || feeAmount >= finalPrice) {
      safeLog('Fee values out of safe range', { feeAmount, productPrice: finalPrice });
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na configuração de taxas. Contate o suporte.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const netAmount = computeNet(finalPrice, feeAmount);


    // ===================================================================
    // === ACQUIRER ROUTING: VeoPag (PIX only) ============================
    // ===================================================================
    // Se o vendedor está roteado para VeoPag em seller_acquirer_config,
    // e o método é PIX, cria a cobrança lá em vez do PodPay. Nunca envia
    // nome/email/URL da plataforma — apenas nome + CPF reais do pagador.
    if (acquirerSlug === "veopag" && paymentMethod === "pix") {
      const preTxId = crypto.randomUUID();

      // Resolve afiliado (mesma regra do fluxo PodPay).
      let resolvedAffiliateLinkId: string | null = null;
      if (affiliateSlug && typeof affiliateSlug === "string") {
        const cleanSlug = affiliateSlug.trim().slice(0, 64);
        if (cleanSlug) {
          const { data: affLink } = await supabase
            .from("affiliate_links")
            .select("id")
            .eq("slug", cleanSlug)
            .eq("product_id", product.id)
            .eq("owner_user_id", product.user_id)
            .eq("is_active", true)
            .maybeSingle();
          if (affLink?.id) resolvedAffiliateLinkId = affLink.id;
        }
      }

      let veo;
      try {
        veo = await createVeopagDeposit({
          amount: finalPrice,
          externalId: preTxId,
          payerName: safeName,
          payerDocument: cleanDoc,
          payerPhone: safePhone,
        }, supabase);
      } catch (e) {
        safeLog("VeoPag error", { error: e instanceof Error ? e.message : "unknown" });
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível processar o pagamento. Tente novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          id: preTxId,
          user_id: product.user_id,
          product_id: product.id,
          amount: finalPrice,
          fee_amount: feeAmount,
          net_amount: netAmount,
          status: "pending",
          payment_method: "pix",
          customer_name: safeName,
          customer_email: safeEmail,
          customer_document: cleanDoc,
          customer_phone: safePhone,
          buyer_ip: requestIp,
          podpay_payment_id: veo.transactionId,
          external_id: preTxId,
          checkout_session_id: checkoutSessionId || null,
          coupon_id: couponId,
          discount_amount: discountAmount,
          affiliate_link_id: resolvedAffiliateLinkId,
          pix_expires_at: pixExpiresAt,
          pix_copy_paste: veo.qrcode,
          pix_qrcode: veo.qrcode,
          metadata: {
            acquirer: "veopag",
            ...(validBumpIds.length > 0
              ? { bump_product_ids: validBumpIds, bumps_total: bumpsTotal }
              : {}),
          },
        })
        .select()
        .single();

      if (txError || !transaction) {
        safeLog("DB error saving veopag tx", { error: txError?.message, code: txError?.code });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Falha ao registrar a transação. Se o pagamento foi debitado, contate o suporte.",
            reconciliation: { veopagId: veo.transactionId, needs_manual_review: true },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const responseBody = {
        success: true,
        data: {
          transactionId: transaction.id,
          podpayId: veo.transactionId, // reusa o campo esperado pelo frontend
          gatewayId: veo.transactionId,

          status: "pending",
          pix: { qrcode: veo.qrcode, expiresAt: pixExpiresAt },
          boleto: null,
          secureUrl: null,
        },
      };

      if (idempotencyKey) {
        await supabase.from("idempotency_keys").upsert({
          key: String(idempotencyKey).slice(0, 255),
          response: responseBody,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "key" });
      }

      safeLog("VeoPag PIX created", { transactionId: transaction.id });
      return new Response(
        JSON.stringify(responseBody),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (acquirerSlug !== "podpay") {
      safeLog("Unsupported acquirer/payment method combination", { acquirer: acquirerSlug, paymentMethod });
      return new Response(
        JSON.stringify({ success: false, error: "Método de pagamento indisponível para a adquirente configurada." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===================================================================
    // === Fim do desvio VeoPag — abaixo segue o fluxo PodPay normal =====
    // ===================================================================


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
        signal: AbortSignal.timeout(15000),
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

    // Resolve afiliado (se houver) — só aceita link ativo do mesmo produto/vendedor
    let resolvedAffiliateLinkId: string | null = null;
    if (affiliateSlug && typeof affiliateSlug === 'string') {
      const cleanSlug = affiliateSlug.trim().slice(0, 64);
      if (cleanSlug) {
        const { data: affLink } = await supabase
          .from('affiliate_links')
          .select('id')
          .eq('slug', cleanSlug)
          .eq('product_id', product.id)
          .eq('owner_user_id', product.user_id)
          .eq('is_active', true)
          .maybeSingle();
        if (affLink?.id) resolvedAffiliateLinkId = affLink.id;
      }
    }

    // === Save transaction ===
    // Resolve pix_expires_at — prefer PodPay response, fallback to now()+30min for PIX
    let pixExpiresAt: string | null = null;
    if (paymentMethod === 'pix') {
      const podpayPixExp =
        podpayData.data?.pix?.expiresAt ||
        podpayData.pix?.expiresAt ||
        podpayData.data?.pix?.expires_at ||
        podpayData.pix?.expires_at ||
        null;
      pixExpiresAt = podpayPixExp
        ? new Date(podpayPixExp).toISOString()
        : new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }

    const { data: transaction, error: txError } = await supabase.from('transactions').insert({
      user_id: product.user_id,
      product_id: product.id,
      amount: finalPrice,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: 'pending',
      payment_method: paymentMethod,
      customer_name: safeName,
      customer_email: safeEmail,
      customer_document: cleanDoc,
      customer_phone: safePhone,
      buyer_ip: requestIp,
      podpay_payment_id: podpayId ? String(podpayId) : null,
      checkout_session_id: checkoutSessionId || null,
      coupon_id: couponId,
      discount_amount: discountAmount,
      affiliate_link_id: resolvedAffiliateLinkId,
      pix_expires_at: pixExpiresAt,
      metadata: validBumpIds.length > 0
        ? { acquirer: 'podpay', bump_product_ids: validBumpIds, bumps_total: bumpsTotal }
        : { acquirer: 'podpay' },
    }).select().single();


    if (txError || !transaction) {
      safeLog('DB error saving transaction', { error: txError?.message, code: txError?.code, podpayId });
      if (txError?.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment already exists for this session' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // CRITICAL: PodPay charge already created but we failed to persist locally.
      // Fail loud so the customer/admin knows to reconcile; do NOT return success
      // (previously fell through with transactionId: undefined => unreconcilable funds).
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Falha ao registrar a transação. Se o pagamento foi debitado, entre em contato com o suporte.',
          reconciliation: { podpayId, needs_manual_review: true },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseBody = {
      success: true,
      data: {
        transactionId: transaction?.id,
        podpayId,
        gatewayId: podpayId,

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

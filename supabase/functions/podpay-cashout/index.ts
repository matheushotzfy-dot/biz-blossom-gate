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

  try {
    // Only admin can trigger cash-out
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { withdrawalId } = await req.json();

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ success: false, error: 'withdrawalId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get withdrawal details
    const { data: withdrawal, error: wError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (wError || !withdrawal) {
      return new Response(
        JSON.stringify({ success: false, error: 'Withdrawal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IDEMPOTENCY: Only process pending withdrawals (atomic check)
    if (withdrawal.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: true, message: `Already ${withdrawal.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Double-check with idempotency key
    const idemKey = `cashout_${withdrawalId}`;
    const { data: existingIdem } = await supabase
      .from('idempotency_keys')
      .select('response')
      .eq('key', idemKey)
      .maybeSingle();

    if (existingIdem) {
      return new Response(
        JSON.stringify(existingIdem.response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's PIX key from profile (encrypted at rest — decrypt via RPC)
    const { data: profile } = await supabase
      .from('profiles')
      .select('pix_key_enc, pix_key_type, full_name')
      .eq('user_id', withdrawal.user_id)
      .single();

    let decryptedPixKey: string | null = null;
    if (profile?.pix_key_enc) {
      const { data: decrypted } = await supabase.rpc('decrypt_field', { _cipher: profile.pix_key_enc });
      decryptedPixKey = decrypted as string | null;
    }

    if (!decryptedPixKey || !profile?.pix_key_type) {
      await supabase.from('withdrawals').update({
        failure_code: 'pix_key_missing',
        rejection_reason: 'Usuário não possui chave PIX cadastrada',
        last_attempt_at: new Date().toISOString(),
      }).eq('id', withdrawalId);
      return new Response(
        JSON.stringify({ success: false, error: 'User has no PIX key configured', failure_code: 'pix_key_missing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountInCents = Math.round(Number(withdrawal.net_amount) * 100);

    const publicKey = Deno.env.get('PODPAY_PUBLIC_KEY')!;
    const secretKey = Deno.env.get('PODPAY_SECRET_KEY')!;
    const withdrawKey = Deno.env.get('PODPAY_WITHDRAW_KEY')!;
    const auth = 'Basic ' + btoa(publicKey + ':' + secretKey);

    // Map pix_key_type to PodPay format
    const pixKeyTypeMap: Record<string, string> = {
      'cpf': 'cpf',
      'cnpj': 'cnpj',
      'email': 'email',
      'telefone': 'phone',
      'phone': 'phone',
      'aleatoria': 'random',
      'random': 'random',
    };

    // Add timeout to PodPay API call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch('https://api.podpay.co/v1/transfers', {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-withdraw-key': withdrawKey,
        },
        body: JSON.stringify({
          method: 'pix',
          amount: amountInCents,
          netPayout: false,
          pixKey: decryptedPixKey,
          pixKeyType: pixKeyTypeMap[profile.pix_key_type.toLowerCase()] || 'cpf',
          postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('PodPay cashout timeout after 15s');
        return new Response(
          JSON.stringify({ success: false, error: 'Timeout ao processar saque. Tente novamente.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    const podpayData = await response.json();

    if (!response.ok) {
      console.error('PodPay cashout error:', JSON.stringify({ status: response.status }));
      // FIX #52: Never leak raw PodPay error messages
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar saque. Tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update withdrawal status atomically (only if still pending)
    const { data: updatedW } = await supabase
      .from('withdrawals')
      .update({ status: 'approved', processed_at: new Date().toISOString() })
      .eq('id', withdrawalId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!updatedW) {
      // Race condition: another request already processed it
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed by another request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cashoutResponse = { success: true, message: 'Cash-out processed successfully', withdrawalId };

    // Store idempotency key
    await supabase.from('idempotency_keys').upsert({
      key: idemKey,
      response: cashoutResponse,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'key' });

    return new Response(
      JSON.stringify(cashoutResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cashout error:', error instanceof Error ? error.message : 'unknown');
    // FIX #53: Never leak internal error details
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao processar saque' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

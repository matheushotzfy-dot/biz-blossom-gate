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

    // IDEMPOTENCY: Only process pending withdrawals
    if (withdrawal.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: true, message: `Already ${withdrawal.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's PIX key from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('pix_key, pix_key_type, full_name')
      .eq('user_id', withdrawal.user_id)
      .single();

    if (!profile?.pix_key || !profile?.pix_key_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'User has no PIX key configured' }),
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
          pixKey: profile.pix_key,
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
      console.error('PodPay cashout error:', JSON.stringify({ status: response.status, message: podpayData?.message || 'unknown' }));
      return new Response(
        JSON.stringify({ success: false, error: podpayData.message || 'Cash-out failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update withdrawal status
    await supabase
      .from('withdrawals')
      .update({ status: 'approved', processed_at: new Date().toISOString() })
      .eq('id', withdrawalId)
      .eq('status', 'pending'); // Extra safety: only update if still pending

    // FIX #4: Never leak raw PodPay response to admin client
    return new Response(
      JSON.stringify({ success: true, message: 'Cash-out processed successfully', withdrawalId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cashout error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

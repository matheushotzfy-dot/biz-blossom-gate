import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/security.ts";


function generateKey(prefix: string, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let result = prefix;
  for (const val of values) {
    result += chars[val % chars.length];
  }
  return result;
}

async function hmacKey(key: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(key));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  // CORS restrito à allowlist do projeto (endpoint autenticado de browser).
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKeyPepper = Deno.env.get('API_KEY_PEPPER');
    if (!supabaseUrl || !supabaseKey || !serviceRoleKey || !apiKeyPepper) {
      return new Response(JSON.stringify({ error: 'Serviço indisponível' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create';

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: rateRows, error: rateError } = await serviceClient.rpc('bump_rate_limit', {
      _bucket_key: `api_key_management:${user.id}`,
      _window_seconds: 600,
      _max_count: 20,
    });
    const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    if (rateError || rateRow?.allowed !== true) {
      return new Response(JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const name = String(body.name || 'Chave API').slice(0, 100).trim();
      
      const publicKey = generateKey('pk_live_', 32);
      const secretKey = generateKey('sk_live_', 48);
      const secretKeyHash = await hmacKey(secretKey, apiKeyPepper);
      const secretKeyPrefix = secretKey.slice(0, 12);

      const { data, error } = await serviceClient.from('api_keys').insert({
        user_id: user.id,
        name,
        public_key: publicKey,
        secret_key_hash: secretKeyHash,
        secret_key_prefix: secretKeyPrefix,
        hash_version: 'hmac-sha256',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('id, name, public_key, secret_key_prefix, is_active, expires_at, created_at').single();

      if (error) {
        const msg = error.message?.includes('Limite') ? error.message : 'Erro ao criar chave';
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return secret key ONLY on creation (never stored in plaintext)
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...data,
            secret_key: secretKey, // Only shown once!
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'rename') {
      const keyId = body.keyId;
      const name = String(body.name || '').slice(0, 100).trim();
      if (!keyId || !name) {
        return new Response(
          JSON.stringify({ error: 'keyId e nome são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { error } = await supabase.from('api_keys')
        .update({ name })
        .eq('id', keyId)
        .eq('user_id', user.id);
      if (error) {
        return new Response(
          JSON.stringify({ error: 'Erro ao renomear chave' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    if (action === 'delete') {
      const keyId = body.keyId;
      if (!keyId) {
        return new Response(
          JSON.stringify({ error: 'keyId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase.from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', user.id);

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar chave' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

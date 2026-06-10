const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
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

    if (action === 'create') {
      const name = String(body.name || 'Chave API').slice(0, 100).trim();
      
      const publicKey = generateKey('pk_live_', 32);
      const secretKey = generateKey('sk_live_', 48);
      const secretKeyHash = await hashKey(secretKey);
      const secretKeyPrefix = secretKey.slice(0, 12);

      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data, error } = await serviceClient.from('api_keys').insert({
        user_id: user.id,
        name,
        public_key: publicKey,
        secret_key_hash: secretKeyHash,
        secret_key_prefix: secretKeyPrefix,
      }).select('id, name, public_key, secret_key_prefix, is_active, created_at').single();

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Brazilian first/last names for realistic data
const FIRST_NAMES = [
  "Lucas","Maria","João","Ana","Pedro","Julia","Carlos","Fernanda","Rafael","Mariana",
  "Gabriel","Camila","Felipe","Larissa","Matheus","Beatriz","Bruno","Amanda","Diego","Letícia",
  "Thiago","Isabela","André","Juliana","Rodrigo","Bruna","Gustavo","Natália","Leonardo","Aline",
  "Vinícius","Patrícia","Marcos","Vanessa","Eduardo","Daniela","Daniel","Carolina","Henrique","Tatiana",
  "Luiz","Raquel","Marcelo","Sandra","Alexandre","Renata","Ricardo","Adriana","Fernando","Luana",
];
const LAST_NAMES = [
  "Silva","Santos","Oliveira","Souza","Rodrigues","Ferreira","Alves","Pereira","Lima","Gomes",
  "Costa","Ribeiro","Martins","Carvalho","Araújo","Melo","Barbosa","Cardoso","Nascimento","Correia",
  "Vieira","Dias","Campos","Batista","Rocha","Franco","Teixeira","Moura","Pinto","Monteiro",
];
const DOMAINS = ["gmail.com","hotmail.com","outlook.com","yahoo.com.br","icloud.com","live.com"];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomCPF(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}
function randomPhone(): string {
  const ddd = [11,21,31,41,51,61,71,81,85,27,19,13,47,48,62,79,84,86,92,65][Math.floor(Math.random()*20)];
  const n = () => Math.floor(Math.random() * 10);
  return `(${ddd}) 9${n()}${n()}${n()}${n()}-${n()}${n()}${n()}${n()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ============================================================
    // FIX #1: REQUIRE ADMIN AUTHENTICATION
    // ============================================================
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

    // Verify the caller is an admin
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

    // ============================================================
    // FIX #2: Read config from request body instead of hardcoding
    // ============================================================
    const body = await req.json().catch(() => ({}));
    const PRODUCT_ID = body.productId;
    const USER_ID = body.userId;

    if (!PRODUCT_ID || !USER_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'productId and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the product exists
    const { data: product } = await supabase.from('products').select('id, price, name').eq('id', PRODUCT_ID).single();
    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AMOUNT = Number(product.price);
    
    // Get fees from DB instead of hardcoding
    const { data: fees } = await supabase.from('fees').select('name, fee_type, value');
    const percentageFee = fees?.find(f => f.name === 'Taxa PIX' && f.fee_type === 'percentage');
    const fixedFee = fees?.find(f => f.name === 'Taxa Fixa por Transação' && f.fee_type === 'fixed');
    const FEE_PCT = percentageFee ? Number(percentageFee.value) : 1.99;
    const FEE_FIXED = fixedFee ? Number(fixedFee.value) : 2.50;
    const FEE_AMOUNT = Number(((AMOUNT * FEE_PCT / 100) + FEE_FIXED).toFixed(2));
    const NET_AMOUNT = Number((AMOUNT - FEE_AMOUNT).toFixed(2));
    const TOTAL = Math.min(body.total || 100, 1000); // Cap at 1000

    // Generate timestamps spread over the specified number of days (default: current month)
    const spreadDays = Math.min(body.spreadDays || 30, 60);
    const now = Date.now();
    const spreadMs = spreadDays * 24 * 60 * 60 * 1000;
    const launchStart = now - spreadMs;

    const transactions = [];
    const completedIndices: number[] = [];

    for (let i = 0; i < TOTAL; i++) {
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const emailName = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random()*999)}`;
      const email = `${emailName}@${randomFrom(DOMAINS)}`;
      
      const progress = i / TOTAL;
      const timeOffset = Math.pow(progress, 0.6) * spreadMs;
      const createdAt = new Date(launchStart + timeOffset + Math.random() * 3600000).toISOString();

      const roll = Math.random();
      let status: string;
      if (roll < 0.65) { status = "completed"; completedIndices.push(i); }
      else if (roll < 0.85) { status = "pending"; }
      else if (roll < 0.93) { status = "failed"; }
      else if (roll < 0.98) { status = "expired"; }
      else { status = "refunded"; }

      transactions.push({
        user_id: USER_ID,
        product_id: PRODUCT_ID,
        amount: AMOUNT,
        fee_amount: FEE_AMOUNT,
        net_amount: NET_AMOUNT,
        status,
        payment_method: "pix",
        customer_name: name,
        customer_email: email,
        customer_document: randomCPF(),
        customer_phone: randomPhone(),
        created_at: createdAt,
        is_simulated: true,
      });
    }

    // Insert in batches of 50
    let inserted = 0;
    const BATCH = 50;
    for (let b = 0; b < transactions.length; b += BATCH) {
      const batch = transactions.slice(b, b + BATCH);
      const { error } = await supabase.from("transactions").insert(batch);
      if (error) {
        console.error(`Batch ${b / BATCH} error:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    // FIX #2: Removed hardcoded Pushcut notification URL
    // Push notifications should be configured via platform_settings if needed

    return new Response(
      JSON.stringify({
        success: true,
        total_inserted: inserted,
        completed: completedIndices.length,
        pending: transactions.filter(t => t.status === "pending").length,
        failed: transactions.filter(t => t.status === "failed").length,
        expired: transactions.filter(t => t.status === "expired").length,
        refunded: transactions.filter(t => t.status === "refunded").length,
        volume: `R$ ${(completedIndices.length * NET_AMOUNT).toFixed(2)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Simulation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

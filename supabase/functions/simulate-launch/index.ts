const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const PRODUCT_ID = "53bc5dd0-6be0-4250-828c-39d75830d63a";
    const USER_ID = "823af613-c733-4962-96a4-2cca03ef56ed";
    const AMOUNT = 147.99;
    const FEE_PCT = 4.99;
    const FEE_FIXED = 2.50;
    const FEE_AMOUNT = Number(((AMOUNT * FEE_PCT / 100) + FEE_FIXED).toFixed(2));
    const NET_AMOUNT = Number((AMOUNT - FEE_AMOUNT).toFixed(2));
    const PUSHCUT_URL = "https://api.pushcut.io/r6g7W1YTIq9uPzgx4OtiC/notifications/Venda%20realizada%F0%9F%92%B8";
    const TOTAL = 500;

    // Generate timestamps spread over last 3 hours to simulate a real launch
    const now = Date.now();
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const launchStart = now - threeHoursMs;

    // Build all 500 transactions
    const transactions = [];
    const completedIndices: number[] = [];

    for (let i = 0; i < TOTAL; i++) {
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const emailName = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random()*999)}`;
      const email = `${emailName}@${randomFrom(DOMAINS)}`;
      
      // Spread timestamps: more dense at start (launch rush), then thinning out
      const progress = i / TOTAL;
      // Use exponential curve — more sales early in the launch
      const timeOffset = Math.pow(progress, 0.6) * threeHoursMs;
      const createdAt = new Date(launchStart + timeOffset + Math.random() * 30000).toISOString();

      // Status distribution: ~65% completed, ~20% pending, ~8% failed, ~5% expired, ~2% refunded
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

    // Send pushcut notifications for completed transactions (batch — max 50 to avoid timeout)
    let notifSent = 0;
    const completedToNotify = completedIndices.slice(0, 80); // limit to avoid timeout
    
    const notifPromises = completedToNotify.map(async (idx) => {
      try {
        const tx = transactions[idx];
        await fetch(PUSHCUT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `💰 R$ ${AMOUNT.toFixed(2)} — ${tx.customer_name} via PIX`,
          }),
        });
        notifSent++;
      } catch (_) { /* silent */ }
    });

    // Run notifications in chunks of 10 to avoid overwhelming
    for (let c = 0; c < notifPromises.length; c += 10) {
      await Promise.all(notifPromises.slice(c, c + 10));
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_inserted: inserted,
        completed: completedIndices.length,
        pending: transactions.filter(t => t.status === "pending").length,
        failed: transactions.filter(t => t.status === "failed").length,
        expired: transactions.filter(t => t.status === "expired").length,
        refunded: transactions.filter(t => t.status === "refunded").length,
        notifications_sent: notifSent,
        volume: `R$ ${(completedIndices.length * NET_AMOUNT).toFixed(2)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Simulation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

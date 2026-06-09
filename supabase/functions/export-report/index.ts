import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { authorization: authHeader } } });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const reportType = url.searchParams.get("type") || "extrato";
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Fetch profile
    const { data: profile } = await supabase.from("profiles").select("full_name, email, document_number").eq("user_id", user.id).single();

    // Fetch transactions
    const { data: transactions } = await supabase.from("transactions").select("*").eq("user_id", user.id).gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false });

    // Fetch withdrawals
    const { data: withdrawals } = await supabase.from("withdrawals").select("*").eq("user_id", user.id).gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: false });

    const txs = transactions || [];
    const wds = withdrawals || [];
    
    const totalSales = txs.filter(t => t.status === "completed").reduce((a, t) => a + t.amount, 0);
    const totalFees = txs.filter(t => t.status === "completed").reduce((a, t) => a + t.fee_amount, 0);
    const totalNet = txs.filter(t => t.status === "completed").reduce((a, t) => a + t.net_amount, 0);
    const totalWithdrawn = wds.filter(w => w.status === "approved").reduce((a, w) => a + w.amount, 0);

    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const monthName = monthNames[month - 1];

    const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Generate CSV
    let csv = `Extrato Mensal - ${monthName} ${year}\n`;
    csv += `Vendedor: ${profile?.full_name || "—"}\n`;
    csv += `Email: ${profile?.email || "—"}\n`;
    csv += `Documento: ${profile?.document_number || "—"}\n\n`;
    
    csv += `RESUMO\n`;
    csv += `Total Vendas,${fmt(totalSales)}\n`;
    csv += `Total Taxas,${fmt(totalFees)}\n`;
    csv += `Total Líquido,${fmt(totalNet)}\n`;
    csv += `Total Sacado,${fmt(totalWithdrawn)}\n`;
    csv += `Transações,${txs.length}\n\n`;

    csv += `TRANSAÇÕES\n`;
    csv += `Data,Cliente,Método,Valor,Taxa,Líquido,Status\n`;
    txs.forEach(t => {
      csv += `${fmtDate(t.created_at)},${(t.customer_name || "—").replace(/,/g, " ")},${t.payment_method || "—"},${fmt(t.amount)},${fmt(t.fee_amount)},${fmt(t.net_amount)},${t.status}\n`;
    });

    if (wds.length > 0) {
      csv += `\nSAQUES\n`;
      csv += `Data,Valor,Taxa,Líquido,Status\n`;
      wds.forEach(w => {
        csv += `${fmtDate(w.created_at)},${fmt(w.amount)},${fmt(w.fee_amount)},${fmt(w.net_amount)},${w.status}\n`;
      });
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="extrato_${monthName.toLowerCase()}_${year}.csv"`,
      },
    });
  } catch (err) {
    console.error("[export-report] Internal error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

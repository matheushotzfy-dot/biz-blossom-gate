// Kill switches globais controlados pelo admin (tabela platform_settings).
// Motivação: permitir parar a emissão de cobranças na plataforma inteira sem deploy.
//
// Chave: platform_settings.key = 'kill_switches'
// Valor: { "payments": boolean, "withdrawals": boolean }
//
// Regra de segurança: fail-OPEN em erro de infraestrutura (não derrubar vendas
// por indisponibilidade de leitura), fail-CLOSED apenas quando o flag existe e é true.

export interface KillSwitches {
  payments: boolean;
  withdrawals: boolean;
}

interface MinimalClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { value: unknown } | null; error: unknown }>;
      };
    };
  };
}

export async function getKillSwitches(supabase: MinimalClient): Promise<KillSwitches> {
  const fallback: KillSwitches = { payments: false, withdrawals: false };
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "kill_switches")
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== "object") return fallback;
    const v = data.value as Record<string, unknown>;
    return {
      payments: v.payments === true,
      withdrawals: v.withdrawals === true,
    };
  } catch (_e) {
    return fallback;
  }
}

/** Retorna uma Response 503 quando pagamentos estão pausados; caso contrário null. */
export async function blockIfPaymentsPaused(
  supabase: MinimalClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const flags = await getKillSwitches(supabase);
  if (!flags.payments) return null;
  return new Response(
    JSON.stringify({
      success: false,
      error: "Pagamentos temporariamente indisponíveis. Tente novamente em instantes.",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "120" } },
  );
}

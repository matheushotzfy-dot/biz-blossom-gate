import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { SELLER_SEARCH_MIN, parseSellers, type SellerHit } from "@/features/admin-referrals/referralsModel";
import { friendlyError } from "@/lib/friendlyError";

/** Escolhe um seller por nome ou e-mail. A busca roda no servidor (`admin_search_sellers`), nunca numa lista carregada. */
export function SellerPicker({ id, value, onChange, error }: { id: string; value: SellerHit | null; onChange: (s: SellerHit | null) => void; error?: string | null }) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim());
  const ready = debounced.length >= SELLER_SEARCH_MIN;
  const sq = useQuery({
    queryKey: ["admin-seller-search", debounced],
    enabled: ready && !value,
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc("admin_search_sellers" as never, { _query: debounced } as never);
      if (e) throw e;
      return parseSellers(data);
    },
  });
  const hits = sq.data ?? [];

  if (value) {
    return (
      <div>
        <FieldLabel>Seller</FieldLabel>
        <div className="flex items-start justify-between gap-3 rounded-[16px] bg-accent/60 p-4 shadow-[inset_0_0_0_1px_hsl(var(--primary)/.35)]">
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold text-foreground">{value.name}</p>
            {value.email && <p className="truncate text-[13px] text-muted-foreground">{value.email}</p>}
          </div>
          <button type="button" onClick={() => { onChange(null); setTerm(""); }} className="vp-ghost shrink-0 !h-9 px-3 text-[13px]">Trocar</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <FieldLabel htmlFor={id}>Seller</FieldLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input id={id} className="vp-field" style={{ paddingLeft: 42 }} autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Nome ou e-mail do seller" aria-describedby={`${id}-msg`} aria-invalid={!!error} />
      </div>
      <div id={`${id}-msg`} aria-live="polite">
        {!ready && !error && <FieldHint>Digite pelo menos {SELLER_SEARCH_MIN} letras.</FieldHint>}
        {ready && sq.isFetching && <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Procurando…</p>}
        {ready && sq.isError && !sq.isFetching && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
            {friendlyError(sq.error, "Não foi possível buscar os sellers.")} <button type="button" className="underline" onClick={() => void sq.refetch()}>Tentar de novo</button>
          </p>
        )}
        {ready && !sq.isFetching && !sq.isError && sq.data && hits.length === 0 && <FieldHint>Nenhuma conta encontrada para “{debounced}”.</FieldHint>}
        {error && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{error}</p>}
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 max-h-[200px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {hits.map((s) => (
            <li key={s.user_id}>
              <button type="button" onClick={() => onChange(s)}
                className="vp-r16 flex w-full min-w-0 flex-col gap-0.5 bg-background px-4 py-3 text-left shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="truncate text-[14px] font-semibold text-foreground">{s.name}</span>
                {s.email && <span className="truncate text-[12.5px] text-muted-foreground">{s.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

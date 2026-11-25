import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { SALE_SEARCH_MIN, dateLabel, methodLabel, parseSales, remainingOf, saleBlockedForDispute, saleBlockedForRefund, shortId, type SaleHit } from "./disputesModel";

/** Venda escolhida: um cartão com os dados e "Trocar". */
export function SaleSummary({ sale, onClear }: { sale: SaleHit; onClear?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[16px] bg-accent/60 p-4 shadow-[inset_0_0_0_1px_hsl(var(--primary)/.35)]">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-[14.5px] font-bold text-foreground">{sale.customer_name || sale.customer_email || "Comprador sem nome"}</p>
        {sale.customer_name && sale.customer_email && <p className="truncate text-[13px] text-muted-foreground">{sale.customer_email}</p>}
        <p className="text-[13px] text-muted-foreground">{sale.product_name || "Produto"} · {sale.seller_name || "Seller"}</p>
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{brl(sale.amount)}</span> no {methodLabel(sale.payment_method)} · {dateLabel(sale.created_at)} · venda {shortId(sale.id)}
        </p>
        {sale.refunded_amount > 0 && <p className="text-[13px] text-muted-foreground">Já reembolsado: {brl(sale.refunded_amount)}. Ainda pode: {brl(remainingOf(sale))}.</p>}
      </div>
      {onClear && <button type="button" onClick={onClear} className="vp-ghost shrink-0 !h-9 px-3 text-[13px]">Trocar</button>}
    </div>
  );
}

/** Busca a venda por e-mail ou nome do comprador, CPF/CNPJ ou ID — no lugar de pedir o ID colado na mão. */
export function SalePicker({ value, onChange, mode }: { value: SaleHit | null; onChange: (sale: SaleHit | null) => void; mode: "dispute" | "refund" }) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim());
  const ready = debounced.length >= SALE_SEARCH_MIN;

  const q = useQuery({
    queryKey: ["admin-sale-search", debounced],
    enabled: ready && !value,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_sales" as never, { _query: debounced } as never);
      if (error) throw error;
      return parseSales(data);
    },
  });

  if (value) return <div><FieldLabel>Venda</FieldLabel><SaleSummary sale={value} onClear={() => { onChange(null); setTerm(""); }} /></div>;

  const blockedOf = mode === "refund" ? saleBlockedForRefund : saleBlockedForDispute;
  const hits = q.data ?? [];
  return (
    <div>
      <FieldLabel htmlFor="sale-search">Venda</FieldLabel>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input id="sale-search" className="vp-field" style={{ paddingLeft: 42 }} autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="E-mail ou nome do comprador, CPF ou ID da venda" aria-describedby="sale-search-msg" />
      </div>
      <div id="sale-search-msg" aria-live="polite">
        {!ready && <FieldHint>Digite pelo menos {SALE_SEARCH_MIN} caracteres. Só vendas pagas de verdade aparecem.</FieldHint>}
        {ready && q.isFetching && <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Procurando…</p>}
        {ready && q.isError && !q.isFetching && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
            {friendlyError(q.error, "Não foi possível buscar as vendas.")} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar de novo</button>
          </p>
        )}
        {ready && !q.isFetching && !q.isError && q.data && hits.length === 0 && <FieldHint>Nenhuma venda encontrada para “{debounced}”.</FieldHint>}
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 max-h-[280px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {hits.map((s) => {
            const blocked = blockedOf(s);
            return (
              <li key={s.id}>
                <button type="button" disabled={!!blocked} onClick={() => onChange(s)}
                  className={cn("vp-r16 flex w-full min-w-0 flex-col gap-0.5 bg-background px-4 py-3 text-left shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    blocked ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50")}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold text-foreground">{s.customer_name || s.customer_email || "Comprador sem nome"}</span>
                    <span className="shrink-0 text-[14px] font-bold tabular-nums text-foreground">{brl(s.amount)}</span>
                  </span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{s.customer_email} · {s.product_name || "Produto"} · {s.seller_name || "Seller"}</span>
                  <span className="text-[12.5px] text-muted-foreground">{methodLabel(s.payment_method)} · {dateLabel(s.created_at)} · venda {shortId(s.id)}</span>
                  {blocked && <span className="text-[12.5px] font-medium text-destructive">{blocked}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

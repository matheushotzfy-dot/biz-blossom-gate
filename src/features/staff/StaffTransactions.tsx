import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface TxRow { id: string; amount: number; status: string; payment_method: string | null; created_at: string; seller_name: string | null; seller_email: string | null }
interface TxPage { rows: TxRow[]; total: number; page: number; page_size: number }
const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

/** Portfolio transactions (active assignments, after assignment start). Server enforces view_transactions. */
export function StaffTransactions({ from, to }: { from: Date; to: Date }) {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["staff-tx", from.toISOString(), to.toISOString(), page], staleTime: 30_000, queryFn: async () => {
    const { data, error } = await supabase.rpc("get_staff_portfolio_transactions", { _from: from.toISOString(), _to: to.toISOString(), _page: page, _search: "" });
    if (error) throw error;
    return data as unknown as TxPage;
  } });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.page_size ?? 25)));
  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border p-4"><h3 className="font-display font-bold">Transações da carteira</h3></div>
      {q.isError ? <p className="p-6 text-sm text-destructive">Não foi possível carregar as transações.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="p-3">Data</th><th className="p-3">Seller</th><th className="p-3">Método</th><th className="p-3">Status</th><th className="p-3 text-right">Valor</th></tr></thead>
          <tbody>{(q.data?.rows ?? []).map((t) => <tr key={t.id} className="border-t border-border"><td className="p-3 text-xs">{new Date(t.created_at).toLocaleString("pt-BR")}</td><td className="p-3 text-xs">{t.seller_name || t.seller_email}</td><td className="p-3 text-xs uppercase">{t.payment_method ?? "—"}</td><td className="p-3 text-xs">{t.status}</td><td className="p-3 text-right font-mono tabular-nums">{money(t.amount)}</td></tr>)}</tbody></table>
          {!q.isLoading && !(q.data?.rows.length) && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma transação no período.</p>}</div>)}
      <div className="flex items-center justify-between border-t border-border p-3"><p className="text-xs text-muted-foreground">Página {page} de {pages}</p><div className="flex gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ArrowLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página"><ArrowRight className="h-4 w-4" /></Button></div></div>
    </div>
  );
}

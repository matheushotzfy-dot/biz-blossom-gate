import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumEmpty, PremiumPanel, PremiumSegmented, premiumTable } from "./AdminPremium";
import AdminPager from "@/components/admin/AdminPager";
import { toast } from "sonner";

type Delivery = Tables<"checkout_delivery_attempts"> & {
  product?: { name: string } | null;
  transaction?: { amount: number; status: string } | null;
};
type DeliveryStatus = "all" | "pending" | "failed" | "delivered";

const statusTone: Record<string, string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  delivered: "border-success/30 bg-success/10 text-success",
  revoked: "border-border bg-muted text-muted-foreground",
};

export default function AdminCheckoutDeliveriesTab() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [status, setStatus] = useState<DeliveryStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from("checkout_delivery_attempts")
      .select("*, product:products(name), transaction:transactions(amount,status)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (status !== "all") query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) toast.error("Não foi possível carregar as entregas");
    setItems((data ?? []) as unknown as Delivery[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [status, page]);

  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.customer_email.toLowerCase().includes(term)
      || item.transaction_id.toLowerCase().includes(term)
      || item.product?.name?.toLowerCase().includes(term));
  }, [items, search]);

  const retry = async (delivery: Delivery) => {
    setRetrying(delivery.id);
    const { error } = await supabase.rpc("admin_retry_checkout_delivery", { _delivery_id: delivery.id });
    if (error) toast.error(error.message || "Falha ao reprocessar entrega");
    else { toast.success("Entrega reprocessada"); await load(); }
    setRetrying(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Operações · Pós-venda"
        title="Entregas do checkout"
        subtitle="Acompanhe acessos liberados e corrija entregas pendentes sem duplicar o acesso."
        status={{ tone: filtered.some((item) => item.status === "failed") ? "destructive" : "info", label: `${totalCount} entrega(s)`, pulse: false }}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por e-mail, produto ou ID" />
        </div>
        <PremiumSegmented<DeliveryStatus> value={status} onChange={setStatus} options={[
          { value: "all", label: "Todas" }, { value: "pending", label: "Pendentes" },
          { value: "failed", label: "Falhas" }, { value: "delivered", label: "Entregues" },
        ]} />
      </div>
      <PremiumPanel eyebrow="Área de membros" title="Histórico de liberações" icon={PackageCheck}>
        {loading ? <div className="h-40 animate-pulse rounded-md bg-muted" /> : filtered.length === 0 ? (
          <PremiumEmpty icon={PackageCheck} title="Nenhuma entrega encontrada" subtitle="As compras confirmadas aparecerão aqui." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead><tr className={premiumTable.headRow}>
                <th className={premiumTable.th}>Produto / comprador</th><th className={premiumTable.th}>Status</th>
                <th className={premiumTable.th}>Tentativas</th><th className={premiumTable.th}>Último detalhe</th>
                <th className={premiumTable.th}>Criada</th><th className={premiumTable.th}></th>
              </tr></thead>
              <tbody>{filtered.map((delivery) => (
                <tr key={delivery.id} className={premiumTable.row}>
                  <td className={premiumTable.td}><div className="space-y-0.5"><p className="font-semibold text-foreground">{delivery.product?.name || "Produto removido"}</p><p className="text-xs text-muted-foreground">{delivery.customer_email}</p><p className="font-mono text-[10px] text-muted-foreground">{delivery.transaction_id}</p></div></td>
                  <td className={premiumTable.td}><span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${statusTone[delivery.status]}`}>
                    {delivery.status === "delivered" ? <CheckCircle2 className="h-3 w-3" /> : delivery.status === "failed" ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{delivery.status}
                  </span></td>
                  <td className={premiumTable.td}>{delivery.attempt_count}</td>
                  <td className={premiumTable.td}><span className="max-w-[300px] text-xs text-muted-foreground">{delivery.last_error || "Sem falhas"}</span></td>
                  <td className={premiumTable.td}>{new Date(delivery.created_at).toLocaleString("pt-BR")}</td>
                  <td className={premiumTable.td}>{delivery.status !== "delivered" && <Button size="sm" variant="outline" disabled={retrying === delivery.id} onClick={() => void retry(delivery)}><RefreshCw className={retrying === delivery.id ? "animate-spin" : ""} /> Reprocessar</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <AdminPager page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} loading={loading} />
      </PremiumPanel>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { brl, DISPUTE_TYPE_LABEL, type DisputeType } from "./types";
import { DisputeRow, type DisputeItem } from "./DisputeRow";
import { OpenDisputeDialog, RefundDialog } from "./DisputeActionDialogs";

type StatusFilter = "active" | "resolved_seller" | "resolved_buyer" | "all";
const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "active", label: "Em aberto" }, { id: "resolved_seller", label: "Ganhas" },
  { id: "resolved_buyer", label: "Perdidas" }, { id: "all", label: "Todas" },
];

interface DisputesCenterProps { initialType?: DisputeType | "all"; profiles: Tables<"profiles">[] }

/** Single place for MED, pré-MED, chargebacks and refunds with real balance effects. */
export default function DisputesCenter({ initialType = "all", profiles }: DisputesCenterProps) {
  const [type, setType] = useState<DisputeType | "all">(initialType);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DisputeItem[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [refundDialog, setRefundDialog] = useState(false);

  useEffect(() => { setType(initialType); }, [initialType]);

  const names = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.full_name || p.email || "Seller"])), [profiles]);

  const load = useCallback(async () => {
    let q = supabase.from("disputes")
      .select("id,transaction_id,seller_user_id,type,status,reason,amount,buyer_name,buyer_email,created_at,response_deadline,seller_response,fee_amount")
      .order("created_at", { ascending: false }).limit(300);
    if (type !== "all") q = q.eq("type", type);
    if (status === "active") q = q.in("status", ["open", "in_review"]);
    else if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    setItems((data ?? []) as DisputeItem[]);
  }, [type, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-disputes-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!items) return [];
    if (!s) return items;
    return items.filter((i) => [names.get(i.seller_user_id), i.buyer_name, i.buyer_email, i.transaction_id, i.id]
      .some((v) => v?.toLowerCase().includes(s)));
  }, [items, search, names]);

  const heldTotal = filtered.filter((i) => i.status === "open" || i.status === "in_review").reduce((a, i) => a + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Disputas e reembolsos</h2>
          <p className="text-xs text-muted-foreground">Em aberto na lista: {brl(heldTotal)} bloqueados</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setRefundDialog(true)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reembolsar venda</Button>
          <Button size="sm" onClick={() => setOpenDialog(true)}><Plus className="mr-1 h-3.5 w-3.5" />Abrir disputa</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...Object.keys(DISPUTE_TYPE_LABEL)] as (DisputeType | "all")[]).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold", type === t ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}>
            {t === "all" ? "Todos os tipos" : DISPUTE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5" role="tablist">
          {STATUS_TABS.map((s) => (
            <button key={s.id} role="tab" aria-selected={status === s.id} type="button" onClick={() => setStatus(s.id)}
              className={cn("rounded-md px-3 py-1 text-xs font-semibold", status === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Seller, comprador ou ID da venda" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {items === null ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma disputa encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => <DisputeRow key={i.id} item={i} sellerName={names.get(i.seller_user_id) ?? "Seller"} onChanged={load} />)}
        </div>
      )}

      <OpenDisputeDialog open={openDialog} onOpenChange={setOpenDialog} onDone={load} defaultType={type === "all" ? "medpix" : type} />
      <RefundDialog open={refundDialog} onOpenChange={setRefundDialog} onDone={load} />
    </div>
  );
}

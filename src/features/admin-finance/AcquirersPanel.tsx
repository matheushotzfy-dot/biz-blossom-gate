import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { brl, rpcErrorMessage } from "./types";
import { SellerSelect } from "./SellerSelect";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

interface AcqRow { id: string; name: string; is_active: boolean; priority: number | null; allow_failover: boolean; health_status: string | null; is_default: boolean; fee_percent: number; fee_fixed: number; sellers: number; tx_total: number; tx_paid: number; gross: number; acquirer_fee: number }
interface Overview { default_id: string | null; sellers_on_default: number; acquirers: AcqRow[] }

/** Default + backup acquirers, per-seller assignment with history (recorded server-side). */
export default function AcquirersPanel({ profiles }: { profiles: Tables<"profiles">[] }) {
  const qc = useQueryClient();
  const [seller, setSeller] = useState("");
  const [target, setTarget] = useState("default");
  const [reason, setReason] = useState("");
  const { confirm, dialog } = useSensitiveConfirm();

  const q = useQuery({ queryKey: ["acq-overview"], staleTime: 30_000, queryFn: async () => {
    const to = new Date(); const from = new Date(Date.now() - 30 * 86400000);
    const { data, error } = await supabase.rpc("get_acquirer_overview", { _from: from.toISOString(), _to: to.toISOString() });
    if (error) throw new Error(rpcErrorMessage(error));
    return data as unknown as Overview;
  } });

  const current = profiles.find((p) => p.user_id === seller);
  const currentName = current?.acquirer_id ? q.data?.acquirers.find((a) => a.id === current.acquirer_id)?.name ?? "—" : "Padrão da plataforma";

  const assign = () => {
    if (!seller) { toast.error("Selecione um seller"); return; }
    if (reason.trim().length < 5) { toast.error("Informe o motivo (mín. 5 caracteres)"); return; }
    confirm("Trocar a adquirente deste seller. Vendas antigas continuam marcadas na adquirente em que foram feitas.", async () => {
      const { error } = await supabase.rpc("admin_set_seller_acquirer", { _seller_id: seller, _new_acquirer_id: target === "default" ? undefined : target, _reason: reason.trim() });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      toast.success("Adquirente do seller atualizada"); setReason("");
      void qc.invalidateQueries({ queryKey: ["acq-overview"] }); void qc.invalidateQueries({ queryKey: ["seller-acq"] });
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Adquirentes</h2>
        <p className="text-xs text-muted-foreground">A padrão é a primeira ativa da lista; se um seller não tiver adquirente própria (ou ela estiver fora do ar), a venda vai automaticamente para a próxima reserva.</p>
      </div>

      {q.isLoading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      : q.data && (q.data.acquirers.length === 0
        ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma adquirente cadastrada ainda. Assim que houver, ela aparece aqui com ordem de reserva.</p>
        : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground"><tr>{["Ordem", "Adquirente", "Status", "Sellers", "Vendas 30d", "Conversão", "Volume 30d", "Custo", "Taxa"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {q.data.acquirers.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{a.priority ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{a.name}{a.is_default && <span className="ml-2 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary">Padrão</span>}{!a.is_default && a.is_active && a.allow_failover && <span className="ml-2 text-[10px] text-muted-foreground">Reserva</span>}</td>
                  <td className="px-3 py-2">{a.is_active ? (a.health_status ?? "ativa") : "Desligada"}</td>
                  <td className="px-3 py-2 font-mono">{a.sellers}</td>
                  <td className="px-3 py-2 font-mono">{a.tx_paid}/{a.tx_total}</td>
                  <td className="px-3 py-2 font-mono">{a.tx_total ? ((a.tx_paid * 100) / a.tx_total).toFixed(1) : "0"}%</td>
                  <td className="px-3 py-2 font-mono">{brl(a.gross)}</td>
                  <td className="px-3 py-2 font-mono">{brl(a.acquirer_fee)}</td>
                  <td className="px-3 py-2 font-mono">{Number(a.fee_percent ?? 0)}% + {brl(a.fee_fixed)}</td>
                </tr>))}
            </tbody>
          </table>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{q.data.sellers_on_default} sellers usando a padrão da plataforma</p>
        </div>))}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Trocar adquirente de um seller</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1"><Label>Seller</Label><SellerSelect profiles={profiles} value={seller} onChange={setSeller} /></div>
          <div className="space-y-1"><Label>Nova adquirente</Label>
            <Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="default">Padrão da plataforma (com reserva)</SelectItem>
                {(q.data?.acquirers ?? []).filter((a) => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="acq-reason">Motivo</Label><Input id="acq-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        {seller && <p className="text-xs text-muted-foreground">Atual: <span className="font-semibold text-foreground">{currentName}</span></p>}
        <Button onClick={assign} disabled={!seller}>Salvar troca</Button>
      </section>
      {dialog}
    </div>
  );
}

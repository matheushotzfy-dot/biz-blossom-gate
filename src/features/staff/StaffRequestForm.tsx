import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { STAFF_KIND_LABEL } from "@/features/admin-finance/StaffRequestsTab";
import { rpcErrorMessage } from "@/features/admin-finance/types";

const schema = z.object({
  kind: z.enum(["acquirer_change", "acquirer_toggle", "fee_change", "seller_freeze", "platform_setting", "other"]),
  reason: z.string().trim().min(5, "Motivo com no mínimo 5 caracteres").max(1000),
  sellerEmail: z.string().trim().max(254).optional(),
});
const STATUS: Record<string, string> = { pending: "Aguardando dono", approved: "Aprovado", rejected: "Recusado", cancelled: "Cancelado" };

/** Partner/manager: send a request the owner approves. Seller is identified by e-mail only (no account access). */
export function StaffRequestForm() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("acquirer_change");
  const [reason, setReason] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [acq, setAcq] = useState("");
  const [busy, setBusy] = useState(false);
  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => (await supabase.rpc("list_acquirers_basic")).data ?? [] });
  const mine = useQuery({ queryKey: ["my-staff-req"], queryFn: async () => (await supabase.from("staff_action_requests").select("id,kind,status,reason,decision_note,created_at").order("created_at", { ascending: false }).limit(50)).data ?? [] });

  const submit = async () => {
    const p = schema.safeParse({ kind, reason, sellerEmail });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    const needsSeller = kind === "acquirer_change" || kind === "seller_freeze";
    const needsAcq = kind === "acquirer_change" || kind === "acquirer_toggle";
    if (needsSeller && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail.trim())) { toast.error("Informe o e-mail do seller"); return; }
    if (needsAcq && !acq) { toast.error("Selecione a adquirente"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_staff_action", {
        _kind: kind, _reason: reason.trim(), _target_acquirer: needsAcq ? acq : undefined,
        _payload: { seller_email: needsSeller ? sellerEmail.trim().toLowerCase() : null },
      });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      toast.success("Pedido enviado ao dono"); setReason(""); setSellerEmail("");
      void qc.invalidateQueries({ queryKey: ["my-staff-req"] });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Novo pedido para o dono</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1"><Label>Tipo</Label><Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STAFF_KIND_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="sr-email">E-mail do seller</Label><Input id="sr-email" type="email" maxLength={254} value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Adquirente</Label><Select value={acq} onValueChange={setAcq}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{(acqs.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-1"><Label htmlFor="sr-reason">Motivo</Label><Textarea id="sr-reason" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Button onClick={() => void submit()} disabled={busy}>Enviar pedido</Button>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Meus pedidos</h3>
        {(mine.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nenhum pedido enviado</p> : (mine.data ?? []).map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 text-xs"><span className="font-semibold">{STAFF_KIND_LABEL[r.kind] ?? r.kind}</span> · {STATUS[r.status] ?? r.status} · {new Date(r.created_at).toLocaleString("pt-BR")}<p className="text-muted-foreground">{r.reason}</p>{r.decision_note && <p>Resposta: {r.decision_note}</p>}</div>))}
      </section>
    </div>
  );
}

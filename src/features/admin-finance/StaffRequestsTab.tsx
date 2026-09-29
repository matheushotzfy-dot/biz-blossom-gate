import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";
import { CreatePartnerCard } from "./CreatePartnerCard";

export const STAFF_KIND_LABEL: Record<string, string> = {
  acquirer_change: "Trocar adquirente de seller", acquirer_toggle: "Ligar/desligar adquirente", fee_change: "Mudança de taxa",
  seller_freeze: "Congelar seller", platform_setting: "Configuração da plataforma", other: "Outro",
};
const ROLE: Record<string, string> = { partner: "Sócio", manager: "Gerente" };

/** Owner-only queue for requests sent by partners and managers. Approving acquirer changes executes them. */
export default function StaffRequestsTab({ profiles }: { profiles: Tables<"profiles">[] }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { confirm, dialog } = useSensitiveConfirm();
  const name = (id: string | null) => (id ? profiles.find((p) => p.user_id === id)?.full_name || profiles.find((p) => p.user_id === id)?.email || id.slice(0, 8) : "—");

  const q = useQuery({ queryKey: ["staff-req", status], queryFn: async () => {
    const { data, error } = await supabase.from("staff_action_requests").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => (await supabase.rpc("list_acquirers_basic")).data ?? [] });

  const decide = (id: string, approve: boolean) => {
    const note = notes[id]?.trim() ?? "";
    if (!approve && note.length < 5) { toast.error("Escreva o motivo da recusa"); return; }
    confirm(approve ? "Aprovar o pedido da equipe." : "Recusar o pedido da equipe.", async () => {
      const { error } = await supabase.rpc("admin_decide_staff_action", { _id: id, _approve: approve, _note: note || undefined });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      toast.success(approve ? "Pedido aprovado" : "Pedido recusado"); void qc.invalidateQueries({ queryKey: ["staff-req"] });
    });
  };

  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold">Pedidos da equipe</h2><p className="text-xs text-muted-foreground">Sócios e gerentes não executam nada sensível: enviam pedidos e só você aprova.</p></div>
      <CreatePartnerCard />
      <Tabs value={status} onValueChange={setStatus}><TabsList><TabsTrigger value="pending">Pendentes</TabsTrigger><TabsTrigger value="approved">Aprovados</TabsTrigger><TabsTrigger value="rejected">Recusados</TabsTrigger></TabsList></Tabs>
      {q.isLoading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      : (q.data ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum pedido</p>
      : (q.data ?? []).map((r) => (
        <div key={r.id} className="space-y-2 rounded-xl border border-border bg-card p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{STAFF_KIND_LABEL[r.kind] ?? r.kind}</span><span className="text-muted-foreground">por {ROLE[r.requested_role] ?? r.requested_role} {name(r.requested_by)} · {new Date(r.created_at).toLocaleString("pt-BR")}</span></div>
          {r.target_seller_id && <p><span className="text-muted-foreground">Seller:</span> {name(r.target_seller_id)}</p>}
          {r.target_acquirer_id && <p><span className="text-muted-foreground">Adquirente:</span> {acqs.data?.find((a) => a.id === r.target_acquirer_id)?.name ?? r.target_acquirer_id.slice(0, 8)}</p>}
          <p className="text-muted-foreground">Motivo: {r.reason}</p>
          {r.decision_note && <p>Decisão: {r.decision_note}</p>}
          {r.status === "pending" && (
            <div className="space-y-2">
              <Textarea placeholder="Observação (obrigatória para recusar)" maxLength={1000} value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              <div className="flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Recusar</Button></div>
            </div>)}
        </div>))}
      {dialog}
    </div>
  );
}

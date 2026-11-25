import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";
import { CreatePartnerCard } from "./CreatePartnerCard";

export const STAFF_KIND_LABEL: Record<string, string> = {
  acquirer_change: "Trocar adquirente de seller", acquirer_toggle: "Ligar/desligar adquirente", fee_change: "Mudança de taxa",
  seller_freeze: "Congelar seller", platform_setting: "Configuração da plataforma", other: "Outro",
};
const ROLE: Record<string, string> = { partner: "Sócio", manager: "Gerente" };
/** Só estes tipos são executados pelo banco quando o dono aprova (admin_decide_staff_action). Os outros só registram a decisão. */
export const EXECUTED_ON_APPROVAL = new Set(["acquirer_change", "acquirer_toggle"]);
type Status = "pending" | "approved" | "rejected";
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Owner-only queue for requests sent by partners and managers. Approving acquirer changes executes them. */
export default function StaffRequestsTab({ profiles }: { profiles: Tables<"profiles">[] }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { confirm, dialog } = useSensitiveConfirm();
  const name = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.user_id === id);
    return p?.full_name || p?.email || `${id.slice(0, 8)}…`;
  };

  const q = useQuery({ queryKey: ["staff-req", status], queryFn: async () => {
    const { data, error } = await supabase.from("staff_action_requests").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(rpcErrorMessage(error));
    return data;
  } });
  // a lista de adquirentes só enfeita o nome; se falhar, mostramos o começo do código
  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => {
    const { data, error } = await supabase.rpc("list_acquirers_basic");
    if (error) throw error;
    return data ?? [];
  } });

  const decide = (r: Tables<"staff_action_requests">, approve: boolean) => {
    const note = notes[r.id]?.trim() ?? "";
    if (!approve && note.length < 5) { setErrors((e) => ({ ...e, [r.id]: "Explique o motivo da recusa em pelo menos 5 caracteres." })); return; }
    setErrors((e) => ({ ...e, [r.id]: "" }));
    const kind = STAFF_KIND_LABEL[r.kind] ?? r.kind;
    const desc = approve
      ? EXECUTED_ON_APPROVAL.has(r.kind) ? `Aprovar "${kind}". A mudança é feita agora.` : `Aprovar "${kind}". Só registramos a sua decisão: a mudança em si fica por sua conta.`
      : `Recusar "${kind}". O pedido sai da fila com a sua explicação.`;
    confirm(desc, async () => {
      const { error } = await supabase.rpc("admin_decide_staff_action", { _id: r.id, _approve: approve, _note: note || undefined });
      if (error) {
        const message = rpcErrorMessage(error);
        toast.error(message);
        if (message.includes("já decidido")) void qc.invalidateQueries({ queryKey: ["staff-req"] });
        return;
      }
      toast.success(approve ? "Pedido aprovado" : "Pedido recusado");
      setNotes((n) => { const { [r.id]: _gone, ...rest } = n; return rest; });
      void qc.invalidateQueries({ queryKey: ["staff-req"] });
    });
  };

  const list = q.data ?? [];
  const pendingCount = status === "pending" && q.data ? list.length : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Financeiro · Equipe"
        title="Pedidos da equipe"
        subtitle="Sócios e gerentes não executam nada sensível: enviam pedidos e só você decide."
        status={pendingCount === null ? undefined : { tone: pendingCount > 0 ? "warning" : "success", label: pendingCount > 0 ? `${pendingCount} aguardando você` : "Nada aguardando você", pulse: pendingCount > 0 }}
      />

      <PremiumSegmented<Status>
        value={status}
        onChange={setStatus}
        options={[{ value: "pending", label: "Pendentes" }, { value: "approved", label: "Aprovados" }, { value: "rejected", label: "Recusados" }]}
      />

      {q.isLoading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      : q.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-destructive">Não foi possível carregar os pedidos.</p>
          <p className="max-w-md text-[12px] text-muted-foreground">{(q.error as Error).message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>Tentar de novo</Button>
        </div>
      )
      : list.length === 0 ? (
        <PremiumPanel><PremiumEmpty icon={Inbox} title={status === "pending" ? "Nenhum pedido esperando você" : status === "approved" ? "Nenhum pedido aprovado" : "Nenhum pedido recusado"} subtitle={status === "pending" ? "Quando um sócio ou gerente pedir algo, aparece aqui." : undefined} /></PremiumPanel>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const payloadEmail = (r.payload as { seller_email?: string | null } | null)?.seller_email;
            const executes = EXECUTED_ON_APPROVAL.has(r.kind);
            return (
              <article key={r.id} className="space-y-3 rounded-[12px] border border-border/60 bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">{STAFF_KIND_LABEL[r.kind] ?? r.kind}</h3>
                  <span className="text-[12.5px] text-muted-foreground">por {ROLE[r.requested_role] ?? r.requested_role} {name(r.requested_by)} · {when(r.created_at)}</span>
                </div>
                <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {(r.target_seller_id || payloadEmail) && <div><dt className="text-[11.5px] font-medium text-muted-foreground/80">Seller</dt><dd>{r.target_seller_id ? name(r.target_seller_id) : payloadEmail}</dd></div>}
                  {r.target_acquirer_id && <div><dt className="text-[11.5px] font-medium text-muted-foreground/80">Adquirente</dt><dd>{acqs.data?.find((a) => a.id === r.target_acquirer_id)?.name ?? `${r.target_acquirer_id.slice(0, 8)}…`}</dd></div>}
                  <div className="sm:col-span-2"><dt className="text-[11.5px] font-medium text-muted-foreground/80">Motivo</dt><dd className="break-words">{r.reason}</dd></div>
                  {r.decision_note && <div className="sm:col-span-2"><dt className="text-[11.5px] font-medium text-muted-foreground/80">Sua decisão</dt><dd className="break-words">{r.decision_note}</dd></div>}
                  {r.decided_at && <div><dt className="text-[11.5px] font-medium text-muted-foreground/80">Decidido em</dt><dd>{when(r.decided_at)}</dd></div>}
                </dl>
                {r.status === "pending" && (
                  <div className="space-y-2 border-t border-border/50 pt-3">
                    <p className={cn("text-[12px]", executes ? "text-foreground" : "text-muted-foreground")}>
                      {executes ? "Ao aprovar, a mudança é feita na hora." : "Ao aprovar, só registramos a sua decisão. A mudança em si não é aplicada sozinha."}
                    </p>
                    <Label htmlFor={`sr-note-${r.id}`} className="text-[12px] font-medium text-muted-foreground">Observação (obrigatória para recusar)</Label>
                    <Textarea id={`sr-note-${r.id}`} maxLength={1000} value={notes[r.id] ?? ""} aria-invalid={!!errors[r.id]}
                      onChange={(e) => { const v = e.target.value; setNotes((n) => ({ ...n, [r.id]: v })); if (errors[r.id]) setErrors((x) => ({ ...x, [r.id]: "" })); }} />
                    {errors[r.id] && <p role="alert" className="text-[12.5px] font-medium text-destructive">{errors[r.id]}</p>}
                    <div className="flex gap-2"><Button size="sm" onClick={() => decide(r, true)}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => decide(r, false)}>Recusar</Button></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <CreatePartnerCard />
      {dialog}
    </div>
  );
}

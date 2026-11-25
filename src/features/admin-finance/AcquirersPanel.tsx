import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Loader2, Network, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, premiumTable } from "@/pages/admin/tabs/AdminPremium";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { brl, rpcErrorMessage } from "./types";
import { SellerSelect } from "./SellerSelect";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

export interface AcqRow { id: string; name: string; is_active: boolean; priority: number | null; allow_failover: boolean; health_status: string | null; is_default: boolean; fee_percent: number; fee_fixed: number; sellers: number; tx_total: number; tx_paid: number; gross: number; acquirer_fee: number }
interface Overview { default_id: string | null; sellers_on_default: number; acquirers: AcqRow[] }

const HEALTH: Record<string, { label: string; cls: string }> = {
  online: { label: "Online", cls: "border-success/40 bg-success/10 text-success" },
  degraded: { label: "Instável", cls: "border-warning/40 bg-warning/10 text-warning" },
  offline: { label: "Fora do ar", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  maintenance: { label: "Em manutenção", cls: "border-border bg-muted/40 text-muted-foreground" },
};
/** Estado mostrado na tabela: desligada vence a saúde reportada. */
export function acquirerStatus(a: Pick<AcqRow, "is_active" | "health_status">): { label: string; cls: string } {
  if (!a.is_active) return { label: "Desligada", cls: "border-border bg-muted/40 text-muted-foreground" };
  return HEALTH[a.health_status ?? "online"] ?? { label: a.health_status ?? "Online", cls: "border-border bg-muted/40 text-muted-foreground" };
}

/** Default + backup acquirers, per-seller assignment with history (recorded server-side). */
export default function AcquirersPanel({ profiles }: { profiles: Tables<"profiles">[] }) {
  const qc = useQueryClient();
  const [seller, setSeller] = useState("");
  const [target, setTarget] = useState("default");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const { confirm, dialog } = useSensitiveConfirm();

  const q = useQuery({ queryKey: ["acq-overview"], staleTime: 30_000, queryFn: async () => {
    const to = new Date(); const from = new Date(Date.now() - 30 * 86400000);
    const { data, error } = await supabase.rpc("get_acquirer_overview", { _from: from.toISOString(), _to: to.toISOString() });
    if (error) throw new Error(rpcErrorMessage(error));
    return data as unknown as Overview;
  } });

  const acquirers = q.data?.acquirers ?? [];
  const active = acquirers.filter((a) => a.is_active);
  const current = profiles.find((p) => p.user_id === seller);
  const currentName = current?.acquirer_id ? acquirers.find((a) => a.id === current.acquirer_id)?.name ?? "adquirente que não existe mais" : "Padrão da plataforma";
  const sellerName = current?.full_name || current?.email || "o seller";
  const targetName = target === "default" ? "a padrão da plataforma" : acquirers.find((a) => a.id === target)?.name ?? "a nova adquirente";

  const assign = () => {
    if (!seller) { setFormError("Escolha o seller."); return; }
    if (reason.trim().length < 5) { setFormError("Explique o motivo em pelo menos 5 caracteres."); return; }
    setFormError("");
    confirm(`Trocar a adquirente de ${sellerName} para ${targetName}. Vendas antigas continuam marcadas na adquirente em que foram feitas.`, async () => {
      const { error } = await supabase.rpc("admin_set_seller_acquirer", { _seller_id: seller, _new_acquirer_id: target === "default" ? undefined : target, _reason: reason.trim() });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      toast.success("Adquirente do seller atualizada"); setReason("");
      void qc.invalidateQueries({ queryKey: ["acq-overview"] }); void qc.invalidateQueries({ queryKey: ["seller-acq"] });
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Financeiro · Adquirentes"
        title="Adquirentes"
        subtitle="A padrão é a primeira ativa da lista. Se o seller não tiver adquirente própria, ou ela estiver fora do ar, a venda vai para a próxima reserva."
      />

      {q.isLoading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      : q.isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-destructive">Não foi possível carregar as adquirentes.</p>
          <p className="max-w-md text-[12px] text-muted-foreground">{(q.error as Error).message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>Tentar de novo</Button>
        </div>
      ) : q.data && (
        <>
          <PremiumMetricGrid cols={3}>
            <PremiumMetric icon={Landmark} label="Adquirentes ativas" value={String(active.length)} sub={`de ${acquirers.length} cadastradas`} tone={active.length > 0 ? "success" : "warning"} />
            <PremiumMetric icon={Network} label="Padrão agora" value={acquirers.find((a) => a.is_default)?.name ?? "Nenhuma"} sub="primeira ativa da lista" />
            <PremiumMetric icon={Users} label="Sellers na padrão" value={String(q.data.sellers_on_default)} sub="sem adquirente própria" />
          </PremiumMetricGrid>

          <PremiumPanel title="Ordem e desempenho" eyebrow="Últimos 30 dias" className="[&>div]:p-0">
            {acquirers.length === 0 ? (
              <PremiumEmpty icon={Landmark} title="Nenhuma adquirente cadastrada ainda" subtitle="Sem adquirente os checkouts ficam indisponíveis e nenhuma cobrança é processada. Quando houver, ela aparece aqui com a ordem de reserva." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-[12.5px]">
                    <thead className={premiumTable.headRow}><tr>{["Ordem", "Adquirente", "Status", "Sellers", "Aprovadas / total", "Conversão", "Volume", "Custo", "Taxa"].map((h, i) => <th key={h} className={cn(premiumTable.th, i > 2 && "text-right")}>{h}</th>)}</tr></thead>
                    <tbody>
                      {acquirers.map((a) => {
                        const st = acquirerStatus(a);
                        return (
                          <tr key={a.id} className={cn(premiumTable.row, "tabular-nums")}>
                            <td className={premiumTable.td}>{a.priority ?? "—"}</td>
                            <td className={cn(premiumTable.td, "font-semibold")}>
                              {a.name}
                              {a.is_default && <span className="ml-2 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Padrão</span>}
                              {!a.is_default && a.is_active && a.allow_failover && <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">Reserva</span>}
                            </td>
                            <td className={premiumTable.td}><span className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold", st.cls)}>{st.label}</span></td>
                            <td className={cn(premiumTable.td, "text-right")}>{a.sellers}</td>
                            <td className={cn(premiumTable.td, "text-right")}>{a.tx_paid}/{a.tx_total}</td>
                            <td className={cn(premiumTable.td, "text-right")}>{a.tx_total ? ((a.tx_paid * 100) / a.tx_total).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</td>
                            <td className={cn(premiumTable.td, "text-right")}>{brl(a.gross)}</td>
                            <td className={cn(premiumTable.td, "text-right")}>{brl(a.acquirer_fee)}</td>
                            <td className={cn(premiumTable.td, "text-right")}>{Number(a.fee_percent ?? 0).toLocaleString("pt-BR")}% + {brl(a.fee_fixed)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-border/50 px-5 py-3 text-[12px] text-muted-foreground">{q.data.sellers_on_default} {q.data.sellers_on_default === 1 ? "seller usa" : "sellers usam"} a padrão da plataforma.</p>
              </>
            )}
          </PremiumPanel>
        </>
      )}

      <PremiumPanel title="Trocar adquirente de um seller">
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); assign(); }}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <div className="space-y-1"><Label className="text-[12px] font-medium text-muted-foreground">Seller</Label><SellerSelect profiles={profiles} value={seller} onChange={(v) => { setSeller(v); setFormError(""); }} /></div>
            <div className="space-y-1"><Label className="text-[12px] font-medium text-muted-foreground">Nova adquirente</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label="Nova adquirente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão da plataforma (com reserva)</SelectItem>
                  {active.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="space-y-1"><Label htmlFor="acq-reason" className="text-[12px] font-medium text-muted-foreground">Motivo</Label><Input id="acq-reason" maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); if (formError) setFormError(""); }} /></div>
          </div>
          {seller && <p className="text-[12.5px] text-muted-foreground">Hoje este seller usa: <span className="font-semibold text-foreground">{currentName}</span></p>}
          {formError && <p role="alert" className="text-[12.5px] font-medium text-destructive">{formError}</p>}
          <Button type="submit" disabled={!seller || q.isError}>Salvar troca</Button>
        </form>
      </PremiumPanel>
      {dialog}
    </div>
  );
}

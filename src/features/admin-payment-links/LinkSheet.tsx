import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime } from "@/features/admin-finance/format";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { SituationBadges } from "./LinkRows";
import { actorLabel, dedupeEvents, eventLabel, eventReason, publicLinkUrl, type LinkEvent, type LinkRow } from "./linksModel";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3 border-b border-border/40 py-2 last:border-b-0">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] text-foreground">{children}</dd>
    </div>
  );
}

const uses = (l: LinkRow) => (l.max_uses ? `${l.current_uses} de ${l.max_uses}` : `${l.current_uses}`);

export function LinkSheet({ link, onClose }: { link: LinkRow | null; onClose: () => void }) {
  const id = link?.id;
  const events = useQuery({
    queryKey: ["admin-link-events", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_link_events").select("id, event_type, actor_type, created_at, metadata")
        .eq("payment_link_id", id as string).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return dedupeEvents((data ?? []) as LinkEvent[]);
    },
  });
  const url = link ? publicLinkUrl(link.slug) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Endereço copiado."); } catch { toast.error("Não foi possível copiar. Selecione o endereço e copie à mão."); }
  };

  return (
    <Sheet open={!!link} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        {link && (
          <>
            <SheetHeader className="space-y-1 border-b border-border/60 p-5 pr-12 text-left">
              <SheetTitle className="text-[17px]">{link.title}</SheetTitle>
              <SheetDescription asChild><div><SituationBadges l={link} /></div></SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-5">
              <dl>
                <Row label="Vendedor">{link.seller_name || link.seller_email || `Conta ${link.user_id.slice(0, 8)}`}{link.seller_name && link.seller_email ? <span className="block text-muted-foreground">{link.seller_email}</span> : null}</Row>
                <Row label="Endereço">
                  <span className="flex items-start justify-between gap-2"><span className="break-all font-mono text-[12px]">{url}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Copiar endereço do link" onClick={() => void copy()}><Copy className="h-3.5 w-3.5" /></Button></span>
                </Row>
                <Row label="Valor">{link.pricing_type === "fixed" || !link.pricing_type ? brl(link.amount) : "Escolhido por quem paga"}</Row>
                <Row label="Receita líquida">{brl(link.net_revenue)}{link.pending_count > 0 ? <span className="block text-muted-foreground">{link.pending_count} {link.pending_count === 1 ? "pagamento pendente" : "pagamentos pendentes"}</span> : null}</Row>
                <Row label="Visitas e usos">{link.clicks.toLocaleString("pt-BR")} {link.clicks === 1 ? "visita" : "visitas"} · {uses(link)} {link.current_uses === 1 && !link.max_uses ? "pagamento" : "pagamentos"}</Row>
                <Row label="Vence em">{link.expires_at ? fmtDateTime(link.expires_at) : "Não vence"}</Row>
                <Row label="Criado em">{fmtDateTime(link.created_at)}</Row>
                {link.admin_status === "blocked" && <Row label="Motivo do bloqueio">{link.admin_block_reason || "—"}{link.admin_blocked_at ? <span className="block text-muted-foreground">em {fmtDateTime(link.admin_blocked_at)}</span> : null}</Row>}
              </dl>

              <section aria-label="Histórico do link">
                <h3 className="mb-2 text-[14px] font-semibold text-foreground">Histórico</h3>
                {events.isPending ? (
                  <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
                ) : events.isError ? (
                  <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[13px]">
                    <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar o histórico.</p>
                    <p className="text-muted-foreground">{friendlyError(events.error, "Tente de novo em instantes.")}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void events.refetch()}>Tentar de novo</Button>
                  </div>
                ) : events.data.length === 0 ? (
                  <PremiumEmpty icon={Clock} title="Sem histórico" subtitle="Nada foi registrado para este link ainda." />
                ) : (
                  <ol className="space-y-2">
                    {events.data.map((ev) => (
                      <li key={ev.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-semibold text-foreground">{eventLabel(ev.event_type)}</p>
                          <p className="whitespace-nowrap text-[12px] text-muted-foreground">{fmtDateTime(ev.created_at)}</p>
                        </div>
                        <p className="text-[12px] text-muted-foreground">{actorLabel(ev.actor_type)}</p>
                        {eventReason(ev) && <p className="mt-1.5 text-[12.5px] text-foreground/80">Motivo: {eventReason(ev)}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

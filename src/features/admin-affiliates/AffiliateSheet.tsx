import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { brl } from "@/features/admin-finance/types";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { HoldDialog, type HoldTarget } from "./HoldDialog";
import {
  affiliateState, conversionLabel, dayLabel, historyLabel, linkState, parseAffiliateDetail, pctLabel, saleStatus, type AffiliateDetail, type AffiliateItem, type LinkRow,
} from "./affiliatesModel";

const int = (v: number) => v.toLocaleString("pt-BR");

/** Raio-X do afiliado: links, vendas, comissão e a ação de pausar ou liberar (tudo ou um link). */
export function AffiliateSheet({ id, seed, onClose }: { id: string | null; seed: AffiliateItem | null; onClose: () => void }) {
  // guarda o último afiliado para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: AffiliateItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <SheetBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SheetBody({ id, seed, onClose }: { id: string; seed: AffiliateItem | null; onClose: () => void }) {
  const [hold, setHold] = useState<HoldTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-affiliate-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_affiliate_detail" as never, { _user_id: id } as never);
      if (error) throw error;
      return parseAffiliateDetail(data);
    },
  });
  const d = q.data;
  const name = d?.affiliate.name ?? seed?.name ?? "Afiliado";
  const st = d ? affiliateState(d.stats) : seed ? affiliateState(seed) : null;
  const anyHeld = (d?.stats.links_held ?? 0) > 0;
  const canHold = !!d && d.links.some((l) => !l.hold_at);

  const holdAll = (h: boolean) => setHold({ affiliate: { id, name }, link: null, hold: h });
  const holdLink = (l: LinkRow, h: boolean) => setHold({ affiliate: { id, name }, link: { id: l.id, label: l.product_name ?? "Produto" }, hold: h });

  return (
    <>
      <DialogHead icon={<Handshake className="h-5 w-5" />} title={name} subtitle={d?.affiliate.email ?? seed?.email ?? "Afiliado"} aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o raio-X do afiliado…</p>
            : q.isError || !d ? (
              <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
                {friendlyError(q.error, "Não foi possível carregar o afiliado.")} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar de novo</button>
              </p>
            ) : <Detail d={d} onHoldLink={holdLink} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {canHold && <button type="button" onClick={() => holdAll(true)} className="vp-ghost !h-12 justify-center !text-destructive">Pausar afiliado</button>}
          {anyHeld && <button type="button" onClick={() => holdAll(false)} className="vp-cta !h-12 justify-center sm:min-w-[150px]">Liberar afiliado</button>}
        </DialogFoot>
      </div>
      <HoldDialog target={hold} onClose={() => setHold(null)} />
    </>
  );
}

/** Link que o checkout ignora hoje, mesmo estando "ativo" para o afiliado. */
const ineffective = (l: LinkRow) => l.is_active && !l.hold_at && (l.product_deleted || l.product_status !== "active" || !l.product_open);

function Detail({ d, onHoldLink }: { d: AffiliateDetail; onHoldLink: (l: LinkRow, hold: boolean) => void }) {
  const x = d.stats;
  const heldLinks = d.links.filter((l) => l.hold_at);
  const reason = heldLinks.find((l) => l.hold_reason)?.hold_reason ?? null;
  const since = heldLinks.map((l) => l.hold_at).filter((v): v is string => !!v).sort()[0] ?? null;

  return (
    <>
      {heldLinks.length > 0 && (
        <div className="rounded-[14px] bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          <p className="font-semibold">
            {heldLinks.length === d.links.length ? "Todos os links estão pausados" : `${int(heldLinks.length)} ${heldLinks.length === 1 ? "link pausado" : "links pausados"} pela equipe`}
            {since ? ` desde ${dateLabel(since)}` : ""}. O afiliado não reativa e não cria link novo.
          </p>
          {reason && <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">Motivo: {reason}</p>}
        </div>
      )}

      <Block title="Resultado" aside="vendas pagas, sem simuladas">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(4,minmax(0,1fr))]">
          <Figure label="Vendas pagas" value={int(x.sales)} sub={conversionLabel(x.sales, x.clicks)} />
          <Figure label="Vendido" value={brl(x.revenue)} sub="valor bruto" />
          <Figure label="Comissão" value={brl(x.commission)} sub={x.reversed > 0 ? `${brl(x.reversed)} estornados` : "já descontado o estorno"} />
          <Figure label="Cliques" value={int(x.clicks)} sub={`${int(x.links_active)} de ${int(x.links)} ${x.links === 1 ? "link no ar" : "links no ar"}`} />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          A comissão cai no saldo do afiliado assim que a venda é paga. Reembolso total ou chargeback estornam; reembolso parcial ainda não reduz a comissão.
          {x.refunded > 0 && ` ${int(x.refunded)} ${x.refunded === 1 ? "venda foi estornada" : "vendas foram estornadas"}.`}
        </p>
      </Block>

      <Block title="Links" aside={d.links.length === 0 ? undefined : `${int(d.links.length)} ${d.links.length === 1 ? "link" : "links"}`}>
        {d.links.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Este afiliado ainda não criou nenhum link.</p> : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
            {d.links.map((l) => {
              const ls = linkState(l);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{l.product_name ?? "Produto sem nome"}{l.product_deleted ? " (apagado)" : ""}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {l.seller_name} · comissão {pctLabel(l.commission_pct)} · {int(l.clicks)} {l.clicks === 1 ? "clique" : "cliques"} · {int(l.sales)} {l.sales === 1 ? "venda" : "vendas"} ({brl(l.commission)})
                    </span>
                    {ineffective(l) && <span className="block text-[12.5px] font-medium text-warning">O afiliado vê o link no ar, mas o checkout não paga comissão por ele.</span>}
                    {l.hold_reason && <span className="block text-[12.5px] text-muted-foreground">Motivo: {l.hold_reason}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <ToneTag tone={ls.tone}>{ls.label}</ToneTag>
                    <button type="button" onClick={() => onHoldLink(l, !l.hold_at)} aria-label={`${l.hold_at ? "Liberar" : "Pausar"} o link de ${l.product_name ?? "produto"}`}
                      className={l.hold_at ? "vp-cta !h-9 !px-3.5 text-[13px]" : "vp-ghost !h-9 !px-3.5 text-[13px] !text-destructive"}>
                      {l.hold_at ? "Liberar" : "Pausar"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title="Últimas vendas" aside={d.sales.length >= 50 ? "50 mais recentes" : undefined}>
        {d.sales.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma venda por este afiliado ainda.</p> : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
            {d.sales.map((t) => {
              const ss = saleStatus(t.status);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{t.product_name ?? "Produto sem nome"}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{t.seller_name}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    <ToneTag tone={ss.tone}>{ss.label}</ToneTag>
                    <span className="tabular-nums text-foreground">{brl(t.sale_amount)}</span>
                    <span className="tabular-nums">comissão {brl(t.commission_amount)}</span>
                    <span>{dayLabel(t.created_at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title="Histórico do afiliado">
        {d.history.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma ação da equipe registrada.</p> : (
          <ol className="space-y-3 border-l border-border pl-4">
            {d.history.map((h) => (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
                <p className="text-[13.5px] font-semibold text-foreground">{historyLabel(h.action, h.links)}</p>
                <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.created_at)}{h.admin_name ? ` · ${h.admin_name}` : ""}</p>
                {h.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Block>
    </>
  );
}

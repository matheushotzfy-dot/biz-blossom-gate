import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { Info } from "@/features/admin-disputes/parts";
import { brl } from "@/features/admin-finance/types";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { saleStatus } from "@/features/admin-products/productsModel";
import { friendlyError } from "@/lib/friendlyError";
import { HoldDialog, type HoldTarget } from "./HoldDialog";
import { dayLabel, discountLabel, expiryLabel, historyLabel, isFullDiscount, parseCouponDetail, stateInfo, usesLabel, type CouponDetail, type CouponItem } from "./couponsModel";

/** Raio-X do cupom: o que o admin precisa ver para decidir, e a ação de pausar ou liberar. */
export function CouponSheet({ id, seed, onClose }: { id: string | null; seed: CouponItem | null; onClose: () => void }) {
  // guarda o último cupom para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: CouponItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <SheetBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SheetBody({ id, seed, onClose }: { id: string; seed: CouponItem | null; onClose: () => void }) {
  const [hold, setHold] = useState<HoldTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-coupon-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_coupon_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parseCouponDetail(data);
    },
  });
  const d = q.data;
  const head = d?.coupon ?? seed;
  const st = head ? stateInfo(head.state) : null;
  const sellerName = d?.seller.name ?? seed?.seller_name ?? "Seller";
  const held = !!d?.coupon.hold_at;
  const start = (h: boolean) => { if (d) setHold({ coupon: { id: d.coupon.id, code: d.coupon.code, seller_name: sellerName }, hold: h }); };

  return (
    <>
      <DialogHead icon={<Tag className="h-5 w-5" />} title={head?.code ?? "Cupom"} subtitle={`${sellerName}${head?.created_at ? ` · criado em ${dateLabel(head.created_at)}` : ""}`}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o raio-X do cupom…</p>
            : q.isError || !d ? (
              <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
                {friendlyError(q.error, "Não foi possível carregar o cupom.")} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar de novo</button>
              </p>
            ) : <Detail d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {d && !held && <button type="button" onClick={() => start(true)} className="vp-ghost !h-12 justify-center !text-destructive">Pausar cupom</button>}
          {d && held && <button type="button" onClick={() => start(false)} className="vp-cta !h-12 justify-center sm:min-w-[150px]">Liberar cupom</button>}
        </DialogFoot>
      </div>
      <HoldDialog target={hold} onClose={() => setHold(null)} />
    </>
  );
}

const int = (v: number) => v.toLocaleString("pt-BR");

function Detail({ d }: { d: CouponDetail }) {
  const { coupon: c, seller: s, stats: x, product: p } = d;
  const expiry = expiryLabel(c);
  const full = isFullDiscount(c);

  return (
    <>
      {c.hold_at && (
        <div className="rounded-[14px] bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
          <p className="font-semibold">Pausado pela equipe em {dateLabel(c.hold_at)}. O seller não consegue ativar de novo.</p>
          {c.hold_reason && <p className="mt-0.5 whitespace-pre-wrap break-words font-medium">Motivo: {c.hold_reason}</p>}
        </div>
      )}
      {full && !c.hold_at && <p className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">Cupom de 100%: quem usa leva {p ? "o produto" : "qualquer produto do seller"} de graça. Confira se isso foi combinado com o seller.</p>}

      <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <Info label="Desconto">{discountLabel(c)}</Info>
        <Info label="Vale para">{p ? `${p.name}${p.deleted ? " (apagado)" : ""}` : "Todos os produtos do seller"}</Info>
        <Info label="Ofertas adicionais">{c.apply_to_bumps ? "O desconto vale também nelas" : "Só no produto principal"}</Info>
        <Info label="Validade">{expiry ?? "Sem validade"}</Info>
        <Info label="Limite de usos">{c.max_uses == null ? "Sem limite" : int(c.max_uses)}</Info>
        <Info label="Seller">{s.name}{s.email ? ` · ${s.email}` : ""}</Info>
      </dl>

      <Block title="Uso" aside="não conta venda simulada">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(4,minmax(0,1fr))]">
          <Figure label="Vendas pagas" value={int(x.sales)} sub={`${int(x.buyers)} ${x.buyers === 1 ? "comprador" : "compradores"}`} />
          <Figure label="Desconto dado" value={brl(x.discount)} />
          <Figure label="Vendido com o cupom" value={brl(x.gross)} sub="já com o desconto" />
          <Figure label="Usos reservados" value={usesLabel(c)} sub={x.open_reservations > 0 ? `${int(x.open_reservations)} aguardando Pix` : undefined} />
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          O uso é reservado quando o comprador gera o Pix e volta para o cupom se o pagamento não acontece ({int(x.lost)} {x.lost === 1 ? "voltou" : "voltaram"}).
          {x.refunds + x.chargebacks > 0 && ` ${int(x.refunds)} ${x.refunds === 1 ? "reembolso" : "reembolsos"} e ${int(x.chargebacks)} ${x.chargebacks === 1 ? "chargeback" : "chargebacks"} com este cupom.`}
          {x.simulated > 0 && ` ${int(x.simulated)} ${x.simulated === 1 ? "venda simulada" : "vendas simuladas"} fora das contas.`}
        </p>
      </Block>

      <Block title="Últimas vendas" aside={d.sales.length >= 50 ? "50 mais recentes" : undefined}>
        {d.sales.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Ninguém comprou com este cupom ainda.</p> : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-[14px] bg-muted/30">
            {d.sales.map((t) => {
              const ss = saleStatus(t.status);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{t.buyer_name ?? t.buyer_email ?? "Comprador sem identificação"}</span>
                    {t.buyer_name && t.buyer_email && <span className="block truncate text-[12.5px] text-muted-foreground">{t.buyer_email}</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    {t.simulated && <ToneTag tone="info">Simulada</ToneTag>}
                    <ToneTag tone={ss.tone}>{ss.label}</ToneTag>
                    <span className="tabular-nums text-foreground">{brl(t.amount)}</span>
                    {t.discount_amount > 0 && <span className="tabular-nums">−{brl(t.discount_amount)}</span>}
                    <span>{dayLabel(t.created_at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title="Histórico do cupom">
        {d.history.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma ação da equipe registrada.</p> : (
          <ol className="space-y-3 border-l border-border pl-4">
            {d.history.map((h) => (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
                <p className="text-[13.5px] font-semibold text-foreground">{historyLabel(h.action)}</p>
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

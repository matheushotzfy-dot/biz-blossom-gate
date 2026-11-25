import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { brl } from "@/features/admin-finance/types";
import { dateLabel, typeLabel } from "@/features/admin-disputes/disputesModel";
import { Info } from "@/features/admin-disputes/parts";
import { getCheckoutLink } from "@/components/products/productPresentation";
import { friendlyError } from "@/lib/friendlyError";
import { openExternal } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { ModerationDialog, type ModerationTarget } from "./ModerationDialog";
import { Block, ClassPicker, Figure, Thumb, ToneTag } from "./parts";
import {
  actionIsDanger, actionLabel, approvalRate, availableActions, historyLabel, isDeleted, paymentLabel, parseProductDetail, saleStatus, shortId, statusInfo,
  type ProductAction, type ProductDetail, type ProductItem,
} from "./productsModel";

/** Raio-X do produto: o que o admin precisa ver para aprovar, e as ações. Lê tudo de uma vez do servidor. */
export function ProductSheet({ id, seed, onClose }: { id: string | null; seed: ProductItem | null; onClose: () => void }) {
  // guarda o último produto para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: ProductItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <SheetBody key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SheetBody({ id, seed, onClose }: { id: string; seed: ProductItem | null; onClose: () => void }) {
  const [mod, setMod] = useState<ModerationTarget | null>(null);
  const q = useQuery({
    queryKey: ["admin-product-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_product_detail" as never, { _id: id } as never);
      if (error) throw error;
      return parseProductDetail(data);
    },
  });
  const d = q.data;
  const p = d?.product;
  const head = p ?? seed;
  const st = head ? statusInfo(head) : null;
  const sellerName = d?.seller.name ?? seed?.seller_name ?? "Seller";
  const actions = p ? availableActions(p) : [];
  const primary: ProductAction | undefined = actions.find((a) => a === "approve" || a === "restore");
  const others = actions.filter((a) => a !== primary);
  const start = (action: ProductAction) => { if (p) setMod({ product: { id: p.id, name: p.name, status: p.status, deleted_at: p.deleted_at, seller_name: sellerName }, action }); };
  const checkoutLink = p?.checkout_url && !isDeleted(p) && p.status === "active" ? getCheckoutLink(p.checkout_url) : "";

  return (
    <>
      <DialogHead icon={<Package className="h-5 w-5" />} title={head?.name ?? "Produto"} subtitle={`${sellerName}${head?.created_at ? ` · criado em ${dateLabel(head.created_at)}` : ""}`}
        aside={st ? <ToneTag tone={st.tone}>{st.label}</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o raio-X do produto…</p>
            : q.isError || !d ? (
              <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
                {friendlyError(q.error, "Não foi possível carregar o produto.")} <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar de novo</button>
              </p>
            ) : <Detail d={d} onChanged={() => void q.refetch()} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          {checkoutLink && <button type="button" className="vp-ghost !h-12 justify-center gap-2" onClick={() => openExternal(checkoutLink)}><ExternalLink className="h-4 w-4" /> Abrir checkout</button>}
          {others.map((a) => (
            <button key={a} type="button" onClick={() => start(a)} className={cn("vp-ghost !h-12 justify-center", actionIsDanger(a) && "!text-destructive")}>{p ? actionLabel(a, p) : ""}</button>
          ))}
          {primary && p && <button type="button" onClick={() => start(primary)} className="vp-cta !h-12 justify-center sm:min-w-[150px]">{actionLabel(primary, p)}</button>}
        </DialogFoot>
      </div>
      <ModerationDialog target={mod} onClose={() => setMod(null)} />
    </>
  );
}

function Detail({ d, onChanged }: { d: ProductDetail; onChanged: () => void }) {
  const { product: p, seller: s, stats: x } = d;
  const rate = approvalRate(x.sales, x.attempts);
  const deleted = isDeleted(p);
  const showReason = p.rejection_reason && (deleted || p.status !== "active");
  const flags = [
    { on: p.pix, label: "Pix" }, { on: p.card, label: "Cartão" }, { on: p.boleto, label: "Boleto" },
    { on: p.timer !== null, label: p.timer !== null ? `Cronômetro de ${p.timer} min` : "Cronômetro" },
    { on: p.guarantee, label: "Garantia" }, { on: p.address_required, label: "Pede endereço" },
    { on: p.affiliate_enabled, label: `Afiliados (${p.affiliate_commission}%)` }, { on: p.co_production_enabled, label: "Coprodução" },
    { on: p.upsell_enabled, label: "Upsell" }, { on: p.downsell_enabled, label: "Downsell" },
  ];

  return (
    <>
      {p.status === "pending_review" && !deleted && (
        <p className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">Esperando a sua análise. Enquanto isso o checkout não vende este produto.</p>
      )}
      {showReason && <p className="text-[14px] text-foreground/90"><span className="font-semibold">Último motivo registrado:</span> {p.rejection_reason}</p>}

      <div className="flex flex-col gap-4 sm:flex-row">
        <Thumb url={p.image_url} name={p.name} size={112} className="self-start" />
        <div className="min-w-0 flex-1 space-y-3">
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-6 gap-y-3">
            <Info label="Preço">{brl(p.price)}</Info>
            <Info label="Entrega">{p.delivery_type === "digital" || !p.delivery_type ? "Digital" : p.delivery_type}</Info>
          </dl>
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Descrição que o comprador lê</p>
            {p.description.trim()
              ? <p className="mt-0.5 max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/90">{p.description}</p>
              : <p className="mt-0.5 text-[14px] text-muted-foreground">O seller não escreveu descrição.</p>}
          </div>
        </div>
      </div>

      <Block title="Classificação"><ClassPicker productId={p.id} value={p.classification} onChanged={onChanged} /></Block>

      <Block title="Seller" aside={`${s.products_total} ${s.products_total === 1 ? "produto" : "produtos"} na conta`}>
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Nome">{s.name}</Info>
          <Info label="E-mail">{s.email ?? "—"}</Info>
          <Info label="Telefone">{s.phone ?? "—"}</Info>
          <Info label="Documento">{s.document_masked ?? "—"}</Info>
        </dl>
      </Block>

      <Block title="Financeiro" aside="vendas reais, sem simulações">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Figure label="Vendas pagas" value={x.sales.toLocaleString("pt-BR")} sub={x.attempts === 0 ? "nenhuma tentativa" : `${x.attempts.toLocaleString("pt-BR")} tentativas${rate !== null ? ` · ${String(rate).replace(".", ",")}% pagas` : ""}`} />
          <Figure label="Faturado" value={brl(x.gross)} sub={`líquido ${brl(x.net)}`} />
          <Figure label="Taxas pagas" value={brl(x.fees)} />
          <Figure label="Reembolsado" value={brl(x.refunded)} sub={x.refunds > 0 ? `${x.refunds} ${x.refunds === 1 ? "venda" : "vendas"}` : "nenhum"} tone={x.refunds > 0 ? "warning" : undefined} />
          <Figure label="Chargebacks" value={x.chargebacks.toLocaleString("pt-BR")} sub={x.chargebacks > 0 ? brl(x.chargeback_amount) : "nenhum"} tone={x.chargebacks > 0 ? "destructive" : undefined} />
          <Figure label="Aguardando pagamento" value={x.pending.toLocaleString("pt-BR")} sub={x.failed > 0 ? `${x.failed} recusadas ou expiradas` : undefined} />
        </div>
      </Block>

      {d.methods.length > 0 && (
        <Block title="Como pagam">
          <ul className="divide-y divide-border/50 rounded-[14px] bg-muted/30">
            {d.methods.map((m) => (
              <li key={m.method} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                <span className="font-semibold text-foreground">{paymentLabel(m.method)}</span>
                <span className="text-muted-foreground">{m.count} {m.count === 1 ? "venda" : "vendas"} · <span className="font-semibold tabular-nums text-foreground">{brl(m.gross)}</span></span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Vendas recentes" aside={d.recent_sales.length > 0 ? `as ${d.recent_sales.length} mais novas` : undefined}>
        {d.recent_sales.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Este produto ainda não teve nenhuma tentativa de compra.</p> : (
          <ul className="divide-y divide-border/50 rounded-[14px] bg-muted/30">
            {d.recent_sales.map((t) => {
              const ss = saleStatus(t.status);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                  <span className="min-w-0 truncate"><span className="font-semibold text-foreground">{t.buyer || "Comprador"}</span> <span className="text-muted-foreground">· {paymentLabel(t.payment_method)} · {dateLabel(t.created_at)}</span></span>
                  <span className="flex items-center gap-2"><span className="font-semibold tabular-nums text-foreground">{brl(t.amount)}</span><ToneTag tone={ss.tone}>{ss.label}</ToneTag></span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      {d.disputes.total > 0 && (
        <Block title="Disputas" aside={`${d.disputes.total} no total · ${brl(d.disputes.amount)} contestados${d.disputes.open > 0 ? ` · ${d.disputes.open} em aberto` : ""}`}>
          <ul className="divide-y divide-border/50 rounded-[14px] bg-muted/30">
            {d.disputes.items.map((x2) => (
              <li key={x2.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                <span className="font-semibold text-foreground">{typeLabel(x2.type)} <span className="font-normal text-muted-foreground">· {dateLabel(x2.created_at)}</span></span>
                <span className="tabular-nums text-foreground">{brl(x2.amount)}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Ofertas e vendas ligadas">
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Info label="Order bumps">{d.bumps.length === 0 ? "Nenhum" : d.bumps.map((b) => `${b.name} (${brl(b.price)})${b.is_active ? "" : " · desligado"}`).join("; ")}</Info>
          <Info label="Vendas por afiliados">{d.affiliate.sales === 0 ? "Nenhuma" : `${d.affiliate.sales} · ${brl(d.affiliate.commission)} de comissão`}</Info>
          <Info label="Área de membros">{d.courses.length === 0 ? "Sem curso" : d.courses.map((c) => `${c.title}${c.is_published ? "" : " (rascunho)"}`).join("; ")}</Info>
        </dl>
      </Block>

      <Block title="Como o checkout está configurado">
        <ul className="flex flex-wrap gap-2">
          {flags.filter((f) => f.on).map((f) => <li key={f.label} className="rounded-full bg-accent px-3 py-1 text-[13px] font-medium text-accent-foreground">{f.label}</li>)}
          {flags.every((f) => !f.on) && <li className="text-[13.5px] text-muted-foreground">Nada ligado ainda.</li>}
        </ul>
        {flags.some((f) => !f.on) && <p className="mt-2 text-[12.5px] text-muted-foreground">Desligado: {flags.filter((f) => !f.on).map((f) => f.label).join(", ")}.</p>}
        {(p.upsell_enabled || p.downsell_enabled) && <p className="mt-2 text-[12.5px] text-muted-foreground">Upsell e downsell ficam salvos, mas o checkout público ainda não os mostra.</p>}
      </Block>

      <Block title="Histórico do produto">
        {d.history.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Nenhuma ação da equipe registrada.</p> : (
          <ol className="space-y-3 border-l border-border pl-4">
            {d.history.map((h) => (
              <li key={h.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full bg-primary" />
                <p className="text-[13.5px] font-semibold text-foreground">{historyLabel(h)}</p>
                <p className="text-[12.5px] text-muted-foreground">{dateLabel(h.created_at)}{h.admin_name ? ` · ${h.admin_name}` : ""}</p>
                {h.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-foreground/85">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground">Código do produto: {shortId(p.id)}</p>
      </Block>
    </>
  );
}

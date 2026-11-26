/**
 * Checkouts: a página de pagamento de cada produto ativo.
 * Personalizar abre o construtor de checkout (a única tela que grava aparência, formas de pagamento e ofertas,
 * com prévia da página de verdade). Cupons ficam em Marketing → Cupons; aqui só aparece o resumo.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Copy, ExternalLink, Info, Package, Palette, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCoupons, useProducts } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Notice } from "@/components/seller-ui/studio";
import { couponState } from "@/components/marketing/couponMeta";
import { checkoutMethods, getCheckoutLink, type AllowedMethods } from "@/components/products/productPresentation";
import { copyText } from "@/features/public-checkout/copyText";
import { defaultCheckoutProcessor } from "@/features/public-checkout/processor";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Product = Tables<"products">;

const orb = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { data: coupons = [] } = useCoupons();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: allowed = null } = useQuery({
    queryKey: ["my-payment-methods", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<AllowedMethods> => {
      const { data, error } = await supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return { pix: !!data?.pix_enabled, boleto: !!data?.boleto_enabled, card: !!data?.credit_card_enabled };
    },
  });

  const activeProducts = useMemo(() => products.filter((p) => p.status === "active" && !p.deleted_at), [products]);
  const usableCoupons = useMemo(() => coupons.filter((c) => couponState(c) === "active"), [coupons]);
  const couponsFor = (productId: string) => usableCoupons.filter((c) => c.product_id === productId || c.product_id === null).length;

  const openBuilder = (p: Product) => navigate(`/vendas/produtos/${p.id}/checkout-builder`, { state: { product: p } });
  const copyLink = async (p: Product) => {
    const link = p.checkout_url ? getCheckoutLink(p.checkout_url) : "";
    if (!link) return;
    if (await copyText(link)) {
      toast.success("Link do checkout copiado.");
      setCopiedId(p.id);
      window.setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 2000);
    } else {
      toast.error("Não foi possível copiar. Abra o checkout e copie o endereço do navegador.");
    }
  };
  const openCheckout = (p: Product) => {
    const link = p.checkout_url ? getCheckoutLink(p.checkout_url) : "";
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="vp-fade space-y-6 pb-6 md:space-y-8">
      <Seo title="Checkouts | Vemprapay" description="A página de pagamento de cada produto." path="/vendas/checkout" noindex />

      <SectionTabs section="products" />
      <PageHead title="Checkouts" subtitle="A página de pagamento de cada produto ativo. Personalize cores, banners, formas de pagamento e ofertas no construtor." />

      {!defaultCheckoutProcessor.available && (
        <Notice tone="warn" icon={<Info className="h-4 w-4" />} title="Os pagamentos ainda não estão ligados">
          A plataforma ainda não tem adquirente conectada. Os links já abrem e mostram o pedido, mas o comprador vê o aviso "Pagamentos indisponíveis agora" e nada é cobrado.
        </Notice>
      )}

      {isError ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />}
            title="Não foi possível carregar seus produtos"
            text="Confira sua conexão e tente de novo."
            action={<button type="button" className="vp-ghost" onClick={() => void refetch()}>Tentar de novo</button>}
          />
        </section>
      ) : isLoading ? (
        <section aria-label="Carregando checkouts" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="vp-sheet h-[360px] animate-pulse bg-muted/40 motion-reduce:animate-none" />)}
        </section>
      ) : activeProducts.length === 0 ? (
        <section className="vp-sheet" aria-label="Checkouts">
          <EmptyPanel
            icon={<Package className="h-7 w-7" />}
            title="Nenhum produto ativo"
            text="O checkout nasce junto com o produto. Ative um produto para personalizar a página de pagamento dele."
            action={<button type="button" className="vp-cta" onClick={() => navigate("/vendas/produtos")}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Ir para Produtos</button>}
          />
        </section>
      ) : (
        <section aria-label="Checkouts" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activeProducts.map((p) => {
            const methods = checkoutMethods(p, allowed);
            const couponCount = couponsFor(p.id);
            const link = p.checkout_url ? getCheckoutLink(p.checkout_url) : "";
            return (
              <article key={p.id} className="vp-sheet group flex min-w-0 flex-col overflow-hidden transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
                  ) : (
                    <div className="grid h-full w-full place-items-center"><span aria-hidden className="font-heading text-[64px] font-extrabold leading-none tracking-[-0.05em] text-primary/35">{(p.name || "?").charAt(0).toUpperCase()}</span></div>
                  )}
                  <div className="absolute inset-x-3.5 top-3.5 flex flex-wrap items-center gap-1.5">
                    {methods.length > 0 ? methods.map((m) => (
                      <span key={m} className="rounded-full bg-card/95 px-3 py-1 text-[12.5px] font-bold text-foreground shadow-sm backdrop-blur-sm">{m}</span>
                    )) : (
                      <span className="rounded-full bg-destructive px-3 py-1 text-[12.5px] font-bold text-destructive-foreground shadow-sm">Sem forma de pagamento</span>
                    )}
                    {p.checkout_timer_enabled && <span className="rounded-full bg-warning px-3 py-1 text-[12.5px] font-bold text-white shadow-sm">Com timer</span>}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 title={p.name} className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{p.name}</h3>
                  <Money value={Number(p.price)} className="mt-2 block text-[26px] font-extrabold leading-none tracking-[-0.04em] text-foreground" centsClassName="opacity-65" />
                  {p.description && <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">{p.description}</p>}

                  {link && (
                    <button
                      type="button"
                      onClick={() => void copyLink(p)}
                      title="Copiar link do checkout"
                      aria-label={`Copiar link do checkout de ${p.name}`}
                      className="mt-4 flex h-10 w-full items-center gap-2.5 rounded-full bg-muted/70 px-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {copiedId === p.id ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />}
                      <span className={cn("truncate text-[13px] font-medium", copiedId === p.id ? "text-primary" : "text-muted-foreground")}>{copiedId === p.id ? "Link copiado" : link.replace(/^https?:\/\//, "")}</span>
                    </button>
                  )}

                  {couponCount > 0 && (
                    <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-[13px] font-bold text-warning">
                      <Ticket className="h-3.5 w-3.5" />{couponCount} {couponCount === 1 ? "cupom vale aqui" : "cupons valem aqui"}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-1 pt-5">
                    <button type="button" className="vp-cta h-10 px-4 text-[13.5px]" onClick={() => openBuilder(p)}>
                      <Palette className="h-4 w-4" strokeWidth={2.3} />
                      Personalizar
                    </button>
                    {link && (
                      <div className="ml-auto flex items-center">
                        <button type="button" onClick={() => openCheckout(p)} className={orb} title="Abrir checkout" aria-label={`Abrir o checkout de ${p.name} em uma nova aba`}>
                          <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Cupons: só o resumo; criar e editar fica em Marketing → Cupons, com as regras completas. */}
      <section className="vp-sheet flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7" aria-label="Cupons de desconto">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Ticket className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Cupons de desconto</h2>
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {usableCoupons.length === 0
                ? "Nenhum cupom valendo agora. Crie e acompanhe seus cupons em Marketing."
                : `${usableCoupons.length} ${usableCoupons.length === 1 ? "cupom valendo" : "cupons valendo"} agora. O comprador digita o código no checkout ou abre o link com o cupom, que já aplica o desconto.`}
            </p>
          </div>
        </div>
        <div className="shrink-0"><Link to="/vendas/cupons" className="vp-ghost">{coupons.length === 0 ? "Criar cupom" : "Ver cupons"}</Link></div>
      </section>
    </div>
  );
}

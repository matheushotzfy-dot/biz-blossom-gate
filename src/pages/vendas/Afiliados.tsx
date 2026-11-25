/**
 * Afiliados: o programa do vendedor (quem divulga os produtos dele), as afiliações dele em produtos de
 * outras pessoas e a vitrine para escolher o que divulgar. Comissão e divisão de saldo acontecem no
 * servidor (apply_transaction_splits); aqui só configuramos o programa e geramos os links.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useProducts } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { ProgramDialog, type ProgramSaveResult, type ProgramValues } from "@/components/marketing/ProgramDialog";
import { ProgramTab, type ProgramProductRow } from "@/components/marketing/ProgramTab";
import { MyLinksTab, type LinkProduct } from "@/components/marketing/MyLinksTab";
import { ExploreTab } from "@/components/marketing/ExploreTab";
import { copyText } from "@/components/seller-ui/copy";
import {
  COMMISSION_DEFAULT, affiliateErrorMessage, affiliateUrl, type AffiliateLink, type AffiliateSale, type CatalogProduct,
} from "@/components/marketing/affiliateMeta";

type Tab = "program" | "mine" | "explore";
const TABS: Tab[] = ["program", "mine", "explore"];

const CATALOG_COLS = "id, name, price, image_url, affiliate_commission, display_name, delivery_type, checkout_url, created_at";

export default function Afiliados() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { hidden } = usePrivacyMode();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [myLinks, setMyLinks] = useState<AffiliateLink[]>([]);
  const [programLinks, setProgramLinks] = useState<AffiliateLink[]>([]);
  const [mySales, setMySales] = useState<AffiliateSale[]>([]);
  const [programSales, setProgramSales] = useState<AffiliateSale[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [extra, setExtra] = useState<Map<string, CatalogProduct>>(new Map());
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const [mine, prog, salesMine, salesProg, cat] = await Promise.all([
        supabase.from("affiliate_links").select("*").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("affiliate_links").select("*").eq("owner_user_id", user.id).neq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("affiliate_sales").select("*").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }).limit(500),
        supabase.from("affiliate_sales").select("*").eq("seller_user_id", user.id).order("created_at", { ascending: false }).limit(500),
        supabase.from("products_public").select(CATALOG_COLS).eq("status", "active").eq("affiliate_enabled", true).order("created_at", { ascending: false }).limit(200),
      ]);
      if (mine.error || prog.error || salesMine.error || salesProg.error || cat.error) throw new Error("load");
      const links = (mine.data ?? []) as unknown as AffiliateLink[];
      setMyLinks(links);
      setProgramLinks((prog.data ?? []) as unknown as AffiliateLink[]);
      setMySales((salesMine.data ?? []) as unknown as AffiliateSale[]);
      setProgramSales((salesProg.data ?? []) as unknown as AffiliateSale[]);
      const catalogRows = ((cat.data ?? []) as unknown as CatalogProduct[]).filter((x) => x.id);
      setCatalog(catalogRows);

      // Produtos dos seus links que já saíram da vitrine (programa fechado ou produto pausado).
      const known = new Set(catalogRows.map((x) => x.id));
      const missing = [...new Set(links.map((l) => l.product_id))].filter((id) => !known.has(id));
      if (missing.length > 0) {
        const { data } = await supabase.from("products_public").select(CATALOG_COLS).in("id", missing);
        setExtra(new Map(((data ?? []) as unknown as CatalogProduct[]).map((x) => [x.id, x])));
      } else setExtra(new Map());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const ownById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const catalogById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

  const productInfo = (id: string): LinkProduct | undefined => {
    const own = ownById.get(id);
    if (own) return { name: own.name, image_url: own.image_url, checkout_url: own.checkout_url };
    const c = catalogById.get(id) ?? extra.get(id);
    return c ? { name: c.name, image_url: c.image_url, checkout_url: c.checkout_url } : undefined;
  };
  const productName = (id: string) => productInfo(id)?.name ?? "Produto indisponível";

  const programRows: ProgramProductRow[] = useMemo(
    () => products.filter((p) => p.status !== "draft").map((p) => ({
      id: p.id, name: p.name, price: Number(p.price), status: p.status, image_url: p.image_url,
      enabled: !!p.affiliate_enabled, commission: Number(p.affiliate_commission) || COMMISSION_DEFAULT,
    })),
    [products],
  );
  const exploreList = useMemo(() => catalog.filter((c) => !ownById.has(c.id)), [catalog, ownById]);
  const linkByProduct = useMemo(() => new Map(myLinks.map((l) => [l.product_id, l])), [myLinks]);

  const initial: Tab = programRows.length === 0 ? "explore" : programRows.some((p) => p.enabled) || programLinks.length > 0 || myLinks.length === 0 ? "program" : "mine";
  const requested = params.get("tab");
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : initial;
  const setTab = (t: Tab) => setParams(t === initial && !requested ? {} : { tab: t }, { replace: true });
  const booting = !requested && (loading || loadingProducts);

  /* ── Programa ── */
  const configuring = programRows.find((r) => r.id === configuringId) ?? null;
  const configuringProduct = configuring ? { ...configuring, affiliates: programLinks.filter((l) => l.product_id === configuring.id).length } : null;

  const saveProgram = async (v: ProgramValues): Promise<ProgramSaveResult> => {
    if (!user || !configuring) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
    const { error } = await supabase.from("products").update({ affiliate_enabled: v.enabled, affiliate_commission: v.commission }).eq("id", configuring.id).eq("user_id", user.id);
    if (error) return { ok: false, message: affiliateErrorMessage(error, "Não foi possível salvar o programa. Tente de novo.") };

    let partial = false;
    if (!v.enabled && configuring.enabled) {
      const { error: e2 } = await supabase.from("affiliate_links").update({ is_active: false }).eq("product_id", configuring.id).eq("owner_user_id", user.id);
      if (e2) partial = true;
    }
    if (v.enabled && v.applyToCurrent) {
      const { error: e3 } = await supabase.from("affiliate_links").update({ commission_pct: v.commission }).eq("product_id", configuring.id).eq("owner_user_id", user.id);
      if (e3) partial = true;
    }
    void qc.invalidateQueries({ queryKey: ["products"], exact: false });
    await load();
    setConfiguringId(null);
    if (partial) toast.warning("O produto foi salvo, mas não deu para atualizar os links dos afiliados. Ajuste pela lista de afiliados.");
    else toast.success(v.enabled ? (configuring.enabled ? "Programa atualizado." : "Programa aberto. O produto já aparece em Explorar produtos.") : "Programa encerrado neste produto.");
    return { ok: true };
  };

  const toggleLink = async (l: AffiliateLink) => {
    if (busyLinkId) return;
    if (!l.is_active && l.affiliate_user_id === user?.id && !catalogById.has(l.product_id)) { toast.error("O produtor encerrou o programa deste produto."); return; }
    setBusyLinkId(l.id);
    const { error } = await supabase.from("affiliate_links").update({ is_active: !l.is_active }).eq("id", l.id);
    setBusyLinkId(null);
    if (error) { toast.error(affiliateErrorMessage(error, "Não foi possível alterar o link. Tente de novo.")); return; }
    toast.success(l.is_active ? "Link pausado." : "Link reativado.");
    void load();
  };

  /* ── Afiliar-se ── */
  const affiliate = async (p: CatalogProduct) => {
    if (!user || busyProductId) return;
    if (linkByProduct.has(p.id)) { void seeLink(p); return; }
    setBusyProductId(p.id);
    try {
      const { data: ownerId, error: ownerErr } = await supabase.rpc("get_affiliate_product_owner", { _product_id: p.id });
      if (ownerErr) { toast.error("Não foi possível criar o link. Tente de novo."); return; }
      if (!ownerId) { toast.error("Este produto não aceita afiliados agora."); void load(); return; }
      if (ownerId === user.id) { toast.error("Você não pode divulgar o seu próprio produto."); return; }
      const slug = `aff-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const { error } = await supabase.from("affiliate_links").insert({
        product_id: p.id, affiliate_user_id: user.id, owner_user_id: ownerId as string, slug,
        commission_pct: Number(p.affiliate_commission) || COMMISSION_DEFAULT,
      });
      if (error) { toast.error(affiliateErrorMessage(error, "Não foi possível criar o link. Tente de novo.")); return; }
      const url = affiliateUrl(p.checkout_url, slug);
      if (url) await copyText(url, "Link criado e copiado.");
      else toast.success("Link criado.");
      await load();
      setTab("mine");
    } catch {
      toast.error("Não foi possível criar o link. Tente de novo.");
    } finally {
      setBusyProductId(null);
    }
  };

  const seeLink = async (p: CatalogProduct) => {
    const l = linkByProduct.get(p.id);
    const url = l ? affiliateUrl(p.checkout_url, l.slug) : "";
    if (url) await copyText(url, "Seu link foi copiado.");
    else setTab("mine");
  };

  const subtitle: Record<Tab, string> = {
    program: "Deixe outras pessoas venderem seus produtos em troca de uma comissão. Você escolhe quanto paga e acompanha cada venda.",
    mine: "Os links que você divulga, as vendas que eles geraram e as comissões que já caíram no seu saldo.",
    explore: "Produtos de outros vendedores que pagam comissão. Gere seu link em um clique e comece a divulgar.",
  };

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Afiliados | Vemprapay" description="Programa de afiliados, seus links e produtos para divulgar." path="/vendas/afiliados" noindex />

      <SectionTabs section="growth" />
      <PageHead title="Afiliados" subtitle={subtitle[tab]} />

      <FilterPills<Tab>
        label="Áreas dos afiliados"
        value={tab}
        onChange={setTab}
        options={[
          { value: "program", label: "Meu programa" },
          { value: "mine", label: "Afiliações" },
          { value: "explore", label: "Explorar" },
        ]}
      />

      {loadError ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />}
            title="Não foi possível carregar os afiliados"
            text="Confira sua conexão e tente de novo. Seus links e comissões continuam salvos."
            action={<button type="button" className="vp-ghost" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</button>}
          />
        </section>
      ) : booting ? (
        <div className="space-y-4" aria-busy="true"><div className="vp-skel h-[128px] !rounded-[22px]" /><div className="vp-skel h-[260px] !rounded-[22px]" /></div>
      ) : tab === "program" ? (
        <ProgramTab
          loading={loading || loadingProducts} hidden={hidden} products={programRows} links={programLinks} sales={programSales}
          productName={productName} busyLinkId={busyLinkId} onConfigure={setConfiguringId} onToggleLink={(l) => void toggleLink(l)}
        />
      ) : tab === "mine" ? (
        <MyLinksTab
          loading={loading} hidden={hidden} links={myLinks} sales={mySales} product={productInfo} inProgram={(id) => catalogById.has(id)} busyLinkId={busyLinkId}
          onToggle={(l) => void toggleLink(l)} onCopy={(url) => void copyText(url, "Link copiado.")} onExplore={() => setTab("explore")}
        />
      ) : (
        <ExploreTab
          loading={loading} error={false} hidden={hidden} products={exploreList} linkByProduct={linkByProduct} busyProductId={busyProductId}
          onAffiliate={(p) => void affiliate(p)} onSeeLink={(p) => void seeLink(p)} onRetry={() => { setLoading(true); void load(); }}
        />
      )}

      <ProgramDialog product={configuringProduct} onOpenChange={(o) => { if (!o) setConfiguringId(null); }} onSave={saveProgram} />
    </div>
  );
}

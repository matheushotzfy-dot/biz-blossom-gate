import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import type { Product } from "@/components/products/productPresentation";
import { getCheckoutLink, getEffectiveStatus, isCheckoutLive } from "@/components/products/productPresentation";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { supabase } from "@/integrations/supabase/client";

type FilterTab = "all" | "active" | "draft" | "pending_review" | "inactive";

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts, isLoading: productsLoading } = useProducts();

  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // A busca global (Ctrl-K) chega aqui com `?q=`; só lê a URL na entrada (mudar a query remonta a página).
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => (params.get("q") ?? "").trim().slice(0, 120));
  const [tab, setTab] = useState<FilterTab>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  // Pre-compute effective status for every product (handles auto-draft).
  const productsWithStatus = useMemo(
    () => products.map((p) => ({ product: p, eff: getEffectiveStatus(p) })),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productsWithStatus
      .filter(({ product, eff }) => {
        if (tab !== "all" && eff !== tab) return false;
        return !q || product.name.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
      })
      .map(({ product }) => product);
  }, [productsWithStatus, search, tab]);

  const counts = useMemo(() => {
    const c: Record<"active" | "draft" | "pending_review" | "inactive", number> = { active: 0, draft: 0, pending_review: 0, inactive: 0 };
    for (const { eff } of productsWithStatus) {
      if (eff in c) c[eff as keyof typeof c]++;
    }
    return c;
  }, [productsWithStatus]);

  // "Rascunho" na tela inclui produto ativo com dados faltando; só quem tem status "draft" no banco
  // nunca foi publicado e pode ser apagado de vez. O resto pode ter histórico de vendas e fica de fora.
  const draftIds = useMemo(
    () => products.filter((p) => p.status === "draft").map((p) => p.id),
    [products]
  );
  const incompleteActive = useMemo(
    () => productsWithStatus.filter((p) => p.eff === "draft" && p.product.status !== "draft").length,
    [productsWithStatus]
  );

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: counts.active },
    { label: "Rascunhos", value: "draft" as const, count: counts.draft },
    { label: "Em revisão", value: "pending_review" as const, count: counts.pending_review },
    { label: "Pausados", value: "inactive" as const, count: counts.inactive },
  ];

  const handleEditProduct = useCallback((product: Product) => navigate(`/vendas/produtos/${product.id}/editar`), [navigate]);
  const handleOpenMembers = useCallback((product: Product) => navigate(`/vendas/conteudo/${product.id}/builder`), [navigate]);
  const handleOpenCheckout = useCallback((product: Product) => {
    if (!isCheckoutLive(product)) {
      toast.info("O checkout ficará público quando o produto estiver ativo.");
      return;
    }
    const url = getCheckoutLink(product.checkout_url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);
  const handleCopyLink = useCallback(async (product: Product) => {
    if (!isCheckoutLive(product)) {
      toast.info("O link ficará disponível quando o produto estiver ativo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(getCheckoutLink(product.checkout_url));
      setCopiedId(product.id);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);
  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    // Soft delete: keep record for admin audit (sales, customers, history)
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", deleteTarget)
      .eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido");
    await loadProducts();
  };

  const confirmClearDrafts = async () => {
    if (!user || draftIds.length === 0) return;
    setClearingDrafts(true);
    // Drafts can be hard-deleted (no sales history)
    const { error } = await supabase.from("products").delete().in("id", draftIds).eq("user_id", user.id).eq("status", "draft");
    setClearingDrafts(false);
    setClearDraftsOpen(false);
    if (error) { toast.error("Erro ao limpar rascunhos"); return; }
    toast.success(draftIds.length === 1 ? "Rascunho excluído" : `${draftIds.length} rascunhos excluídos`);
    await loadProducts();
  };

  const handleDuplicate = useCallback(async (product: Product) => {
    if (!user) return;
    const slug = crypto.randomUUID().slice(0, 8);
    const checkoutUrl = `${window.location.origin}/pay/${slug}`;
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name: `${product.name} (cópia)`,
      description: product.description,
      price: product.price,
      status: "pending_review",
      image_url: product.image_url,
      display_name: product.display_name,
      delivery_type: product.delivery_type,
      checkout_url: checkoutUrl,
      checkout_pix_enabled: product.checkout_pix_enabled,
      checkout_credit_card_enabled: product.checkout_credit_card_enabled,
      checkout_boleto_enabled: product.checkout_boleto_enabled,
    });
    if (error) { toast.error("Erro ao duplicar produto"); return; }
    toast.success("Produto duplicado! Aguardando revisão.");
    await loadProducts();
  }, [user, loadProducts]);

  const handleToggleStatus = useCallback(async (product: Product) => {
    if (!user) return;
    const next = product.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("products")
      .update({ status: next })
      .eq("id", product.id)
      .eq("user_id", user.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(next === "active" ? "Vendas reativadas!" : "Vendas pausadas. Produto fora do checkout público.");
    await loadProducts();
  }, [user, loadProducts]);

  const handleDeleteProduct = useCallback((product: Product) => setDeleteTarget(product.id), []);
  const handleOpenPixels = useCallback((product: Product) => setPixelProduct(product), []);

  const menuHandlers = useMemo(() => ({
    onCopyLink: handleCopyLink,
    onDeleteProduct: handleDeleteProduct,
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: handleOpenPixels,
    onDuplicateProduct: handleDuplicate,
    onToggleStatus: handleToggleStatus,
  }), [handleCopyLink, handleDeleteProduct, handleEditProduct, handleOpenCheckout, handleOpenMembers, handleOpenPixels, handleDuplicate, handleToggleStatus]);

  const showClearDraftsBtn = tab === "draft" && draftIds.length > 0;
  const hasFilter = search.trim() !== "" || tab !== "all";
  const goNew = () => navigate("/vendas/produtos/novo/editar");

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Produtos | Vemprapay" description="Gerencie seu catálogo, checkouts e área de membros." path="/vendas/produtos" noindex />

      <SectionTabs section="products" />
      <PageHead
        title="Produtos"
        subtitle="Tudo o que você vende, com checkout, pixels e área de membros de cada produto."
        actions={
          <>
            {showClearDraftsBtn && (
              <button type="button" onClick={() => setClearDraftsOpen(true)} className="vp-ghost">
                <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                Limpar rascunhos
                <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[12px] font-bold tabular-nums">{draftIds.length}</span>
              </button>
            )}
            <button type="button" onClick={goNew} className="vp-cta">
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
              Novo produto
            </button>
          </>
        }
      />

      {/* Filtros e busca (só aparecem quando já existe catálogo) */}
      {(products.length > 0 || productsLoading) && (
        <div className="vp-sheet flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <FilterPills<FilterTab>
            label="Filtrar produtos por situação"
            value={tab}
            options={tabs.map((t) => ({ value: t.value, label: t.label, count: t.count > 0 ? t.count : undefined }))}
            onChange={setTab}
          />
          <SearchField label="Buscar produtos" value={search} onChange={setSearch} placeholder="Nome ou descrição" className="lg:w-[320px] lg:shrink-0" />
        </div>
      )}

      {/* Catálogo */}
      {productsLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Carregando produtos">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="vp-sheet overflow-hidden">
              <div className="vp-skel aspect-[16/10] w-full" />
              <div className="space-y-3 p-5">
                <div className="vp-skel h-5 w-3/4 rounded-full" />
                <div className="vp-skel h-4 w-1/3 rounded-full" />
                <div className="vp-skel h-8 w-1/2 rounded-full" />
                <div className="vp-skel h-10 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="vp-sheet">
          {hasFilter ? (
            <EmptyPanel
              icon={<Package className="h-7 w-7" />}
              title="Nenhum produto encontrado"
              text="Nada bate com esse filtro ou busca. Limpe os filtros para ver o catálogo inteiro."
              action={<button type="button" className="vp-ghost" onClick={() => { setSearch(""); setTab("all"); }}>Limpar filtros</button>}
            />
          ) : (
            <EmptyPanel
              icon={<Package className="h-7 w-7" />}
              title="Seu catálogo está vazio"
              text="Crie o primeiro produto, defina preço e entrega e publique o checkout para começar a vender."
              action={<button type="button" className="vp-cta" onClick={goNew}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar primeiro produto</button>}
            />
          )}
        </div>
      ) : (
        <ProductGridView copiedId={copiedId} products={filtered} {...menuHandlers} />
      )}

      {/* Pixels e rastreamento */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(open) => { if (!open) setPixelProduct(null); }} />
      )}

      {/* Excluir um produto */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
            <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed">
              <span className="block break-words font-semibold text-foreground">{products.find((p) => p.id === deleteTarget)?.name}</span>
              O produto sai do catálogo e o checkout deixa de abrir. O histórico das vendas já feitas continua guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={deleting} className="vp-ghost m-0 h-11 border-border">Manter produto</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="vp-cta vp-cta-danger h-11">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir produto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Limpar rascunhos */}
      <AlertDialog open={clearDraftsOpen} onOpenChange={(open) => { if (!clearingDrafts) setClearDraftsOpen(open); }}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-5 w-5" /></span>
            <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">
              Excluir {draftIds.length} {draftIds.length === 1 ? "rascunho" : "rascunhos"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed">
              São produtos que você não terminou de criar e que nunca foram publicados. Eles somem de vez e não dá para desfazer.
              {incompleteActive > 0 && (
                <span className="mt-2 block text-muted-foreground">
                  {incompleteActive === 1 ? "1 produto ativo com dados faltando fica de fora" : `${incompleteActive} produtos ativos com dados faltando ficam de fora`}, porque pode haver vendas ligadas a {incompleteActive === 1 ? "ele" : "eles"}. Edite ou exclua {incompleteActive === 1 ? "esse produto" : "esses produtos"} um por um.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={clearingDrafts} className="vp-ghost m-0 h-11 border-border">Manter rascunhos</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearDrafts} disabled={clearingDrafts} className="vp-cta vp-cta-danger h-11">
              {clearingDrafts && <Loader2 className="h-4 w-4 animate-spin" />}
              {clearingDrafts ? "Excluindo…" : draftIds.length === 1 ? "Excluir rascunho" : `Excluir ${draftIds.length} rascunhos`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

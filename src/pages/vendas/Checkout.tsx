import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Copy, Eye, Settings, Package, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import CheckoutSettingsDialog from "@/components/CheckoutSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";

export default function Checkout() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [settingsProduct, setSettingsProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false });
    if (data) setProducts(data);
  };

  useEffect(() => { load(); }, [user?.id]);

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const getSlug = (url: string) => url.split("/").pop()!;
  const openCheckout = (url: string) => window.open(`/pay/${getSlug(url)}`, "_blank");

  return (
    <PageShell>
      <PageTitle icon={<ExternalLink className="h-6 w-6" />} title="Checkout" subtitle="Links de checkout dos seus produtos" />

      {/* Desktop */}
      <div className="hidden md:block">
        <Panel>
          <div className="mb-4">
            <h3 className="text-[14px] font-bold text-foreground">Links de Pagamento</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Compartilhe para receber pagamentos</p>
          </div>
          <div className="space-y-1">
            {products.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-[13px]">Crie um produto para gerar um link</div>
            ) : products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[13px] text-foreground">{p.name}</h4>
                  <p className="text-[12px] text-muted-foreground mt-0.5">R$ {Number(p.price).toFixed(2)}</p>
                  {p.checkout_url && <p className="text-[11px] font-mono mt-0.5 truncate text-primary">{p.checkout_url}</p>}
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm" className="gap-1 rounded-xl text-[12px]" onClick={() => setSettingsProduct(p)}>
                    <Settings className="h-3 w-3" /> Personalizar
                  </Button>
                  {p.checkout_url && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1 rounded-xl text-[12px]" onClick={() => openCheckout(p.checkout_url!)}><Eye className="h-3 w-3" /> Ver</Button>
                      <Button variant="outline" size="sm" className="gap-1 rounded-xl text-[12px]" onClick={() => copyLink(p.id, p.checkout_url!)}><Copy className="h-3 w-3" /> Copiar</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Mobile cards — redesigned */}
      <div className="md:hidden space-y-3">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto ativo</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Crie um produto para gerar seu link de checkout</p>
          </div>
        ) : products.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl relative transition-all duration-500"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(20px)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div className="absolute top-0 left-0 w-full h-[1px] rounded-t-2xl" style={{ background: "var(--top-line)" }} />
            {/* Product header */}
            <div className="p-4 pb-3 relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-11 w-11 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-[14px] text-foreground truncate">{p.name}</h4>
                    <p className="text-primary font-extrabold text-[16px] mt-0.5">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsProduct(p)}
                  className="h-9 w-9 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            {p.checkout_url && (
              <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
                <p className="text-[10px] font-mono text-muted-foreground truncate">{p.checkout_url}</p>
              </div>
            )}
            {p.checkout_url && (
              <div className="flex border-t border-border/50 rounded-b-2xl">
                <button
                  onClick={() => openCheckout(p.checkout_url!)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-r border-border/50 rounded-bl-2xl"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver
                </button>
                <button
                  onClick={() => copyLink(p.id, p.checkout_url!)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-primary hover:bg-primary/5 transition-colors rounded-br-2xl"
                >
                  {copiedId === p.id ? (
                    <><CheckCircle className="h-3.5 w-3.5" /> Copiado!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copiar</>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* How to use — mobile optimized */}
      <Panel>
        <h3 className="font-bold mb-3 text-foreground text-[14px]">Como usar</h3>
        <div className="space-y-2.5 text-[13px] text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p>Cadastre um produto em <strong className="text-foreground/70">Produtos</strong>.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p>Toque em <Settings className="inline h-3 w-3" /> para <strong className="text-foreground/70">personalizar</strong> o checkout.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p>Compartilhe o link com seus clientes.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <p>Acompanhe vendas no <strong className="text-foreground/70">Dashboard</strong>.</p>
          </div>
        </div>
      </Panel>

      {settingsProduct && (
        <CheckoutSettingsDialog
          product={settingsProduct}
          open={!!settingsProduct}
          onOpenChange={(v) => { if (!v) setSettingsProduct(null); }}
          onSaved={load}
        />
      )}
    </PageShell>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Copy, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Checkout() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data); });
  }, [user?.id]);

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); toast.success("Link copiado!"); };
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
                  {p.checkout_url && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1 rounded-xl text-[12px]" onClick={() => openCheckout(p.checkout_url!)}><Eye className="h-3 w-3" /> Ver</Button>
                      <Button variant="outline" size="sm" className="gap-1 rounded-xl text-[12px]" onClick={() => copyLink(p.checkout_url!)}><Copy className="h-3 w-3" /> Copiar</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {products.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-4">Crie um produto para gerar um link</p></Panel>
        ) : products.map((p) => (
          <Panel key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm text-foreground">{p.name}</h4>
              <span className="text-primary font-bold text-sm">R$ {Number(p.price).toFixed(2)}</span>
            </div>
            {p.checkout_url && (
              <p className="text-[11px] font-mono text-muted-foreground truncate mb-3">{p.checkout_url}</p>
            )}
            {p.checkout_url && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-xl text-[12px]" onClick={() => openCheckout(p.checkout_url!)}><Eye className="h-3 w-3" /> Ver</Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-xl text-[12px]" onClick={() => copyLink(p.checkout_url!)}><Copy className="h-3 w-3" /> Copiar</Button>
              </div>
            )}
          </Panel>
        ))}
      </div>

      <Panel>
        <h3 className="font-bold mb-3 text-foreground text-[14px]">Como usar</h3>
        <div className="space-y-2 text-[13px] text-muted-foreground">
          <p>1. Cadastre um produto em <strong className="text-foreground/70">Produtos</strong>.</p>
          <p>2. O link é gerado automaticamente.</p>
          <p>3. Compartilhe com seus clientes.</p>
          <p>4. Acompanhe no <strong className="text-foreground/70">Dashboard</strong>.</p>
        </div>
      </Panel>
    </PageShell>
  );
}

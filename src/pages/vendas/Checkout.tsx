import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Copy, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function Checkout() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data); });
  }, [user]);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getSlug = (url: string) => {
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  const openCheckout = (url: string) => {
    const slug = getSlug(url);
    window.open(`/pay/${slug}`, "_blank");
  };

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ExternalLink className="h-6 w-6 text-primary" /> Checkout
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Links de checkout dos seus produtos</p>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Links de Pagamento</h3>
          <p className="text-xs text-muted-foreground mt-1">Compartilhe esses links para receber pagamentos</p>
        </div>
        <div className="divide-y divide-border">
          {products.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Crie um produto para gerar um link de checkout</div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-foreground">{p.name}</h4>
                  <p className="text-xs text-foreground mt-0.5">R$ {Number(p.price).toFixed(2)}</p>
                  {p.checkout_url && (
                    <p className="text-xs font-mono text-primary mt-1 truncate">{p.checkout_url}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {p.checkout_url && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => openCheckout(p.checkout_url!)}>
                        <Eye className="h-3 w-3" /> Visualizar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => copyLink(p.checkout_url!)}>
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-3 text-foreground">Como usar o Checkout</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Cadastre um produto na seção <strong className="text-foreground">Produtos</strong>.</p>
          <p>2. Um link de checkout será gerado automaticamente.</p>
          <p>3. Compartilhe o link com seus clientes para receber pagamentos.</p>
          <p>4. Acompanhe as vendas em tempo real no <strong className="text-foreground">Dashboard</strong>.</p>
        </div>
      </div>
    </div>
  );
}
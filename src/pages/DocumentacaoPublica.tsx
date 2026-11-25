import { Link } from "react-router-dom";
import { ArrowLeft, Webhook } from "lucide-react";
import { Seo } from "@/components/Seo";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import Documentacao from "./vendas/Documentacao";

/**
 * Documentação pública da API (/documentacao). Fica fora do painel, sem login, para poder ser
 * enviada a quem vai integrar. Usa a mesma página da aba Integrações, na identidade do seller.
 */
export default function DocumentacaoPublica() {
  useSellerSkin();
  return (
    <div className="vp-seller-shell vp-stage min-h-screen text-foreground">
      <Seo
        title="Documentação da API | Vemprapay"
        description="Como receber vendas e saques por webhook assinado com HMAC-SHA256 na Vemprapay, e a prévia da API de cobranças PIX."
        path="/documentacao"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "Documentação da API Vemprapay",
          description: "Webhooks assinados, chaves de API e a prévia da API de cobranças PIX.",
          inLanguage: "pt-BR",
          publisher: { "@type": "Organization", name: "Vemprapay" },
        }}
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Voltar para o início">
            <ArrowLeft className="h-4 w-4" />
            <VenxpayLogo className="h-6 w-auto" />
          </Link>
          <Link to="/integracoes?tab=webhooks" className="vp-cta !h-10 !px-5"><Webhook className="h-4 w-4" />Configurar webhooks</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6">
        <Documentacao standalone />
      </main>
    </div>
  );
}

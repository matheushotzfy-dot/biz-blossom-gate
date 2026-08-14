import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";
import Documentacao from "./vendas/Documentacao";

/**
 * Public API reference — https://hotzfy.com.br/documentacao
 *
 * Rendered outside the dashboard shell (no auth required) so it can be shared
 * with developers or pasted into an AI agent for integration.
 */
export default function DocumentacaoPublica() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Documentação da API PIX | Hotzfy"
        description="Referência completa da API Hotzfy: autenticação por chave secreta, criação de cobranças PIX, consulta de status e webhooks assinados com HMAC-SHA256."
        path="/documentacao"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "Documentação da API PIX Hotzfy",
          description:
            "Guia de integração da API Hotzfy: autenticação, cobranças PIX e webhooks.",
          inLanguage: "pt-BR",
          publisher: { "@type": "Organization", name: "Hotzfy" },
        }}
      />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <HotzfyLogo className="h-5 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-muted-foreground sm:inline">Documentação pública da API</span>
            <Link
              to="/integracoes?tab=keys"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Gerar chave <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6">
        <Documentacao />
      </main>
    </div>
  );
}

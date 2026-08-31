/**
 * LandingPage — página pública da VENXPAY.
 *
 * Composição de cenas independentes, todas apresentacionais: nenhuma consulta a
 * banco, nenhuma regra de negócio. A navegação leva para /auth (login/cadastro).
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroScene } from "@/components/landing/HeroScene";
import { EngineScene } from "@/components/landing/EngineScene";
import { CheckoutScene } from "@/components/landing/CheckoutScene";
import { OperationScene } from "@/components/landing/OperationScene";
import { TrustScene } from "@/components/landing/TrustScene";
import { EcosystemScene } from "@/components/landing/EcosystemScene";
import { VoicesScene } from "@/components/landing/VoicesScene";
import { OfferScene } from "@/components/landing/OfferScene";
import { FaqScene, FAQ_ITEMS } from "@/components/landing/FaqScene";
import { ClosingScene } from "@/components/landing/ClosingScene";
import "@/styles/landing.css";

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function LandingPage() {
  const navigate = useNavigate();

  const goSignup = useCallback(() => navigate("/auth?mode=signup"), [navigate]);
  const goLogin = useCallback(() => navigate("/auth"), [navigate]);

  return (
    <div id="topo" className="venx relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <Seo
        title="VENXPAY — infraestrutura de pagamentos para produtos digitais"
        description="Checkout de alta conversão, liquidação no mesmo dia, área de membros, afiliados e API. A plataforma completa para vender produtos digitais no Brasil."
        canonical="https://www.hotzfy.com.br/"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />

      <LandingNav onLogin={goLogin} onSignup={goSignup} />

      <main>
        <HeroScene onSignup={goSignup} />
        <EngineScene />
        <CheckoutScene />
        <OperationScene />
        <TrustScene />
        <EcosystemScene />
        <VoicesScene />
        <OfferScene onSignup={goSignup} />
        <FaqScene />
        <ClosingScene onSignup={goSignup} />
      </main>
    </div>
  );
}

/**
 * LandingPage — página pública da VENXPAY.
 *
 * Composição de cenas independentes, todas apresentacionais: nenhuma consulta a
 * banco, nenhuma regra de negócio. A navegação leva para /auth (login/cadastro).
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroCinema } from "@/components/landing/HeroCinema";
import { AlertScene } from "@/components/landing/AlertScene";
import { EngineScene } from "@/components/landing/EngineScene";
import { ConsoleScene } from "@/components/landing/ConsoleScene";
import { CheckoutScene } from "@/components/landing/CheckoutScene";
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

  // O app interno trava o scroll no <body>; a landing precisa dele liberado.
  useEffect(() => {
    document.documentElement.classList.add("venx-scroll");
    return () => document.documentElement.classList.remove("venx-scroll");
  }, []);

  const goSignup = useCallback(() => navigate("/auth?mode=signup"), [navigate]);
  const goLogin = useCallback(() => navigate("/auth"), [navigate]);


  return (
    <div id="topo" className="venx relative min-h-dvh bg-background text-foreground">
      <Seo
        title="VENXPAY — infraestrutura de pagamentos para produtos digitais"
        description="Checkout de alta conversão, liquidação no mesmo dia, área de membros, afiliados e API. A plataforma completa para vender produtos digitais no Brasil."
        path="/"
        jsonLd={FAQ_JSONLD}
      />


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

/**
 * LandingPage — página pública da VENXPAY (sistema escuro tecnológico, v3).
 *
 * Tudo aqui é apresentacional: sem consultas ao banco e sem regras de negócio.
 * Painéis e notificações são simulações ilustrativas. A navegação leva a /auth.
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { TechBackground } from "@/components/landing3/TechBackground";
import { TopBar } from "@/components/landing3/TopBar";
import { Hero } from "@/components/landing3/Hero";
import { StatsBand } from "@/components/landing3/StatsBand";
import { Speed } from "@/components/landing3/Speed";
import { Acquirers } from "@/components/landing3/Acquirers";
import { Withdraw } from "@/components/landing3/Withdraw";
import { CardPix } from "@/components/landing3/CardPix";
import { LivePanel } from "@/components/landing3/LivePanel";
import { Included } from "@/components/landing3/Included";
import { Integrations } from "@/components/landing3/Integrations";
import { Questions, QA } from "@/components/landing3/Questions";
import { Closing } from "@/components/landing3/Closing";
import "@/styles/landing-v3.css";

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QA.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function LandingPage() {
  const navigate = useNavigate();

  // O app interno trava o scroll no documento; a landing precisa dele liberado.
  useEffect(() => {
    document.documentElement.classList.add("vx-scroll");
    return () => document.documentElement.classList.remove("vx-scroll");
  }, []);

  const goSignup = useCallback(() => navigate("/auth?mode=signup"), [navigate]);
  const goLogin = useCallback(() => navigate("/auth"), [navigate]);

  return (
    <div id="topo" className="vx3 min-h-dvh">
      <Seo
        title="VENXPAY — gateway com aprovação acima de 75%"
        description="Gateway de pagamentos com adquirências exclusivas, aprovação acima de 75% em PIX e cartão, saque instantâneo e checkout que converte."
        path="/"
        jsonLd={FAQ_JSONLD}
      />
      <TechBackground />
      <TopBar onLogin={goLogin} onSignup={goSignup} />

      <main>
        <Hero onSignup={goSignup} />
        <StatsBand />
        <Speed />
        <Acquirers />
        <Withdraw />
        <CardPix />
        <LivePanel />
        <Included />
        <Integrations />
        <Questions />
      </main>
      <Closing onSignup={goSignup} onLogin={goLogin} />
    </div>
  );
}

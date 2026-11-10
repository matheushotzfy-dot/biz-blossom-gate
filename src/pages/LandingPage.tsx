/**
 * LandingPage — página pública da Vemprapay (identidade fintech clara).
 * Apresentacional: sem consultas ao banco. Mockups usam valores de exemplo.
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { SiteNav } from "@/components/landing-vp/SiteNav";
import { HeroSection } from "@/components/landing-vp/HeroSection";
import { FeatureGrid, HowItWorks, SecuritySection, StatsStrip } from "@/components/landing-vp/Sections";
import { CtaAndFooter, FAQ, FaqSection } from "@/components/landing-vp/FaqAndFooter";

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
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
    <div id="topo" className="vp-site min-h-dvh bg-background text-foreground">
      <Seo
        title="Vemprapay — receba com Pix e cartão e saque na hora"
        description="Gateway de pagamentos com aprovação acima de 75% em Pix e cartão, checkout que converte e saque instantâneo. Abra sua conta grátis."
        path="/"
        jsonLd={FAQ_JSONLD}
      />
      <SiteNav onLogin={goLogin} onSignup={goSignup} />
      <main>
        <HeroSection onSignup={goSignup} />
        <StatsStrip />
        <FeatureGrid />
        <HowItWorks />
        <SecuritySection />
        <FaqSection />
      </main>
      <CtaAndFooter onSignup={goSignup} onLogin={goLogin} />
    </div>
  );
}

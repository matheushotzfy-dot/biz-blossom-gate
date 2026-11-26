/**
 * LandingPage — página pública da Vemprapay (identidade fintech clara).
 * Apresentacional: sem consultas ao banco. As telas são capturas reais do painel com dados de exemplo, e a página avisa.
 * Credibilidade vem de prova: telas reais, links que o visitante confere (status, documentação, termos) e a empresa.
 * Só afirma o que o produto faz hoje: nada de taxa de aprovação, prazo de saque ou número que o painel não prove.
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import "@/components/landing-vp/landing.css";
import { SiteNav } from "@/components/landing-vp/SiteNav";
import { HeroSection } from "@/components/landing-vp/HeroSection";
import { HowItWorks, ProofStrip } from "@/components/landing-vp/ProofAndSteps";
import { PanelTour } from "@/components/landing-vp/PanelTour";
import { SellSection } from "@/components/landing-vp/SellSection";
import { AwardsShelf } from "@/components/landing-vp/AwardsShelf";
import { DevSection, SecuritySection } from "@/components/landing-vp/DevAndSecurity";
import { Closing, CompanySection, FAQ, FaqSection, SiteFooter } from "@/components/landing-vp/FaqAndFooter";

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
    <div id="topo" className="vp-site lp min-h-dvh bg-background text-foreground">
      <Seo
        title="Vemprapay: venda, entregue e receba num painel só"
        description="Checkout com Pix, cartão e boleto, área de membros, divisão com coprodutor e afiliado e saque por Pix num painel só. Abra sua conta grátis."
        path="/"
        jsonLd={FAQ_JSONLD}
      />
      <SiteNav onLogin={goLogin} onSignup={goSignup} />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <HeroSection onSignup={goSignup} />
        <ProofStrip />
        <HowItWorks />
        <PanelTour />
        <SellSection />
        <AwardsShelf />
        <SecuritySection />
        <DevSection />
        <FaqSection />
        <CompanySection />
        <Closing onSignup={goSignup} onLogin={goLogin} />
      </main>
      <SiteFooter />
    </div>
  );
}

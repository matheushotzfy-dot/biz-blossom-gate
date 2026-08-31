/**
 * LandingPage — página pública da VENXPAY (v2).
 *
 * Composição de cenas independentes, todas apresentacionais: nenhuma consulta a
 * banco, nenhuma regra de negócio. A navegação leva para /auth.
 */
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { TopBar } from "@/components/landing2/TopBar";
import { Opening } from "@/components/landing2/Opening";
import { ApprovalStrip } from "@/components/landing2/ApprovalStrip";
import { MoneyTimeline } from "@/components/landing2/MoneyTimeline";
import { RealScreen } from "@/components/landing2/RealScreen";
import { CheckoutDemo } from "@/components/landing2/CheckoutDemo";
import { Included } from "@/components/landing2/Included";
import { Integrations } from "@/components/landing2/Integrations";
import { Terms } from "@/components/landing2/Terms";
import { Questions, QA } from "@/components/landing2/Questions";
import { Closing } from "@/components/landing2/Closing";
import "@/styles/landing-v2.css";

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
    <div id="topo" className="vx-land relative min-h-dvh bg-background text-foreground">
      <Seo
        title="VENXPAY — o dinheiro entra e não some no caminho"
        description="Checkout, antifraude, split e liquidação no mesmo núcleo. Saque quando quiser, área de membros, afiliados e API para vender produtos digitais no Brasil."
        path="/"
        jsonLd={FAQ_JSONLD}
      />

      <TopBar onLogin={goLogin} onSignup={goSignup} />

      <main>
        <Opening onSignup={goSignup} onLogin={goLogin} />
        <ApprovalStrip />
        <MoneyTimeline />
        <RealScreen />
        <CheckoutDemo />
        <Included />
        <Integrations />
        <Terms onSignup={goSignup} />
        <Questions />
        <Closing onSignup={goSignup} />
      </main>
    </div>
  );
}

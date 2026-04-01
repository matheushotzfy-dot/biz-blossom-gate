import { useState } from "react";
import { FlaskConical, Ticket, MessageSquare, ArrowUpRight, Link2, UserMinus, HelpCircle, Calculator, Globe, Eye, Filter, Phone } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ABTesting = lazy(() => import("./vendas/ABTesting"));
const AutoCupons = lazy(() => import("./vendas/AutoCupons"));
const RecuperacaoWhatsApp = lazy(() => import("./vendas/RecuperacaoWhatsApp"));
const UpsellPosPagamento = lazy(() => import("./vendas/UpsellPosPagamento"));
const LinkPagamento = lazy(() => import("./vendas/LinkPagamento"));
const RelatorioChurn = lazy(() => import("./vendas/RelatorioChurn"));
const CentralAjuda = lazy(() => import("./vendas/CentralAjuda"));
const CalculadoraLucro = lazy(() => import("./vendas/CalculadoraLucro"));
const SmartCheckout = lazy(() => import("./vendas/SmartCheckout"));
const ProofPopup = lazy(() => import("./vendas/ProofPopup"));
const FunilVendas = lazy(() => import("./vendas/FunilVendas"));
const CheckoutWhatsApp = lazy(() => import("./vendas/CheckoutWhatsApp"));

const TABS: HubTab[] = [
  { id: "funil", label: "Funil", icon: Filter },
  { id: "ab", label: "A/B Testing", icon: FlaskConical },
  { id: "cupons", label: "Auto Cupons", icon: Ticket },
  { id: "whatsapp", label: "Recuperação", icon: MessageSquare },
  { id: "checkout-wpp", label: "Checkout WhatsApp", icon: Phone },
  { id: "upsell", label: "Upsell", icon: ArrowUpRight },
  { id: "links", label: "Links", icon: Link2 },
  { id: "proof", label: "Proof Popup", icon: Eye },
  { id: "smart", label: "Smart Checkout", icon: Globe },
  { id: "churn", label: "Churn", icon: UserMinus },
  { id: "calc", label: "Calculadora", icon: Calculator },
  { id: "ajuda", label: "Central de Ajuda", icon: HelpCircle },
];

const COMPONENTS: Record<string, React.LazyExoticComponent<React.FC>> = {
  funil: FunilVendas,
  ab: ABTesting,
  cupons: AutoCupons,
  whatsapp: RecuperacaoWhatsApp,
  "checkout-wpp": CheckoutWhatsApp,
  upsell: UpsellPosPagamento,
  links: LinkPagamento,
  proof: ProofPopup,
  smart: SmartCheckout,
  churn: RelatorioChurn,
  calc: CalculadoraLucro,
  ajuda: CentralAjuda,
};

const Loading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function VendasHub() {
  const [tab, setTab] = useState("funil");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <Suspense fallback={<Loading />}>
        <ActiveComponent />
      </Suspense>
    </>
  );
}

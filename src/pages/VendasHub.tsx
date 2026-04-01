import { useState } from "react";
import { FlaskConical, Ticket, MessageSquare, ArrowUpRight, Link2, UserMinus, HelpCircle, Calculator, Globe, Eye, Filter } from "lucide-react";
import { HubTabs, type HubTab } from "@/components/HubTabs";
import ABTesting from "./vendas/ABTesting";
import AutoCupons from "./vendas/AutoCupons";
import RecuperacaoWhatsApp from "./vendas/RecuperacaoWhatsApp";
import UpsellPosPagamento from "./vendas/UpsellPosPagamento";
import LinkPagamento from "./vendas/LinkPagamento";
import RelatorioChurn from "./vendas/RelatorioChurn";
import CentralAjuda from "./vendas/CentralAjuda";
import CalculadoraLucro from "./vendas/CalculadoraLucro";
import SmartCheckout from "./vendas/SmartCheckout";
import ProofPopup from "./vendas/ProofPopup";
import FunilVendas from "./vendas/FunilVendas";

const TABS: HubTab[] = [
  { id: "funil", label: "Funil", icon: Filter },
  { id: "ab", label: "A/B Testing", icon: FlaskConical },
  { id: "cupons", label: "Auto Cupons", icon: Ticket },
  { id: "whatsapp", label: "Recuperação", icon: MessageSquare },
  { id: "upsell", label: "Upsell", icon: ArrowUpRight },
  { id: "links", label: "Links", icon: Link2 },
  { id: "proof", label: "Proof Popup", icon: Eye },
  { id: "smart", label: "Smart Checkout", icon: Globe },
  { id: "churn", label: "Churn", icon: UserMinus },
  { id: "calc", label: "Calculadora", icon: Calculator },
  { id: "ajuda", label: "Central de Ajuda", icon: HelpCircle },
];

const COMPONENTS: Record<string, React.FC> = {
  funil: FunilVendas,
  ab: ABTesting,
  cupons: AutoCupons,
  whatsapp: RecuperacaoWhatsApp,
  upsell: UpsellPosPagamento,
  links: LinkPagamento,
  proof: ProofPopup,
  smart: SmartCheckout,
  churn: RelatorioChurn,
  calc: CalculadoraLucro,
  ajuda: CentralAjuda,
};

export default function VendasHub() {
  const [tab, setTab] = useState("funil");
  const ActiveComponent = COMPONENTS[tab];

  return (
    <>
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      <ActiveComponent />
    </>
  );
}

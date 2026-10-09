import { ArrowUpRight } from "lucide-react";
import ComingSoonFeature from "@/components/ComingSoonFeature";

/**
 * Upsell Pós-Pagamento — Em desenvolvimento.
 * Removidas as ofertas mockadas e as métricas fictícias de views/conversões/
 * receita. A feature exigirá a criação real de ofertas, exibição na página de
 * obrigado e rastreamento server-side dos resultados.
 */
export default function UpsellPosPagamento() {
  return (
    <ComingSoonFeature
      icon={<ArrowUpRight className="h-5 w-5" />}
      title="Upsell Pós-Pagamento"
      description="Ofertas exibidas na página de obrigado após o pagamento."
    />
  );
}

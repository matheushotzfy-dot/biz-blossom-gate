import { Eye } from "lucide-react";
import ComingSoonFeature from "@/components/ComingSoonFeature";

/**
 * Pop-up de Prova Social — Em desenvolvimento.
 * Removidas as configurações sem persistência e as métricas fictícias
 * (impressões, influenciadas, taxa de impacto). A feature exigirá salvar as
 * configurações por produto e rastrear exibições reais no checkout.
 */
export default function ProofPopup() {
  return (
    <ComingSoonFeature
      icon={<Eye className="h-5 w-5" />}
      title="Pop-up de Prova Social"
      description="Mostra compras recentes para aumentar a confiança no checkout."
    />
  );
}

import { Globe } from "lucide-react";
import ComingSoonFeature from "@/components/ComingSoonFeature";

/**
 * Checkout Inteligente (geolocalização) — Em desenvolvimento.
 * Removidas as regras por país e configurações globais mockadas, que não
 * eram persistidas nem aplicadas de verdade no checkout. A feature exigirá
 * detecção de localização, conversão de moeda real e tradução automática.
 */
export default function SmartCheckout() {
  return (
    <ComingSoonFeature
      icon={<Globe className="h-5 w-5" />}
      title="Checkout Inteligente"
      description="Adapta moeda, idioma e métodos de pagamento conforme o país do cliente."
    />
  );
}

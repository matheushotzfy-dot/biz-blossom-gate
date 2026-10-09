import { MessageSquare } from "lucide-react";
import ComingSoonFeature from "@/components/ComingSoonFeature";

/**
 * Recuperação via WhatsApp — Em desenvolvimento.
 * Removidas as campanhas mockadas e as métricas fictícias (enviadas,
 * recuperadas, receita) que não correspondiam a disparos reais. A feature
 * exigirá integração real com a API do WhatsApp Business e persistência das
 * campanhas e seus resultados.
 */
export default function RecuperacaoWhatsApp() {
  return (
    <ComingSoonFeature
      icon={<MessageSquare className="h-5 w-5" />}
      title="Recuperação via WhatsApp"
      description="Campanhas automáticas para recuperar carrinhos abandonados e pagamentos pendentes."
    />
  );
}

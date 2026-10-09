import { FlaskConical } from "lucide-react";
import ComingSoonFeature from "@/components/ComingSoonFeature";

/**
 * A/B Testing — Em desenvolvimento.
 * Removidos os testes mockados ("Cor do botão", "Timer de urgência") que não
 * eram criados nem persistidos de verdade. A feature exigirá uma tabela de
 * testes por produto, rastreamento real de impressões/conversões por variante
 * e lógica server-side para decidir o vencedor.
 */
export default function ABTesting() {
  return (
    <ComingSoonFeature
      icon={<FlaskConical className="h-5 w-5" />}
      title="A/B Testing"
      description="Teste variações do checkout para otimizar conversões."
    />
  );
}

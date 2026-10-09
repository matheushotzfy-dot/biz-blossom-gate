import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonFeatureProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

/**
 * ComingSoonFeature — Padrão honesto de "em breve" para recursos ainda não
 * implementados no backend. Evita exibir dados mockados/fictícios para o
 * vendedor. Reproduz o padrão usado em `AutoCupons.tsx`.
 */
export default function ComingSoonFeature({ title, description, icon }: ComingSoonFeatureProps) {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            {icon ?? <Clock className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Clock className="h-3 w-3" /> Em breve
        </Badge>
      </div>

      <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">Recurso em construção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Estamos finalizando a implementação deste recurso, incluindo a
            persistência dos dados e o processamento server-side necessários
            para que ele funcione de verdade.
          </p>
          <p className="text-xs">
            Em breve você será avisado por aqui assim que estiver disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

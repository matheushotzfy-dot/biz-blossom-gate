import { Ticket, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Cupons Automáticos — Em desenvolvimento.
 * Removido o estado mockado (regras "Resgate Carrinho", "Boas-vindas", etc.
 * que não persistiam em lugar nenhum). Quando a feature entrar em produção,
 * criaremos a tabela `auto_coupon_rules` com RLS por seller e um gatilho
 * server-side em edge function para aplicar os cupons.
 */
export default function AutoCupons() {
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Cupons Automáticos</h1>
            <p className="text-sm text-muted-foreground">
              Regras que disparam cupons com base no comportamento do cliente.
            </p>
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
            Em breve você poderá criar regras que geram cupons automaticamente
            para carrinhos abandonados, primeiras compras, aniversários,
            reativação de inativos e indicações.
          </p>
          <p className="text-xs">
            Estamos finalizando a persistência das regras e o disparo
            server-side antes de liberar a criação. Enquanto isso, você pode
            criar cupons manuais em <strong>Vendas → Cupons</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

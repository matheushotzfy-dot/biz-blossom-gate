import { Settings } from "lucide-react";

export default function AdminConfiguracoes() {
  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações gerais da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Plataforma</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">PayGate</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Versão</span>
              <span className="font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Status</span>
              <span className="text-success font-medium">Ativo</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Pagamentos</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">PIX</span>
              <span className="text-success font-medium">Ativado</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Cartão de Crédito</span>
              <span className="text-success font-medium">Ativado</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Boleto</span>
              <span className="text-success font-medium">Ativado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

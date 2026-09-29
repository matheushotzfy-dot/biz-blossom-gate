import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Sparkles, KeyRound } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { FinancialHistoryPanel } from "./FinancialHistoryPanel";
import { SellerRiskAnalysis } from "./SellerRiskAnalysis";
import { FinancialPermissionsCard } from "./FinancialPermissionsCard";

/** Admin area: auditable money history, AI risk analysis and financial permissions by role. */
export default function FinancialAuditTab({ profiles }: { profiles: Tables<"profiles">[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Auditoria financeira</h2>
        <p className="text-xs text-muted-foreground">Reembolsos, chargebacks, disputas e ajustes de saldo com responsável, horário, justificativa e saldo antes/depois.</p>
      </div>
      <Tabs defaultValue="history">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" />Histórico</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Análise de risco (IA)</TabsTrigger>
          <TabsTrigger value="perms" className="gap-1.5"><KeyRound className="h-3.5 w-3.5" />Permissões</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4"><FinancialHistoryPanel profiles={profiles} /></TabsContent>
        <TabsContent value="ai" className="mt-4"><SellerRiskAnalysis profiles={profiles} /></TabsContent>
        <TabsContent value="perms" className="mt-4"><FinancialPermissionsCard /></TabsContent>
      </Tabs>
    </div>
  );
}

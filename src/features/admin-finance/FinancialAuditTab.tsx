import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { FinancialHistoryPanel } from "./FinancialHistoryPanel";
import { SellerRiskAnalysis } from "./SellerRiskAnalysis";
import { FinancialPermissionsCard } from "./FinancialPermissionsCard";

type Section = "history" | "ai" | "perms";

/** Área do dono: histórico auditável do dinheiro, análise de risco por IA e permissões financeiras por cargo. */
export default function FinancialAuditTab({ profiles }: { profiles: Tables<"profiles">[] }) {
  const [section, setSection] = useState<Section>("history");
  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        eyebrow="Financeiro · Auditoria" title="Auditoria financeira"
        subtitle="Quem mexeu no dinheiro, quando e por quê. Também reúne a análise de risco por IA e o que cada cargo pode fazer."
        status={{ tone: "info", label: "Só o dono vê esta área" }}
      />
      <PremiumSegmented<Section> value={section} onChange={setSection} options={[
        { value: "history", label: "Histórico" }, { value: "ai", label: "Análise de risco por IA" }, { value: "perms", label: "Permissões por cargo" },
      ]} />
      {section === "history" && <FinancialHistoryPanel profiles={profiles} />}
      {section === "ai" && <SellerRiskAnalysis profiles={profiles} />}
      {section === "perms" && <FinancialPermissionsCard />}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Radar, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { defaultCheckoutProcessor } from "@/features/public-checkout/processor";
import { BlacklistPanel, ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { RadarPanel } from "@/features/admin-antifraud/RadarPanel";
import { SecurityFindingsPanel } from "@/features/admin-antifraud/SecurityFindingsPanel";
import { TrailPanel } from "@/features/admin-antifraud/TrailPanel";
import { VelocityPanel } from "@/features/admin-antifraud/VelocityPanel";
import { RADAR_HIGH, parseOverview, pct, plural, type RadarWindow } from "@/features/admin-antifraud/antifraudModel";
import { PremiumMetric, PremiumMetricGrid, PremiumSegmented } from "./AdminPremium";

type Section = "blacklist" | "radar" | "velocity" | "trail" | "findings";

/** Anti-Fraude: o que o servidor barra (blacklist e velocidade), quem está com chargeback alto e a trilha do que já foi barrado. */
export default function AdminRiskComplianceTab() {
  const [section, setSection] = useState<Section>("blacklist");
  const [days, setDays] = useState<RadarWindow>(90);

  const ov = useQuery({
    queryKey: ["admin-antifraud-overview", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_antifraud_overview" as never, { _days: days } as never);
      if (error) throw error;
      return parseOverview(data);
    },
  });
  const o = ov.data;
  const waiting = ov.isError ? "Indisponível" : "Carregando…";
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));

  const heroStatus = !o ? (ov.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : o.sellers_high > 0 ? { tone: "destructive" as const, label: plural(o.sellers_high, "seller em risco", "sellers em risco"), pulse: true }
      : o.rules_total > 0 && o.rules_enabled < o.rules_total ? { tone: "warning" as const, label: `${o.rules_total - o.rules_enabled} de ${o.rules_total} regras desligadas` }
        : { tone: "success" as const, label: "Nenhum seller em risco" };

  const sections: { value: Section; label: string }[] = [
    { value: "blacklist", label: o ? `Blacklist · ${n(o.blacklist_active)}` : "Blacklist" },
    { value: "radar", label: o && o.sellers_high > 0 ? `Radar de chargeback · ${o.sellers_high} em risco` : "Radar de chargeback" },
    { value: "velocity", label: o ? `Velocidade · ${o.rules_enabled} de ${o.rules_total} ligadas` : "Velocidade" },
    { value: "trail", label: "Trilha de bloqueios" },
    { value: "findings", label: "Achados de segurança" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        eyebrow="Risco · Anti-Fraude" title="Anti-fraude"
        subtitle="O que o servidor barra antes de cobrar, quais sellers estão com chargeback alto e o histórico do que já foi barrado."
        status={heroStatus}
        actions={<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void ov.refetch()} disabled={ov.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${ov.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>}
      />

      {!defaultCheckoutProcessor.available && (
        <p role="note" className="rounded-[12px] border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Hoje o checkout ainda não cobra ninguém (nenhum adquirente configurado), então nenhuma compra passa por estas regras.
          Quando a cobrança for ativada, o servidor confere a blacklist e a velocidade antes de cada pagamento e o que for barrado aparece na trilha.
        </p>
      )}

      {ov.isError && <ErrorBlock title="Não foi possível carregar o resumo." error={ov.error} onRetry={() => void ov.refetch()} />}

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Ban} label="Blacklist" value={n(o?.blacklist_active)} sub={o ? "dados bloqueados" : waiting} tone={o && o.blacklist_active > 0 ? "destructive" : "neutral"} />
        <PremiumMetric icon={Zap} label="Regras ligadas" value={o ? `${o.rules_enabled} de ${o.rules_total}` : "—"} sub={o ? (o.rules_enabled < o.rules_total ? "tem regra desligada" : "todas ligadas") : waiting} tone={o && o.rules_enabled < o.rules_total ? "warning" : "success"} />
        <PremiumMetric icon={ShieldAlert} label="Barradas hoje" value={n(o?.blocked_today)} sub={o ? "compras barradas" : waiting} tone="info" />
        <PremiumMetric icon={Radar} label="Sellers em risco" value={n(o?.sellers_high)} sub={o ? `acima de ${pct(RADAR_HIGH)}` : waiting} tone={o && o.sellers_high > 0 ? "destructive" : "success"} />
      </PremiumMetricGrid>

      <PremiumSegmented<Section> value={section} onChange={setSection} options={sections} />

      {section === "blacklist" && <BlacklistPanel />}
      {section === "radar" && <RadarPanel days={days} onDays={setDays} />}
      {section === "velocity" && <VelocityPanel />}
      {section === "trail" && <TrailPanel />}
      {section === "findings" && <SecurityFindingsPanel />}
    </div>
  );
}


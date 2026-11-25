import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Fingerprint, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { ActivityPanel } from "@/features/admin-abuse/ActivityPanel";
import { IpsPanel } from "@/features/admin-abuse/IpsPanel";
import { WaitingPanel } from "@/features/admin-abuse/WaitingPanel";
import { HOURS, hoursLabel, lastLabel, parseOverview, type Hours } from "@/features/admin-abuse/abuseModel";
import { PremiumMetric, PremiumMetricGrid, PremiumSegmented } from "./AdminPremium";

type Section = "activity" | "waiting" | "ips";

/** Abuso & Auth: tentativas de login com erro, IPs que insistem e o que está travado agora (com ação de liberar e bloquear). */
export default function AdminAbuseMetricsTab() {
  const [hours, setHours] = useState<Hours>(24);
  const [section, setSection] = useState<Section>("activity");

  const ov = useQuery({
    queryKey: ["admin-abuse-overview", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_abuse_overview" as never, { _hours: hours } as never);
      if (error) throw error;
      return parseOverview(data);
    },
  });
  const o = ov.data;
  const waiting = o ? o.blocks_active + o.lockouts_active : undefined;
  const pending = ov.isError ? "Indisponível" : "Carregando…";
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));

  const heroStatus = !o ? (ov.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : waiting! > 0 ? { tone: "warning" as const, label: `${waiting} em espera agora`, pulse: true }
      : { tone: "success" as const, label: "Nada travado agora" };

  const sections: { value: Section; label: string }[] = [
    { value: "activity", label: "Atividade" },
    { value: "waiting", label: waiting !== undefined ? `Em espera agora · ${waiting}` : "Em espera agora" },
    { value: "ips", label: "IPs mais ativos" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero
        eyebrow="Segurança" title="Abuso e logins"
        subtitle="Tentativas de login com erro, IPs que insistem e quem está travado agora. O IP aparece só como código, nunca como número."
        status={heroStatus}
        actions={<Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void ov.refetch()} disabled={ov.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${ov.isFetching ? "animate-spin" : ""}`} /> Atualizar</Button>}
      />

      <PremiumSegmented<`${Hours}`> value={`${hours}`} onChange={(v) => setHours(Number(v) as Hours)}
        options={HOURS.map((h) => ({ value: `${h}` as `${Hours}`, label: hoursLabel(h) }))} />

      {ov.isError && <ErrorBlock title="Não foi possível carregar o resumo." error={ov.error} onRetry={() => void ov.refetch()} />}

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Ban} label="E-mail ou senha errados" value={n(o?.failed)} sub={o ? lastLabel(hours) : pending} tone={o && o.failed > 0 ? "warning" : "neutral"} />
        <PremiumMetric icon={ShieldAlert} label="Barrados por excesso" value={n(o?.rate_limited)} sub={o ? "tentativas depois do limite" : pending} tone={o && o.rate_limited > 0 ? "destructive" : "neutral"} />
        <PremiumMetric icon={Fingerprint} label="IPs diferentes" value={n(o?.distinct_ips)} sub={o ? `${o.distinct_accounts.toLocaleString("pt-BR")} ${o.distinct_accounts === 1 ? "e-mail tentado" : "e-mails tentados"}` : pending} tone="info" />
        <PremiumMetric icon={LockKeyhole} label="Em espera agora" value={n(waiting)} sub={o ? `${o.lockouts_active} ${o.lockouts_active === 1 ? "login" : "logins"} · ${o.blocks_active} ${o.blocks_active === 1 ? "IP" : "IPs"}` : pending} tone={waiting ? "warning" : "success"} />
      </PremiumMetricGrid>

      <PremiumSegmented<Section> value={section} onChange={setSection} options={sections} />

      {section === "activity" && (o ? <ActivityPanel o={o} hours={hours} /> : !ov.isError && <p className="py-10 text-[13px] text-muted-foreground">Carregando a atividade…</p>)}
      {section === "waiting" && <WaitingPanel />}
      {section === "ips" && <IpsPanel hours={hours} />}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, CreditCard, TrendingUp, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";

type Sub = Tables<"subscriptions">;
type Plan = Tables<"subscription_plans">;

export default function AdminSubscriptionsTab({ profiles, fmtCurrency }: {
  profiles: { user_id: string; full_name: string | null; email: string | null }[];
  fmtCurrency: (v: number) => string;
}) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("subscription_plans").select("*"),
    ]).then(([subRes, planRes]) => {
      if (subRes.data) setSubs(subRes.data);
      if (planRes.data) setPlans(planRes.data);
      setLoading(false);
    });
  }, []);

  const getPlan = (id: string) => plans.find(p => p.id === id);
  const getSeller = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const active = subs.filter(s => s.status === "active").length;
  const canceled = subs.filter(s => s.status === "canceled" || s.status === "cancelled").length;
  const mrr = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const plan = getPlan(s.plan_id);
    return sum + (plan?.price || 0);
  }, 0);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Receita Recorrente"
        title="Assinaturas"
        subtitle={`${subs.length} no total · ${active} ativas · MRR ${fmtCurrency(mrr)}`}
        status={{ tone: "success", label: "Live", pulse: true }}
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Total" value={String(subs.length)} sub="cadastradas" icon={CreditCard} tone="neutral" />
        <FinanceiroKpi label="Ativas" value={String(active)} sub="cobrando agora" icon={Users} tone="success" />
        <FinanceiroKpi label="MRR" value={fmtCurrency(mrr)} sub="receita mensal" icon={TrendingUp} tone="primary" />
        <FinanceiroKpi label="Canceladas" value={String(canceled)} sub="histórico" icon={RefreshCw} tone="warning" />
      </FinanceiroKpiGrid>

      <PremiumPanel title="Lista de Assinaturas" eyebrow={`${subs.length} registros`} icon={RefreshCw}>
        {subs.length === 0 ? (
          <PremiumEmpty icon={RefreshCw} title="Nenhuma assinatura" subtitle="As novas assinaturas aparecem aqui em tempo real." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Assinante</th>
                  <th className={premiumTable.th}>Plano</th>
                  <th className={premiumTable.th}>Vendedor</th>
                  <th className={premiumTable.th}>Valor</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Início</th>
                </tr>
              </thead>
              <tbody>
                {subs.slice(0, 100).map(sub => {
                  const plan = getPlan(sub.plan_id);
                  return (
                    <tr key={sub.id} className={premiumTable.row}>
                      <td className={premiumTable.td}>
                        <p className="font-bold text-foreground text-[12px]">{sub.subscriber_name || sub.subscriber_email}</p>
                        <p className="text-[10px] text-muted-foreground/70">{sub.subscriber_email}</p>
                      </td>
                      <td className={premiumTable.td}>
                        <span className="text-[11px] font-semibold text-foreground/80">{plan?.name || "—"}</span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className="text-[11px] text-muted-foreground">{getSeller(sub.seller_user_id)}</span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className="font-display text-[13px] font-black tabular-nums text-success">{fmtCurrency(plan?.price || 0)}</span>
                      </td>
                      <td className={premiumTable.td}><StatusBadge status={sub.status} /></td>
                      <td className={premiumTable.td}>
                        <span className="text-[11px] text-muted-foreground/80">{new Date(sub.created_at).toLocaleDateString("pt-BR")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>
    </div>
  );
}

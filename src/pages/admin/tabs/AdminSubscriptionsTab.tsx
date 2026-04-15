import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { RefreshCw, CreditCard } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  const mrr = subs.filter(s => s.status === "active").reduce((sum, s) => {
    const plan = getPlan(s.plan_id);
    return sum + (plan?.price || 0);
  }, 0);

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Assinaturas</h2>
        <p className="text-xs text-white/40 mt-1">{subs.length} total · {active} ativas · MRR {fmtCurrency(mrr)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Total</p>
          <p className="text-2xl font-black text-white/90">{subs.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Ativas</p>
          <p className="text-2xl font-black text-emerald-400">{active}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">MRR</p>
          <p className="text-2xl font-black text-emerald-400">{fmtCurrency(mrr)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-white/30 text-[10px] uppercase tracking-wider">
              <th className="text-left p-3 font-bold">Assinante</th>
              <th className="text-left p-3 font-bold">Plano</th>
              <th className="text-left p-3 font-bold">Vendedor</th>
              <th className="text-left p-3 font-bold">Valor</th>
              <th className="text-left p-3 font-bold">Status</th>
              <th className="text-left p-3 font-bold">Início</th>
            </tr>
          </thead>
          <tbody>
            {subs.slice(0, 100).map(sub => {
              const plan = getPlan(sub.plan_id);
              return (
                <tr key={sub.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3">
                    <p className="font-semibold text-white/80">{sub.subscriber_name || sub.subscriber_email}</p>
                    <p className="text-[10px] text-white/30">{sub.subscriber_email}</p>
                  </td>
                  <td className="p-3 text-white/60">{plan?.name || "—"}</td>
                  <td className="p-3 text-white/50">{getSeller(sub.seller_user_id)}</td>
                  <td className="p-3 font-semibold text-white/80">{fmtCurrency(plan?.price || 0)}</td>
                  <td className="p-3"><StatusBadge status={sub.status} /></td>
                  <td className="p-3 text-white/40">{new Date(sub.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              );
            })}
            {subs.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-white/30">Nenhuma assinatura</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

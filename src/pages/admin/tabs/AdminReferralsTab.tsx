import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Gift } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Referral = Tables<"referrals">;

export default function AdminReferralsTab({ profiles, fmtCurrency }: {
  profiles: { user_id: string; full_name: string | null; email: string | null }[];
  fmtCurrency: (v: number) => string;
}) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { if (data) setReferrals(data); setLoading(false); });
  }, []);

  const getName = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const completed = referrals.filter(r => r.status === "completed" || r.status === "paid").length;
  const totalRewards = referrals.reduce((s, r) => s + Number(r.reward_amount), 0);

  if (loading) return <div className="flex justify-center py-20"><div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Gift className="h-5 w-5" /> Indicações</h2>
        <p className="text-xs text-white/40 mt-1">{referrals.length} total · {completed} convertidas · {fmtCurrency(totalRewards)} em recompensas</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Total</p>
          <p className="text-2xl font-black text-white/90">{referrals.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Convertidas</p>
          <p className="text-2xl font-black text-emerald-400">{completed}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Recompensas</p>
          <p className="text-2xl font-black text-emerald-400">{fmtCurrency(totalRewards)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-white/30 text-[10px] uppercase tracking-wider">
              <th className="text-left p-3 font-bold">Indicador</th>
              <th className="text-left p-3 font-bold">Indicado</th>
              <th className="text-left p-3 font-bold">Recompensa</th>
              <th className="text-left p-3 font-bold">Status</th>
              <th className="text-left p-3 font-bold">Data</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map(ref => (
              <tr key={ref.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="p-3 font-semibold text-white/80">{getName(ref.referrer_user_id)}</td>
                <td className="p-3 text-white/60">{ref.referred_email}</td>
                <td className="p-3 font-semibold text-white/80">{fmtCurrency(Number(ref.reward_amount))}</td>
                <td className="p-3"><StatusBadge status={ref.status} /></td>
                <td className="p-3 text-white/40">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
            {referrals.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-white/30">Nenhuma indicação</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

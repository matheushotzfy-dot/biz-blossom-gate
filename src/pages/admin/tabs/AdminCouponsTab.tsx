import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Search, ToggleLeft, Percent, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface Props {
  profiles: Tables<"profiles">[];
  fmtCurrency: (v: number) => string;
}

export default function AdminCouponsTab({ profiles, fmtCurrency }: Props) {
  const [coupons, setCoupons] = useState<Tables<"coupons">[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("coupons").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setCoupons(data); });
  }, []);

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";
  const active = coupons.filter(c => c.is_active);
  const expired = coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date());
  const totalUses = coupons.reduce((a, c) => a + c.current_uses, 0);

  const filtered = coupons.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.code.toLowerCase().includes(s) || getSellerName(c.user_id).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Tag className="h-5 w-5" />} label="Total Cupons" value={String(coupons.length)} sub="Criados" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<ToggleLeft className="h-5 w-5" />} label="Ativos" value={String(active.length)} sub="Em uso" gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Percent className="h-5 w-5" />} label="Utilizações" value={String(totalUses)} sub="Total de usos" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<DollarSign className="h-5 w-5" />} label="Expirados" value={String(expired.length)} sub="Vencidos" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input placeholder="Buscar cupom ou vendedor..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
      </div>

      <AdminPanel>
        <PanelTitle color="violet" icon={<Tag className="h-4 w-4" />}>Cupons ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["Código", "Vendedor", "Tipo", "Valor", "Usos", "Limite", "Status", "Expira", "Criado"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-mono text-xs font-bold text-violet-400">{c.code}</td>
                  <td className="p-3 text-xs text-white/50">{getSellerName(c.user_id)}</td>
                  <td className="p-3 text-[10px] uppercase text-white/30">{c.discount_type}</td>
                  <td className="p-3 text-xs font-bold">{c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmtCurrency(Number(c.discount_value))}</td>
                  <td className="p-3"><span className="text-xs font-bold bg-white/[0.04] px-2 py-0.5 rounded">{c.current_uses}</span></td>
                  <td className="p-3 text-xs text-white/30">{c.max_uses || "∞"}</td>
                  <td className="p-3"><StatusBadge status={c.is_active ? "active" : "inactive"} /></td>
                  <td className="p-3 text-[10px] text-white/25">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3 text-[10px] text-white/25">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-white/20 text-xs">Nenhum cupom</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

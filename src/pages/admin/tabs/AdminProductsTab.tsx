import { useState } from "react";
import { Package, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle } from "./AdminOverviewTab";

interface Props {
  products: Tables<"products">[];
  profiles: Tables<"profiles">[];
  fmtCurrency: (v: number) => string;
}

export default function AdminProductsTab({ products, profiles, fmtCurrency }: Props) {
  const [search, setSearch] = useState("");

  const filtered = products.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
  });

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
      </div>

      <AdminPanel>
        <PanelTitle color="violet" icon={<Package className="h-4 w-4" />}>Todos os Produtos ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">{["Produto","Vendedor","Preço","Status","Checkout","Criado"].map(h=>(<th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                      <div><p className="text-xs font-bold">{p.name}</p><p className="text-[10px] text-white/30 max-w-[200px] truncate">{p.description || "—"}</p></div>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-white/50">{getSellerName(p.user_id)}</td>
                  <td className="p-3 text-xs font-bold text-emerald-400">{fmtCurrency(Number(p.price))}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 font-mono text-[10px] text-white/20 max-w-[150px] truncate">{p.checkout_url || "—"}</td>
                  <td className="p-3 text-[11px] text-white/30">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-white/20 text-xs">Nenhum produto</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

import { useState } from "react";
import { ArrowDownToLine, Search, CheckCircle2, XCircle, Clock, Wallet } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface Props {
  withdrawals: Tables<"withdrawals">[];
  profiles: Tables<"profiles">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  fmtCurrency: (v: number) => string;
}

export default function AdminWithdrawalsTab({ withdrawals, profiles, onWithdrawalAction, fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => profiles.find(p => p.user_id === userId)?.email || "";

  const pending = withdrawals.filter(w => w.status === "pending");
  const approved = withdrawals.filter(w => w.status === "approved");
  const rejected = withdrawals.filter(w => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.amount), 0);
  const totalFees = withdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);

  const filtered = withdrawals
    .filter(w => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return getSellerName(w.user_id).toLowerCase().includes(s) || w.id.includes(s);
    });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Total Saques" value={String(withdrawals.length)} sub="Todos" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Pendentes" value={fmtCurrency(totalPending)} sub={`${pending.length} solicitações`} gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={pending.length > 0} />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Aprovados" value={fmtCurrency(totalApproved)} sub={`${approved.length} saques`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<XCircle className="h-5 w-5" />} label="Recusados" value={String(rejected.length)} sub="Negados" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" />
        <AdminKpi icon={<Wallet className="h-5 w-5" />} label="Taxas Coletadas" value={fmtCurrency(totalFees)} sub="De saques" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" highlight />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10 bg-white/[0.04] border-white/[0.06] text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminPanel>
        <PanelTitle color="amber" icon={<ArrowDownToLine className="h-4 w-4" />}>Saques ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["ID", "Vendedor", "Valor Bruto", "Taxa", "Líquido", "Status", "Data", "Processado", "Ações"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${w.status === "pending" ? "bg-amber-500/[0.02]" : ""}`}>
                  <td className="p-3 font-mono text-[10px] text-white/25">{w.id.slice(0, 8)}</td>
                  <td className="p-3"><div><p className="text-xs font-bold">{getSellerName(w.user_id)}</p><p className="text-[10px] text-white/25">{getSellerEmail(w.user_id)}</p></div></td>
                  <td className="p-3 text-xs font-extrabold">R$ {Number(w.amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-amber-400">R$ {Number(w.fee_amount).toFixed(2)}</td>
                  <td className="p-3 text-xs text-emerald-400 font-bold">R$ {Number(w.net_amount).toFixed(2)}</td>
                  <td className="p-3"><StatusBadge status={w.status} /></td>
                  <td className="p-3 text-[10px] text-white/25">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3 text-[10px] text-white/25">{w.processed_at ? new Date(w.processed_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3">
                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}>
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" className="h-7 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "rejected")}>
                          <XCircle className="h-3 w-3" /> Recusar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-white/20 text-xs">Nenhum saque</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}

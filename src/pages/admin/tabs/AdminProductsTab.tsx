import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Search, Ban, CheckCircle2, Eye, MoreHorizontal, ShieldAlert,
  AlertTriangle, ExternalLink, Image,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";

interface Props {
  products: Tables<"products">[];
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
  onReload: () => void;
}

export default function AdminProductsTab({ products, profiles, transactions, fmtCurrency, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Tables<"products"> | null>(null);

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => profiles.find(p => p.user_id === userId)?.email || "";

  const getProductStats = (productId: string) => {
    const txs = transactions.filter(t => t.product_id === productId);
    const completed = txs.filter(t => t.status === "completed" || t.status === "approved");
    return {
      totalTx: txs.length,
      completedTx: completed.length,
      revenue: completed.reduce((a, t) => a + Number(t.amount), 0),
      fees: completed.reduce((a, t) => a + Number(t.fee_amount), 0),
      conversion: txs.length > 0 ? (completed.length / txs.length) * 100 : 0,
    };
  };

  const handleProductStatus = async (productId: string, status: string, userId: string) => {
    const { error } = await supabase.from("products").update({ status }).eq("id", productId);
    if (error) { toast.error("Erro ao atualizar produto"); return; }
    const labels: Record<string, string> = { active: "ativado", blocked: "bloqueado", rejected: "recusado" };
    toast.success(`Produto ${labels[status] || status}!`);
    await logAdminAction(`product_${status}`, "product", productId, { status, user_id: userId });
    onReload();
  };

  const filtered = products.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s) || getSellerName(p.user_id).toLowerCase().includes(s);
  });

  const activeCount = products.filter(p => p.status === "active").length;
  const blockedCount = products.filter(p => p.status === "blocked").length;
  const rejectedCount = products.filter(p => p.status === "rejected").length;
  const totalRevenue = products.reduce((a, p) => a + getProductStats(p.id).revenue, 0);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "blocked") return <Ban className="h-3 w-3 text-red-400" />;
    if (status === "rejected") return <ShieldAlert className="h-3 w-3 text-amber-400" />;
    return null;
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<Package className="h-5 w-5" />} label="Total Produtos" value={String(products.length)} sub="Cadastrados" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Ativos" value={String(activeCount)} sub={`${((activeCount / Math.max(products.length, 1)) * 100).toFixed(0)}% do total`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Ban className="h-5 w-5" />} label="Bloqueados" value={String(blockedCount)} sub="Por violação" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" alert={blockedCount > 0} />
        <AdminKpi icon={<ShieldAlert className="h-5 w-5" />} label="Recusados" value={String(rejectedCount)} sub="Contra políticas" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={rejectedCount > 0} />
        <AdminKpi icon={<AlertTriangle className="h-5 w-5" />} label="Receita Produtos" value={fmtCurrency(totalRevenue)} sub="Volume total" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" highlight />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input placeholder="Buscar produto ou vendedor..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-10 bg-white/[0.04] border-white/[0.06] text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-[hsl(228,18%,8%)] border-white/[0.08]">
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <AdminPanel>
        <PanelTitle color="violet" icon={<Package className="h-4 w-4" />}>Produtos ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["Produto", "Vendedor", "Preço", "Vendas", "Receita", "Conversão", "Status", "Ações"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const stats = getProductStats(p.id);
                return (
                  <tr key={p.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                    p.status === "blocked" ? "bg-red-500/[0.02]" : p.status === "rejected" ? "bg-amber-500/[0.02]" : ""
                  }`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-white/[0.06]" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center"><Image className="h-4 w-4 text-white/20" /></div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={p.status} />
                            <p className="text-xs font-bold">{p.name}</p>
                          </div>
                          <p className="text-[10px] text-white/25 max-w-[200px] truncate">{p.description || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="text-xs font-medium text-white/60">{getSellerName(p.user_id)}</p>
                        <p className="text-[10px] text-white/20">{getSellerEmail(p.user_id)}</p>
                      </div>
                    </td>
                    <td className="p-3 text-xs font-bold text-emerald-400">{fmtCurrency(Number(p.price))}</td>
                    <td className="p-3">
                      <span className="text-xs font-bold bg-white/[0.04] px-2 py-0.5 rounded">{stats.completedTx}/{stats.totalTx}</span>
                    </td>
                    <td className="p-3 text-xs font-bold">{fmtCurrency(stats.revenue)}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold ${stats.conversion >= 50 ? "text-emerald-400" : stats.conversion >= 20 ? "text-amber-400" : "text-red-400"}`}>
                        {stats.conversion.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[hsl(228,18%,8%)] border-white/[0.08] min-w-[180px]">
                          <DropdownMenuItem className="gap-2 text-white/70" onClick={() => setSelectedProduct(p)}>
                            <Eye className="h-3.5 w-3.5" /> Ver detalhes
                          </DropdownMenuItem>
                          {p.checkout_url && (
                            <DropdownMenuItem className="gap-2 text-blue-400" onClick={() => window.open(p.checkout_url!, "_blank")}>
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir checkout
                            </DropdownMenuItem>
                          )}
                          {p.status !== "active" && (
                            <DropdownMenuItem className="gap-2 text-emerald-400" onClick={() => handleProductStatus(p.id, "active", p.user_id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ativar produto
                            </DropdownMenuItem>
                          )}
                          {p.status !== "blocked" && (
                            <DropdownMenuItem className="gap-2 text-red-400" onClick={() => handleProductStatus(p.id, "blocked", p.user_id)}>
                              <Ban className="h-3.5 w-3.5" /> Bloquear produto
                            </DropdownMenuItem>
                          )}
                          {p.status !== "rejected" && (
                            <DropdownMenuItem className="gap-2 text-amber-400" onClick={() => handleProductStatus(p.id, "rejected", p.user_id)}>
                              <ShieldAlert className="h-3.5 w-3.5" /> Recusar produto
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-white/20 text-xs">Nenhum produto</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={v => { if (!v) setSelectedProduct(null); }}>
        <DialogContent className="max-w-2xl bg-[hsl(228,18%,6%)] border-white/[0.06] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedProduct?.image_url ? (
                <img src={selectedProduct.image_url} alt="" className="h-14 w-14 rounded-2xl object-cover border border-white/[0.06]" />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-white/[0.04] flex items-center justify-center"><Package className="h-6 w-6 text-white/20" /></div>
              )}
              <div>
                <p className="text-base font-bold">{selectedProduct?.name}</p>
                <p className="text-xs text-white/40 font-normal mt-0.5">{getSellerName(selectedProduct?.user_id || "")} • {fmtCurrency(Number(selectedProduct?.price || 0))}</p>
                <p className="text-[10px] text-white/15 font-mono mt-0.5">{selectedProduct?.id}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (() => {
            const stats = getProductStats(selectedProduct.id);
            return (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MiniKpi label="Vendas" value={`${stats.completedTx}/${stats.totalTx}`} color="blue" />
                  <MiniKpi label="Receita" value={fmtCurrency(stats.revenue)} color="emerald" />
                  <MiniKpi label="Taxas" value={fmtCurrency(stats.fees)} color="amber" />
                  <MiniKpi label="Conversão" value={`${stats.conversion.toFixed(1)}%`} color="violet" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Descrição" value={selectedProduct.description} />
                  <InfoRow label="Status" value={selectedProduct.status} />
                  <InfoRow label="Checkout URL" value={selectedProduct.checkout_url} mono />
                  <InfoRow label="Criado em" value={new Date(selectedProduct.created_at).toLocaleString("pt-BR")} />
                  <InfoRow label="PIX" value={selectedProduct.checkout_pix_enabled ? "Sim" : "Não"} />
                  <InfoRow label="Cartão" value={selectedProduct.checkout_credit_card_enabled ? "Sim" : "Não"} />
                  <InfoRow label="Boleto" value={selectedProduct.checkout_boleto_enabled ? "Sim" : "Não"} />
                  <InfoRow label="Timer" value={selectedProduct.checkout_timer_enabled ? `${selectedProduct.checkout_timer_minutes}min` : "Não"} />
                </div>
                <div className="flex gap-2 pt-2 border-t border-white/[0.04]">
                  {selectedProduct.status !== "active" && (
                    <Button size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs"
                      onClick={() => { handleProductStatus(selectedProduct.id, "active", selectedProduct.user_id); setSelectedProduct(null); }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Ativar
                    </Button>
                  )}
                  {selectedProduct.status !== "blocked" && (
                    <Button size="sm" className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs"
                      onClick={() => { handleProductStatus(selectedProduct.id, "blocked", selectedProduct.user_id); setSelectedProduct(null); }}>
                      <Ban className="h-3 w-3 mr-1" /> Bloquear
                    </Button>
                  )}
                  {selectedProduct.status !== "rejected" && (
                    <Button size="sm" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs"
                      onClick={() => { handleProductStatus(selectedProduct.id, "rejected", selectedProduct.user_id); setSelectedProduct(null); }}>
                      <ShieldAlert className="h-3 w-3 mr-1" /> Recusar
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null | boolean; mono?: boolean }) {
  const display = typeof value === "boolean" ? (value ? "Sim" : "Não") : (value || "—");
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xs font-medium ${mono ? "font-mono" : ""} ${display !== "—" ? "text-white" : "text-white/20"}`}>{display}</p>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = { emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400", amber: "from-amber-500/20 to-amber-500/5 text-amber-400", blue: "from-blue-500/20 to-blue-500/5 text-blue-400", violet: "from-violet-500/20 to-violet-500/5 text-violet-400" };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${colors[color]} border border-white/[0.04] p-4`}>
      <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-extrabold mt-1">{value}</p>
    </div>
  );
}

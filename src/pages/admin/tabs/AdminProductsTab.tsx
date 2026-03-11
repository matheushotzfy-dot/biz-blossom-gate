import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Search, Ban, CheckCircle2, Eye, MoreHorizontal, ShieldAlert,
  AlertTriangle, ExternalLink, Image, Clock, Layers, Tag,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

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
  const [sheetOpen, setSheetOpen] = useState(false);

  // Rejection modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Tables<"products"> | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Suspend modal
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Tables<"products"> | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Order bumps for X-Ray
  const [orderBumps, setOrderBumps] = useState<any[]>([]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const getSellerName = (userId: string) => profileMap.get(userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => profileMap.get(userId)?.email || "";

  const statsCache = useMemo(() => {
    const m = new Map<string, { totalTx: number; completedTx: number; revenue: number; fees: number; chargebacks: number; conversion: number }>();
    const byProduct = new Map<string, Tables<"transactions">[]>();
    for (const t of transactions) {
      if (!t.product_id) continue;
      const arr = byProduct.get(t.product_id) || [];
      arr.push(t);
      byProduct.set(t.product_id, arr);
    }
    for (const [pid, txs] of byProduct) {
      const completed = txs.filter(t => t.status === "completed" || t.status === "approved");
      const chargebacks = txs.filter(t => t.status === "chargeback").length;
      m.set(pid, {
        totalTx: txs.length,
        completedTx: completed.length,
        revenue: completed.reduce((a, t) => a + Number(t.amount), 0),
        fees: completed.reduce((a, t) => a + Number(t.fee_amount), 0),
        chargebacks,
        conversion: txs.length > 0 ? (completed.length / txs.length) * 100 : 0,
      });
    }
    return m;
  }, [transactions]);

  const getProductStats = (pid: string) => statsCache.get(pid) || { totalTx: 0, completedTx: 0, revenue: 0, fees: 0, chargebacks: 0, conversion: 0 };

  // Load order bumps when X-Ray opens
  useEffect(() => {
    if (!selectedProduct) { setOrderBumps([]); return; }
    supabase.from("order_bumps").select("*, bump_product:products!order_bumps_bump_product_id_fkey(id,name,price)")
      .eq("product_id", selectedProduct.id)
      .then(({ data }) => setOrderBumps(data || []));
  }, [selectedProduct]);

  const handleProductStatus = async (productId: string, status: string, userId: string, reason?: string) => {
    const updateData: any = { status };
    if (reason) updateData.rejection_reason = reason;
    const { error } = await supabase.from("products").update(updateData).eq("id", productId);
    if (error) { toast.error("Erro ao atualizar produto"); return; }
    const labels: Record<string, string> = { active: "aprovado ✅", blocked: "suspenso 🚫", rejected: "recusado ❌", pending_review: "em revisão" };
    toast.success(`Produto ${labels[status] || status}!`);
    await logAdminAction(`product_${status}`, "product", productId, { status, user_id: userId, reason });
    onReload();
  };

  const openReject = (p: Tables<"products">) => {
    setRejectTarget(p);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { toast.error("Motivo obrigatório"); return; }
    await handleProductStatus(rejectTarget.id, "rejected", rejectTarget.user_id, rejectReason.trim());
    setRejectOpen(false);
    setRejectTarget(null);
  };

  const openSuspend = (p: Tables<"products">) => {
    setSuspendTarget(p);
    setSuspendReason("");
    setSuspendOpen(true);
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) { toast.error("Motivo obrigatório"); return; }
    await handleProductStatus(suspendTarget.id, "blocked", suspendTarget.user_id, suspendReason.trim());
    setSuspendOpen(false);
    setSuspendTarget(null);
  };

  const openXRay = (p: Tables<"products">) => {
    setSelectedProduct(p);
    setSheetOpen(true);
  };

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s) || getSellerName(p.user_id).toLowerCase().includes(s);
    });
  }, [products, statusFilter, search, profileMap]);

  const pendingReview = useMemo(() => products.filter(p => p.status === "pending_review"), [products]);
  const activeCount = products.filter(p => p.status === "active").length;
  const blockedCount = products.filter(p => p.status === "blocked").length;
  const rejectedCount = products.filter(p => p.status === "rejected").length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<Package className="h-5 w-5" />} label="Total Produtos" value={String(products.length)} sub="Cadastrados" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Em Revisão" value={String(pendingReview.length)} sub="Aguardando" alert={pendingReview.length > 0} />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Ativos" value={String(activeCount)} sub={`${((activeCount / Math.max(products.length, 1)) * 100).toFixed(0)}%`} highlight />
        <AdminKpi icon={<Ban className="h-5 w-5" />} label="Suspensos" value={String(blockedCount)} sub="Checkout inativo" alert={blockedCount > 0} />
        <AdminKpi icon={<ShieldAlert className="h-5 w-5" />} label="Recusados" value={String(rejectedCount)} sub="Contra políticas" alert={rejectedCount > 0} />
      </div>

      {/* ═══ REVIEW BOARD ═══ */}
      {pendingReview.length > 0 && (
        <AdminPanel className="ring-1 ring-warning/20">
          <PanelTitle color="amber" icon={<Clock className="h-4 w-4" />}>
            Fila de Revisão ({pendingReview.length})
          </PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["ID", "Seller", "Produto", "Tipo", "Preço", "Criado em", "Ações"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pendingReview.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-warning/[0.03] transition-colors">
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{p.id.slice(0, 8)}</td>
                    <td className="p-3">
                      <p className="text-xs font-medium text-foreground">{getSellerName(p.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">{getSellerEmail(p.user_id)}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center"><Image className="h-3.5 w-3.5 text-muted-foreground" /></div>
                        )}
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-[10px] text-muted-foreground uppercase">Infoproduto</td>
                    <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(Number(p.price))}</td>
                    <td className="p-3 text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => handleProductStatus(p.id, "active", p.user_id)}>
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => openReject(p)}>
                          <ShieldAlert className="h-3 w-3" /> Reprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openXRay(p)}>
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar produto ou vendedor..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-10 text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending_review">Em Revisão</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="blocked">Suspensos</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Full Table */}
      <AdminPanel>
        <PanelTitle color="violet" icon={<Package className="h-4 w-4" />}>Todos os Produtos ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Produto", "Vendedor", "Preço", "Vendas", "Receita", "CBs", "Status", "Ações"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const stats = getProductStats(p.id);
                const isBlocked = p.status === "blocked";
                const isRejected = p.status === "rejected";
                const isPending = p.status === "pending_review";
                return (
                  <tr key={p.id} className={cn(
                    "border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer",
                    isBlocked && "bg-destructive/[0.03]",
                    isRejected && "bg-warning/[0.03]",
                    isPending && "bg-info/[0.03]",
                  )} onClick={() => openXRay(p)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-border" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center"><Image className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-foreground">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground max-w-[200px] truncate">{p.description || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-xs font-medium text-muted-foreground">{getSellerName(p.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground/60">{getSellerEmail(p.user_id)}</p>
                    </td>
                    <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(Number(p.price))}</td>
                    <td className="p-3">
                      <span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded text-foreground">{stats.completedTx}/{stats.totalTx}</span>
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">{fmtCurrency(stats.revenue)}</td>
                    <td className="p-3">
                      <span className={cn("text-xs font-bold", stats.chargebacks > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {stats.chargebacks}
                      </span>
                    </td>
                    <td className="p-3"><StatusBadge status={p.status} /></td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[180px]">
                          <DropdownMenuItem className="gap-2" onClick={() => openXRay(p)}>
                            <Eye className="h-3.5 w-3.5" /> Raio-X
                          </DropdownMenuItem>
                          {p.checkout_url && (
                            <DropdownMenuItem className="gap-2" onClick={() => window.open(p.checkout_url!, "_blank")}>
                              <ExternalLink className="h-3.5 w-3.5" /> Checkout
                            </DropdownMenuItem>
                          )}
                          {p.status !== "active" && (
                            <DropdownMenuItem className="gap-2 text-primary" onClick={() => handleProductStatus(p.id, "active", p.user_id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                            </DropdownMenuItem>
                          )}
                          {p.status === "active" && (
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => openSuspend(p)}>
                              <Ban className="h-3.5 w-3.5" /> Suspender Checkout
                            </DropdownMenuItem>
                          )}
                          {p.status !== "rejected" && (
                            <DropdownMenuItem className="gap-2 text-warning" onClick={() => openReject(p)}>
                              <ShieldAlert className="h-3.5 w-3.5" /> Reprovar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">Nenhum produto encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* ═══ X-RAY SHEET ═══ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selectedProduct && (() => {
            const stats = getProductStats(selectedProduct.id);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" /> Raio-X do Produto
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  {/* Thumbnail + Name */}
                  <div className="flex items-start gap-4">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt="" className="h-20 w-20 rounded-2xl object-cover border border-border shadow-lg" />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-muted/30 flex items-center justify-center border border-border">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-base font-black text-foreground">{selectedProduct.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{getSellerName(selectedProduct.user_id)} • {getSellerEmail(selectedProduct.user_id)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={selectedProduct.status} />
                        <span className="text-sm font-bold text-primary">{fmtCurrency(Number(selectedProduct.price))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Descrição</p>
                    <p className="text-xs text-foreground">{selectedProduct.description || "Sem descrição"}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Vendas" value={`${stats.completedTx}/${stats.totalTx}`} />
                    <MiniStat label="Receita" value={fmtCurrency(stats.revenue)} />
                    <MiniStat label="Conversão" value={`${stats.conversion.toFixed(1)}%`} />
                    <MiniStat label="Chargebacks" value={String(stats.chargebacks)} alert={stats.chargebacks > 0} />
                  </div>

                  {/* Checkout Config */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Config. Checkout</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">PIX:</span><span className="font-medium text-foreground">{selectedProduct.checkout_pix_enabled ? "✅ Sim" : "❌ Não"}</span>
                      <span className="text-muted-foreground">Cartão:</span><span className="font-medium text-foreground">{selectedProduct.checkout_credit_card_enabled ? "✅ Sim" : "❌ Não"}</span>
                      <span className="text-muted-foreground">Boleto:</span><span className="font-medium text-foreground">{selectedProduct.checkout_boleto_enabled ? "✅ Sim" : "❌ Não"}</span>
                      <span className="text-muted-foreground">Timer:</span><span className="font-medium text-foreground">{selectedProduct.checkout_timer_enabled ? `${selectedProduct.checkout_timer_minutes}min` : "Não"}</span>
                      <span className="text-muted-foreground">Garantia:</span><span className="font-medium text-foreground">{selectedProduct.checkout_guarantee_enabled ? "✅ Sim" : "❌ Não"}</span>
                      <span className="text-muted-foreground">Endereço:</span><span className="font-medium text-foreground">{selectedProduct.checkout_address_required ? "✅ Obrig." : "Não"}</span>
                    </div>
                    {selectedProduct.checkout_url && (
                      <div className="pt-2 mt-2 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground">URL: <span className="font-mono">{selectedProduct.checkout_url}</span></p>
                      </div>
                    )}
                  </div>

                  {/* Order Bumps */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Order Bumps
                    </p>
                    {orderBumps.length > 0 ? (
                      <div className="space-y-1.5">
                        {orderBumps.map((ob: any) => (
                          <div key={ob.id} className="flex items-center justify-between text-xs rounded-lg bg-background/50 p-2 border border-border/50">
                            <span className="font-medium text-foreground">{ob.bump_product?.name || "—"}</span>
                            <span className="text-primary font-bold">{fmtCurrency(Number(ob.bump_product?.price || 0))}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum order bump vinculado</p>
                    )}
                  </div>

                  {/* IDs */}
                  <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                    <p>Product ID: {selectedProduct.id}</p>
                    <p>User ID: {selectedProduct.user_id}</p>
                    <p>Criado: {new Date(selectedProduct.created_at).toLocaleString("pt-BR")}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    {selectedProduct.status !== "active" && (
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => { handleProductStatus(selectedProduct.id, "active", selectedProduct.user_id); setSheetOpen(false); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar Produto
                      </Button>
                    )}
                    {selectedProduct.status === "active" && (
                      <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => { openSuspend(selectedProduct); }}>
                        <Ban className="h-3.5 w-3.5" /> Suspender Checkout
                      </Button>
                    )}
                    {selectedProduct.status !== "rejected" && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs border-warning/30 text-warning hover:bg-warning/10" onClick={() => { openReject(selectedProduct); }}>
                        <ShieldAlert className="h-3.5 w-3.5" /> Reprovar
                      </Button>
                    )}
                    {selectedProduct.checkout_url && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => window.open(selectedProduct.checkout_url!, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir Checkout
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ═══ REJECT MODAL ═══ */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <ShieldAlert className="h-5 w-5" /> Reprovar Produto
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <p className="font-bold text-foreground">{rejectTarget.name}</p>
                <p className="text-muted-foreground">Seller: {getSellerName(rejectTarget.user_id)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Promessa Irreal", "Nicho Proibido", "Conteúdo Ilegal", "Violação de Direitos Autorais", "Spam/Baixa Qualidade"].map(r => (
                  <Button key={r} size="sm" variant={rejectReason === r ? "default" : "outline"} className="text-[10px] h-7 rounded-full"
                    onClick={() => setRejectReason(r)}>{r}</Button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Motivo detalhado (obrigatório)</label>
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Descreva o motivo da reprovação..." className="mt-1 text-xs" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmReject} className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ SUSPEND MODAL ═══ */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Suspender Checkout
            </DialogTitle>
          </DialogHeader>
          {suspendTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <p className="font-bold text-foreground">{suspendTarget.name}</p>
                <p className="text-muted-foreground">Seller: {getSellerName(suspendTarget.user_id)}</p>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/[0.06] p-3 text-xs text-warning">
                <p className="font-bold">Suspensão Cirúrgica</p>
                <p className="mt-1 text-warning/80">Isso inativa apenas o checkout deste produto. O seller <strong>NÃO</strong> será banido da plataforma.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Motivo (obrigatório para Audit Trail)</label>
                <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                  placeholder="Ex: Alto volume de chargebacks, oferta agressiva..." className="mt-1 text-xs" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmSuspend} className="gap-1.5">
              <Ban className="h-3.5 w-3.5" /> Confirmar Suspensão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", alert ? "border-destructive/30 bg-destructive/[0.06]" : "border-border bg-muted/20")}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-extrabold mt-0.5", alert ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}

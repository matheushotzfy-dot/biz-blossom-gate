import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Search, Ban, CheckCircle2, Eye, MoreHorizontal, ShieldAlert,
  ExternalLink, Image as ImageIcon, Clock, Layers, Trash2, CircleDollarSign,
  TrendingDown, AlertTriangle, FileText, ShoppingBag, ShieldCheck, ShieldX,
  ShieldQuestion, Receipt, User as UserIcon, Mail, RefreshCw, X, Tag,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { LinearHero, LinearStat, LinearStatRow } from "@/components/admin/LinearKit";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

interface Props {
  products: Tables<"products">[];
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
  onReload: () => void;
}

type Classification = "white" | "gray" | "black";

const CLASSIFICATION_META: Record<Classification, { label: string; icon: any; color: string; ring: string }> = {
  white: { label: "White", icon: ShieldCheck, color: "text-emerald-400", ring: "border-emerald-500/30 bg-emerald-500/10" },
  gray:  { label: "Gray",  icon: ShieldQuestion, color: "text-amber-400", ring: "border-amber-500/30 bg-amber-500/10" },
  black: { label: "Black", icon: ShieldX, color: "text-red-400", ring: "border-red-500/30 bg-red-500/10" },
};

export default function AdminProductsTab({ products, profiles, transactions, fmtCurrency, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState<"all" | Classification>("all");
  const [selectedProduct, setSelectedProduct] = useState<Tables<"products"> | null>(null);
  const [xrayOpen, setXrayOpen] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Tables<"products"> | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Tables<"products"> | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<"products"> | null>(null);

  // X-Ray data
  const [orderBumps, setOrderBumps] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [affiliateSales, setAffiliateSales] = useState<any[]>([]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);

  const getSellerName = (userId: string) => profileMap.get(userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => profileMap.get(userId)?.email || "";
  const getSellerDoc = (userId: string) => profileMap.get(userId)?.document_number || "";
  const getSellerPhone = (userId: string) => profileMap.get(userId)?.phone || "";

  const txByProduct = useMemo(() => {
    const m = new Map<string, Tables<"transactions">[]>();
    for (const t of transactions) {
      if (!t.product_id) continue;
      const arr = m.get(t.product_id) || [];
      arr.push(t);
      m.set(t.product_id, arr);
    }
    return m;
  }, [transactions]);

  const getProductStats = (pid: string) => {
    const txs = txByProduct.get(pid) || [];
    const completed = txs.filter(t => t.status === "completed");
    const pending = txs.filter(t => t.status === "pending");
    const refunded = txs.filter(t => t.status === "refunded");
    const chargebacks = txs.filter(t => t.status === "chargeback");
    const failed = txs.filter(t => t.status === "failed" || t.status === "expired");
    const gross = completed.reduce((a, t) => a + Number(t.amount), 0);
    const net = completed.reduce((a, t) => a + Number(t.net_amount || 0), 0);
    const fees = completed.reduce((a, t) => a + Number(t.fee_amount || 0), 0);
    const refundedAmt = refunded.reduce((a, t) => a + Number(t.amount), 0);
    const cbAmt = chargebacks.reduce((a, t) => a + Number(t.amount), 0);
    const conversion = txs.length > 0 ? (completed.length / txs.length) * 100 : 0;
    return {
      total: txs.length, completed: completed.length, pending: pending.length,
      refunded: refunded.length, chargebacks: chargebacks.length, failed: failed.length,
      gross, net, fees, refundedAmt, cbAmt, conversion,
      txs,
    };
  };

  useEffect(() => {
    if (!selectedProduct) { setOrderBumps([]); setDisputes([]); setAffiliateSales([]); return; }
    const pid = selectedProduct.id;
    const txIds = (txByProduct.get(pid) || []).map(t => t.id);
    Promise.all([
      supabase.from("order_bumps").select("*, bump_product:products!order_bumps_bump_product_id_fkey(id,name,price)").eq("product_id", pid),
      txIds.length ? supabase.from("disputes").select("*").in("transaction_id", txIds) : Promise.resolve({ data: [] } as any),
      supabase.from("affiliate_sales").select("*").eq("product_id", pid),
    ]).then(([obRes, dRes, asRes]) => {
      setOrderBumps(obRes.data || []);
      setDisputes(dRes.data || []);
      setAffiliateSales(asRes.data || []);
    });
  }, [selectedProduct, txByProduct]);

  const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    draft: ["active", "pending_review", "inactive"],
    pending_review: ["active", "inactive"],
    active: ["pending_review", "inactive"],
    inactive: ["active", "pending_review"],
    suspended: ["active", "inactive"],
    rejected: ["active", "pending_review", "inactive"],
  };

  const handleProductStatus = async (productId: string, status: string, userId: string, reason?: string) => {
    const product = products.find(p => p.id === productId);
    const currentStatus = product?.status || "active";
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    if (allowed && !allowed.includes(status)) {
      toast.error(`Não é possível mudar de "${currentStatus}" para "${status}"`);
      return;
    }
    const updateData: any = { status };
    if (status === "active") updateData.rejection_reason = null;
    else if (reason) updateData.rejection_reason = reason.replace(/[<>]/g, "").trim().slice(0, 1000);
    const { error } = await supabase.from("products").update(updateData).eq("id", productId);
    if (error) { toast.error("Erro ao atualizar produto"); return; }
    const labels: Record<string, string> = { active: "reaprovado", inactive: "inativado", pending_review: "marcado para revisão" };
    toast.success(`Produto ${labels[status] || status}!`);
    await logAdminAction(`product_${status}`, "product", productId, { status, user_id: userId, reason });
    onReload();
  };

  const setClassification = async (productId: string, classification: Classification) => {
    const { error } = await supabase.from("products").update({ classification } as any).eq("id", productId);
    if (error) { toast.error("Erro ao classificar"); return; }
    toast.success(`Produto classificado como ${CLASSIFICATION_META[classification].label}`);
    await logAdminAction("product_classified", "product", productId, { classification });
    onReload();
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() } as any).eq("id", deleteTarget.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto excluído (soft-delete)");
    await logAdminAction("product_deleted", "product", deleteTarget.id, {});
    setDeleteOpen(false); setDeleteTarget(null); onReload();
  };

  const openXRay = (p: Tables<"products">) => { setSelectedProduct(p); setXrayOpen(true); };

  const filtered = useMemo(() => {
    return products.filter(p => {
      const isDeleted = !!(p as any).deleted_at;
      if (statusFilter === "deleted") {
        if (!isDeleted) return false;
      } else if (statusFilter === "all") {
        if (isDeleted) return false;
      } else {
        if (isDeleted) return false;
        if (p.status !== statusFilter) return false;
      }
      if (classFilter !== "all" && ((p as any).classification || "white") !== classFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s) || getSellerName(p.user_id).toLowerCase().includes(s);
    });
  }, [products, statusFilter, classFilter, search, profileMap]);

  const pendingReview = useMemo(() => products.filter(p => p.status === "pending_review" && !(p as any).deleted_at), [products]);
  const activeCount = products.filter(p => p.status === "active" && !(p as any).deleted_at).length;
  const blockedCount = products.filter(p => (p.status === "inactive" || p.status === "suspended") && !(p as any).deleted_at).length;
  const deletedCount = products.filter(p => !!(p as any).deleted_at).length;
  const blackCount = products.filter(p => (p as any).classification === "black" && !(p as any).deleted_at).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <LinearHero
        eyebrow="Catálogo · Produtos"
        title="Curadoria de produtos"
        subtitle="Revise pendentes, classifique risco, suspenda violações e investigue cada produto em profundidade."
        status={{ tone: pendingReview.length > 0 ? "warning" : "success", label: pendingReview.length > 0 ? `${pendingReview.length} em revisão` : "Sem pendências", pulse: pendingReview.length > 0 }}
      />

      <LinearStatRow>
        <LinearStat icon={Package} label="Total" value={String(products.length - deletedCount)} sub="Ativos no catálogo" tone="neutral" />
        <LinearStat icon={Clock} label="Em Revisão" value={String(pendingReview.length)} sub="Aguardando" tone="warning" />
        <LinearStat icon={CheckCircle2} label="Ativos" value={String(activeCount)} sub={`${((activeCount / Math.max(products.length - deletedCount, 1)) * 100).toFixed(0)}% publicados`} tone="success" />
        <LinearStat icon={Ban} label="Suspensos" value={String(blockedCount)} sub="Checkout inativo" tone="destructive" />
        <LinearStat icon={ShieldX} label="Black-list" value={String(blackCount)} sub="Risco crítico" tone="destructive" />
      </LinearStatRow>

      {pendingReview.length > 0 && (
        <AdminPanel className="ring-1 ring-warning/20">
          <PanelTitle color="amber" icon={<Clock className="h-4 w-4" />}>
            Fila de Revisão ({pendingReview.length})
          </PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["Produto", "Seller", "Preço", "Criado em", "Ações"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pendingReview.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-warning/[0.03] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-border" />
                        ) : <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>}
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-xs font-medium text-foreground">{getSellerName(p.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">{getSellerEmail(p.user_id)}</p>
                    </td>
                    <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(Number(p.price))}</td>
                    <td className="p-3 text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => handleProductStatus(p.id, "active", p.user_id)}>
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => { setRejectTarget(p); setRejectReason(""); setRejectOpen(true); }}>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar produto ou vendedor..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-10 text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ativos (todos status)</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="pending_review">Em Revisão</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="deleted">🗑️ Apagados (histórico)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={(v: any) => setClassFilter(v)}>
          <SelectTrigger className="w-[160px] h-10 text-xs rounded-xl"><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas classes</SelectItem>
            <SelectItem value="white">⚪ White</SelectItem>
            <SelectItem value="gray">🟡 Gray</SelectItem>
            <SelectItem value="black">⚫ Black</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminPanel>
        <PanelTitle color={statusFilter === "deleted" ? "amber" : "violet"} icon={<Package className="h-4 w-4" />}>
          {statusFilter === "deleted" ? `🗑️ Produtos Apagados (${filtered.length})` : `Todos os Produtos (${filtered.length})`}
        </PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Produto", "Vendedor", "Classe", "Preço", "Vendas", "Receita", "Reemb.", "CB", "Status", ""].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(p => {
                const stats = getProductStats(p.id);
                const cls = ((p as any).classification || "white") as Classification;
                const ClsIcon = CLASSIFICATION_META[cls].icon;
                const isDeleted = !!(p as any).deleted_at;
                return (
                  <tr key={p.id} className={cn(
                    "border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer",
                    cls === "black" && "bg-red-500/[0.03]",
                    cls === "gray" && "bg-amber-500/[0.03]",
                    isDeleted && "opacity-70",
                  )} onClick={() => openXRay(p)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-border" />
                        ) : <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
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
                    <td className="p-3">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", CLASSIFICATION_META[cls].ring, CLASSIFICATION_META[cls].color)}>
                        <ClsIcon className="h-3 w-3" /> {CLASSIFICATION_META[cls].label}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold text-primary">{fmtCurrency(Number(p.price))}</td>
                    <td className="p-3"><span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded text-foreground">{stats.completed}/{stats.total}</span></td>
                    <td className="p-3 text-xs font-bold text-foreground">{fmtCurrency(stats.gross)}</td>
                    <td className="p-3"><span className={cn("text-xs font-bold", stats.refunded > 0 ? "text-warning" : "text-muted-foreground/50")}>{stats.refunded}</span></td>
                    <td className="p-3"><span className={cn("text-xs font-bold", stats.chargebacks > 0 ? "text-destructive" : "text-muted-foreground/50")}>{stats.chargebacks}</span></td>
                    <td className="p-3">{isDeleted ? <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-destructive/15 text-destructive border border-destructive/30">Apagado</span> : <StatusBadge status={p.status} />}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[200px]">
                          <DropdownMenuItem className="gap-2" onClick={() => openXRay(p)}><Eye className="h-3.5 w-3.5" /> Raio-X completo</DropdownMenuItem>
                          {p.checkout_url && <DropdownMenuItem className="gap-2" onClick={() => window.open(p.checkout_url!, "_blank")}><ExternalLink className="h-3.5 w-3.5" /> Abrir Checkout</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-emerald-400" onClick={() => setClassification(p.id, "white")}><ShieldCheck className="h-3.5 w-3.5" /> Classificar White</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-amber-400" onClick={() => setClassification(p.id, "gray")}><ShieldQuestion className="h-3.5 w-3.5" /> Classificar Gray</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-red-400" onClick={() => setClassification(p.id, "black")}><ShieldX className="h-3.5 w-3.5" /> Classificar Black</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {p.status !== "active" && <DropdownMenuItem className="gap-2 text-primary" onClick={() => handleProductStatus(p.id, "active", p.user_id)}><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar</DropdownMenuItem>}
                          {p.status === "active" && <DropdownMenuItem className="gap-2 text-warning" onClick={() => { setRejectTarget(p); setRejectReason(""); setRejectOpen(true); }}><ShieldAlert className="h-3.5 w-3.5" /> Em Revisão</DropdownMenuItem>}
                          {p.status !== "inactive" && <DropdownMenuItem className="gap-2 text-orange-400" onClick={() => { setSuspendTarget(p); setSuspendReason(""); setSuspendOpen(true); }}><Ban className="h-3.5 w-3.5" /> Desativar</DropdownMenuItem>}
                          {!isDeleted && <DropdownMenuItem className="gap-2 text-destructive" onClick={() => { setDeleteTarget(p); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /> Excluir (soft)</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={10} className="p-10 text-center text-muted-foreground text-xs">Nenhum produto encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* ═══ RAIO-X DIALOG ═══ */}
      <Dialog open={xrayOpen} onOpenChange={setXrayOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          {selectedProduct && (() => {
            const stats = getProductStats(selectedProduct.id);
            const cls = ((selectedProduct as any).classification || "white") as Classification;
            const ClsIcon = CLASSIFICATION_META[cls].icon;
            const commissionsTotal = affiliateSales.reduce((a, s) => a + Number(s.commission_amount || 0), 0);
            const disputeAmt = disputes.reduce((a, d) => a + Number(d.amount || 0), 0);
            return (
              <>
                <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {selectedProduct.image_url ? (
                        <img src={selectedProduct.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover border border-border shrink-0" />
                      ) : <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center shrink-0"><Package className="h-7 w-7 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-base">
                            <Eye className="h-4 w-4 text-primary" /> Raio-X do Produto
                          </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm font-black text-foreground mt-1 truncate">{selectedProduct.name}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <StatusBadge status={selectedProduct.status} />
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", CLASSIFICATION_META[cls].ring, CLASSIFICATION_META[cls].color)}>
                            <ClsIcon className="h-3 w-3" /> {CLASSIFICATION_META[cls].label}
                          </span>
                          <span className="text-xs font-bold text-primary">{fmtCurrency(Number(selectedProduct.price))}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{selectedProduct.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setXrayOpen(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Seller */}
                  <div className="rounded-2xl border border-border bg-card/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><UserIcon className="h-3 w-3" /> Vendedor</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <KV label="Nome" value={getSellerName(selectedProduct.user_id)} />
                      <KV label="Email" value={getSellerEmail(selectedProduct.user_id) || "—"} />
                      <KV label="Documento" value={getSellerDoc(selectedProduct.user_id) || "—"} />
                      <KV label="Telefone" value={getSellerPhone(selectedProduct.user_id) || "—"} />
                    </div>
                  </div>

                  {/* Métricas */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><CircleDollarSign className="h-3 w-3" /> Financeiro</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MetricCard icon={CircleDollarSign} label="Faturamento Bruto" value={fmtCurrency(stats.gross)} tone="success" />
                      <MetricCard icon={Receipt} label="Receita Líquida" value={fmtCurrency(stats.net)} tone="primary" />
                      <MetricCard icon={Tag} label="Taxas Pagas" value={fmtCurrency(stats.fees)} tone="muted" />
                      <MetricCard icon={TrendingDown} label="Reembolsado" value={fmtCurrency(stats.refundedAmt)} tone="warning" />
                      <MetricCard icon={AlertTriangle} label="Chargebacks" value={fmtCurrency(stats.cbAmt)} tone="destructive" />
                      <MetricCard icon={ShoppingBag} label="Vendas" value={`${stats.completed}/${stats.total}`} sub={`${stats.conversion.toFixed(1)}% conv.`} tone="neutral" />
                      <MetricCard icon={Clock} label="Pendentes" value={String(stats.pending)} tone="warning" />
                      <MetricCard icon={Users} label="Comissões Afiliados" value={fmtCurrency(commissionsTotal)} sub={`${affiliateSales.length} vendas`} tone="primary" />
                    </div>
                  </div>

                  {/* Breakdown por método */}
                  <PaymentMethodBreakdown txs={stats.txs.filter(t => t.status === "completed")} fmtCurrency={fmtCurrency} />

                  {/* Transações */}
                  <TxHistory title="Transações Aprovadas" icon={CheckCircle2} color="emerald" txs={stats.txs.filter(t => t.status === "completed").slice(0, 50)} fmtCurrency={fmtCurrency} />
                  {stats.pending > 0 && <TxHistory title="Pendentes" icon={Clock} color="amber" txs={stats.txs.filter(t => t.status === "pending").slice(0, 20)} fmtCurrency={fmtCurrency} />}
                  {stats.refunded > 0 && <TxHistory title="Reembolsos" icon={RefreshCw} color="orange" txs={stats.txs.filter(t => t.status === "refunded").slice(0, 20)} fmtCurrency={fmtCurrency} />}
                  {stats.chargebacks > 0 && <TxHistory title="Chargebacks" icon={AlertTriangle} color="red" txs={stats.txs.filter(t => t.status === "chargeback").slice(0, 20)} fmtCurrency={fmtCurrency} />}

                  {/* Disputas/MED */}
                  {disputes.length > 0 && (
                    <div className="rounded-2xl border border-warning/30 bg-warning/[0.04] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-warning mb-3 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Disputas / MED ({disputes.length}) — {fmtCurrency(disputeAmt)}</p>
                      <div className="space-y-1.5">
                        {disputes.slice(0, 10).map(d => (
                          <div key={d.id} className="flex items-center justify-between text-xs rounded-lg bg-background/50 p-2 border border-border/50">
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{d.buyer_name || d.buyer_email}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{d.reason}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground">{d.type}</p>
                              <p className="text-xs font-bold text-warning">{fmtCurrency(Number(d.amount))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order bumps */}
                  <div className="rounded-2xl border border-border bg-card/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Layers className="h-3 w-3" /> Order Bumps ({orderBumps.length})</p>
                    {orderBumps.length > 0 ? (
                      <div className="space-y-1.5">
                        {orderBumps.map((ob: any) => (
                          <div key={ob.id} className="flex items-center justify-between text-xs rounded-lg bg-background/50 p-2 border border-border/50">
                            <span className="font-medium text-foreground">{ob.bump_product?.name || "—"}</span>
                            <span className="text-primary font-bold">{fmtCurrency(Number(ob.bump_product?.price || 0))}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground">Nenhum order bump vinculado</p>}
                  </div>

                  {/* Config */}
                  <div className="rounded-2xl border border-border bg-card/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><FileText className="h-3 w-3" /> Configuração de Checkout</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                      <KV label="PIX" value={selectedProduct.checkout_pix_enabled ? "Sim" : "Não"} />
                      <KV label="Cartão" value={selectedProduct.checkout_credit_card_enabled ? "Sim" : "Não"} />
                      <KV label="Boleto" value={selectedProduct.checkout_boleto_enabled ? "Sim" : "Não"} />
                      <KV label="Timer" value={selectedProduct.checkout_timer_enabled ? `${selectedProduct.checkout_timer_minutes}min` : "Não"} />
                      <KV label="Garantia" value={selectedProduct.checkout_guarantee_enabled ? "Sim" : "Não"} />
                      <KV label="Endereço" value={selectedProduct.checkout_address_required ? "Obrig." : "Não"} />
                      <KV label="Afiliados" value={selectedProduct.affiliate_enabled ? `${selectedProduct.affiliate_commission || 0}%` : "Não"} />
                      <KV label="Coprodução" value={selectedProduct.co_production_enabled ? "Sim" : "Não"} />
                      <KV label="Upsell" value={selectedProduct.upsell_enabled ? "Sim" : "Não"} />
                    </div>
                    {selectedProduct.checkout_url && <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/50 font-mono break-all">{selectedProduct.checkout_url}</p>}
                  </div>
                </div>

                <DialogFooter className="sticky bottom-0 z-20 bg-card/95 backdrop-blur-md border-t border-border p-4 flex-wrap gap-2">
                  {selectedProduct.status !== "active" && (
                    <Button size="sm" className="gap-1.5 text-xs" onClick={() => { handleProductStatus(selectedProduct.id, "active", selectedProduct.user_id); setXrayOpen(false); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  )}
                  {selectedProduct.status === "active" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs border-warning/30 text-warning hover:bg-warning/10" onClick={() => { setRejectTarget(selectedProduct); setRejectReason(""); setRejectOpen(true); }}>
                      <ShieldAlert className="h-3.5 w-3.5" /> Em Revisão
                    </Button>
                  )}
                  {selectedProduct.status !== "inactive" && (
                    <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => { setSuspendTarget(selectedProduct); setSuspendReason(""); setSuspendOpen(true); }}>
                      <Ban className="h-3.5 w-3.5" /> Desativar
                    </Button>
                  )}
                  {selectedProduct.checkout_url && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => window.open(selectedProduct.checkout_url!, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5" /> Checkout
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-warning"><ShieldAlert className="h-5 w-5" /> Colocar Em Revisão</DialogTitle></DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <p className="font-bold text-foreground">{rejectTarget.name}</p>
                <p className="text-muted-foreground">Seller: {getSellerName(rejectTarget.user_id)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Promessa Irreal", "Nicho Proibido", "Conteúdo Ilegal", "Direitos Autorais", "Spam/Baixa Qualidade"].map(r => (
                  <Button key={r} size="sm" variant={rejectReason === r ? "default" : "outline"} className="text-[10px] h-7 rounded-full" onClick={() => setRejectReason(r)}>{r}</Button>
                ))}
              </div>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Motivo detalhado (obrigatório)" className="text-xs" rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!rejectTarget || !rejectReason.trim()) { toast.error("Motivo obrigatório"); return; }
              await handleProductStatus(rejectTarget.id, "pending_review", rejectTarget.user_id, rejectReason.trim());
              setRejectOpen(false);
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Ban className="h-5 w-5" /> Desativar Produto</DialogTitle></DialogHeader>
          {suspendTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                <p className="font-bold text-foreground">{suspendTarget.name}</p>
                <p className="text-muted-foreground">Seller: {getSellerName(suspendTarget.user_id)}</p>
              </div>
              <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Motivo (obrigatório para auditoria)" className="text-xs" rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!suspendTarget || !suspendReason.trim()) { toast.error("Motivo obrigatório"); return; }
              await handleProductStatus(suspendTarget.id, "inactive", suspendTarget.user_id, suspendReason.trim());
              setSuspendOpen(false);
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> Excluir Produto</DialogTitle></DialogHeader>
          {deleteTarget && (
            <p className="text-xs text-muted-foreground">
              Confirmar exclusão de <span className="font-bold text-foreground">{deleteTarget.name}</span>? O produto entra em soft-delete (histórico preservado para auditoria).
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleSoftDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone: "success" | "warning" | "destructive" | "primary" | "muted" | "neutral" }) {
  const toneClasses = {
    success: "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/[0.04] text-amber-400",
    destructive: "border-red-500/20 bg-red-500/[0.04] text-red-400",
    primary: "border-primary/20 bg-primary/[0.04] text-primary",
    muted: "border-border bg-muted/20 text-muted-foreground",
    neutral: "border-border bg-card/40 text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-3", toneClasses)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="h-3 w-3 opacity-70" />
      </div>
      <p className="text-base font-black tabular-nums">{value}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function PaymentMethodBreakdown({ txs, fmtCurrency }: { txs: Tables<"transactions">[]; fmtCurrency: (v: number) => string }) {
  const byMethod = txs.reduce((acc, t) => {
    const m = t.payment_method || "outro";
    acc[m] = acc[m] || { count: 0, gross: 0 };
    acc[m].count += 1;
    acc[m].gross += Number(t.amount);
    return acc;
  }, {} as Record<string, { count: number; gross: number }>);
  if (Object.keys(byMethod).length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Por Método de Pagamento</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(byMethod).map(([m, s]) => (
          <div key={m} className="rounded-xl border border-border/50 bg-background/40 p-2.5">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">{m}</p>
            <p className="text-sm font-black text-foreground">{fmtCurrency(s.gross)}</p>
            <p className="text-[10px] text-muted-foreground">{s.count} vendas</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxHistory({ title, icon: Icon, color, txs, fmtCurrency }: { title: string; icon: any; color: string; txs: Tables<"transactions">[]; fmtCurrency: (v: number) => string }) {
  const colorClass: Record<string, string> = {
    emerald: "text-emerald-400 border-emerald-500/20",
    amber: "text-amber-400 border-amber-500/20",
    orange: "text-orange-400 border-orange-500/20",
    red: "text-red-400 border-red-500/20",
  };
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1", colorClass[color]?.split(" ")[0])}>
        <Icon className="h-3 w-3" /> {title} ({txs.length})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground">
            <th className="text-left p-2 font-bold">Cliente</th>
            <th className="text-left p-2 font-bold">Email</th>
            <th className="text-left p-2 font-bold">Método</th>
            <th className="text-right p-2 font-bold">Bruto</th>
            <th className="text-right p-2 font-bold">Líquido</th>
            <th className="text-left p-2 font-bold">Data</th>
          </tr></thead>
          <tbody>
            {txs.map(t => (
              <tr key={t.id} className="border-b border-border/20 hover:bg-muted/10">
                <td className="p-2 font-medium text-foreground truncate max-w-[140px]">{t.customer_name || "—"}</td>
                <td className="p-2 text-muted-foreground truncate max-w-[180px]">{t.customer_email || "—"}</td>
                <td className="p-2 text-muted-foreground uppercase text-[10px]">{t.payment_method}</td>
                <td className="p-2 text-right font-bold tabular-nums text-foreground">{fmtCurrency(Number(t.amount))}</td>
                <td className="p-2 text-right font-bold tabular-nums text-primary">{fmtCurrency(Number(t.net_amount || 0))}</td>
                <td className="p-2 text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {txs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Local users icon
function Users(props: any) { return <UserIcon {...props} />; }

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Handshake, Plus, CheckCircle2, XCircle, Clock, Mail, Shield,
  ArrowUpRight, Trash2, Send, Inbox, Search, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi, Panel } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type CoProduction = {
  id: string; product_id: string; owner_user_id: string; co_producer_user_id: string | null;
  co_producer_email: string; split_percentage: number; status: string;
  accepted_at: string | null; created_at: string; updated_at: string;
};

type TabId = "all" | "sent" | "received";

const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  accepted: { label: "Ativa", dot: "bg-success", pill: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pendente", dot: "bg-warning", pill: "bg-warning/10 text-warning border-warning/20" },
  rejected: { label: "Recusada", dot: "bg-destructive", pill: "bg-destructive/10 text-destructive border-destructive/20" },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] || { label: status, dot: "bg-muted-foreground", pill: "bg-muted/15 text-muted-foreground border-border/30" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border tabular-nums", c.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot, status === "pending" && "animate-pulse")} />
      {c.label}
    </span>
  );
}

/* ─── Partner Row ─── */
function PartnerRow({ cp, isSent, productName, productPrice, onAccept, onReject, onCancel }: {
  cp: CoProduction; isSent: boolean; productName: string; productPrice: number;
  onAccept?: () => void; onReject?: () => void; onCancel?: () => void;
}) {
  const ownerPct = 100 - cp.split_percentage;
  const yourPct = isSent ? ownerPct : cp.split_percentage;
  const yourAmount = productPrice * yourPct / 100;
  const partnerEmail = cp.co_producer_email;
  const initials = partnerEmail.slice(0, 2).toUpperCase();

  return (
    <div className="group grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 border-b border-border/20 last:border-b-0 hover:bg-muted/5 transition-colors">
      {/* Partner */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-muted/15 border border-border/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground truncate leading-tight">{partnerEmail}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">
              {isSent ? "Enviado" : "Recebido"}
            </span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {new Date(cp.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          </div>
        </div>
      </div>

      {/* Product */}
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate">{productName}</p>
        <p className="text-[10.5px] text-muted-foreground/50 tabular-nums mt-0.5">
          {productPrice > 0 ? fmt(productPrice) : "—"}
        </p>
      </div>

      {/* Commission split */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-display font-black text-primary tabular-nums leading-none">{yourPct}%</span>
          <span className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider font-bold">você</span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-muted/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
            style={{ width: `${yourPct}%` }}
          />
        </div>
        {productPrice > 0 && (
          <p className="text-[10px] text-muted-foreground/50 tabular-nums mt-1">
            {fmt(yourAmount)} <span className="text-muted-foreground/30">/ venda</span>
          </p>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusPill status={cp.status} />
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {!isSent && cp.status === "pending" ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={onAccept}
              className="h-7 px-2.5 text-[10.5px] bg-success/10 text-success hover:bg-success/15 border border-success/25 gap-1 rounded-md shadow-none font-bold">
              <CheckCircle2 className="h-3 w-3" /> Aceitar
            </Button>
            <Button size="sm" variant="ghost" onClick={onReject}
              className="h-7 px-2 text-[10.5px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md font-bold">
              <XCircle className="h-3 w-3" />
            </Button>
          </div>
        ) : isSent && cp.status !== "rejected" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="text-[12px]">
                <Mail className="h-3.5 w-3.5 mr-2" /> Reenviar convite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCancel} className="text-[12px] text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancelar parceria
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-7 w-7" />
        )}
      </div>
    </div>
  );
}

export default function Coproducoes() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const [coproductions, setCoproductions] = useState<CoProduction[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coSplit, setCoSplit] = useState("50");
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = async () => {
    if (!user) return;
    const { data } = await supabase.from("co_productions").select("*").or(
      `owner_user_id.eq.${user.id},co_producer_email.eq.${user.email}`
    ).order("created_at", { ascending: false });
    if (data) setCoproductions(data as unknown as CoProduction[]);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleCreate = async () => {
    if (!user || !selectedProduct || !coEmail.trim()) return;
    if (!coEmail.includes("@")) { toast.error("E-mail inválido"); return; }
    const split = Number(coSplit);
    if (split < 1 || split > 99) { toast.error("Split deve ser entre 1% e 99%"); return; }
    await supabase.from("products").update({
      co_production_enabled: true, co_producer_email: coEmail.trim(), co_production_split: split,
    }).eq("id", selectedProduct).eq("user_id", user.id);
    const { error } = await supabase.from("co_productions").insert({
      product_id: selectedProduct, owner_user_id: user.id,
      co_producer_email: coEmail.trim().toLowerCase(), split_percentage: split,
    });
    if (error) { toast.error("Erro ao criar coprodução"); return; }
    toast.success("Convite de coprodução enviado!");
    setOpenCreate(false); setCoEmail(""); setSelectedProduct(""); setCoSplit("50");
    loadData();
  };

  const handleAccept = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("co_productions").update({
      status: "accepted", co_producer_user_id: user.id, accepted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erro ao aceitar"); return; }
    toast.success("Coprodução aceita!"); loadData();
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Recusar este convite de coprodução?")) return;
    const { error } = await supabase.from("co_productions").update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error("Erro ao recusar"); return; }
    toast.success("Convite recusado."); loadData();
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancelar esta coprodução?")) return;
    const cp = coproductions.find(c => c.id === id);
    if (cp) {
      await supabase.from("products").update({ co_production_enabled: false, co_producer_email: null })
        .eq("id", cp.product_id).eq("user_id", user!.id);
    }
    const { error } = await supabase.from("co_productions").delete().eq("id", id);
    if (error) { toast.error("Erro ao cancelar"); return; }
    toast.success("Coprodução cancelada."); loadData();
  };

  const getProductName = (pid: string) => products.find(p => p.id === pid)?.name || "Produto";
  const getProductPrice = (pid: string) => Number(products.find(p => p.id === pid)?.price || 0);

  const sentCount = coproductions.filter(c => c.owner_user_id === user?.id).length;
  const receivedCount = coproductions.filter(c => c.owner_user_id !== user?.id).length;
  const activeCount = coproductions.filter(c => c.status === "accepted").length;
  const pendingCount = coproductions.filter(c => c.status === "pending").length;

  const filtered = useMemo(() => {
    return coproductions.filter(c => {
      if (tab === "sent" && c.owner_user_id !== user?.id) return false;
      if (tab === "received" && c.owner_user_id === user?.id) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const productName = getProductName(c.product_id).toLowerCase();
        if (!c.co_producer_email.toLowerCase().includes(q) && !productName.includes(q)) return false;
      }
      return true;
    });
  }, [coproductions, tab, statusFilter, search, user?.id, products]);

  const TABS: { id: TabId; label: string; icon: typeof Send; count: number }[] = [
    { id: "all", label: "Todas", icon: Handshake, count: coproductions.length },
    { id: "sent", label: "Enviadas", icon: Send, count: sentCount },
    { id: "received", label: "Recebidas", icon: Inbox, count: receivedCount },
  ];

  return (
    <PageShell>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Handshake className="h-6 w-6" />} title="Coproduções" subtitle="Gerencie parcerias e splits de receita com outros produtores" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-display font-bold h-10 px-5 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Nova Coprodução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/20">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
                    <Handshake className="h-5 w-5 text-primary" />
                  </div>
                  Criar Coprodução
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>
                    {products.filter(p => !p.co_production_enabled).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(Number(p.price))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">E-mail do Co-produtor</Label>
                <Input type="email" value={coEmail} onChange={e => setCoEmail(e.target.value)}
                  placeholder="parceiro@email.com" className="mt-1.5 rounded-xl h-11" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Split para o Co-produtor (%)</Label>
                <Input type="number" min="1" max="99" value={coSplit} onChange={e => setCoSplit(e.target.value)}
                  className="mt-1.5 rounded-xl w-28 h-11" />
                {selectedProduct && (
                  <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">Você receberá</span>
                      <span className="text-[14px] font-display font-black text-primary">{100 - Number(coSplit || 0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/60">Co-produtor receberá</span>
                      <span className="text-[14px] font-display font-black text-foreground">{coSplit}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${100 - Number(coSplit || 0)}%` }} />
                    </div>
                    <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/40">Por venda de {fmt(getProductPrice(selectedProduct))}</span>
                      <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                        Você: <strong className="text-primary">{fmt(getProductPrice(selectedProduct) * (100 - Number(coSplit || 0)) / 100)}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} className="w-full rounded-xl font-display font-bold h-11 shadow-lg shadow-primary/20" disabled={!selectedProduct || !coEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" /> Enviar Convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Ativas" value={String(activeCount)} icon={CheckCircle2} tone="success" sub="parcerias em produção" delay={0} />
        <GlassKpi label="Pendentes" value={String(pendingCount)} icon={Clock} tone="warning" sub="aguardando resposta" delay={1} />
        <GlassKpi label="Enviadas" value={String(sentCount)} icon={ArrowUpRight} tone="primary" sub="convites por você" delay={2} />
        <GlassKpi label="Recebidas" value={String(receivedCount)} icon={Inbox} tone="info" sub="convites recebidos" delay={3} />
      </div>

      {/* ─── Operations Panel ─── */}
      <Panel className="p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-border/30 bg-muted/5">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/15 border border-border/30 w-fit">
            {TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-display font-bold transition-colors",
                    isActive
                      ? "bg-card text-foreground border border-border/40 shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground/80"
                  )}
                >
                  <t.icon className="h-3 w-3" />
                  <span>{t.label}</span>
                  <span className={cn(
                    "text-[9.5px] font-black px-1 rounded tabular-nums",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground/40"
                  )}>{t.count}</span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar parceiro ou produto..."
                className="h-8 pl-8 pr-3 text-[11.5px] rounded-md w-full lg:w-64 bg-card/50 border-border/40"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-[11.5px] rounded-md bg-card/50 border-border/40 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="accepted">Ativas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="rejected">Recusadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Column headers */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 border-b border-border/30 bg-muted/10">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Parceiro</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Produto</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Sua comissão</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Status</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 w-[88px] text-right">Ações</span>
          </div>
        )}

        {/* Rows */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-7 w-7" />}
            title={coproductions.length === 0 ? "Nenhuma coprodução ainda" : "Nenhum resultado encontrado"}
            subtitle={coproductions.length === 0 ? "Crie sua primeira parceria para dividir receitas com outros produtores" : "Tente ajustar a busca ou os filtros"}
            action={coproductions.length === 0 ? (
              <Button onClick={() => setOpenCreate(true)} className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> Criar Primeira Coprodução
              </Button>
            ) : undefined}
          />
        ) : (
          <div>
            {filtered.map(cp => (
              <PartnerRow
                key={cp.id}
                cp={cp}
                isSent={cp.owner_user_id === user?.id}
                productName={getProductName(cp.product_id)}
                productPrice={getProductPrice(cp.product_id)}
                onAccept={() => handleAccept(cp.id)}
                onReject={() => handleReject(cp.id)}
                onCancel={() => handleCancel(cp.id)}
              />
            ))}
          </div>
        )}

        {/* Footer summary */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-muted/5">
            <span className="text-[10.5px] text-muted-foreground/50 font-medium tabular-nums">
              Mostrando <strong className="text-foreground/80">{filtered.length}</strong> de <strong className="text-foreground/80">{coproductions.length}</strong> coproduções
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <Shield className="h-3 w-3" />
              Split automático no servidor
            </div>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Handshake, Plus, CheckCircle2, XCircle, Clock, Users, DollarSign,
  Mail, Percent, Shield, ArrowUpRight, Trash2, Send, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi, Panel, SectionHeader } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type CoProduction = {
  id: string; product_id: string; owner_user_id: string; co_producer_user_id: string | null;
  co_producer_email: string; split_percentage: number; status: string;
  accepted_at: string | null; created_at: string; updated_at: string;
};

const TABS = [
  { id: "sent" as const, label: "Enviados", icon: Send },
  { id: "received" as const, label: "Recebidos", icon: Inbox },
] as const;
type TabId = typeof TABS[number]["id"];

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
  const cfg = {
    accepted: { label: "Ativa", dot: "bg-success", cls: "bg-success/10 text-success border-success/15" },
    pending: { label: "Pendente", dot: "bg-warning animate-pulse", cls: "bg-warning/10 text-warning border-warning/15" },
    rejected: { label: "Recusada", dot: "bg-destructive", cls: "bg-destructive/10 text-destructive border-destructive/15" },
  }[status] || { label: status, dot: "bg-muted-foreground", cls: "bg-muted/10 text-muted-foreground border-border/20" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

/* ─── Co-production Card ─── */
function CoProductionCard({ cp, isSent, productName, productPrice, onAccept, onReject, onCancel, index }: {
  cp: CoProduction; isSent: boolean; productName: string; productPrice: number;
  onAccept?: () => void; onReject?: () => void; onCancel?: () => void; index: number;
}) {
  const ownerPct = 100 - cp.split_percentage;
  const ownerAmount = productPrice * ownerPct / 100;
  const coProdAmount = productPrice * cp.split_percentage / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Panel accent={cp.status === "accepted" ? "bg-success" : cp.status === "pending" ? "bg-warning" : "bg-destructive"}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/20",
              cp.status === "accepted" ? "bg-success/10" : cp.status === "pending" ? "bg-warning/10" : "bg-destructive/10"
            )}>
              <Handshake className={cn(
                "h-4.5 w-4.5",
                cp.status === "accepted" ? "text-success" : cp.status === "pending" ? "text-warning" : "text-destructive"
              )} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-display font-bold text-foreground truncate">{productName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3 w-3 text-muted-foreground/30" />
                <span className="text-[11px] text-muted-foreground/60 truncate">{cp.co_producer_email}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={cp.status} />
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              {new Date(cp.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Split visualization */}
        <div className="mt-4 p-3.5 rounded-xl bg-muted/5 border border-border/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
              {isSent ? "Você" : "Produtor"}: {ownerPct}%
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
              {isSent ? "Co-produtor" : "Você"}: {cp.split_percentage}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${ownerPct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 + 0.2 }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
            />
          </div>
          {productPrice > 0 && (
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/10">
              <span className="text-[10px] text-muted-foreground/40">Por venda de {fmt(productPrice)}</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-display font-bold text-primary tabular-nums">
                  {isSent ? fmt(ownerAmount) : fmt(coProdAmount)}
                </span>
                <span className="text-[9px] text-muted-foreground/30">para você</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {(isSent && cp.status !== "rejected") && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="ghost" onClick={onCancel}
              className="h-8 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5 font-display font-bold">
              <Trash2 className="h-3 w-3" /> Cancelar
            </Button>
          </div>
        )}
        {(!isSent && cp.status === "pending") && (
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" onClick={onAccept}
              className="h-8 text-[11px] bg-success/10 text-success hover:bg-success/20 border border-success/20 gap-1.5 rounded-xl shadow-none font-display font-bold">
              <CheckCircle2 className="h-3 w-3" /> Aceitar
            </Button>
            <Button size="sm" onClick={onReject}
              className="h-8 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1.5 rounded-xl shadow-none font-display font-bold">
              <XCircle className="h-3 w-3" /> Recusar
            </Button>
          </div>
        )}
      </Panel>
    </motion.div>
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
  const [tab, setTab] = useState<TabId>("sent");

  const loadData = async () => {
    if (!user) return;
    const { data } = await supabase.from("co_productions" as any).select("*").or(
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
    } as any).eq("id", selectedProduct).eq("user_id", user.id);
    const { error } = await supabase.from("co_productions" as any).insert({
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
    const { error } = await supabase.from("co_productions" as any).update({
      status: "accepted", co_producer_user_id: user.id, accepted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erro ao aceitar"); return; }
    toast.success("Coprodução aceita!"); loadData();
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Recusar este convite de coprodução?")) return;
    const { error } = await supabase.from("co_productions" as any).update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error("Erro ao recusar"); return; }
    toast.success("Convite recusado."); loadData();
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancelar esta coprodução?")) return;
    const cp = coproductions.find(c => c.id === id);
    if (cp) {
      await supabase.from("products").update({ co_production_enabled: false, co_producer_email: null } as any)
        .eq("id", cp.product_id).eq("user_id", user!.id);
    }
    const { error } = await supabase.from("co_productions" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao cancelar"); return; }
    toast.success("Coprodução cancelada."); loadData();
  };

  const getProductName = (pid: string) => products.find(p => p.id === pid)?.name || "Produto";
  const getProductPrice = (pid: string) => Number(products.find(p => p.id === pid)?.price || 0);

  const sentCoproductions = coproductions.filter(c => c.owner_user_id === user?.id);
  const receivedCoproductions = coproductions.filter(c => c.owner_user_id !== user?.id);
  const activeCount = coproductions.filter(c => c.status === "accepted").length;
  const pendingCount = coproductions.filter(c => c.status === "pending").length;

  const currentList = tab === "sent" ? sentCoproductions : receivedCoproductions;

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
                    {products.filter(p => !(p as any).co_production_enabled).map(p => (
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
                <AnimatePresence>
                  {selectedProduct && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
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
                            Você: <strong className="text-primary">{fmt(getProductPrice(selectedProduct) * (100 - Number(coSplit || 0)) / 100)}</strong> · Co-prod: <strong>{fmt(getProductPrice(selectedProduct) * Number(coSplit || 0) / 100)}</strong>
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
        <GlassKpi label="Ativas" value={String(activeCount)} icon={CheckCircle2} tone="success" sub="parcerias ativas" delay={0} />
        <GlassKpi label="Pendentes" value={String(pendingCount)} icon={Clock} tone="warning" sub="aguardando resposta" delay={1} />
        <GlassKpi label="Total" value={String(coproductions.length)} icon={Handshake} tone="primary" sub="coproduções criadas" delay={2} />
        <GlassKpi label="Enviadas" value={String(sentCoproductions.length)} icon={ArrowUpRight} tone="info" sub="convites por você" delay={3} />
      </div>

      {/* ─── Tabs — enterprise pill style with layoutId ─── */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/15 border border-border/30 w-fit">
        {TABS.map(t => {
          const isActive = tab === t.id;
          const count = t.id === "sent" ? sentCoproductions.length : receivedCoproductions.length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold transition-all duration-300",
                isActive ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/70"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="coprod-tab-bg"
                  className="absolute inset-0 rounded-xl bg-card/80 border border-border/30 shadow-sm"
                  transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                />
              )}
              <t.icon className="h-3.5 w-3.5 relative z-10" />
              <span className="relative z-10">{t.label}</span>
              {count > 0 && (
                <span className={cn(
                  "relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted/15 text-muted-foreground/30"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          <SectionHeader
            icon={tab === "sent" ? <Send className="h-4.5 w-4.5" /> : <Inbox className="h-4.5 w-4.5" />}
            title={tab === "sent" ? "Convites Enviados" : "Convites Recebidos"}
            subtitle={`${currentList.length} coprodução${currentList.length !== 1 ? "ões" : ""} ${tab === "sent" ? "enviada" : "recebida"}${currentList.length !== 1 ? "s" : ""}`}
          />

          {currentList.length === 0 ? (
            <EmptyState
              icon={tab === "sent" ? <Handshake className="h-7 w-7" /> : <Mail className="h-7 w-7" />}
              title={tab === "sent" ? "Nenhuma coprodução enviada" : "Nenhum convite recebido"}
              subtitle={tab === "sent" ? "Crie sua primeira parceria para dividir receitas" : "Quando alguém te convidar como co-produtor, aparecerá aqui"}
              action={tab === "sent" ? (
                <Button onClick={() => setOpenCreate(true)} className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4" /> Criar Primeira Coprodução
                </Button>
              ) : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {currentList.map((cp, i) => (
                <CoProductionCard
                  key={cp.id}
                  cp={cp}
                  isSent={tab === "sent"}
                  productName={getProductName(cp.product_id)}
                  productPrice={getProductPrice(cp.product_id)}
                  onAccept={() => handleAccept(cp.id)}
                  onReject={() => handleReject(cp.id)}
                  onCancel={() => handleCancel(cp.id)}
                  index={i}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <Panel accent="bg-primary">
        <div className="flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/15">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-display font-bold text-foreground">Split Automático</p>
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              O split de receita é calculado automaticamente no servidor. Cada co-produtor recebe sua porcentagem diretamente no saldo.
            </p>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}

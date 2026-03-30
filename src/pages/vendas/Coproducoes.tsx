import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Handshake, Plus, CheckCircle2, XCircle, Clock, Users, DollarSign,
  Mail, Percent, Shield, ArrowUpRight, UserPlus, Search, Trash2,
  TrendingUp, Zap, BarChart3, Copy, ExternalLink, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type CoProduction = {
  id: string; product_id: string; owner_user_id: string; co_producer_user_id: string | null;
  co_producer_email: string; split_percentage: number; status: string;
  accepted_at: string | null; created_at: string; updated_at: string;
};

/* KpiCard uses shared GlassKpi */

/* ─── Co-production Card ─── */
function CoProductionCard({ cp, isSent, productName, productPrice, onAccept, onReject, onCancel, index }: {
  cp: CoProduction; isSent: boolean; productName: string; productPrice: number;
  onAccept?: () => void; onReject?: () => void; onCancel?: () => void; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5 hover:border-primary/15 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Handshake className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-foreground truncate">{productName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground truncate">{cp.co_producer_email}</span>
              </div>
            </div>
          </div>

          {/* Split visualization */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {isSent ? "Você" : "Produtor"}: {100 - cp.split_percentage}%
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {isSent ? "Co-prod" : "Você"}: {cp.split_percentage}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  style={{ width: `${100 - cp.split_percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Revenue per sale */}
          {productPrice > 0 && (
            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground/60">
              <span>Por venda de {fmt(productPrice)}:</span>
              <span className="text-primary font-bold">{isSent ? fmt(productPrice * (100 - cp.split_percentage) / 100) : fmt(productPrice * cp.split_percentage / 100)}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Clock className="h-3 w-3 text-muted-foreground/30" />
            <span className="text-[10px] text-muted-foreground/40">
              {new Date(cp.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold",
            cp.status === "accepted" && "bg-success/10 text-success border border-success/15",
            cp.status === "pending" && "bg-warning/10 text-warning border border-warning/15",
            cp.status === "rejected" && "bg-destructive/10 text-destructive border border-destructive/15",
          )}>
            {cp.status === "accepted" && <CheckCircle2 className="h-3 w-3" />}
            {cp.status === "pending" && <Clock className="h-3 w-3" />}
            {cp.status === "rejected" && <XCircle className="h-3 w-3" />}
            {cp.status === "accepted" ? "Ativa" : cp.status === "pending" ? "Pendente" : "Recusada"}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1.5 mt-1">
            {isSent && cp.status !== "rejected" && (
              <Button size="sm" variant="ghost" onClick={onCancel}
                className="h-8 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-1">
                <Trash2 className="h-3 w-3" /> Cancelar
              </Button>
            )}
            {!isSent && cp.status === "pending" && (
              <>
                <Button size="sm" onClick={onAccept}
                  className="h-8 text-[11px] bg-success/10 text-success hover:bg-success/20 border border-success/20 gap-1 rounded-lg shadow-none">
                  <CheckCircle2 className="h-3 w-3" /> Aceitar
                </Button>
                <Button size="sm" onClick={onReject}
                  className="h-8 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-lg shadow-none">
                  <XCircle className="h-3 w-3" /> Recusar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
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
  const [tab, setTab] = useState<"sent" | "received">("sent");

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
      co_production_enabled: true,
      co_producer_email: coEmail.trim(),
      co_production_split: split,
    } as any).eq("id", selectedProduct).eq("user_id", user.id);

    const { error } = await supabase.from("co_productions" as any).insert({
      product_id: selectedProduct,
      owner_user_id: user.id,
      co_producer_email: coEmail.trim().toLowerCase(),
      split_percentage: split,
    });
    if (error) { toast.error("Erro ao criar coprodução"); return; }
    toast.success("Convite de coprodução enviado!");
    setOpenCreate(false); setCoEmail(""); setSelectedProduct(""); setCoSplit("50");
    loadData();
  };

  const handleAccept = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("co_productions" as any).update({
      status: "accepted",
      co_producer_user_id: user.id,
      accepted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erro ao aceitar"); return; }
    toast.success("Coprodução aceita!");
    loadData();
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Recusar este convite de coprodução?")) return;
    const { error } = await supabase.from("co_productions" as any).update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error("Erro ao recusar"); return; }
    toast.success("Convite recusado.");
    loadData();
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancelar esta coprodução?")) return;
    const cp = coproductions.find(c => c.id === id);
    if (cp) {
      await supabase.from("products").update({
        co_production_enabled: false,
        co_producer_email: null,
      } as any).eq("id", cp.product_id).eq("user_id", user!.id);
    }
    const { error } = await supabase.from("co_productions" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao cancelar"); return; }
    toast.success("Coprodução cancelada.");
    loadData();
  };

  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || "Produto";
  const getProductPrice = (productId: string) => Number(products.find(p => p.id === productId)?.price || 0);

  const sentCoproductions = coproductions.filter(c => c.owner_user_id === user?.id);
  const receivedCoproductions = coproductions.filter(c => c.owner_user_id !== user?.id);
  const activeCount = coproductions.filter(c => c.status === "accepted").length;
  const pendingCount = coproductions.filter(c => c.status === "pending").length;

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Handshake className="h-6 w-6" />} title="Coproduções" subtitle="Gerencie parcerias e splits de receita com outros produtores" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Nova Coprodução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Handshake className="h-5 w-5 text-primary" />
                  </div>
                  Criar Coprodução
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Produto</Label>
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
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">E-mail do Co-produtor</Label>
                <Input
                  type="email"
                  value={coEmail}
                  onChange={e => setCoEmail(e.target.value)}
                  placeholder="parceiro@email.com"
                  className="mt-1.5 rounded-xl h-11"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Split para o Co-produtor (%)</Label>
                <Input
                  type="number"
                  min="1" max="99"
                  value={coSplit}
                  onChange={e => setCoSplit(e.target.value)}
                  className="mt-1.5 rounded-xl w-28 h-11"
                />
                {selectedProduct && (
                  <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Você receberá</span>
                      <span className="text-[14px] font-black text-primary">{100 - Number(coSplit || 0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Co-produtor receberá</span>
                      <span className="text-[14px] font-black text-foreground">{coSplit}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${100 - Number(coSplit || 0)}%` }} />
                    </div>
                    <div className="pt-2 border-t border-primary/10 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Por venda de {fmt(getProductPrice(selectedProduct))}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Você: {fmt(getProductPrice(selectedProduct) * (100 - Number(coSplit || 0)) / 100)} · 
                        Co-prod: {fmt(getProductPrice(selectedProduct) * Number(coSplit || 0) / 100)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} className="w-full rounded-xl font-semibold h-11 shadow-lg shadow-primary/20" disabled={!selectedProduct || !coEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" /> Enviar Convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Ativas" value={String(activeCount)} icon={CheckCircle2} tone="success" sub="parcerias" delay={0} />
        <GlassKpi label="Pendentes" value={String(pendingCount)} icon={Clock} tone="warning" sub="convites" delay={1} />
        <GlassKpi label="Total" value={String(coproductions.length)} icon={Handshake} tone="primary" sub="coproduções" delay={2} />
        <GlassKpi label="Enviadas" value={String(sentCoproductions.length)} icon={ArrowUpRight} tone="info" sub="por você" delay={3} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
        {([
          { id: "sent" as const, label: "Convites Enviados", count: sentCoproductions.length },
          { id: "received" as const, label: "Convites Recebidos", count: receivedCoproductions.length },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
            {t.count > 0 && <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── SENT ─── */}
      {tab === "sent" && (
        <div className="space-y-3">
          {sentCoproductions.length === 0 ? (
            <EmptyState icon={<Handshake className="h-7 w-7" />} title="Nenhuma coprodução enviada" subtitle="Crie sua primeira parceria de coprodução para dividir receitas" />
          ) : sentCoproductions.map((cp, i) => (
            <CoProductionCard
              key={cp.id}
              cp={cp}
              isSent={true}
              productName={getProductName(cp.product_id)}
              productPrice={getProductPrice(cp.product_id)}
              onCancel={() => handleCancel(cp.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ─── RECEIVED ─── */}
      {tab === "received" && (
        <div className="space-y-3">
          {receivedCoproductions.length === 0 ? (
            <EmptyState icon={<Mail className="h-7 w-7" />} title="Nenhum convite recebido" subtitle="Quando alguém te convidar como co-produtor, aparecerá aqui" />
          ) : receivedCoproductions.map((cp, i) => (
            <CoProductionCard
              key={cp.id}
              cp={cp}
              isSent={false}
              productName={getProductName(cp.product_id)}
              productPrice={getProductPrice(cp.product_id)}
              onAccept={() => handleAccept(cp.id)}
              onReject={() => handleReject(cp.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="rounded-2xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Split Automático</p>
            <p className="text-[11px] text-muted-foreground/60">
              O split de receita é calculado automaticamente no servidor. Cada co-produtor recebe sua porcentagem diretamente no saldo.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

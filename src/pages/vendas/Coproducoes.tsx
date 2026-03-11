import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Handshake, Plus, CheckCircle2, XCircle, Clock, Users, DollarSign,
  Mail, Percent, Shield, ArrowUpRight, UserPlus, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type CoProduction = {
  id: string; product_id: string; owner_user_id: string; co_producer_user_id: string | null;
  co_producer_email: string; split_percentage: number; status: string;
  accepted_at: string | null; created_at: string; updated_at: string;
};

export default function Coproducoes() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const [coproductions, setCoproductions] = useState<CoProduction[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [coEmail, setCoEmail] = useState("");
  const [coSplit, setCoSplit] = useState("50");
  const [tab, setTab] = useState<"sent" | "received">("sent");
  const [profiles, setProfiles] = useState<any[]>([]);

  const loadData = async () => {
    if (!user) return;
    const { data } = await supabase.from("co_productions" as any).select("*").or(
      `owner_user_id.eq.${user.id},co_producer_email.eq.${user.email}`
    ).order("created_at", { ascending: false });
    if (data) setCoproductions(data as CoProduction[]);

    // Load profile for current user
    const { data: pData } = await supabase.from("profiles").select("email,user_id").eq("user_id", user.id);
    if (pData) setProfiles(pData);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleCreate = async () => {
    if (!user || !selectedProduct || !coEmail.trim()) return;
    if (!coEmail.includes("@")) { toast.error("E-mail inválido"); return; }
    const split = Number(coSplit);
    if (split < 1 || split > 99) { toast.error("Split deve ser entre 1% e 99%"); return; }

    // Update product co_production settings
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
    toast.success("Coprodução aceita! Você receberá sua parte automaticamente.");
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
        <PageTitle icon={<Handshake className="h-6 w-6" />} title="Coproduções" subtitle="Gerencie parcerias e splits de receita" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-lg h-9 text-[12px] font-medium">
              <Plus className="h-3.5 w-3.5" /> Nova Coprodução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Handshake className="h-4 w-4 text-primary" />
                  </div>
                  Criar Coprodução
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
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
                  className="mt-1.5 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Split para o Co-produtor (%)</Label>
                <Input
                  type="number"
                  min="1" max="99"
                  value={coSplit}
                  onChange={e => setCoSplit(e.target.value)}
                  className="mt-1.5 rounded-lg w-28"
                />
                {selectedProduct && (
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Você receberá</span>
                      <span className="text-[13px] font-bold text-primary">{100 - Number(coSplit || 0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Co-produtor receberá</span>
                      <span className="text-[13px] font-bold text-foreground">{coSplit}%</span>
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
              <Button onClick={handleCreate} className="w-full rounded-lg font-medium h-11" disabled={!selectedProduct || !coEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" /> Enviar Convite
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground">Coproduções Ativas</span>
            <Handshake className="h-4 w-4 text-success" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{activeCount}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground">Convites Pendentes</span>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{pendingCount}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          className="col-span-2 lg:col-span-1 rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-muted-foreground">Total de Parcerias</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{coproductions.length}</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit">
        {([
          { id: "sent" as const, label: "Convites Enviados", count: sentCoproductions.length },
          { id: "received" as const, label: "Convites Recebidos", count: receivedCoproductions.length },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            )}>
            {t.label}
            {t.count > 0 && <span className="h-4 min-w-[16px] px-1 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── SENT ─── */}
      {tab === "sent" && (
        <div className="space-y-2">
          {sentCoproductions.length === 0 ? (
            <EmptyState icon={<Handshake className="h-7 w-7" />} title="Nenhuma coprodução enviada" subtitle="Crie sua primeira parceria de coprodução" />
          ) : sentCoproductions.map((cp, i) => (
            <motion.div key={cp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{getProductName(cp.product_id)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[11px] text-muted-foreground">{cp.co_producer_email}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <Percent className="h-3 w-3 text-primary/50" />
                      <span className="text-[11px] text-muted-foreground">Você: {100 - cp.split_percentage}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <UserPlus className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground">Co-prod: {cp.split_percentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase",
                    cp.status === "accepted" && "bg-success/10 text-success",
                    cp.status === "pending" && "bg-warning/10 text-warning",
                    cp.status === "rejected" && "bg-destructive/10 text-destructive",
                  )}>
                    {cp.status === "accepted" && <CheckCircle2 className="h-3 w-3" />}
                    {cp.status === "pending" && <Clock className="h-3 w-3" />}
                    {cp.status === "rejected" && <XCircle className="h-3 w-3" />}
                    {cp.status === "accepted" ? "Ativa" : cp.status === "pending" ? "Pendente" : "Recusada"}
                  </span>
                  {cp.status !== "rejected" && (
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(cp.id)}
                      className="h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10">
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── RECEIVED ─── */}
      {tab === "received" && (
        <div className="space-y-2">
          {receivedCoproductions.length === 0 ? (
            <EmptyState icon={<Mail className="h-7 w-7" />} title="Nenhum convite recebido" subtitle="Quando alguém te convidar como co-produtor, aparecerá aqui" />
          ) : receivedCoproductions.map((cp, i) => (
            <motion.div key={cp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{getProductName(cp.product_id)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Você receberá <strong className="text-success">{cp.split_percentage}%</strong> de cada venda</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Convite de {new Date(cp.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {cp.status === "pending" ? (
                    <>
                      <Button size="sm" onClick={() => handleAccept(cp.id)}
                        className="h-8 text-[11px] bg-success/10 text-success hover:bg-success/20 border border-success/20 gap-1 rounded-lg shadow-none">
                        <CheckCircle2 className="h-3 w-3" /> Aceitar
                      </Button>
                      <Button size="sm" onClick={() => handleReject(cp.id)}
                        className="h-8 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-lg shadow-none">
                        <XCircle className="h-3 w-3" /> Recusar
                      </Button>
                    </>
                  ) : (
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase",
                      cp.status === "accepted" && "bg-success/10 text-success",
                      cp.status === "rejected" && "bg-destructive/10 text-destructive",
                    )}>
                      {cp.status === "accepted" ? "Ativa" : "Recusada"}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground/70">
            O split de receita é calculado automaticamente no servidor. Cada co-produtor recebe sua porcentagem diretamente no saldo.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

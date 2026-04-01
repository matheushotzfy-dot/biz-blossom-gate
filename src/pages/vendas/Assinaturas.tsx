import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  RefreshCw, Plus, Users, DollarSign, TrendingUp, Calendar,
  Pause, Play, XCircle, Eye, Search, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi, Panel, SectionHeader, DataTable } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Plan = {
  id: string; user_id: string; product_id: string | null; name: string; description: string | null;
  price: number; interval: string; interval_count: number; trial_days: number; is_active: boolean;
  created_at: string; updated_at: string;
};
type Subscription = {
  id: string; plan_id: string; subscriber_email: string; subscriber_name: string | null;
  seller_user_id: string; status: string; current_period_start: string;
  current_period_end: string | null; trial_end: string | null; canceled_at: string | null;
  created_at: string;
};

const INTERVAL_LABELS: Record<string, string> = {
  daily: "Diário", weekly: "Semanal", monthly: "Mensal", yearly: "Anual",
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active: { label: "Ativa", cls: "bg-success/10 text-success border-success/20" },
  trialing: { label: "Trial", cls: "bg-info/10 text-info border-info/20" },
  past_due: { label: "Atrasada", cls: "bg-warning/10 text-warning border-warning/20" },
  canceled: { label: "Cancelada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  paused: { label: "Pausada", cls: "bg-muted/10 text-muted-foreground border-border/20" },
};

const TABS = [
  { id: "plans" as const, label: "Planos", icon: Zap },
  { id: "subscribers" as const, label: "Assinantes", icon: Users },
] as const;
type TabId = typeof TABS[number]["id"];

export default function Assinaturas() {
  const { user } = useAuth();
  const { data: products } = useProducts();
  const [tab, setTab] = useState<TabId>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  // Form
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fInterval, setFInterval] = useState("monthly");
  const [fTrial, setFTrial] = useState("0");
  const [fProduct, setFProduct] = useState<string>("");

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [plansRes, subsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").eq("seller_user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (subsRes.data) setSubs(subsRes.data as Subscription[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const handleCreate = async () => {
    if (!fName.trim() || !fPrice) { toast.error("Preencha nome e preço"); return; }
    const price = parseFloat(fPrice.replace(",", "."));
    if (isNaN(price) || price < 1) { toast.error("Preço mínimo: R$ 1,00"); return; }

    const { error } = await supabase.from("subscription_plans").insert({
      user_id: user!.id,
      name: fName.trim(),
      description: fDesc.trim() || null,
      price,
      interval: fInterval,
      trial_days: parseInt(fTrial) || 0,
      product_id: fProduct || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Plano criado!");
    setShowCreate(false);
    setFName(""); setFDesc(""); setFPrice(""); setFInterval("monthly"); setFTrial("0"); setFProduct("");
    fetchData();
  };

  const togglePlan = async (plan: Plan) => {
    await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
    fetchData();
  };

  const activeSubs = subs.filter(s => s.status === "active" || s.status === "trialing");
  const mrr = activeSubs.reduce((acc, s) => {
    const plan = plans.find(p => p.id === s.plan_id);
    if (!plan) return acc;
    if (plan.interval === "monthly") return acc + plan.price;
    if (plan.interval === "yearly") return acc + plan.price / 12;
    if (plan.interval === "weekly") return acc + plan.price * 4.33;
    return acc + plan.price * 30;
  }, 0);

  const filtered = tab === "plans"
    ? plans.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : subs.filter(s => s.subscriber_email.toLowerCase().includes(search.toLowerCase()) || (s.subscriber_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <PageTitle icon={<RefreshCw className="h-6 w-6" />} title="Assinaturas" subtitle="Gerencie planos e cobranças recorrentes" />
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 shadow-lg shadow-primary/15">
              <Plus className="h-4 w-4" /> Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Criar Plano de Assinatura</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div><Label>Nome do Plano</Label><Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex: Plano Premium" /></div>
              <div><Label>Descrição (opcional)</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Acesso completo ao curso..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço (R$)</Label><Input value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="49,90" /></div>
                <div>
                  <Label>Intervalo</Label>
                  <Select value={fInterval} onValueChange={setFInterval}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Dias de trial grátis</Label><Input type="number" value={fTrial} onChange={e => setFTrial(e.target.value)} min={0} max={365} /></div>
              {products && products.length > 0 && (
                <div>
                  <Label>Vincular a produto (opcional)</Label>
                  <Select value={fProduct} onValueChange={setFProduct}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleCreate} className="gradient-primary text-primary-foreground">Criar Plano</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <GlassKpi icon={Zap} label="Planos Ativos" value={String(plans.filter(p => p.is_active).length)} />
        <GlassKpi icon={Users} label="Assinantes Ativos" value={String(activeSubs.length)} />
        <GlassKpi icon={DollarSign} label="MRR" value={fmt(mrr)} />
        <GlassKpi icon={TrendingUp} label="Total Assinaturas" value={String(subs.length)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/20 w-fit mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
      </div>

      {/* Plans Tab */}
      {tab === "plans" && (
        <Panel>
          {plans.length === 0 && !loading ? (
            <EmptyState icon={Zap} title="Nenhum plano criado" description="Crie seu primeiro plano de assinatura para cobranças recorrentes." />
          ) : (
            <div className="grid gap-3">
              {(filtered as Plan[]).map(plan => (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/20 bg-card/50 hover:bg-card/80 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground truncate">{plan.name}</h3>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        plan.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted/10 text-muted-foreground border-border/20"
                      )}>{plan.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{fmt(plan.price)}</span>
                      <span>/ {INTERVAL_LABELS[plan.interval]}</span>
                      {plan.trial_days > 0 && <span className="text-info">• {plan.trial_days} dias grátis</span>}
                      <span>• {subs.filter(s => s.plan_id === plan.id && (s.status === "active" || s.status === "trialing")).length} assinantes</span>
                    </div>
                  </div>
                  <Switch checked={plan.is_active} onCheckedChange={() => togglePlan(plan)} />
                </motion.div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Subscribers Tab */}
      {tab === "subscribers" && (
        <Panel>
          {subs.length === 0 && !loading ? (
            <EmptyState icon={Users} title="Nenhum assinante" description="Seus assinantes aparecerão aqui quando começarem a assinar seus planos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-3 font-medium">Assinante</th>
                    <th className="text-left py-3 px-3 font-medium">Plano</th>
                    <th className="text-left py-3 px-3 font-medium">Status</th>
                    <th className="text-left py-3 px-3 font-medium">Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as Subscription[]).map(sub => {
                    const plan = plans.find(p => p.id === sub.plan_id);
                    const cfg = STATUS_CFG[sub.status] || { label: sub.status, cls: "bg-muted/10 text-muted-foreground" };
                    return (
                      <tr key={sub.id} className="border-b border-border/10 hover:bg-muted/5">
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{sub.subscriber_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{sub.subscriber_email}</div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{plan?.name || "—"}</td>
                        <td className="py-3 px-3">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border", cfg.cls)}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground text-xs">
                          {new Date(sub.created_at).toLocaleDateString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </PageShell>
  );
}

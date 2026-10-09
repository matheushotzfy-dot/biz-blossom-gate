import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Plus, Users, DollarSign, TrendingUp, Calendar,
  Search, Zap, X, CheckCircle2, AlertCircle, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { friendlyError } from "@/lib/friendlyError";

const fmt = formatCurrency;

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

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active:   { label: "Ativa",      dot: "bg-success",        text: "text-success",        bg: "bg-success/10 border-success/20" },
  trialing: { label: "Trial",      dot: "bg-info",           text: "text-info",           bg: "bg-info/10 border-info/20" },
  past_due: { label: "Atrasada",   dot: "bg-warning",        text: "text-warning",        bg: "bg-warning/10 border-warning/20" },
  canceled: { label: "Cancelada",  dot: "bg-destructive",    text: "text-destructive",    bg: "bg-destructive/10 border-destructive/20" },
  paused:   { label: "Pausada",    dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted/10 border-border/40" },
};

const TABS = [
  { id: "plans" as const,       label: "Planos",     icon: Zap,   tone: "text-primary" },
  { id: "subscribers" as const, label: "Assinantes", icon: Users, tone: "text-info" },
] as const;
type TabId = typeof TABS[number]["id"];

type KpiTone = "success" | "info" | "warning" | "neutral";

function Kpi({ label, value, sub, icon: Icon, tone = "neutral" }: {
  label: string; value: string; sub?: string; icon: LucideIcon; tone?: KpiTone;
}) {
  const toneCls: Record<KpiTone, string> = {
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    neutral: "text-foreground",
  };
  const iconBg: Record<KpiTone, string> = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    neutral: "bg-secondary text-muted-foreground",
  };
  return (
    <div className="bg-card px-5 py-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground/70">{label}</span>
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", iconBg[tone])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
      </div>
      <div className={cn("font-display text-[26px] font-black leading-none tabular-nums tracking-tight", toneCls[tone])}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/70 font-medium truncate">{sub}</div>}
    </div>
  );
}

export default function Assinaturas() {
  const { user } = useAuth();
  const { data: products } = useProducts();
  const [tab, setTab] = useState<TabId>("plans");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

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
      product_id: fProduct && fProduct !== "none" ? fProduct : null,
    });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Plano criado!");
    setShowCreate(false);
    setFName(""); setFDesc(""); setFPrice(""); setFInterval("monthly"); setFTrial("0"); setFProduct("");
    fetchData();
  };

  const togglePlan = async (plan: Plan) => {
    if (!user) return;
    await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id).eq("user_id", user.id);
    toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
    fetchData();
  };

  const activeSubs = subs.filter(s => s.status === "active" || s.status === "trialing");
  const trialingCount = subs.filter(s => s.status === "trialing").length;
  const pastDueCount = subs.filter(s => s.status === "past_due").length;
  const canceledCount = subs.filter(s => s.status === "canceled").length;
  const activePlans = plans.filter(p => p.is_active).length;
  const orphanSubsCount = subs.filter(s => !plans.some(p => p.id === s.plan_id)).length;

  const mrr = activeSubs.reduce((acc, s) => {
    const plan = plans.find(p => p.id === s.plan_id);
    if (!plan) return acc;
    if (plan.interval === "monthly") return acc + plan.price;
    if (plan.interval === "yearly")  return acc + plan.price / 12;
    if (plan.interval === "weekly")  return acc + plan.price * 4.33;
    if (plan.interval === "daily")   return acc + plan.price * 30.44;
    return acc;
  }, 0);

  const filtered = tab === "plans"
    ? plans.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : subs.filter(s =>
        s.subscriber_email.toLowerCase().includes(search.toLowerCase()) ||
        (s.subscriber_name || "").toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 space-y-6">
      {/* ═══════ HERO ═══════ */}
      <div className="relative overflow-hidden animate-fade-in">
        <div
          className="pointer-events-none absolute -top-24 -left-20 h-[280px] w-[520px] rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.10), transparent 70%)" }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {activeSubs.length} {activeSubs.length === 1 ? "assinatura ativa" : "assinaturas ativas"}
              </span>
            </div>
            <h1 className="font-display text-[40px] sm:text-[52px] font-black leading-[0.95] tracking-[-0.03em] text-foreground">
              Assinaturas
            </h1>
            <p className="text-[13px] text-muted-foreground/80 max-w-xl leading-relaxed">
              Receita recorrente com planos flexíveis, gestão completa de assinantes e acompanhamento do seu MRR em tempo real.
            </p>
          </div>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <button className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-semibold text-primary-foreground transition-all duration-300  hover:bg-primary/90">
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                Novo plano
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[12px] border border-border/50 bg-card p-0 overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-border/40">
                <DialogHeader>
                  <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    Criar Plano de Assinatura
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Nome do Plano</Label>
                  <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex: Plano Premium" className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Descrição (opcional)</Label>
                  <Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Acesso completo ao curso..." className="mt-1.5 rounded-xl h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Preço (R$)</Label>
                    <Input value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="49,90" className="mt-1.5 rounded-xl h-11" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Intervalo</Label>
                    <Select value={fInterval} onValueChange={setFInterval}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Dias de trial grátis</Label>
                  <Input type="number" value={fTrial} onChange={e => setFTrial(e.target.value)} min={0} max={365} className="mt-1.5 rounded-xl h-11" />
                </div>
                {products && products.length > 0 && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground font-medium">Vincular a produto (opcional)</Label>
                    <Select value={fProduct} onValueChange={setFProduct}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} className="w-full rounded-xl font-display font-bold h-11">Criar Plano</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ═══════ KPI GRID — 1px divider style ═══════ */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40 lg:grid-cols-4 animate-fade-in stagger-1">
        <Kpi
          label="Receita recorrente (MRR)"
          value={fmt(mrr)}
          sub={`${activeSubs.length} ${activeSubs.length === 1 ? "assinante ativo" : "assinantes ativos"}`}
          icon={DollarSign}
          tone="success"
        />
        <Kpi
          label="Planos ativos"
          value={String(activePlans)}
          sub={`${plans.length} ${plans.length === 1 ? "plano criado" : "planos criados"}`}
          icon={Zap}
          tone="info"
        />
        <Kpi
          label="Assinantes ativos"
          value={String(activeSubs.length)}
          sub={`${trialingCount} em trial · ${activeSubs.length - trialingCount} pagantes`}
          icon={TrendingUp}
          tone="info"
        />
        <Kpi
          label="Total de assinaturas"
          value={String(subs.length)}
          sub={`${canceledCount} canceladas · ${pastDueCount} atrasadas`}
          icon={Calendar}
          tone={pastDueCount > 0 ? "warning" : "neutral"}
        />
      </div>

      {orphanSubsCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-[12px] font-medium text-warning animate-fade-in">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {orphanSubsCount} {orphanSubsCount === 1 ? "assinatura está" : "assinaturas estão"} vinculada{orphanSubsCount === 1 ? "" : "s"} a um plano que não existe mais.
        </div>
      )}

      {/* ═══════ SEGMENT CONTROL + SEARCH ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in stagger-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-border/50 bg-card/60 p-1">
          {TABS.map(t => {
            const isActive = tab === t.id;
            const count = t.id === "plans" ? plans.length : subs.length;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
                className={cn(
 "inline-flex items-center gap-2 rounded-lg h-8 px-3 text-[12px] font-bold tracking-tight transition-colors duration-200",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? t.tone : "text-muted-foreground/70")} strokeWidth={2.25} />
                <span>{t.label}</span>
                {count > 0 && (
                  <span className={cn(
 "text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md transition-colors",
                    isActive ? "bg-card text-foreground" : "bg-secondary/60 text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === "plans" ? "Buscar plano…" : "Buscar assinante…"}
            className="h-9 w-full rounded-xl border border-border/50 bg-secondary/40 pl-10 pr-9 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
              <X className="h-3.5 w-3.5 text-muted-foreground/70" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div className="animate-fade-in stagger-3">
        {tab === "plans" && (
          <>
            {plans.length === 0 && !loading ? (
              <div className="rounded-[12px] border border-border/50 bg-card p-16 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-[12px] bg-secondary border border-border/50 flex items-center justify-center">
                  <Zap className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="text-[14px] text-foreground font-display font-bold">Nenhum plano criado</p>
                <p className="text-[12px] text-muted-foreground/70 font-medium">Crie seu primeiro plano de assinatura para cobranças recorrentes</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/50 bg-border/40 grid gap-px">
                {(filtered as Plan[]).map((plan) => {
                  const planSubs = subs.filter(s => s.plan_id === plan.id && (s.status === "active" || s.status === "trialing")).length;
                  return (
                    <div
                      key={plan.id}
                      className="group relative bg-card hover:bg-card/80 transition-colors duration-200"
                    >
                      <div className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={cn(
 "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border",
                            plan.is_active ? "bg-primary/10 border-primary/20" : "bg-secondary border-border/50"
                          )}>
                            <Zap className={cn("h-5 w-5", plan.is_active ? "text-primary" : "text-muted-foreground/60")} strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-[14px] font-display font-black text-foreground truncate tracking-tight">{plan.name}</h3>
                              <span className={cn(
 "inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border",
                                plan.is_active
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-muted/10 text-muted-foreground border-border/40"
                              )}>
                                {plan.is_active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                {plan.is_active ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[12px] text-muted-foreground/80 font-medium">
                              <span className="font-display font-black text-foreground tabular-nums">{fmt(plan.price)}</span>
                              <span className="text-muted-foreground/50">/</span>
                              <span>{INTERVAL_LABELS[plan.interval]}</span>
                              {plan.trial_days > 0 && (
                                <>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span className="text-info font-bold">{plan.trial_days}d trial</span>
                                </>
                              )}
                              <span className="text-muted-foreground/30">•</span>
                              <span className="tabular-nums">{planSubs} {planSubs === 1 ? "assinante" : "assinantes"}</span>
                            </div>
                          </div>
                        </div>
                        <Switch checked={plan.is_active} onCheckedChange={() => togglePlan(plan)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "subscribers" && (
          <>
            {subs.length === 0 && !loading ? (
              <div className="rounded-[12px] border border-border/50 bg-card p-16 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-[12px] bg-secondary border border-border/50 flex items-center justify-center">
                  <Users className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="text-[14px] text-foreground font-display font-bold">Nenhum assinante</p>
                <p className="text-[12px] text-muted-foreground/70 font-medium">Seus assinantes aparecerão aqui quando começarem a assinar seus planos</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-secondary/40">
                      <th className="text-left px-5 py-3 text-[11px] font-display font-semibold text-muted-foreground">Assinante</th>
                      <th className="text-left px-4 py-3 text-[11px] font-display font-semibold text-muted-foreground">Plano</th>
                      <th className="text-left px-4 py-3 text-[11px] font-display font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-[11px] font-display font-semibold text-muted-foreground">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered as Subscription[]).map((sub) => {
                      const plan = plans.find(p => p.id === sub.plan_id);
                      const cfg = STATUS_CFG[sub.status] || { label: sub.status, dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted/10 border-border/40" };
                      return (
                        <tr
                          key={sub.id}
                          className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors duration-150"
                        >
                          <td className="py-3.5 px-5">
                            <div className="font-display font-black text-[13px] text-foreground tracking-tight">{sub.subscriber_name || "—"}</div>
                            <div className="text-[11px] text-muted-foreground/70 font-mono">{sub.subscriber_email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-[12px] text-foreground font-display font-bold">{plan?.name || "—"}</td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
 "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                              cfg.bg, cfg.text
                            )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-muted-foreground font-mono tabular-nums">
                            {new Date(sub.created_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

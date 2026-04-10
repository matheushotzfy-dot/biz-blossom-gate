import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
 RefreshCw, Plus, Users, DollarSign, TrendingUp, Calendar,
 Pause, Play, XCircle, Eye, Search, Zap, Clock, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
 product_id: fProduct && fProduct !== "none" ? fProduct : null,
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
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ════════════════════════════════════════════════════════════════ */}
 {/* HERO */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-info/6 rounded-full blur-[160px]" />
 <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 {/* Top bar */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <RefreshCw className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Assinaturas</span>
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <span className="relative flex h-2 w-2">
 <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
 <span className="relative h-2 w-2 rounded-full bg-success" />
 </span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{activeSubs.length} Ativo{activeSubs.length !== 1 ? "s" : ""}</span>
 </div>
 </div>
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogTrigger asChild>
 <button className="h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300">
 <Plus className="h-3.5 w-3.5" /> Novo Plano
 </button>
 </DialogTrigger>
 <DialogContent className="max-w-md rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
 <div className="px-6 pt-6 pb-4 border-b border-border/20">
 <DialogHeader>
 <DialogTitle className="font-display text-lg flex items-center gap-2.5">
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
 <Zap className="h-5 w-5 text-primary" />
 </div>
 Criar Plano de Assinatura
 </DialogTitle>
 </DialogHeader>
 </div>
 <div className="p-6 space-y-4">
 <div><Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Nome do Plano</Label><Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex: Plano Premium" className="mt-1.5 rounded-xl h-11" /></div>
 <div><Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Descrição (opcional)</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Acesso completo ao curso..." className="mt-1.5 rounded-xl h-11" /></div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Preço (R$)</Label><Input value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="49,90" className="mt-1.5 rounded-xl h-11" /></div>
 <div>
 <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Intervalo</Label>
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
 <div><Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Dias de trial grátis</Label><Input type="number" value={fTrial} onChange={e => setFTrial(e.target.value)} min={0} max={365} className="mt-1.5 rounded-xl h-11" /></div>
 {products && products.length > 0 && (
 <div>
 <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Vincular a produto (opcional)</Label>
 <Select value={fProduct} onValueChange={setFProduct}>
 <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Nenhum" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Nenhum</SelectItem>
 {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 )}
 <Button onClick={handleCreate} className="w-full rounded-xl font-display font-bold h-11 shadow-lg shadow-primary/20">Criar Plano</Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Main stats */}
 <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-8">
 <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Receita Recorrente Mensal</p>
 <div className="flex items-end gap-4 mb-4">
 <span className="text-5xl sm:text-6xl lg:text-7xl font-heading tabular-nums text-foreground leading-[0.85] [text-shadow:0_0_80px_hsl(var(--primary)/0.2)]">
 {fmt(mrr)}
 </span>
 <span className="text-lg font-heading text-muted-foreground/30 mb-1">/ mês</span>
 </div>
 <div className="flex flex-wrap items-center gap-2 mt-4">
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <Zap className="h-3 w-3 text-primary" /> {plans.filter(p => p.is_active).length} planos ativos
 </span>
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <Users className="h-3 w-3 text-success" /> {activeSubs.length} assinantes
 </span>
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <TrendingUp className="h-3 w-3" /> {subs.length} total
 </span>
 </div>
 </motion.div>

 {/* KPI strip */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Planos Ativos", value: String(plans.filter(p => p.is_active).length), color: "primary", icon: Zap },
 { label: "Assinantes Ativos", value: String(activeSubs.length), color: "success", icon: Users },
 { label: "MRR", value: fmt(mrr), color: "info", icon: DollarSign },
 { label: "Total Assinaturas", value: String(subs.length), color: "warning", icon: TrendingUp },
 ].map((item, idx) => (
 <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 + idx * 0.08 }} className="group rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden relative">
 <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
 <div className="relative z-10 flex items-start justify-between">
 <div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{item.label}</p>
 <p className={cn("text-xl font-heading tabular-nums tracking-tight leading-none", item.color === "primary" ? "text-foreground" : `text-${item.color}`)}>{item.value}</p>
 </div>
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
 <item.icon className="h-4 w-4" />
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </motion.section>

 {/* ─── Tab Navigation ─── */}
 <div className="flex items-center gap-1 p-1 rounded-2xl border border-border/60 bg-card shadow-sm w-fit mb-6">
 {TABS.map(t => {
 const isActive = tab === t.id;
 const count = t.id === "plans" ? plans.length : subs.length;
 return (
 <button
 key={t.id}
 onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
 className={cn(
 "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold transition-all duration-300",
 isActive ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/70"
 )}
 >
 {isActive && (
 <motion.div
 layoutId="sub-tab-bg"
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

 {/* Search */}
 <div className="relative mb-6 max-w-sm">
 <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Buscar..."
 className="h-9 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
 />
 {search && (
 <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>
 )}
 </div>

 {/* Plans Tab */}
 <AnimatePresence mode="wait">
 <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
 {tab === "plans" && (
 <>
 {plans.length === 0 && !loading ? (
 <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card shadow-sm p-16 flex flex-col items-center gap-4">
 <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center">
 <Zap className="h-7 w-7 text-muted-foreground/8" />
 </div>
 <p className="text-[13px] text-muted-foreground/25 font-display font-semibold">Nenhum plano criado</p>
 <p className="text-[11px] text-muted-foreground/15 font-display">Crie seu primeiro plano de assinatura para cobranças recorrentes</p>
 </motion.div>
 ) : (
 <div className="space-y-3">
 {(filtered as Plan[]).map((plan, i) => (
 <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
 className="group relative rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", plan.is_active ? "bg-primary" : "bg-muted-foreground/20")} />
 <div className="flex items-center justify-between p-5 pl-5">
 <div className="flex items-center gap-3.5 min-w-0 flex-1">
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/20", plan.is_active ? "bg-primary/10" : "bg-muted/15")}>
 <Zap className={cn("h-4.5 w-4.5", plan.is_active ? "text-primary" : "text-muted-foreground/40")} />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="text-[13px] font-display font-bold text-foreground truncate">{plan.name}</h3>
 <span className={cn("text-[9px] font-heading px-2 py-0.5 rounded-full border",
 plan.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted/10 text-muted-foreground border-border/20"
 )}>{plan.is_active ? "Ativo" : "Inativo"}</span>
 </div>
 <div className="flex items-center gap-3 text-[11px] text-muted-foreground/40">
 <span className="font-heading text-foreground tabular-nums">{fmt(plan.price)}</span>
 <span>/ {INTERVAL_LABELS[plan.interval]}</span>
 {plan.trial_days > 0 && <span className="text-info">• {plan.trial_days} dias grátis</span>}
 <span>• {subs.filter(s => s.plan_id === plan.id && (s.status === "active" || s.status === "trialing")).length} assinantes</span>
 </div>
 </div>
 </div>
 <Switch checked={plan.is_active} onCheckedChange={() => togglePlan(plan)} />
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </>
 )}

 {/* Subscribers Tab */}
 {tab === "subscribers" && (
 <>
 {subs.length === 0 && !loading ? (
 <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/60 bg-card shadow-sm p-16 flex flex-col items-center gap-4">
 <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center">
 <Users className="h-7 w-7 text-muted-foreground/8" />
 </div>
 <p className="text-[13px] text-muted-foreground/25 font-display font-semibold">Nenhum assinante</p>
 <p className="text-[11px] text-muted-foreground/15 font-display">Seus assinantes aparecerão aqui quando começarem a assinar seus planos</p>
 </motion.div>
 ) : (
 <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border/[0.06]">
 <th className="text-left px-5 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Assinante</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Plano</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Status</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Desde</th>
 </tr>
 </thead>
 <tbody>
 {(filtered as Subscription[]).map((sub, i) => {
 const plan = plans.find(p => p.id === sub.plan_id);
 const cfg = STATUS_CFG[sub.status] || { label: sub.status, cls: "bg-muted/10 text-muted-foreground" };
 return (
 <motion.tr key={sub.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
 className="border-b border-border/[0.04] transition-all duration-200">
 <td className="py-4 px-5">
 <div className="font-display font-bold text-[13px] text-foreground">{sub.subscriber_name || "—"}</div>
 <div className="text-[11px] text-muted-foreground/40">{sub.subscriber_email}</div>
 </td>
 <td className="py-4 px-4 text-[12px] text-muted-foreground/50 font-display">{plan?.name || "—"}</td>
 <td className="py-4 px-4">
 <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-heading border", cfg.cls)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", sub.status === "active" ? "bg-success" : sub.status === "trialing" ? "bg-info" : "bg-muted-foreground")} />
 {cfg.label}
 </span>
 </td>
 <td className="py-4 px-4 text-[11px] text-muted-foreground/30 font-mono tabular-nums">
 {new Date(sub.created_at).toLocaleDateString("pt-BR")}
 </td>
 </motion.tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 );
}

import { useState } from "react";
import { Ticket, Plus, Clock, Percent, ShoppingCart, Trash2, Zap, Tag, Target, Sparkles, ToggleLeft, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type AutoCouponRule = {
 id: string;
 name: string;
 trigger: string;
 discountType: string;
 discountValue: number;
 maxUses: number;
 isActive: boolean;
};

const TRIGGER_OPTIONS = [
 { value: "abandoned_cart", label: "Carrinho Abandonado (30min)", icon: ShoppingCart, tone: "warning" },
 { value: "first_purchase", label: "Primeira Compra", icon: Zap, tone: "success" },
 { value: "birthday", label: "Aniversário do Cliente", icon: Sparkles, tone: "primary" },
 { value: "inactive_30d", label: "Inativo há 30 dias", icon: Clock, tone: "destructive" },
 { value: "referral", label: "Indicação de Amigo", icon: Target, tone: "info" },
];

const DEMO_RULES: AutoCouponRule[] = [
 { id: "1", name: "Resgate Carrinho", trigger: "abandoned_cart", discountType: "percentage", discountValue: 10, maxUses: 1, isActive: true },
 { id: "2", name: "Boas-vindas", trigger: "first_purchase", discountType: "percentage", discountValue: 15, maxUses: 1, isActive: true },
 { id: "3", name: "Reconquista", trigger: "inactive_30d", discountType: "fixed", discountValue: 20, maxUses: 1, isActive: false },
];

export default function AutoCupons() {
 const [rules] = useState<AutoCouponRule[]>(DEMO_RULES);
 const [showForm, setShowForm] = useState(false);

 const activeRules = rules.filter(r => r.isActive);
 const totalUses = rules.reduce((a, r) => a + r.maxUses, 0);

 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ═══ HERO ═══ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-warning/6 rounded-full blur-[160px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 {/* Top bar */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Ticket className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Cupons Automáticos</span>
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <span className="relative flex h-2 w-2">
 <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
 <span className="relative h-2 w-2 rounded-full bg-success" />
 </span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{activeRules.length} Ativo{activeRules.length !== 1 ? "s" : ""}</span>
 </div>
 </div>
 <button
 onClick={() => setShowForm(!showForm)}
 className="h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300"
 >
 <Plus className="h-3.5 w-3.5" /> Nova Regra
 </button>
 </div>

 {/* Big title */}
 <div className="mb-8">
 <p className="text-[9px] font-heading uppercase tracking-[0.25em] text-muted-foreground/40 mb-2">Regras Configuradas</p>
 <div className="flex items-end gap-3">
 <span className="text-[56px] sm:text-[72px] font-heading tabular-nums tracking-[-0.04em] text-foreground leading-none">
 {rules.length}
 </span>
 <span className="text-[14px] font-heading text-muted-foreground/30 mb-3">regras</span>
 </div>
 </div>

 {/* KPI Row */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: "Total Regras", value: String(rules.length), icon: Tag, color: "primary" },
 { label: "Ativas", value: String(activeRules.length), icon: ToggleLeft, color: "success" },
 { label: "Gatilhos", value: String(new Set(rules.map(r => r.trigger)).size), icon: Zap, color: "warning" },
 { label: "Max Usos", value: String(totalUses), icon: Activity, color: "info" },
 ].map((kpi, i) => (
 <motion.div
 key={kpi.label}
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
 className="group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden p-4 shimmer"
 >
 <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${kpi.color}`)}>
 </div>
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border mb-3 transition-all duration-300 group-hover:scale-110", `bg-${kpi.color}/10 border-${kpi.color}/12 text-${kpi.color}`)}>
 <kpi.icon className="h-4 w-4" />
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1">{kpi.label}</p>
 <span className="text-xl font-heading tabular-nums tracking-tight text-foreground">{kpi.value}</span>
 </motion.div>
 ))}
 </div>
 </div>
 </motion.section>

 {/* ═══ CREATE FORM ═══ */}
 {showForm && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 exit={{ opacity: 0, height: 0 }}
 className="mb-6 rounded-2xl border border-border/60 bg-card shadow-sm p-6 overflow-hidden"
 >
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
 <h3 className="text-[14px] font-display font-bold text-foreground mb-5 flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
 <Zap className="h-4 w-4 text-primary" />
 </div>
 Nova Regra de Cupom Automático
 </h3>
 <div className="grid md:grid-cols-2 gap-4">
 <input
 placeholder="Nome da regra"
 className="rounded-xl border border-border/30 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/10 transition-all"
 />
 <select className="rounded-xl border border-border/30 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-all">
 {TRIGGER_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <div className="flex gap-2">
 <select className="flex-1 rounded-xl border border-border/30 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-all">
 <option value="percentage">Porcentagem (%)</option>
 <option value="fixed">Valor fixo (R$)</option>
 </select>
 <input
 type="number"
 placeholder="Valor"
 className="w-28 rounded-xl border border-border/30 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary/40 focus:outline-none transition-all"
 />
 </div>
 <input
 type="number"
 placeholder="Uso máximo por cliente"
 className="rounded-xl border border-border/30 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none transition-all"
 />
 </div>
 <button className="mt-5 h-10 px-6 rounded-xl gradient-primary text-primary-foreground text-[12px] font-heading shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all">
 Criar Regra
 </button>
 </motion.div>
 )}

 {/* ═══ RULES LIST ═══ */}
 <div className="space-y-3">
 {rules.map((rule, i) => {
 const trigger = TRIGGER_OPTIONS.find((t) => t.value === rule.trigger);
 const TriggerIcon = trigger?.icon || Clock;
 const toneCls = trigger?.tone || "primary";

 return (
 <motion.div
 key={rule.id}
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
 className="group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden relative"
 >
 {/* Accent bar */}
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all",
 rule.isActive ? `bg-${toneCls}` : "bg-muted-foreground/15"
 )} />

 <div className="p-5 pl-5">
 <div className="flex items-center gap-4">
 <div className={cn(
 "h-12 w-12 rounded-2xl flex items-center justify-center ring-1 transition-all shrink-0",
 rule.isActive
 ? `bg-${toneCls}/10 ring-${toneCls}/15 text-${toneCls}`
 : "bg-muted/10 ring-border/15 text-muted-foreground/30"
 )}>
 <TriggerIcon className="h-5 w-5" />
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2.5 mb-1">
 <h4 className="text-[14px] font-display font-bold text-foreground">{rule.name}</h4>
 <span className={cn(
 "text-[8px] font-heading uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border",
 rule.isActive
 ? "bg-success/8 text-success border-success/15"
 : "bg-muted/10 text-muted-foreground/40 border-border/15"
 )}>
 {rule.isActive ? "Ativo" : "Inativo"}
 </span>
 </div>
 <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50">
 <span className="flex items-center gap-1.5">
 <Clock className="h-3 w-3" />
 {trigger?.label}
 </span>
 <span className="flex items-center gap-1.5">
 <Percent className="h-3 w-3" />
 {rule.discountType === "percentage" ? `${rule.discountValue}%` : `R$ ${rule.discountValue}`} off
 </span>
 <span className="flex items-center gap-1.5">
 <ShoppingCart className="h-3 w-3" />
 Max {rule.maxUses}x
 </span>
 </div>
 </div>

 {/* Stats mini */}
 <div className="hidden md:flex items-center gap-3">
 <div className="text-center px-4 py-2 rounded-xl bg-muted/5 border border-border/10">
 <p className="text-[14px] font-heading font-bold text-foreground tabular-nums">0</p>
 <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider font-bold">Usos</p>
 </div>
 <div className="text-center px-4 py-2 rounded-xl bg-muted/5 border border-border/10">
 <p className="text-[14px] font-heading font-bold text-foreground tabular-nums">R$ 0</p>
 <p className="text-[8px] text-muted-foreground/30 uppercase tracking-wider font-bold">Economia</p>
 </div>
 </div>

 <button className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/10 border border-border/15 hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 shrink-0">
 <Trash2 className="h-4 w-4 text-muted-foreground" />
 </button>
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 );
}

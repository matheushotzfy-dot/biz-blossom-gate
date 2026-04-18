import { useFees } from "@/hooks/useQueryData";
import { Percent, Zap, Shield, Info, CreditCard, ArrowDownToLine, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TONE_MAP: Record<string, { gradient: string; glow: string; icon: React.ComponentType<{ className?: string }> }> = {
 "Taxa de Transação": { gradient: "from-emerald-500/90 to-teal-400/90", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]", icon: CreditCard },
 "Taxa de Saque": { gradient: "from-amber-500/90 to-yellow-400/90", glow: "shadow-[0_0_18px_rgba(245,158,11,0.25)]", icon: ArrowDownToLine },
 "Taxa Fixa": { gradient: "from-sky-500/90 to-blue-400/90", glow: "shadow-[0_0_18px_rgba(14,165,233,0.25)]", icon: DollarSign },
};

function getTone(name: string) {
 return TONE_MAP[name] || { gradient: "from-violet-500/90 to-purple-400/90", glow: "shadow-[0_0_18px_rgba(139,92,246,0.25)]", icon: Zap };
}

export default function Taxas() {
 const { data: fees = [] } = useFees();
 const percentFees = fees.filter(f => f.fee_type === "percentage");
 const fixedFees = fees.filter(f => f.fee_type === "fixed");
 const avgFee = percentFees.length > 0 ? (percentFees.reduce((a, f) => a + f.value, 0) / percentFees.length) : 0;

 const kpis = [
 { label: "Taxas Ativas", value: String(fees.length), icon: Zap, gradient: "from-violet-500/90 to-purple-400/90", glow: "shadow-[0_0_18px_rgba(139,92,246,0.25)]" },
 { label: "Percentuais", value: String(percentFees.length), icon: Percent, gradient: "from-sky-500/90 to-blue-400/90", glow: "shadow-[0_0_18px_rgba(14,165,233,0.25)]" },
 { label: "Valores Fixos", value: String(fixedFees.length), icon: DollarSign, gradient: "from-amber-500/90 to-yellow-400/90", glow: "shadow-[0_0_18px_rgba(245,158,11,0.25)]" },
 { label: "Média %", value: avgFee > 0 ? `${avgFee.toFixed(2)}%` : "—", icon: TrendingUp, gradient: "from-emerald-500/90 to-teal-400/90", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]" },
 ];

 return (
 <div className="relative animate-fade-in">
 <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 overflow-hidden">
 <div className="mx-auto h-full w-full max-w-[1180px]">
 </div>
 </div>

 <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-6 pb-10">

 {/* ════ HERO ════ */}
 <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="relative rounded-3xl overflow-hidden">
 <div className="absolute inset-0 border border-border/60 bg-card shadow-sm" />
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 25, 0], y: [0, -15, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[160px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 25, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[350px] h-[350px] bg-info/6 rounded-full blur-[140px]" />
 </div>

 <div className="relative z-10 p-6 sm:p-8">
 <div className="flex items-center gap-3.5 mb-8">
 <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.6, delay: 0.1, type: "spring" }}>
 <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
 <Percent className="h-6 w-6 text-primary-foreground" />
 </div>
 </motion.div>
 <div>
 <h1 className="text-xl sm:text-2xl font-heading font-black text-foreground tracking-[-0.03em]">Taxas e Tarifas</h1>
 <p className="text-[11px] text-muted-foreground/40 font-display mt-0.5">Taxas aplicadas às suas operações</p>
 </div>
 </div>

 {/* KPI Strip */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {kpis.map((item, idx) => {
 const mirrored = idx % 2 === 1;
 return (
 <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 + idx * 0.08 }}
 className="group relative rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden">
 <div className={cn("relative z-10 flex items-start justify-between", mirrored && "flex-row-reverse")}>
 <div className={mirrored ? "text-right" : ""}>
 <p className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground/40 mb-2">{item.label}</p>
 <p className="text-xl font-heading tabular-nums tracking-tight leading-none text-foreground">{item.value}</p>
 </div>
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-gradient-to-br", item.gradient, item.glow)}>
 <item.icon className="h-4.5 w-4.5 text-foreground" />
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 </motion.section>

 {/* ════ FEE CARDS ════ */}
 {fees.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 {fees.map((fee, i) => {
 const tone = getTone(fee.name);
 const IconComp = tone.icon;
 return (
 <motion.div key={fee.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, delay: i * 0.06 }}>
 <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl p-5 hover:border-primary/15 hover:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.08)] transition-all duration-500 group">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-gradient-to-br", tone.gradient, tone.glow)}>
 <IconComp className="h-5 w-5 text-foreground" />
 </div>
 <div>
 <h3 className="text-[14px] font-display font-bold text-foreground tracking-[-0.02em]">{fee.name}</h3>
 <span className={cn(
 "inline-block mt-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
 fee.fee_type === "percentage"
 ? "text-info bg-info/8 border-info/15"
 : "text-warning bg-warning/8 border-warning/15"
 )}>
 {fee.fee_type === "percentage" ? "Percentual" : "Valor Fixo"}
 </span>
 </div>
 </div>
 </div>

 <p className="text-[32px] font-display font-black text-foreground tracking-[-0.04em] tabular-nums leading-none">
 {fee.fee_type === "percentage" ? `${fee.value}%` : `R$ ${Number(fee.value).toFixed(2)}`}
 </p>

 {fee.description && (
 <p className="text-[12px] text-muted-foreground/40 mt-3 leading-relaxed line-clamp-2">{fee.description}</p>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 ) : (
 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-16 text-center">
 <div className="h-20 w-20 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mx-auto mb-5">
 <Percent className="h-10 w-10 text-muted-foreground/15" />
 </div>
 <h3 className="text-lg font-display font-bold text-foreground/40 mb-1">Nenhuma taxa configurada</h3>
 <p className="text-muted-foreground/30 text-sm">As taxas serão exibidas quando configuradas pelo administrador</p>
 </motion.div>
 )}

 {/* ════ HOW IT WORKS ════ */}
 <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
 className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl p-5 overflow-hidden">
 <div className="flex items-center gap-3.5 mb-5">
 <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-400/10 border border-info/10 flex items-center justify-center">
 <Info className="h-4.5 w-4.5 text-info" />
 </div>
 <div>
 <h3 className="text-[15px] font-display font-bold text-foreground">Como as taxas funcionam</h3>
 <p className="text-[11px] text-muted-foreground/40 font-display">Entenda como os valores são calculados</p>
 </div>
 </div>
 <div className="space-y-2.5">
 {[
 { label: "Taxas percentuais", desc: "Calculadas sobre o valor bruto de cada transação aprovada.", accent: "bg-info" },
 { label: "Taxas fixas", desc: "Cobradas por operação realizada (ex: saque, transferência).", accent: "bg-warning" },
 { label: "Cálculo do líquido", desc: "Valor bruto − taxas percentuais − taxas fixas = valor líquido creditado.", accent: "bg-primary" },
 { label: "Transparência total", desc: "Todas as taxas são exibidas antes da confirmação de cada operação.", accent: "bg-success" },
 ].map((item) => (
 <div key={item.label} className="relative flex items-start gap-3 p-3.5 rounded-xl bg-muted/5 border border-border/15 overflow-hidden">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
 <div className="pl-1.5">
 <p className="text-[13px] font-bold text-foreground/70">{item.label}</p>
 <p className="text-[11px] text-muted-foreground/40 mt-0.5">{item.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </motion.div>
 </div>
 </div>
 );
}

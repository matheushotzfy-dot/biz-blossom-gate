import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Landmark, CheckCircle2, TrendingUp, Loader2,
 Shield, Zap, Globe, Signal, Crown, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface VisibleAcquirer {
 id: string;
 name: string;
 slug: string;
 type: string;
 description: string | null;
 conversion_rate: number;
}

export default function Adquirente() {
 const { user } = useAuth();
 const [acquirers, setAcquirers] = useState<VisibleAcquirer[]>([]);
 const [currentAcquirerId, setCurrentAcquirerId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 if (user?.id) loadData();
 }, [user?.id]);

 const loadData = async () => {
 setLoading(true);
 const [acqRes, profileRes] = await Promise.all([
 supabase.from("acquirers").select("id, name, slug, type, description, conversion_rate").order("conversion_rate", { ascending: false }),
 supabase.from("profiles").select("acquirer_id").eq("user_id", user!.id).maybeSingle(),
 ]);
 if (acqRes.data) setAcquirers(acqRes.data as unknown as VisibleAcquirer[]);
 if (profileRes.data?.acquirer_id) setCurrentAcquirerId(profileRes.data.acquirer_id);
 setLoading(false);
 };

 const selectAcquirer = async (acquirerId: string) => {
 if (!user?.id) return;
 setSaving(true);
 const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId }).eq("user_id", user.id);
 if (error) {
 toast.error("Erro ao selecionar adquirente");
 } else {
 setCurrentAcquirerId(acquirerId);
 toast.success("Adquirente selecionada com sucesso!");
 }
 setSaving(false);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 const selectedAcq = acquirers.find(a => a.id === currentAcquirerId);
 const avgConversion = acquirers.length > 0 ? (acquirers.reduce((a, b) => a + b.conversion_rate, 0) / acquirers.length) : 0;

 const kpis = [
 { label: "Disponíveis", value: String(acquirers.length), icon: Globe, gradient: "from-sky-500/90 to-blue-400/90", glow: "shadow-[0_0_18px_rgba(14,165,233,0.25)]" },
 { label: "Selecionada", value: selectedAcq ? "1" : "0", icon: CheckCircle2, gradient: "from-emerald-500/90 to-teal-400/90", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]" },
 { label: "Conversão Atual", value: selectedAcq ? `${selectedAcq.conversion_rate}%` : "—", icon: TrendingUp, gradient: "from-violet-500/90 to-purple-400/90", glow: "shadow-[0_0_18px_rgba(139,92,246,0.25)]" },
 { label: "Média Geral", value: `${avgConversion.toFixed(1)}%`, icon: Signal, gradient: "from-amber-500/90 to-yellow-400/90", glow: "shadow-[0_0_18px_rgba(245,158,11,0.25)]" },
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
 <Landmark className="h-6 w-6 text-primary-foreground" />
 </div>
 </motion.div>
 <div>
 <h1 className="text-xl sm:text-2xl font-heading font-black text-foreground tracking-[-0.03em]">Adquirente</h1>
 <p className="text-[11px] text-muted-foreground/40 font-display mt-0.5">Selecione seu processador de pagamentos</p>
 </div>
 {selectedAcq && (
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm shadow-[0_0_16px_rgba(34,197,94,0.08)] ml-1">
 <span className="relative flex h-2 w-2">
 <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
 <span className="relative h-2 w-2 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" />
 </span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{selectedAcq.name}</span>
 </div>
 )}
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

 {/* ════ ACQUIRERS GRID ════ */}
 {acquirers.length === 0 ? (
 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-16 text-center">
 <div className="h-20 w-20 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mx-auto mb-5">
 <Landmark className="h-10 w-10 text-muted-foreground/15" />
 </div>
 <h3 className="text-lg font-display font-bold text-foreground/40 mb-1">Nenhuma adquirente disponível</h3>
 <p className="text-muted-foreground/30 text-sm">O administrador ainda não liberou adquirentes para seleção.</p>
 </motion.div>
 ) : (
 <div className="grid gap-3 md:grid-cols-2">
 {acquirers.map((acq, i) => {
 const isSelected = currentAcquirerId === acq.id;
 const isBlack = acq.type === "black";
 return (
 <motion.div key={acq.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}>
 <div
 className={cn(
 "relative overflow-hidden rounded-2xl border bg-card/50 backdrop-blur-xl p-5 transition-all duration-500 cursor-pointer group",
 "hover:border-primary/15 hover:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.08)]",
 isSelected ? "ring-2 ring-primary/20 border-primary/30" : "border-border/30"
 )}
 onClick={() => !saving && selectAcquirer(acq.id)}
 >
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", isSelected ? "bg-primary" : isBlack ? "bg-foreground/60" : "bg-info")} />

 <div className="flex items-start justify-between mb-4 pl-1">
 <div className="flex items-center gap-3.5">
 <div className={cn(
 "h-12 w-12 rounded-xl flex items-center justify-center text-base font-display font-black border transition-all duration-300 group-hover:scale-105",
 isBlack
 ? "bg-foreground/5 text-foreground border-border/30"
 : "bg-gradient-to-br from-primary/10 to-primary/5 text-primary border-primary/15"
 )}>
 {acq.name[0]}
 </div>
 <div>
 <h3 className="text-[15px] font-display font-black text-foreground tracking-tight">{acq.name}</h3>
 <div className="flex items-center gap-2 mt-1">
 <span className={cn(
 "inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
 isBlack ? "bg-foreground/5 text-muted-foreground border-border/20" : "bg-info/8 text-info border-info/15"
 )}>
 {isBlack && <Crown className="h-2.5 w-2.5 inline mr-1" />}
 {acq.type}
 </span>
 {isSelected && (
 <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold border border-primary/15">
 <CheckCircle2 className="h-2.5 w-2.5" /> Ativa
 </span>
 )}
 </div>
 </div>
 </div>
 </div>

 {acq.description && (
 <p className="text-[12px] text-muted-foreground/40 mb-4 leading-relaxed line-clamp-2 pl-1">{acq.description}</p>
 )}

 <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/5 border border-border/15 pl-1">
 <div className="flex items-center gap-2.5 pl-1">
 <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-400/10 flex items-center justify-center">
 <TrendingUp className="h-3.5 w-3.5 text-success" />
 </div>
 <span className="text-[11px] text-muted-foreground/50 font-display">Taxa de Conversão</span>
 </div>
 <span className="text-xl font-display font-black text-foreground tabular-nums tracking-tight">
 {acq.conversion_rate}%
 </span>
 </div>

 {!isSelected && (
 <Button
 size="sm"
 className="w-full mt-4 text-xs rounded-xl h-10 font-bold gap-2 shadow-lg shadow-primary/15"
 disabled={saving}
 onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
 >
 {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
 Selecionar Adquirente
 </Button>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 )}

 {/* ════ HOW IT WORKS ════ */}
 <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
 className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl p-5 overflow-hidden">
 <div className="flex items-center gap-3.5 mb-5">
 <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/15 to-blue-400/10 border border-info/10 flex items-center justify-center">
 <Shield className="h-4.5 w-4.5 text-info" />
 </div>
 <div>
 <h3 className="text-[15px] font-display font-bold text-foreground">Como funciona</h3>
 <p className="text-[11px] text-muted-foreground/40 font-display">Entenda o processamento de pagamentos</p>
 </div>
 </div>
 <div className="space-y-2.5">
 {[
 { label: "Processamento", desc: "A adquirente processa todas as suas transações via cartão de crédito e PIX.", accent: "bg-primary", icon: Zap },
 { label: "Taxa de Conversão", desc: "Indica o percentual de transações aprovadas. Quanto maior, melhor.", accent: "bg-success", icon: TrendingUp },
 { label: "Segurança", desc: "Todas as transações são criptografadas e seguem os padrões PCI DSS.", accent: "bg-info", icon: Shield },
 ].map((item) => (
 <div key={item.label} className="relative flex items-start gap-3 p-3.5 rounded-xl bg-muted/5 border border-border/15 overflow-hidden">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
 <div className="h-8 w-8 rounded-lg bg-muted/10 flex items-center justify-center shrink-0 ml-1">
 <item.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
 </div>
 <div>
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

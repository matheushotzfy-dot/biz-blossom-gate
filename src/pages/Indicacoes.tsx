/**
 * Indicações — Programa de Referral
 * @module Indicacoes
 * @version 3.0.0 — Ultra-Premium Redesign
 */

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, Copy, Users, DollarSign, CheckCircle2, Link2, Share2, TrendingUp, ArrowUpRight, Sparkles, Clock, Zap, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";


const ease = [0.16, 1, 0.3, 1] as const;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Referral = {
 id: string;
 referrer_user_id: string;
 referred_user_id: string | null;
 referred_email: string;
 status: string;
 reward_amount: number;
 paid_at: string | null;
 created_at: string;
};

/* ═══ GlowCard ═══ */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: {
 children: React.ReactNode; className?: string; glowColor?: string; delay?: number;
}) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease }}
 className={cn("relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden", className)}
 >
 <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
 <div className={cn("absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700", `bg-gradient-to-r from-transparent via-${glowColor}/20 to-transparent`)} />
 <div className="relative z-10">{children}</div>
 </motion.div>
 );
}

/* ═══ KPI Tile ═══ */
function KpiTile({ label, value, icon: Icon, color = "primary", delay = 0, sub }: {
 label: string; value: string; icon: any; color?: string; delay?: number; sub?: string;
}) {
 return (
 <GlowCard glowColor={color} delay={delay} className="p-5 shimmer">
 <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${color}/10 border-${color}/12 text-${color}`)}>
 <Icon className="h-4.5 w-4.5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{value}</span>
 {sub && <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-display">{sub}</p>}
 </GlowCard>
 );
}

export default function Indicacoes() {
 const { user } = useAuth();
 const [referrals, setReferrals] = useState<Referral[]>([]);

 const referralCode = user?.id?.slice(0, 8).toUpperCase() || "---";
 const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

 const loadData = async () => {
 if (!user) return;
 const { data } = await supabase
 .from("referrals" as any)
 .select("*")
 .eq("referrer_user_id", user.id)
 .order("created_at", { ascending: false });
 if (data) setReferrals(data as unknown as Referral[]);
 };

 useEffect(() => { loadData(); }, [user?.id]);

 const copyLink = () => {
 navigator.clipboard.writeText(referralLink);
 toast.success("Link copiado!");
 };

 const stats = useMemo(() => {
 const total = referrals.length;
 const converted = referrals.filter(r => r.status === "converted").length;
 const totalReward = referrals.filter(r => r.status === "converted").reduce((acc, r) => acc + Number(r.reward_amount), 0);
 const pending = referrals.filter(r => r.status === "pending").length;
 return { total, converted, totalReward, pending };
 }, [referrals]);

 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ═══ HERO ═══ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-8 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-success/6 rounded-full blur-[160px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Gift className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Programa de Indicações</span>
 </div>
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <Sparkles className="h-3 w-3 text-success" />
 <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-success">R$ 50 por indicação</span>
 </div>
 </div>

 {/* Referral Link */}
 <GlowCard glowColor="primary" className="p-5 sm:p-6">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary")} />
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
 <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
 <Share2 className="h-6 w-6 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-sm font-heading font-black text-foreground mb-0.5">Seu Link de Indicação</h3>
 <p className="text-[10px] text-muted-foreground/40">Compartilhe com outros vendedores e ganhe R$ 50 por cada indicação convertida</p>
 <div className="mt-3 flex items-center gap-2">
 <code className="flex-1 text-[10px] font-mono bg-muted/10 rounded-xl px-3 py-2.5 text-muted-foreground/60 truncate border border-border/15">
 {referralLink}
 </code>
 <Button size="sm" onClick={copyLink} className="rounded-xl gap-1.5 h-10 px-4 font-heading font-bold shrink-0 text-[11px]">
 <Copy className="h-3.5 w-3.5" /> Copiar
 </Button>
 </div>
 </div>
 </div>
 </GlowCard>
 </div>
 </motion.section>

 {/* ═══ KPIs ═══ */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
 <KpiTile label="Indicações" value={String(stats.total)} icon={Users} color="primary" delay={0} sub="enviadas" />
 <KpiTile label="Convertidas" value={String(stats.converted)} icon={CheckCircle2} color="success" delay={0.06} sub="ativadas" />
 <KpiTile label="Pendentes" value={String(stats.pending)} icon={Clock} color="warning" delay={0.12} sub="aguardando" />
 <KpiTile label="Total Ganho" value={fmt(stats.totalReward)} icon={DollarSign} color="primary" delay={0.18} sub="em recompensas" />
 </div>

 {/* ═══ How it Works ═══ */}
 <div className="mb-8">
 <div className="flex items-center gap-2.5 mb-5">
 <div className="h-8 w-8 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
 <TrendingUp className="h-4 w-4 text-info" />
 </div>
 <div>
 <h3 className="text-[14px] font-heading font-black text-foreground">Como Funciona</h3>
 <p className="text-[10px] text-muted-foreground/35">3 passos simples para ganhar</p>
 </div>
 </div>

 <div className="grid sm:grid-cols-3 gap-3">
 {[
 { step: "1", title: "Compartilhe", desc: "Envie seu link para outros empreendedores digitais", icon: Share2, color: "primary" },
 { step: "2", title: "Cadastro", desc: "Quando alguém se cadastra pelo seu link, a indicação é registrada", icon: Users, color: "info" },
 { step: "3", title: "Recompensa", desc: "Ao ativar a conta e fazer a primeira venda, você recebe R$ 50", icon: DollarSign, color: "success" },
 ].map((item, i) => (
 <GlowCard key={item.step} glowColor={item.color} delay={i * 0.08} className="p-5">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${item.color}`)} />
 <div className="text-center">
 <div className={cn(
 "h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ring-1 transition-all group-hover:scale-110",
 `bg-${item.color}/10 ring-${item.color}/15 text-${item.color}`
 )}>
 <item.icon className="h-5 w-5" />
 </div>
 <div className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-foreground/5 text-[9px] font-heading font-black text-foreground/40 mb-2">
 {item.step}
 </div>
 <p className="text-[13px] font-heading font-bold text-foreground">{item.title}</p>
 <p className="text-[10px] text-muted-foreground/40 mt-1.5 leading-relaxed">{item.desc}</p>
 </div>
 </GlowCard>
 ))}
 </div>
 </div>

 {/* ═══ Referral List ═══ */}
 <div>
 <div className="flex items-center gap-2.5 mb-5">
 <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
 <Users className="h-4 w-4 text-primary" />
 </div>
 <div>
 <h3 className="text-[14px] font-heading font-black text-foreground">Suas Indicações</h3>
 <p className="text-[10px] text-muted-foreground/35">{referrals.length} indicações registradas</p>
 </div>
 </div>

 {referrals.length === 0 ? (
 <GlowCard glowColor="primary" className="p-10">
 <div className="text-center">
 <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-muted/10 ring-1 ring-border/10 flex items-center justify-center">
 <Gift className="h-7 w-7 text-muted-foreground/20" />
 </div>
 <p className="text-[14px] font-heading font-bold text-foreground/60">Nenhuma indicação ainda</p>
 <p className="text-[11px] text-muted-foreground/35 mt-1.5">Compartilhe seu link para começar a ganhar</p>
 </div>
 </GlowCard>
 ) : (
 <div className="space-y-2">
 {referrals.map((ref, i) => (
 <GlowCard
 key={ref.id}
 glowColor={ref.status === "converted" ? "success" : "warning"}
 delay={i * 0.03}
 >
 <div className={cn(
 "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
 ref.status === "converted" ? "bg-success" : "bg-warning"
 )} />
 <div className="flex items-center justify-between p-4 pl-5">
 <div className="flex items-center gap-3 min-w-0">
 <div className={cn(
 "h-9 w-9 rounded-xl flex items-center justify-center ring-1 shrink-0",
 ref.status === "converted"
 ? "bg-success/10 ring-success/15 text-success"
 : "bg-warning/10 ring-warning/15 text-warning"
 )}>
 {ref.status === "converted" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
 </div>
 <div className="min-w-0">
 <span className="text-[12px] font-heading font-bold text-foreground block truncate">{ref.referred_email}</span>
 <span className="text-[10px] text-muted-foreground/30 font-mono">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</span>
 </div>
 </div>
 <div className="flex items-center gap-2.5 shrink-0">
 <span className={cn(
 "text-[9px] font-heading font-bold px-2.5 py-1 rounded-lg ring-1",
 ref.status === "converted"
 ? "bg-success/8 ring-success/15 text-success"
 : "bg-warning/8 ring-warning/15 text-warning"
 )}>
 {ref.status === "converted" ? "Convertida" : "Pendente"}
 </span>
 {ref.status === "converted" && (
 <span className="text-[12px] font-heading font-black text-primary tabular-nums">{fmt(Number(ref.reward_amount))}</span>
 )}
 </div>
 </div>
 </GlowCard>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

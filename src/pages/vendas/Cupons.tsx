/**
 * Cupons — Gestão de cupons de desconto
 * @module Cupons
 * @version 4.0.0 — Premium Redesign
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useCoupons } from "@/hooks/useQueryData";
import {
 Ticket, Search, Plus, Trash2, Percent, ToggleLeft, TrendingDown, Calendar,
 Zap, Copy, Tag, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Cupons() {
 const { user } = useAuth();
 const { data: products = [] } = useProducts();
 const { data: coupons = [], refetch } = useCoupons();
 const [search, setSearch] = useState("");
 const [showForm, setShowForm] = useState(false);
 const [deleting, setDeleting] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);

 const [form, setForm] = useState({
 code: "",
 product_id: "",
 discount_type: "percentage" as "percentage" | "fixed",
 discount_value: "",
 max_uses: "",
 starts_at: "",
 expires_at: "",
 apply_to_bumps: false,
 });

 const activeProducts = products.filter(p => p.status === "active");
 const activeCoupons = coupons.filter(c => c.is_active);
 const totalUses = coupons.reduce((a, c) => a + c.current_uses, 0);
 const totalDiscount = coupons.reduce((a, c) => a + c.total_discount_amount, 0);

 const filtered = coupons.filter(c => {
 if (!search) return true;
 return c.code.toLowerCase().includes(search.toLowerCase());
 });

 const getProductName = (pid: string | null) => {
 if (!pid) return "Todos";
 return products.find(p => p.id === pid)?.name || "—";
 };

 const resetForm = () => {
 setForm({ code: "", product_id: "", discount_type: "percentage", discount_value: "", max_uses: "", starts_at: "", expires_at: "", apply_to_bumps: false });
 setShowForm(false);
 };

 const handleCreate = async () => {
 if (!user || !form.code.trim() || !form.discount_value) {
 toast.error("Preencha o código e o valor do desconto.");
 return;
 }
 setSaving(true);
 const { error } = await supabase.from("coupons").insert({
 user_id: user.id,
 code: form.code.trim().toUpperCase(),
 product_id: form.product_id || null,
 discount_type: form.discount_type,
 discount_value: Number(form.discount_value),
 max_uses: form.max_uses ? Number(form.max_uses) : null,
 expires_at: form.expires_at || null,
 });
 setSaving(false);
 if (error) {
 toast.error(error.message.includes("duplicate") ? "Cupom já existe." : "Erro ao criar cupom.");
 return;
 }
 toast.success("Cupom criado com sucesso!");
 resetForm();
 refetch();
 };

 const handleDelete = async (id: string) => {
 setDeleting(id);
 await supabase.from("coupons").delete().eq("id", id);
 toast.success("Cupom removido.");
 setDeleting(null);
 refetch();
 };

 const handleToggle = async (coupon: Tables<"coupons">) => {
 await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
 refetch();
 };

 const copyCode = (code: string) => {
 navigator.clipboard.writeText(code);
 toast.success("Código copiado!");
 };

 const kpis = [
 { label: "Total de Cupons", value: String(coupons.length), icon: Ticket, gradient: "from-violet-500/90 to-purple-400/90", glow: "shadow-[0_0_18px_rgba(139,92,246,0.25)]" },
 { label: "Ativos", value: String(activeCoupons.length), icon: Zap, gradient: "from-emerald-500/90 to-teal-400/90", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]" },
 { label: "Utilizações", value: String(totalUses), icon: Percent, gradient: "from-sky-500/90 to-blue-400/90", glow: "shadow-[0_0_18px_rgba(14,165,233,0.25)]" },
 { label: "Descontos Aplicados", value: fmt(totalDiscount), icon: TrendingDown, gradient: "from-amber-500/90 to-yellow-400/90", glow: "shadow-[0_0_18px_rgba(245,158,11,0.25)]" },
 ];

 return (
 <div className="relative animate-fade-in">
 {/* Atmospheric glow */}
 <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 overflow-hidden">
 <div className="mx-auto h-full w-full max-w-[1180px]">
 </div>
 </div>

 <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-6 pb-10">

 {/* ════════════════════════════════════════════════════════════════ */}
 {/* HERO */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative rounded-3xl overflow-hidden"
 >
 <div className="absolute inset-0 border border-border/60 bg-card shadow-sm" />
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 25, 0], y: [0, -15, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[160px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 25, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[350px] h-[350px] bg-info/6 rounded-full blur-[140px]" />
 </div>

 <div className="relative z-10 p-6 sm:p-8">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
 <div className="flex items-center gap-3.5">
 <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.6, delay: 0.1, type: "spring" }}>
 <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
 <Tag className="h-6 w-6 text-primary-foreground" />
 </div>
 </motion.div>
 <div>
 <h1 className="text-xl sm:text-2xl font-heading font-black text-foreground tracking-[-0.03em]">Meus Cupons</h1>
 <p className="text-[11px] text-muted-foreground/40 font-display mt-0.5">Crie e gerencie estratégias de desconto</p>
 </div>
 </div>
 <motion.button
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.3 }}
 onClick={() => setShowForm(!showForm)}
 className="h-11 px-6 rounded-xl text-sm font-display font-bold flex items-center gap-2.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all duration-300"
 >
 <Plus className="h-4.5 w-4.5" /> Novo Cupom
 </motion.button>
 </div>

 {/* KPI Strip */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {kpis.map((item, idx) => {
 const mirrored = idx % 2 === 1;
 return (
 <motion.div
 key={item.label}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay: 0.2 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
 className="group relative rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden"
 >
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

 {/* ════════════════════════════════════════════════════════════════ */}
 {/* CONTENT */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

 {/* ── Left: Coupon List ── */}
 <div className="lg:col-span-2 space-y-4">
 {/* Search bar */}
 <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
 <div className="relative max-w-sm group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25 group-focus-within:text-primary/50 transition-colors" />
 <Input
 placeholder="Buscar cupom..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="pl-11 h-11 rounded-xl bg-card/50 border-border/20 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-display"
 />
 </div>
 </motion.div>

 {/* Coupons list as cards */}
 <AnimatePresence mode="popLayout">
 {filtered.length === 0 ? (
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-16 text-center"
 >
 <div className="h-20 w-20 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mx-auto mb-5">
 <Ticket className="h-10 w-10 text-muted-foreground/15" />
 </div>
 <h3 className="text-lg font-display font-bold text-foreground/40 mb-1">Nenhum cupom encontrado</h3>
 <p className="text-muted-foreground/30 text-sm">Crie seu primeiro cupom para começar</p>
 </motion.div>
 ) : (
 <div className="space-y-2.5">
 {filtered.map((c, idx) => (
 <motion.div
 key={c.id}
 layout
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.35, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
 className="group relative rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl overflow-hidden hover:border-primary/15 hover:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.08)] transition-all duration-500"
 >
 {/* Left accent bar */}
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-colors", c.is_active ? "bg-primary" : "bg-muted-foreground/15")} />

 <div className="p-4 pl-5 flex items-center gap-4">
 {/* Code badge */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2.5 mb-1.5">
 <button
 onClick={() => copyCode(c.code)}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors cursor-pointer group/code"
 >
 <span className="font-mono text-sm font-black text-primary tracking-wider">{c.code}</span>
 <Copy className="h-3 w-3 text-primary/40 group-hover/code:text-primary/70 transition-colors" />
 </button>
 <button onClick={() => handleToggle(c)} className="cursor-pointer">
 <StatusBadge status={c.is_active ? "active" : "inactive"} />
 </button>
 </div>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/40">
 <span className="font-display">
 <span className="text-foreground/70 font-bold">
 {c.discount_type === "percentage" ? `${Number(c.discount_value)}% OFF` : `${fmt(Number(c.discount_value))} OFF`}
 </span>
 </span>
 <span className="font-display">Produto: <span className="text-foreground/50 font-bold">{getProductName(c.product_id)}</span></span>
 <span className="font-numbers tabular-nums">
 {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""} usos
 </span>
 {c.expires_at && (
 <span className="flex items-center gap-1 font-numbers">
 <Calendar className="h-3 w-3" />
 {new Date(c.expires_at).toLocaleDateString("pt-BR")}
 </span>
 )}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-1 shrink-0">
 <Button
 variant="ghost"
 size="icon"
 className="h-9 w-9 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/8"
 onClick={() => handleDelete(c.id)}
 disabled={deleting === c.id}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </AnimatePresence>
 </div>

 {/* ── Right: Create Form ── */}
 <div className={cn("lg:block", showForm ? "block" : "hidden lg:block")}>
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 }}
 className="sticky top-4 rounded-2xl border border-border/30 bg-card/50 backdrop-blur-xl overflow-hidden"
 >
 {/* Form header */}
 <div className="px-5 pt-5 pb-4 border-b border-border/15">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
 <Sparkles className="h-4 w-4 text-primary/60" />
 </div>
 <div>
 <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">Criar Cupom</h3>
 <p className="text-[10px] text-muted-foreground/35 font-display">Configure o desconto</p>
 </div>
 </div>
 </div>

 {/* Form body */}
 <div className="p-5 space-y-4">
 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Código</Label>
 <Input
 placeholder="Ex: DESCONTO10"
 value={form.code}
 onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
 className="h-11 rounded-xl font-mono bg-muted/5 border-border/20 focus:border-primary/30"
 />
 </div>

 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Produto</Label>
 <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v === "all" ? "" : v }))}>
 <SelectTrigger className="h-11 rounded-xl bg-muted/5 border-border/20">
 <SelectValue placeholder="Todos os produtos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos os produtos</SelectItem>
 {activeProducts.map(p => (
 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Desconto</Label>
 <div className="flex gap-2">
 <Input
 type="number"
 placeholder="10"
 value={form.discount_value}
 onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
 className="h-11 rounded-xl flex-1 bg-muted/5 border-border/20 focus:border-primary/30"
 />
 <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as "percentage" | "fixed" }))}>
 <SelectTrigger className="h-11 rounded-xl w-20 bg-muted/5 border-border/20">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="percentage">%</SelectItem>
 <SelectItem value="fixed">R$</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Limite de Usos</Label>
 <Input
 type="number"
 placeholder="Ilimitado"
 value={form.max_uses}
 onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
 className="h-11 rounded-xl bg-muted/5 border-border/20 focus:border-primary/30"
 />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Início</Label>
 <Input
 type="date"
 value={form.starts_at}
 onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
 className="h-11 rounded-xl bg-muted/5 border-border/20 focus:border-primary/30 text-xs"
 />
 </div>
 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2 block">Expiração</Label>
 <Input
 type="date"
 value={form.expires_at}
 onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
 className="h-11 rounded-xl bg-muted/5 border-border/20 focus:border-primary/30 text-xs"
 />
 </div>
 </div>
 <p className="text-[10px] text-muted-foreground/30 -mt-2">Sem data = validade eterna</p>

 <div className="flex items-center gap-3 pt-1 pb-1">
 <Switch
 checked={form.apply_to_bumps}
 onCheckedChange={v => setForm(f => ({ ...f, apply_to_bumps: v }))}
 />
 <span className="text-xs text-foreground/60 font-display">Aplicar aos Order Bumps</span>
 </div>

 <div className="flex items-center gap-3 pt-2">
 <Button variant="outline" className="flex-1 rounded-xl h-10 font-display font-bold border-border/20 hover:bg-muted/10" onClick={resetForm}>
 Cancelar
 </Button>
 <Button className="flex-1 rounded-xl h-10 font-display font-bold shadow-lg shadow-primary/15" onClick={handleCreate} disabled={saving}>
 {saving ? "Salvando..." : "Criar Cupom"}
 </Button>
 </div>
 </div>
 </motion.div>
 </div>
 </div>
 </div>
 </div>
 );
}

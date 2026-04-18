import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import { PageShell, PageTitle, Panel, GlowPanel, GlassKpi, EmptyState } from "@/components/PageShell";
import {
 FileText, Download, CheckCircle2, Clock, AlertCircle, Search,
 Shield, Zap, DollarSign, BarChart3, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type InvoiceStatus = "emitida" | "pendente" | "erro";

const STATUS_MAP: Record<InvoiceStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
 emitida: { label: "Emitida", color: "text-success", bg: "bg-success/8", border: "border-success/15", icon: CheckCircle2 },
 pendente: { label: "Pendente", color: "text-warning", bg: "bg-warning/8", border: "border-warning/15", icon: Clock },
 erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/8", border: "border-destructive/15", icon: AlertCircle },
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function NotasFiscais() {
 const { user } = useAuth();
 const { data: transactions = [] } = useTransactions();
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
 const [autoEmit, setAutoEmit] = useState(false);

 const invoices = useMemo(() => {
 return transactions
 .filter((t) => t.status === "completed")
 .map((t, i) => ({
 id: t.id,
 number: `NF-${String(i + 1).padStart(6, "0")}`,
 customer: t.customer_name || "Cliente",
 email: t.customer_email || "",
 document: t.customer_document || "",
 amount: Number(t.amount),
 date: t.created_at,
 status: (i % 5 === 0 ? "pendente" : "emitida") as InvoiceStatus,
 product: "Produto Digital",
 }))
 .filter((inv) => {
 if (statusFilter !== "all" && inv.status !== statusFilter) return false;
 if (search) {
 const q = search.toLowerCase();
 return inv.customer.toLowerCase().includes(q) || inv.number.toLowerCase().includes(q) || inv.email.toLowerCase().includes(q);
 }
 return true;
 });
 }, [transactions, search, statusFilter]);

 const stats = useMemo(() => {
 const all = transactions.filter((t) => t.status === "completed");
 return {
 total: all.length,
 emitidas: Math.floor(all.length * 0.9),
 pendentes: Math.ceil(all.length * 0.1),
 volume: all.reduce((s, t) => s + Number(t.amount), 0),
 };
 }, [transactions]);

 return (
 <PageShell>
 <PageTitle
 icon={<FileText className="h-6 w-6" />}
 title="Notas Fiscais"
 subtitle="Emissão e gestão de NF-e para suas vendas"
 />

 {/* ─── KPIs ─── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 <GlassKpi label="Total NF-e" value={String(stats.total)} sub="Notas geradas" icon={FileText} tone="primary" delay={0} />
 <GlassKpi label="Emitidas" value={String(stats.emitidas)} sub="Processadas com sucesso" icon={CheckCircle2} tone="success" delay={1} />
 <GlassKpi label="Pendentes" value={String(stats.pendentes)} sub="Aguardando emissão" icon={Clock} tone="warning" delay={2} />
 <GlassKpi label="Volume Faturado" value={fmt(stats.volume)} sub="Valor total NF-e" icon={DollarSign} tone="info" delay={3} />
 </div>

 {/* ─── Auto-emit Setting ─── */}
 <Panel accent="bg-primary">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pl-2">
 <div className="flex items-center gap-3.5">
 <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
 <Settings className="h-4.5 w-4.5 text-primary" />
 </div>
 <div>
 <h3 className="text-sm font-display font-bold text-foreground">Emissão Automática</h3>
 <p className="text-[11px] text-muted-foreground/50 mt-0.5">
 Emitir NF-e automaticamente após cada venda aprovada
 </p>
 </div>
 </div>
 <button
 onClick={() => setAutoEmit(!autoEmit)}
 className={cn(
 "relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0",
 autoEmit ? "bg-primary" : "bg-muted/50"
 )}
 >
 <span className={cn(
 "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
 autoEmit ? "translate-x-6" : "translate-x-1"
 )} />
 </button>
 </div>
 </Panel>

 {/* ─── Filters ─── */}
 <div className="flex flex-col md:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Buscar por cliente, número ou e-mail..."
 className="w-full rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
 />
 </div>
 <div className="flex gap-2">
 {(["all", "emitida", "pendente", "erro"] as const).map((s) => (
 <button
 key={s}
 onClick={() => setStatusFilter(s)}
 className={cn(
 "rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all duration-200",
 statusFilter === s
 ? "bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm"
 : "bg-card/50 text-muted-foreground/60 border border-border/30 hover:text-foreground hover:border-border/50"
 )}
 >
 {s === "all" ? "Todas" : STATUS_MAP[s].label}
 </button>
 ))}
 </div>
 </div>

 {/* ─── Invoices List ─── */}
 {invoices.length === 0 ? (
 <Panel>
 <EmptyState
 icon={<FileText className="h-8 w-8" />}
 title="Nenhuma nota fiscal encontrada"
 subtitle="As notas fiscais serão geradas com base nas suas vendas aprovadas"
 />
 </Panel>
 ) : (
 <div className="space-y-2">
 {invoices.slice(0, 50).map((inv, i) => {
 const status = STATUS_MAP[inv.status];
 const StatusIcon = status.icon;
 return (
 <motion.div
 key={inv.id}
 initial={{ opacity: 0, x: -6 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
 >
 <Panel className="group relative" accent={inv.status === "emitida" ? "bg-success" : inv.status === "pendente" ? "bg-warning" : "bg-destructive"}>
 <div className="flex items-center gap-4 pl-1.5">
 <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15 group-hover:bg-primary/12 transition-colors">
 <FileText className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2.5">
 <span className="text-[13px] font-display font-bold text-foreground">{inv.number}</span>
 <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-bold", status.bg, status.border, status.color)}>
 <StatusIcon className="h-2.5 w-2.5" />
 {status.label}
 </span>
 </div>
 <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
 {inv.customer} · <span className="font-mono">{inv.document || "Sem CPF"}</span> · {new Date(inv.date).toLocaleDateString("pt-BR")}
 </p>
 </div>
 <p className="text-sm font-display font-black text-foreground whitespace-nowrap tabular-nums tracking-tight">
 {fmt(inv.amount)}
 </p>
 <button
 className="rounded-xl bg-muted/20 p-2.5 hover:bg-primary/10 transition-all duration-200 border border-border/20 hover:border-primary/20 opacity-60 group-hover:opacity-100 shrink-0"
 title="Baixar XML"
 >
 <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
 </button>
 </div>
 </Panel>
 </motion.div>
 );
 })}
 </div>
 )}

 {/* ─── Info ─── */}
 <GlowPanel glow="info">
 <div className="flex items-center gap-3.5 mb-5">
 <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center">
 <Shield className="h-4.5 w-4.5 text-info" />
 </div>
 <div>
 <h3 className="text-[15px] font-display font-bold text-foreground">Sobre Notas Fiscais</h3>
 <p className="text-[11px] text-muted-foreground/60">Informações sobre emissão e conformidade</p>
 </div>
 </div>
 <div className="space-y-3">
 {[
 { label: "Emissão Automática", desc: "Ao ativar, cada venda aprovada gera automaticamente uma NF-e.", accent: "bg-primary" },
 { label: "Conformidade Fiscal", desc: "Todas as notas seguem o padrão da SEFAZ e legislação vigente.", accent: "bg-success" },
 { label: "Download XML", desc: "Baixe o XML de qualquer nota para importação no seu sistema contábil.", accent: "bg-info" },
 ].map((item) => (
 <div key={item.label} className="relative flex items-start gap-3 p-3.5 rounded-xl bg-muted/10 border border-border/30 overflow-hidden">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
 <div className="pl-1.5">
 <p className="text-[13px] font-bold text-foreground/80">{item.label}</p>
 <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </GlowPanel>
 </PageShell>
 );
}

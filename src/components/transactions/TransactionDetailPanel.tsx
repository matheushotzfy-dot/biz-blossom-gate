import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
 ArrowDownRight,
 Check,
 Copy,
 CreditCard,
 ExternalLink,
 Hash,
 Mail,
 MessageCircle,
 Package,
 Phone,
 Receipt,
 RefreshCw,
 Smartphone,
 Users,
 X,
 Zap,
} from "lucide-react";
import { PixLogoMark } from "@/components/icons/PixLogoMark";

import { StatusBadge } from "@/components/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Transaction = Tables<"transactions">;

interface TransactionDetailPanelProps {
 tx: Transaction;
 products: Record<string, string>;
 onClose: () => void;
 onRefund?: (tx: Transaction) => void;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
 style: "currency",
 currency: "BRL",
 minimumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
 timeZone: "America/Sao_Paulo",
 dateStyle: "short",
 timeStyle: "short",
});

const avatarTones = [
 "bg-primary/15 text-primary",
 "bg-info/15 text-info",
 "bg-warning/15 text-warning",
 "bg-success/15 text-success",
 "bg-destructive/15 text-destructive",
];

const methodTones: Record<string, string> = {
 pix: "bg-success/10 text-success border-success/15",
 credit_card: "bg-info/10 text-info border-info/15",
 boleto: "bg-warning/10 text-warning border-warning/15",
};

const methodLabels: Record<string, string> = {
 pix: "PIX",
 credit_card: "Cartão",
 boleto: "Boleto",
};

const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));

const getInitials = (name: string) => {
 const parts = name.trim().split(/\s+/).filter(Boolean);
 if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
 return (parts[0]?.[0] || "?").toUpperCase();
};

const getAvatarTone = (name: string) => {
 const seed = name.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
 return avatarTones[seed % avatarTones.length];
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <section className="rounded-[24px] border border-border/40 bg-muted/[0.04] p-4 shadow-sm sm:p-5">
 <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">{title}</p>
 {children}
 </section>
 );
}

function DataRow({
 label,
 value,
 icon,
 valueClassName,
}: {
 label: string;
 value: React.ReactNode;
 icon?: React.ReactNode;
 valueClassName?: string;
}) {
 return (
 <div className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
 <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground/80">
 {icon}
 <span>{label}</span>
 </div>
 <div className={cn("min-w-0 max-w-[72%] text-right text-[13px] font-semibold text-foreground break-words", valueClassName)}>
 {value}
 </div>
 </div>
 );
}

export function TransactionDetailPanel({ tx, products, onClose, onRefund }: TransactionDetailPanelProps) {
 const [copiedId, setCopiedId] = useState(false);

 const customerName = tx.customer_name || "Cliente";
 const customerEmail = tx.customer_email || "—";
 const productName = tx.product_id ? products[tx.product_id] || tx.product_id : "—";
 const methodLabel = methodLabels[tx.payment_method || ""] || tx.payment_method || "—";
 const methodTone = methodTones[tx.payment_method || ""] || "bg-muted text-muted-foreground border-border";
 const avatarTone = getAvatarTone(customerName);
 const whatsappHref = tx.customer_phone ? `https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}` : null;

 const trackingItems = useMemo(() => {
 if (!tx.checkout_session_id?.startsWith("http")) return [] as Array<[string, string]>;

 try {
 const url = new URL(tx.checkout_session_id);
 return ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"]
 .map((key) => [key, url.searchParams.get(key)] as const)
 .filter((entry): entry is [string, string] => Boolean(entry[1]));
 } catch {
 return [] as Array<[string, string]>;
 }
 }, [tx.checkout_session_id]);

 const handleCopyId = async () => {
 await navigator.clipboard.writeText(tx.id);
 setCopiedId(true);
 toast.success("ID copiado!");
 window.setTimeout(() => setCopiedId(false), 1800);
 };

 return createPortal(
 <AnimatePresence>
 <div className="fixed inset-0 z-[70] overflow-hidden">
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
 className="absolute inset-0 bg-background/70 backdrop-blur-sm"
 onClick={onClose}
 />

 <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
 <motion.div
 initial={{ opacity: 0, y: 14, scale: 0.985 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 8, scale: 0.99 }}
 transition={{ type: "spring", duration: 0.42, bounce: 0.06 }}
 className="pointer-events-auto flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[30px] border border-border/50 bg-card/98 shadow-2xl"
 >
 <div className="relative shrink-0 border-b border-border/40 bg-card px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
 <button
 onClick={onClose}
 className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
 >
 <X className="h-4 w-4" />
 </button>

 <div className="pr-12">
 <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">Detalhes da transação</p>
 <div className="mt-4 flex items-start gap-3">
 <Avatar className="h-12 w-12 shrink-0">
 <AvatarFallback className={cn("text-sm font-black", avatarTone)}>{getInitials(customerName)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0 flex-1">
 <p className="truncate text-[15px] font-bold text-foreground">{customerName}</p>
 <p className="truncate text-[12px] text-muted-foreground">{customerEmail}</p>
 <div className="mt-3 flex flex-wrap items-center gap-2">
 <StatusBadge status={tx.status} />
 <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]", methodTone)}>
 {tx.payment_method === "pix" && <Smartphone className="h-3 w-3" />}
 {tx.payment_method === "credit_card" && <CreditCard className="h-3 w-3" />}
 {tx.payment_method === "boleto" && <Package className="h-3 w-3" />}
 {methodLabel}
 </span>
 </div>
 </div>
 </div>
 </div>

 <div className="mt-5 rounded-[24px] border border-border/40 bg-muted/[0.05] p-4 sm:p-5">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-[11px] font-semibold text-muted-foreground/75">Valor bruto</p>
 <p className="mt-2 text-[30px] font-black leading-none tracking-tight text-foreground sm:text-[36px]">{formatCurrency(Number(tx.amount))}</p>
 </div>
 <div className="rounded-2xl border border-border/35 bg-background/35 px-3 py-2 text-right">
 <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Data</p>
 <p className="mt-1 text-[12px] font-semibold text-foreground">{formatDateTime(tx.created_at)}</p>
 </div>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto overscroll-contain">
 <div className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
 <div className="space-y-4">
 <section className="grid gap-3 sm:grid-cols-3">
 <div className="rounded-[24px] border border-border/40 bg-muted/[0.03] p-4">
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Bruto</p>
 <p className="mt-2 text-[18px] font-black text-foreground">{formatCurrency(Number(tx.amount))}</p>
 </div>
 <div className="rounded-[24px] border border-border/40 bg-muted/[0.03] p-4">
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Taxa</p>
 <p className="mt-2 text-[18px] font-black text-destructive">- {formatCurrency(Number(tx.fee_amount))}</p>
 </div>
 <div className="rounded-[24px] border border-primary/20 bg-primary/[0.05] p-4">
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Líquido</p>
 <p className="mt-2 text-[18px] font-black text-primary">{formatCurrency(Number(tx.net_amount))}</p>
 </div>
 </section>

 <SectionCard title="Transação">
 <DataRow label="Produto" value={<span className="block break-words text-right">{productName}</span>} icon={<Package className="h-3.5 w-3.5 shrink-0" />} />
 <DataRow label="Método" value={methodLabel} icon={<CreditCard className="h-3.5 w-3.5 shrink-0" />} />
 <DataRow label="Data" value={formatDateTime(tx.created_at)} icon={<Zap className="h-3.5 w-3.5 shrink-0" />} />
 {Number(tx.retained_amount) > 0 && (
 <DataRow
 label="Valor retido"
 value={`- ${formatCurrency(Number(tx.retained_amount))}`}
 icon={<ArrowDownRight className="h-3.5 w-3.5 shrink-0" />}
 valueClassName="text-warning"
 />
 )}
 <div className="mt-3 rounded-2xl border border-border/40 bg-background/40 p-3 sm:p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">ID da transação</p>
 <p className="mt-2 break-all font-mono text-[12px] text-foreground/90">{tx.id}</p>
 </div>
 <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-xl" onClick={handleCopyId}>
 {copiedId ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
 </Button>
 </div>
 </div>
 </SectionCard>
 </div>

 <div className="space-y-4">
 <SectionCard title="Cliente">
 <DataRow label="Nome" value={tx.customer_name || "—"} icon={<Users className="h-3.5 w-3.5 shrink-0" />} />
 <DataRow label="Email" value={tx.customer_email || "—"} icon={<Mail className="h-3.5 w-3.5 shrink-0" />} />
 <DataRow label="Telefone" value={tx.customer_phone || "—"} icon={<Phone className="h-3.5 w-3.5 shrink-0" />} />
 {tx.customer_document && <DataRow label="CPF/CNPJ" value={tx.customer_document} icon={<Hash className="h-3.5 w-3.5 shrink-0" />} />}
 </SectionCard>

 <SectionCard title="Resumo rápido">
 <div className="space-y-3">
 <div className="rounded-2xl border border-border/30 bg-background/35 p-3">
 <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground/70">
 <Receipt className="h-3.5 w-3.5" /> Status atual
 </div>
 <div className="mt-2">
 <StatusBadge status={tx.status} />
 </div>
 </div>

 <div className="rounded-2xl border border-border/30 bg-background/35 p-3">
 <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground/70">Produto vinculado</p>
 <p className="mt-2 break-words text-[13px] font-semibold text-foreground">{productName}</p>
 </div>
 </div>
 </SectionCard>

 {trackingItems.length > 0 && (
 <SectionCard title="Rastreamento">
 <div className="space-y-2">
 {trackingItems.map(([key, value]) => (
 <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-border/30 bg-background/35 px-3 py-2.5">
 <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground/70">{key}</span>
 <span className="min-w-0 break-words text-right text-[12px] font-semibold text-foreground">{value}</span>
 </div>
 ))}
 </div>
 </SectionCard>
 )}
 </div>
 </div>
 </div>

 {(whatsappHref || (onRefund && tx.status === "completed")) && (
 <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card px-5 py-4 sm:flex-row sm:px-6">
 {whatsappHref && (
 <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex-1">
 <Button variant="outline" className="h-11 w-full gap-2 rounded-2xl border-success/20 text-success hover:bg-success/5">
 <MessageCircle className="h-4 w-4" /> WhatsApp
 </Button>
 </a>
 )}
 {onRefund && tx.status === "completed" && (
 <Button
 variant="outline"
 className="h-11 flex-1 gap-2 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5"
 onClick={() => onRefund(tx)}
 >
 <RefreshCw className="h-4 w-4" /> Reembolsar
 </Button>
 )}
 {tx.checkout_session_id?.startsWith("http") && (
 <a href={tx.checkout_session_id} target="_blank" rel="noopener noreferrer" className="sm:w-auto">
 <Button variant="outline" className="h-11 w-full gap-2 rounded-2xl">
 <ExternalLink className="h-4 w-4" /> Origem
 </Button>
 </a>
 )}
 </div>
 )}
 </motion.div>
 </div>
 </div>
 </AnimatePresence>,
 document.body
 );
}
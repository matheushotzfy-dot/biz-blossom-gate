import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, useInvalidateAll } from "@/hooks/useQueryData";
import {
 ArrowDownToLine, Clock, CheckCircle2, XCircle, Shield, Zap,
 Wallet, AlertTriangle, Info, Globe, Link2, Radio, Eye, EyeOff,
 Search, X, Plus, Layers, Activity, TrendingUp, Banknote,
 Percent, ArrowUpRight, ArrowDownRight, Sparkles, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

/* ── Crypto definitions ── */
interface CryptoNetwork { id: string; name: string; shortName: string; }
interface CryptoAsset { id: string; symbol: string; name: string; coingeckoId: string; color: string; networks: CryptoNetwork[]; }

const CRYPTO_ASSETS: CryptoAsset[] = [
 {
 id: "btc", symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", color: "#F7931A",
 networks: [
 { id: "onchain", name: "Bitcoin Onchain", shortName: "BTC" },
 { id: "lightning", name: "Lightning Network", shortName: "LN" },
 { id: "liquid", name: "Liquid Network", shortName: "L-BTC" },
 ],
 },
 {
 id: "usdt", symbol: "USDT", name: "Tether", coingeckoId: "tether", color: "#26A17B",
 networks: [
 { id: "tron", name: "Tron (TRC-20)", shortName: "TRC20" },
 { id: "polygon", name: "Polygon", shortName: "MATIC" },
 { id: "arbitrum", name: "Arbitrum One", shortName: "ARB" },
 { id: "solana", name: "Solana", shortName: "SOL" },
 { id: "optimism", name: "Optimism", shortName: "OP" },
 { id: "near", name: "NEAR Protocol", shortName: "NEAR" },
 { id: "polkadot", name: "Polkadot", shortName: "DOT" },
 { id: "bsc", name: "BNB Smart Chain", shortName: "BSC" },
 { id: "ethereum", name: "Ethereum (ERC-20)", shortName: "ETH" },
 ],
 },
 {
 id: "xmr", symbol: "XMR", name: "Monero", coingeckoId: "monero", color: "#FF6600",
 networks: [{ id: "monero", name: "Monero Network", shortName: "XMR" }],
 },
];

const MARKUP = 1.03;
const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
 if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
 if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
 return fmt(v);
};
const fmtUSD = (v: number) => `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const HIDE = "•••";

interface CoinPrice { brl: number; usd: number; brl_24h_change: number; }

const STATUS_CONFIG: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
 approved: { label: "Aprovado", fg: "text-success", dot: "bg-success", bg: "bg-success/10", border: "border-success/25" },
 pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10", border: "border-warning/25" },
 rejected: { label: "Recusado", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
};

/* ─── Animated Number ─── */
function AnimatedNumber({ value, formatter = fmt, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
 const [display, setDisplay] = useState(value);
 const prevRef = useRef(value);
 useEffect(() => {
 const from = prevRef.current;
 const to = value;
 prevRef.current = value;
 if (from === to) return;
 const start = performance.now();
 const tick = (now: number) => {
 const elapsed = now - start;
 const progress = Math.min(elapsed / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);
 setDisplay(from + (to - from) * eased);
 if (progress < 1) requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
 }, [value, duration]);
 return <>{formatter(display)}</>;
}

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
 if (prev === 0 && cur === 0) return null;
 if (prev === 0) return <span className="text-[9px] font-display font-bold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10"><Sparkles className="h-2.5 w-2.5" />novo</span>;
 const pct = ((cur - prev) / prev) * 100;
 const up = pct >= 0;
 return (
 <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
 className={cn("inline-flex items-center gap-0.5 text-[9px] font-display font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}
 >
 {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
 {Math.abs(pct).toFixed(1)}%
 </motion.span>
 );
}

function GlowCard({ children, className, glowColor = "primary", delay = 0, animated = false }: { children: React.ReactNode; className?: string; glowColor?: string; delay?: number; animated?: boolean }) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
 className={cn("relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden", animated && "", className)}
 >
 <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
 <div className={cn("absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000 blur-[40px] pointer-events-none", `bg-${glowColor}/6`)} />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
 <div className="relative z-10">{children}</div>
 </motion.div>
 );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function SaquesCrypto() {
 const { user } = useAuth();
 const { data: withdrawals = [], refetch: refetchWithdrawals } = useWithdrawals();
 const invalidateAll = useInvalidateAll();

 const [open, setOpen] = useState(false);
 const [amount, setAmount] = useState("");
 const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>(CRYPTO_ASSETS[0]);
 const [selectedNetwork, setSelectedNetwork] = useState(CRYPTO_ASSETS[0].networks[0]);
 const [cryptoAddress, setCryptoAddress] = useState("");
 const [prices, setPrices] = useState<Record<string, CoinPrice>>({});
 const [loadingPrices, setLoadingPrices] = useState(true);
 const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });
 const [search, setSearch] = useState("");

 const toggleHidden = useCallback(() => {
 setHidden(p => { const n = !p; try { localStorage.setItem("privacy_mode", String(n)); } catch {} return n; });
 }, []);

 useEffect(() => {
 const fetchPrices = async () => {
 try {
 const ids = CRYPTO_ASSETS.map(a => a.coingeckoId).join(",");
 const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl,usd&include_24hr_change=true`);
 if (res.ok) {
 const data = await res.json();
 const mapped: Record<string, CoinPrice> = {};
 for (const asset of CRYPTO_ASSETS) {
 const d = data[asset.coingeckoId];
 if (d) mapped[asset.id] = { brl: d.brl || 0, usd: d.usd || 0, brl_24h_change: d.brl_24h_change || 0 };
 }
 setPrices(mapped);
 }
 } catch { /* silent */ }
 setLoadingPrices(false);
 };
 fetchPrices();
 const interval = setInterval(fetchPrices, 60000);
 return () => clearInterval(interval);
 }, []);

 useEffect(() => {
 if (!user?.id) return;
 const interval = setInterval(() => refetchWithdrawals(), 30000);
 return () => clearInterval(interval);
 }, [user?.id, refetchWithdrawals]);

 const cryptoWithdrawals = useMemo(
 () => withdrawals.filter(w => (w as any).withdrawal_type === "crypto"),
 [withdrawals]
 );

 const hasCompletedCrypto = cryptoWithdrawals.some(w => w.status === "approved");
 const dailyLimit = hasCompletedCrypto ? 6000 : 500;

 const handleSelectAsset = (asset: CryptoAsset) => {
 setSelectedAsset(asset);
 setSelectedNetwork(asset.networks[0]);
 };

 const getMarkupPrice = (assetId: string) => {
 const p = prices[assetId];
 if (!p) return null;
 return { ...p, brl: p.brl * MARKUP, usd: p.usd * MARKUP };
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!user) return;
 const numAmount = parseFloat(amount);
 if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
 if (!cryptoAddress.trim()) { toast.error("Insira o endereço da carteira"); return; }
 const fee = numAmount * 0.05 + 5;
 if (numAmount <= fee) { toast.error(`Valor deve ser maior que a taxa de ${fmt(fee)}`); return; }
 const { error } = await supabase.from("withdrawals").insert({
 user_id: user.id, amount: numAmount, withdrawal_type: "crypto",
 crypto_currency: selectedAsset.symbol, crypto_network: selectedNetwork.id, crypto_address: cryptoAddress.trim(),
 } as any);
 if (error) {
 const msg = error.message || "";
 if (msg.includes("Saldo insuficiente")) toast.error(msg);
 else if (msg.includes("Máximo de 3")) toast.error("Você já tem 3 saques pendentes");
 else if (msg.includes("congelado")) toast.error("Saldo congelado pelo administrador");
 else if (msg.includes("Primeiro saque crypto")) toast.error("Primeiro saque crypto limitado a R$ 500,00");
 else if (msg.includes("Limite diário")) toast.error(msg);
 else toast.error("Erro ao solicitar saque crypto");
 return;
 }
 toast.success("Saque crypto solicitado! Será processado manualmente.");
 setOpen(false); setAmount(""); setCryptoAddress("");
 invalidateAll(["withdrawals"]);
 };

 const pending = cryptoWithdrawals.filter(w => w.status === "pending");
 const approved = cryptoWithdrawals.filter(w => w.status === "approved");
 const rejected = cryptoWithdrawals.filter(w => w.status === "rejected");
 const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);
 const totalRequested = cryptoWithdrawals.reduce((a, w) => a + Number(w.amount), 0);
 const totalFees = cryptoWithdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);

 const markupPrice = getMarkupPrice(selectedAsset.id);
 const numAmount = parseFloat(amount) || 0;
 const fee = numAmount > 0 ? numAmount * 0.05 + 5 : 0;
 const netAmount = numAmount > fee ? numAmount - fee : 0;
 const cryptoAmount = markupPrice && markupPrice.brl > 0 ? netAmount / markupPrice.brl : 0;

 const filtered = useMemo(() => {
 if (!search) return cryptoWithdrawals;
 const q = search.toLowerCase();
 return cryptoWithdrawals.filter(w => w.id.toLowerCase().includes(q) || (w as any).crypto_currency?.toLowerCase().includes(q));
 }, [cryptoWithdrawals, search]);

  return (
    <div className="mx-auto w-full max-w-[1480px] pb-20 px-5 sm:px-8 mt-6 relative">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
        className="relative mb-14 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm overflow-hidden">

 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-warning/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-info/6 rounded-full blur-[160px]" />
 <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 {/* Top controls */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-14">
 <div className="flex items-center gap-3">
 <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="inline-flex items-center gap-2.5">
 <div className="h-9 w-9 rounded-xl bg-warning/10 border border-warning/15 flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(234,179,8,0.15)" }}>
 <Wallet className="h-4.5 w-4.5 text-warning" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80 block leading-tight">Saques Crypto</span>
 </motion.div>
 {pending.length > 0 && (
 <div className="inline-flex items-center gap-2 rounded-full border border-warning/15 bg-warning/5 px-3 py-1.5 backdrop-blur-sm">
 <span className="relative flex h-2 w-2"><span className="absolute h-full w-full rounded-full bg-warning pulse-ring" /><span className="absolute h-full w-full animate-ping rounded-full bg-warning opacity-30" /><span className="relative h-2 w-2 rounded-full bg-warning" /></span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-warning">{pending.length} Pendente{pending.length > 1 ? "s" : ""}</span>
 </div>
 )}
 </div>
 <div className="flex items-center gap-1.5">
 <button onClick={toggleHidden} className={cn("h-8 w-8 rounded-full transition-all active:scale-[0.97] border border-transparent hover:border-border/10", hidden ? "text-primary bg-primary/8" : "text-muted-foreground/25 hover:text-foreground")}>
 {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
 </button>
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <button className={cn("h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.97] transition-all duration-300")}>
 <Plus className="h-3.5 w-3.5" /> Novo Saque Crypto
 </button>
 </DialogTrigger>
 <DialogContent className="max-w-lg rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
 <div className="px-6 pt-6 pb-4 border-b border-border/15">
 <DialogHeader>
 <DialogTitle className="font-display font-black text-lg tracking-[-0.03em] flex items-center gap-2.5">
 <div className="h-10 w-10 rounded-xl bg-warning/10 ring-1 ring-warning/15 flex items-center justify-center">
 <ArrowDownToLine className="h-4 w-4 text-warning" />
 </div>
 Saque Crypto
 </DialogTitle>
 </DialogHeader>
 </div>
 <form onSubmit={handleSubmit} className="space-y-4 p-6">
 {/* Asset Selection */}
 <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
 <div className="pl-1.5">
 <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Moeda</Label>
 <div className="mt-2.5 grid grid-cols-3 gap-2">
 {CRYPTO_ASSETS.map(asset => {
 const mp = getMarkupPrice(asset.id);
 return (
 <button key={asset.id} type="button" onClick={() => handleSelectAsset(asset)} className={cn(
 "relative flex flex-col items-center gap-1.5 p-3.5 rounded-xl border transition-all duration-300",
 selectedAsset.id === asset.id ? "border-primary/20 bg-primary/5 ring-1 ring-primary/10" : "border-border/15 bg-muted/5 hover:border-border/30"
 )}>
 <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg" style={{ backgroundColor: asset.color, boxShadow: `0 4px 14px ${asset.color}30` }}>
 {asset.symbol.charAt(0)}
 </div>
 <div className="text-center">
 <p className="text-[12px] font-bold text-foreground">{asset.symbol}</p>
 <p className="text-[9px] text-muted-foreground/40">{asset.name}</p>
 </div>
 {mp && (
 <div className="text-center">
 <p className="text-[10px] font-display font-bold text-foreground tabular-nums">{fmt(mp.brl)}</p>
 <p className={cn("text-[9px] font-bold", mp.brl_24h_change >= 0 ? "text-success" : "text-destructive")}>
 {mp.brl_24h_change >= 0 ? "+" : ""}{mp.brl_24h_change.toFixed(1)}%
 </p>
 </div>
 )}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Network */}
 <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
 <div className="pl-1.5">
 <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em] flex items-center gap-1.5"><Globe className="h-3 w-3" /> Rede ({selectedAsset.symbol})</Label>
 <div className="mt-2.5 flex flex-wrap gap-1.5">
 {selectedAsset.networks.map(net => (
 <button key={net.id} type="button" onClick={() => setSelectedNetwork(net)} className={cn(
 "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-300 text-[11px] font-bold",
 selectedNetwork.id === net.id ? "border-primary/20 bg-primary/10 text-primary ring-1 ring-primary/10" : "border-border/15 bg-muted/5 text-muted-foreground/40 hover:border-border/30"
 )}>
 <span className={cn("h-1.5 w-1.5 rounded-full", selectedNetwork.id === net.id ? "bg-primary" : "bg-muted-foreground/20")} />
 <span className="text-[10px] opacity-60">{net.shortName}</span>
 <span className="truncate">{net.name}</span>
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Address */}
 <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
 <div className="pl-1.5">
 <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em] flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Endereço da Carteira</Label>
 <p className="text-[9px] text-muted-foreground/30 mt-0.5 mb-2">{selectedAsset.symbol} na rede {selectedNetwork.name}</p>
 <Input value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} placeholder={`Cole seu endereço ${selectedAsset.symbol} aqui`} required className="h-11 font-mono text-[12px] rounded-xl bg-muted/5 border-border/15" />
 </div>
 </div>

 {/* Amount */}
 <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 p-4 overflow-hidden hover:border-border/30 transition-all duration-300">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
 <div className="pl-1.5">
 <Label className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.18em]">Valor em BRL (R$)</Label>
 <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required className="mt-1.5 h-14 text-xl font-display font-black rounded-xl bg-muted/5 border-border/15" />
 <div className="flex items-center justify-between mt-2.5">
 <p className="text-[10px] text-muted-foreground/30 font-display font-semibold">Taxa: 5% + R$ 5,00</p>
 {fee > 0 && <p className="text-[11px] font-display font-bold text-warning tabular-nums">- {fmt(fee)}</p>}
 </div>
 {netAmount > 0 && (
 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2 overflow-hidden">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center"><Zap className="h-3 w-3 text-primary" /></div>
 <span className="text-[11px] text-muted-foreground/50 font-display font-semibold">Você receberá</span>
 </div>
 <span className="text-lg font-display font-black text-primary tabular-nums">{fmt(netAmount)}</span>
 </div>
 {markupPrice && markupPrice.brl > 0 && (
 <div className="flex items-center justify-between pt-2 border-t border-primary/10">
 <div>
 <span className="text-[11px] text-muted-foreground/40 block font-display">Cotação aplicada</span>
 <span className="text-[9px] text-muted-foreground/20 font-display">Atualizada ao vivo</span>
 </div>
 <div className="text-right">
 <span className="text-[14px] font-mono font-bold" style={{ color: selectedAsset.color }}>
 {cryptoAmount < 0.0001 ? cryptoAmount.toFixed(8) : cryptoAmount < 1 ? cryptoAmount.toFixed(6) : cryptoAmount.toFixed(4)} {selectedAsset.symbol}
 </span>
 <span className="text-[9px] text-muted-foreground/30 block font-mono">1 {selectedAsset.symbol} = {fmt(markupPrice.brl)}</span>
 </div>
 </div>
 )}
 </motion.div>
 )}
 </div>
 </div>

 {/* Limit */}
 <div className="p-3.5 rounded-xl bg-warning/5 border border-warning/15 flex items-start gap-2.5">
 <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
 <div className="text-[11px] text-muted-foreground/40 space-y-0.5">
 <p className="font-bold text-foreground/70">Limite: {fmt(dailyLimit)}{hasCompletedCrypto ? " / dia" : " (primeiro saque)"}</p>
 <p>Após o primeiro saque, limite diário de R$ 6.000,00.</p>
 </div>
 </div>

 <button type="submit" className={cn(
 "w-full h-11 rounded-xl text-[12px] font-display font-bold flex items-center justify-center gap-2",
 "gradient-primary text-primary-foreground shadow-lg shadow-primary/20",
 "hover:shadow-xl active:scale-[0.985] transition-all duration-300"
 )}>
 <ArrowDownToLine className="h-4 w-4" /> Solicitar Saque Crypto
 </button>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {/* MAIN FOCAL — Total */}
 <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="mb-10">
 <div className="flex items-center gap-3 mb-5">
 <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-warning/40 to-transparent" />
 <p className="text-[10px] font-heading uppercase tracking-[0.3em] text-gradient-premium">Total Sacado em Crypto</p>
 <div className="h-px flex-1 max-w-[48px] bg-gradient-to-l from-warning/40 to-transparent" />
 </div>
 <div className="flex items-end gap-5 mb-3">
 <motion.span className="text-5xl sm:text-7xl lg:text-[100px] font-heading tabular-nums text-foreground leading-[0.82] [text-shadow:0_0_120px_hsl(var(--primary)/0.3),0_0_60px_hsl(var(--primary)/0.1)]" initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
 {hidden ? "R$ •••••••" : <AnimatedNumber value={totalApproved} />}
 </motion.span>
 </div>
 <div className="flex flex-wrap items-center gap-2.5 mt-6">
 {[
 { icon: CheckCircle2, text: `${approved.length} aprovados`, iconColor: "text-success" },
 { icon: Banknote, text: `solicitado ${hidden ? HIDE : fmtCompact(totalRequested)}` },
 { icon: Percent, text: `taxas ${hidden ? HIDE : fmtCompact(totalFees)}`, iconColor: "text-warning" },
 ].map((chip, i) => (
 <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3.5 py-1.5">
 <chip.icon className={cn("h-3 w-3", chip.iconColor)} /> {chip.text}
 </motion.span>
 ))}
 </div>
 </motion.div>

 {/* Live Prices Strip */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
 {CRYPTO_ASSETS.map((asset, idx) => {
 const mp = getMarkupPrice(asset.id);
 const rawPrice = prices[asset.id];
 return (
 <motion.div key={asset.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }} className="group relative rounded-2xl border border-border/60 bg-card shadow-sm p-5 overflow-hidden">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full" style={{ backgroundColor: asset.color }} />
 <div className={cn("absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[50px] pointer-events-none")} style={{ backgroundColor: `${asset.color}18` }} />
 <div className="relative z-10">
 <div className="flex items-center gap-3 mb-3 pl-1">
 <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg" style={{ backgroundColor: asset.color, boxShadow: `0 4px 14px ${asset.color}25` }}>
 {asset.symbol.charAt(0)}
 </div>
 <div className="min-w-0">
 <p className="text-[13px] font-display font-bold text-foreground">{asset.symbol}</p>
 <p className="text-[10px] text-muted-foreground/30">{asset.name}</p>
 </div>
 {rawPrice && (
 <div className={cn("ml-auto px-2 py-0.5 rounded-lg text-[10px] font-bold border", rawPrice.brl_24h_change >= 0 ? "bg-success/8 text-success border-success/10" : "bg-destructive/8 text-destructive border-destructive/10")}>
 {rawPrice.brl_24h_change >= 0 ? "+" : ""}{rawPrice.brl_24h_change.toFixed(1)}%
 </div>
 )}
 </div>
 {mp ? (
 <div className="pl-1">
 <p className="text-2xl font-heading tabular-nums text-foreground tracking-tight">{hidden ? HIDE : fmt(mp.brl)}</p>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-[11px] text-muted-foreground/30 font-mono tabular-nums">{hidden ? HIDE : fmtUSD(mp.usd)}</p>
 <div className="flex items-center gap-1">
 <Radio className="h-2.5 w-2.5 text-success animate-pulse" />
 <span className="text-[9px] text-success font-bold">Ao vivo</span>
 </div>
 </div>
 </div>
 ) : (
 <div className="h-10 flex items-center pl-1"><div className="h-4 w-28 rounded bg-muted/20 animate-pulse" /></div>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 </motion.section>

 {/* ════════════════════════════════════════════════════════════════ */}
 {/* KPIs */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <section className="mb-10 grid grid-cols-2 lg:grid-cols-3 gap-3">
 <GlowCard glowColor="primary" delay={0} animated className="p-5 shimmer">
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110", "bg-primary/10 border-primary/12 text-primary")}>
 <Wallet className="h-5 w-5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">Total Sacado</p>
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{hidden ? HIDE : <AnimatedNumber value={totalApproved} />}</span>
 <p className="text-[10px] text-muted-foreground/25 font-display mt-2">{approved.length} saques aprovados</p>
 </GlowCard>

 <GlowCard glowColor="warning" delay={0.08} animated className="p-5 shimmer">
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110", "bg-warning/10 border-warning/12 text-warning")}>
 <Clock className="h-5 w-5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">Pendentes</p>
 <div className="flex items-center gap-2">
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{pending.length}</span>
 {pending.length > 0 && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-warning" /></span>}
 </div>
 <p className="text-[10px] text-muted-foreground/25 font-display mt-2">saques em análise</p>
 </GlowCard>

 <GlowCard glowColor="destructive" delay={0.16} animated className="p-5 shimmer col-span-2 lg:col-span-1">
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110", "bg-destructive/10 border-destructive/12 text-destructive")}>
 <AlertTriangle className="h-5 w-5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">Limite Diário</p>
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{hidden ? HIDE : fmt(dailyLimit)}</span>
 <p className="text-[10px] text-muted-foreground/25 font-display mt-2">{hasCompletedCrypto ? "Limite diário ativo" : "Primeiro saque (limite reduzido)"}</p>
 </GlowCard>
 </section>

 {/* ════════════════════════════════════════════════════════════════ */}
 {/* TABLE */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
 <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between mb-5">
 <div className="flex items-center gap-3">
 <div className="h-8 w-8 rounded-xl bg-card/50 border border-border/10 flex items-center justify-center">
 <Layers className="h-4 w-4 text-muted-foreground/40" />
 </div>
 <h2 className="text-sm font-heading text-foreground/80 uppercase tracking-[0.1em]">Histórico Crypto</h2>
 </div>
 <div className="relative w-full xl:w-80">
 <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
 <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ID ou moeda…"
 className="h-10 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-12 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display" />
 {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>}
 </div>
 </div>

 {/* Desktop Table */}
 <div className="hidden md:block rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
  <thead className="bg-muted/30">
  <tr className="border-b border-border/60">
  {["ID", "Moeda", "Rede", "Valor", "Taxa", "Líquido", "Status", "Data"].map(h => (
  <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{h}</th>
  ))}
  </tr>
  </thead>
 <tbody>
 {filtered.length === 0 ? (
 <tr><td colSpan={8} className="py-16 text-center">
 <div className="flex flex-col items-center gap-3">
 <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center"><Wallet className="h-7 w-7 text-muted-foreground/8" /></div>
 <p className="text-[12px] text-muted-foreground/20 font-display font-semibold">Nenhum saque crypto</p>
 <p className="text-[10px] text-muted-foreground/12 font-display">Solicite seu primeiro saque em criptomoeda</p>
 </div>
 </td></tr>
 ) : filtered.map((w, i) => {
 const wa = w as any;
 const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
 const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
 return (
 <motion.tr key={w.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }} className="group border-b border-border/[0.04] transition-all duration-200">
 <td className="py-4 px-4"><span className="font-mono text-[10px] text-muted-foreground/25 bg-muted/8 px-2 py-0.5 rounded-md">{w.id.slice(0, 8)}</span></td>
 <td className="py-4 px-4">
 <div className="flex items-center gap-2">
 {asset && <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-md" style={{ backgroundColor: asset.color }}>{asset.symbol.charAt(0)}</div>}
 <span className="font-display font-bold text-[12px] text-foreground">{wa.crypto_currency || "—"}</span>
 </div>
 </td>
 <td className="py-4 px-4"><span className="text-[11px] text-muted-foreground/30 font-display">{wa.crypto_network || "—"}</span></td>
 <td className="py-4 px-4"><span className="font-display font-black text-foreground text-[14px] tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</span></td>
 <td className="py-4 px-4"><span className="font-display font-bold text-warning/70 text-[12px] tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</span></td>
 <td className="py-4 px-4"><span className="font-display font-black text-primary text-[14px] tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</span></td>
 <td className="py-4 px-4">
  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-[-0.005em] border", st.fg, st.bg, st.border)}>
  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot, w.status === "pending" && "animate-pulse")} />
  {st.label}
  </span>
 </td>
 <td className="py-4 px-4">
 <div className="flex flex-col">
 <span className="text-[11px] text-muted-foreground/35 tabular-nums font-mono">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
 <span className="text-[9px] text-muted-foreground/20 tabular-nums font-mono">{new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
 </div>
 </td>
 </motion.tr>
 );
 })}
 </tbody>
 </table>
 </div>
 <div className="flex items-center justify-between px-4 py-3 border-t border-border/[0.06]">
 <p className="text-[10px] font-display font-bold text-muted-foreground/20">{filtered.length} saque{filtered.length !== 1 ? "s" : ""}</p>
 {filtered.length > 0 && <p className="text-[10px] font-display font-bold text-primary/50 tabular-nums">{hidden ? HIDE : fmt(filtered.reduce((a, w) => a + Number(w.net_amount), 0))} líquido</p>}
 </div>
 </div>

 {/* Mobile Cards */}
 <div className="md:hidden space-y-2">
 {filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 gap-3">
 <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center"><Wallet className="h-7 w-7 text-muted-foreground/8" /></div>
 <p className="text-[12px] text-muted-foreground/20 font-display font-semibold">Nenhum saque crypto</p>
 </div>
 ) : filtered.map((w, i) => {
 const wa = w as any;
 const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
 const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
 return (
 <motion.div key={w.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.15), ease: [0.16, 1, 0.3, 1] }}
 className="rounded-2xl bg-card/50 backdrop-blur-lg border border-border/10 p-4 active:scale-[0.985] transition-all hover:border-primary/15 hover:shadow-lg hover:shadow-primary/5">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 {asset && <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md" style={{ backgroundColor: asset.color }}>{asset.symbol.charAt(0)}</div>}
 <div>
 <p className="text-xl font-display font-black text-foreground tabular-nums tracking-tight leading-none">{hidden ? HIDE : fmt(Number(w.amount))}</p>
 <p className="text-[10px] text-muted-foreground/30 font-display mt-0.5">{wa.crypto_currency} · {wa.crypto_network}</p>
 </div>
 </div>
 <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-display font-bold shrink-0 border", st.fg, st.bg, st.border)}>
 {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
 {st.label}
 </span>
 </div>
 <div className="flex items-end justify-between pt-3 border-t border-border/6">
 <div className="flex items-center gap-5">
 <div>
 <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Taxa</p>
 <p className="text-warning/60 font-display font-bold text-[11px] mt-0.5 tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</p>
 </div>
 <div>
 <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold">Líquido</p>
 <p className="text-primary font-display font-black text-[13px] mt-0.5 tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</p>
 </div>
 </div>
 <span className="text-muted-foreground/20 text-[10px] font-display tabular-nums">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
 </div>
 {wa.crypto_address && (
 <div className="mt-3 pt-3 border-t border-border/6">
 <p className="text-[8px] text-muted-foreground/20 uppercase tracking-[0.18em] font-display font-bold mb-1">Endereço</p>
 <p className="font-mono text-[10px] text-muted-foreground/30 break-all">{wa.crypto_address}</p>
 </div>
 )}
 </motion.div>
 );
 })}
 </div>
 </motion.section>

 {/* Security Footer */}
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10">
 <GlowCard glowColor="success" delay={0.4} className="p-5">
 <div className="space-y-2.5">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-success/8 ring-1 ring-success/10 flex items-center justify-center shrink-0">
 <Shield className="h-4 w-4 text-success/60" />
 </div>
 <p className="text-[10px] text-muted-foreground/30 font-display font-semibold">
 Saques crypto são processados manualmente. Taxa de 5% + R$ 5,00 por operação.
 </p>
 </div>
 <div className="flex items-center gap-3 pl-12">
 <Info className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />
 <p className="text-[10px] text-muted-foreground/20 font-display">
 Primeiro saque: limite R$ 500. Após aprovação, limite diário de R$ 6.000. Cotações via CoinGecko com spread operacional.
 </p>
 </div>
 </div>
 </GlowCard>
 </motion.div>
 </div>
 );
}

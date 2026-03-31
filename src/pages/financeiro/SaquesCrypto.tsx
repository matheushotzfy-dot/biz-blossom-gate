import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Clock, CheckCircle2, XCircle, Shield, Zap,
  Wallet, AlertTriangle, Info, Globe, Link2, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtUSD = (v: number) => `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CoinPrice { brl: number; usd: number; brl_24h_change: number; }

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

  const markupPrice = getMarkupPrice(selectedAsset.id);
  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount > 0 ? numAmount * 0.05 + 5 : 0;
  const netAmount = numAmount > fee ? numAmount - fee : 0;
  const cryptoAmount = markupPrice && markupPrice.brl > 0 ? netAmount / markupPrice.brl : 0;

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Wallet className="h-6 w-6" />} title="Saques Crypto" subtitle="Solicite saques em BTC, USDT ou XMR" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl h-10 text-sm font-bold shadow-lg shadow-primary/20">
              <ArrowDownToLine className="h-4 w-4" /> Novo Saque Crypto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-border/30">
              <DialogHeader>
                <DialogTitle className="font-display font-black text-lg tracking-tight flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                    <ArrowDownToLine className="h-4.5 w-4.5 text-primary" />
                  </div>
                  Saque Crypto
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Asset Selection */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Moeda</Label>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {CRYPTO_ASSETS.map(asset => {
                    const mp = getMarkupPrice(asset.id);
                    return (
                      <button
                        key={asset.id} type="button" onClick={() => handleSelectAsset(asset)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 p-3.5 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                          selectedAsset.id === asset.id
                            ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5 ring-1 ring-primary/20"
                            : "border-border/30 bg-card/50 hover:border-border/50 hover:bg-muted/20"
                        )}
                      >
                        <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                          style={{ backgroundColor: asset.color, boxShadow: `0 4px 14px ${asset.color}30` }}>
                          {asset.symbol.charAt(0)}
                        </div>
                        <div className="text-center">
                          <p className="text-[12px] font-bold text-foreground">{asset.symbol}</p>
                          <p className="text-[9px] text-muted-foreground">{asset.name}</p>
                        </div>
                        {mp && (
                          <div className="text-center">
                            <p className="text-[10px] font-numbers font-bold text-foreground">{fmt(mp.brl)}</p>
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

              {/* Network Selection */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Rede ({selectedAsset.symbol})
                </Label>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedAsset.networks.map(net => (
                    <button key={net.id} type="button" onClick={() => setSelectedNetwork(net)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] text-[11px] font-bold",
                        selectedNetwork.id === net.id
                          ? "border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm"
                          : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50 hover:bg-muted/20"
                      )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", selectedNetwork.id === net.id ? "bg-primary" : "bg-muted-foreground/30")} />
                      <span className="text-[10px] opacity-60">{net.shortName}</span>
                      <span className="truncate">{net.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" /> Endereço da Carteira
                </Label>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5 mb-2">{selectedAsset.symbol} na rede {selectedNetwork.name}</p>
                <Input value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder={`Cole seu endereço ${selectedAsset.symbol} aqui`} required
                  className="h-11 font-mono text-[12px] rounded-xl border-border/40 bg-card/80" />
              </div>

              {/* Amount */}
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Valor em BRL (R$)</Label>
                <Input type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00" required className="mt-1.5 h-14 text-xl font-numbers font-black rounded-xl bg-card/80 border-border/40" />
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11px] text-muted-foreground/70">Taxa: 5% + R$ 5,00</p>
                  {fee > 0 && <p className="text-[12px] font-numbers font-bold text-warning">- {fmt(fee)}</p>}
                </div>

                {netAmount > 0 && (
                  <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                          <Zap className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-[12px] text-muted-foreground font-medium">Você receberá</span>
                      </div>
                      <span className="text-lg font-numbers font-black text-primary">{fmt(netAmount)}</span>
                    </div>
                    {markupPrice && markupPrice.brl > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Cotação aplicada</span>
                          <span className="text-[9px] text-muted-foreground/50">Atualizada ao vivo</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[14px] font-mono font-bold" style={{ color: selectedAsset.color }}>
                            {cryptoAmount < 0.0001 ? cryptoAmount.toFixed(8) : cryptoAmount < 1 ? cryptoAmount.toFixed(6) : cryptoAmount.toFixed(4)} {selectedAsset.symbol}
                          </span>
                          <span className="text-[9px] text-muted-foreground/50 block">1 {selectedAsset.symbol} = {fmt(markupPrice.brl)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Limit info */}
              <div className="p-3.5 rounded-xl bg-warning/5 border border-warning/15 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p className="font-bold text-foreground">Limite: {fmt(dailyLimit)}{hasCompletedCrypto ? " / dia" : " (primeiro saque)"}</p>
                  <p>Após o primeiro saque, limite diário de R$ 6.000,00.</p>
                  <p>Saques crypto são processados manualmente.</p>
                </div>
              </div>

              <Button type="submit" className="w-full font-bold h-11 rounded-xl text-sm shadow-lg shadow-primary/20">
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque Crypto
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Live Prices (with markup) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CRYPTO_ASSETS.map((asset, i) => {
          const mp = getMarkupPrice(asset.id);
          const rawPrice = prices[asset.id];
          return (
            <motion.div key={asset.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full" style={{ backgroundColor: asset.color }} />
              <div className="flex items-center gap-3 mb-3 pl-1">
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg"
                  style={{ backgroundColor: asset.color, boxShadow: `0 4px 14px ${asset.color}25` }}>
                  {asset.symbol.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground">{asset.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{asset.name}</p>
                </div>
                {rawPrice && (
                  <div className={cn("ml-auto px-2 py-0.5 rounded-lg text-[10px] font-bold",
                    rawPrice.brl_24h_change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {rawPrice.brl_24h_change >= 0 ? "+" : ""}{rawPrice.brl_24h_change.toFixed(1)}%
                  </div>
                )}
              </div>
              {mp ? (
                <div className="pl-1">
                  <p className="text-2xl font-numbers font-black text-foreground tracking-tight">{fmt(mp.brl)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-muted-foreground font-numbers">{fmtUSD(mp.usd)}</p>
                    <div className="flex items-center gap-1">
                      <Radio className="h-2.5 w-2.5 text-success animate-pulse" />
                      <span className="text-[9px] text-success font-bold">Ao vivo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-10 flex items-center pl-1"><div className="h-4 w-28 rounded bg-muted/50 animate-pulse" /></div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Total Sacado</span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-numbers font-black text-foreground tracking-tight">{fmt(totalApproved)}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">{approved.length} saques aprovados</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
          className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Pendentes</span>
            <div className="h-9 w-9 rounded-xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-numbers font-black text-foreground tracking-tight">{pending.length}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium flex items-center gap-1.5">
            {pending.length > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
            )}
            saques em análise
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }}
          className="relative col-span-2 lg:col-span-1 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-destructive" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Limite Diário</span>
            <div className="h-9 w-9 rounded-xl bg-destructive/10 ring-1 ring-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-numbers font-black text-foreground tracking-tight">{fmt(dailyLimit)}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">
            {hasCompletedCrypto ? "Limite diário ativo" : "Primeiro saque (limite reduzido)"}
          </p>
        </motion.div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden shadow-sm">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/5">
                  {["ID", "Moeda", "Rede", "Valor", "Taxa", "Líquido", "Status", "Data"].map(h => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {cryptoWithdrawals.length === 0 ? (
                  <tr><td colSpan={8}>
                    <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque crypto" subtitle="Solicite seu primeiro saque em criptomoeda" />
                  </td></tr>
                ) : cryptoWithdrawals.map((w, i) => {
                  const wa = w as any;
                  const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
                  return (
                    <motion.tr key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                      className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-mono text-[11px] text-muted-foreground/60">{w.id.slice(0, 8)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {asset && (
                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ backgroundColor: asset.color }}>{asset.symbol.charAt(0)}</div>
                          )}
                          <span className="font-bold text-[12px] text-foreground">{wa.crypto_currency || "—"}</span>
                        </div>
                      </td>
                      <td className="p-4 text-[11px] text-muted-foreground font-medium">{wa.crypto_network || "—"}</td>
                      <td className="p-4 font-numbers font-black text-foreground text-[15px]">{fmt(Number(w.amount))}</td>
                      <td className="p-4 text-warning font-numbers font-bold text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                      <td className="p-4 text-primary font-numbers font-black text-[15px]">{fmt(Number(w.net_amount))}</td>
                      <td className="p-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                          w.status === "approved" && "bg-success/10 text-success",
                          w.status === "pending" && "bg-warning/10 text-warning",
                          w.status === "rejected" && "bg-destructive/10 text-destructive",
                        )}>
                          {w.status === "pending" && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                            </span>
                          )}
                          {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                          {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground/70 text-[12px] font-bold">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {cryptoWithdrawals.length === 0 ? (
          <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque crypto" subtitle="Solicite seu primeiro saque" />
        ) : cryptoWithdrawals.map((w, i) => {
          const wa = w as any;
          const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
          return (
            <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-4 overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                w.status === "approved" ? "bg-success" : w.status === "pending" ? "bg-warning" : "bg-destructive")} />
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {asset && (
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: asset.color }}>{asset.symbol.charAt(0)}</div>
                  )}
                  <div>
                    <p className="text-foreground font-numbers font-black text-xl">{fmt(Number(w.amount))}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{wa.crypto_currency} · {wa.crypto_network}</p>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  w.status === "approved" && "bg-success/10 text-success",
                  w.status === "pending" && "bg-warning/10 text-warning",
                  w.status === "rejected" && "bg-destructive/10 text-destructive",
                )}>
                  {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                  {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/20">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em] font-bold">Taxa</p>
                    <p className="text-warning font-numbers font-bold text-[12px] mt-0.5">- {fmt(Number(w.fee_amount))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em] font-bold">Líquido</p>
                    <p className="text-primary font-numbers font-black text-[14px] mt-0.5">{fmt(Number(w.net_amount))}</p>
                  </div>
                </div>
                <span className="text-muted-foreground/60 text-[11px] font-medium">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {wa.crypto_address && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.14em] font-bold mb-1">Endereço</p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">{wa.crypto_address}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Security footer */}
      <div className="relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-4 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
        <div className="space-y-2.5 pl-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
              <Shield className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-[11px] text-muted-foreground/70 font-medium">
              Saques crypto são processados manualmente. Taxa de 5% + R$ 5,00 por operação.
            </p>
          </div>
          <div className="flex items-center gap-3 pl-11">
            <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <p className="text-[11px] text-muted-foreground/50">
              Primeiro saque: limite R$ 500. Após aprovação, limite diário de R$ 6.000. Cotações via CoinGecko com spread operacional.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

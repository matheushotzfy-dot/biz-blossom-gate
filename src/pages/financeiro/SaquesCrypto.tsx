import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Clock, CheckCircle2, XCircle, Shield, Zap, Copy,
  Wallet, AlertTriangle, Info, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ── Crypto definitions ── */
interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  coingeckoId: string;
  color: string;
  networks: { id: string; name: string; icon: string }[];
}

const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    id: "btc", symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin",
    color: "#F7931A",
    networks: [
      { id: "onchain", name: "Onchain (BTC)", icon: "🔗" },
      { id: "lightning", name: "Lightning Network", icon: "⚡" },
      { id: "liquid", name: "Liquid Network", icon: "💧" },
    ],
  },
  {
    id: "usdt", symbol: "USDT", name: "Tether", coingeckoId: "tether",
    color: "#26A17B",
    networks: [
      { id: "tron", name: "Tron (TRC-20)", icon: "🔴" },
      { id: "polygon", name: "Polygon", icon: "🟣" },
      { id: "arbitrum", name: "Arbitrum One", icon: "🔵" },
      { id: "solana", name: "Solana", icon: "🟢" },
      { id: "optimism", name: "Optimism", icon: "🔴" },
      { id: "near", name: "NEAR Protocol", icon: "⬛" },
      { id: "polkadot", name: "Polkadot", icon: "🩷" },
      { id: "bsc", name: "BNB Smart Chain", icon: "🟡" },
      { id: "ethereum", name: "Ethereum (ERC-20)", icon: "🔷" },
    ],
  },
  {
    id: "xmr", symbol: "XMR", name: "Monero", coingeckoId: "monero",
    color: "#FF6600",
    networks: [
      { id: "monero", name: "Monero Network", icon: "🟠" },
    ],
  },
];

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtUSD = (v: number) => `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface CoinPrice {
  brl: number;
  usd: number;
  brl_24h_change: number;
}

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

  // Fetch crypto prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = CRYPTO_ASSETS.map(a => a.coingeckoId).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl,usd&include_24hr_change=true`
        );
        if (res.ok) {
          const data = await res.json();
          const mapped: Record<string, CoinPrice> = {};
          for (const asset of CRYPTO_ASSETS) {
            const d = data[asset.coingeckoId];
            if (d) {
              mapped[asset.id] = { brl: d.brl || 0, usd: d.usd || 0, brl_24h_change: d.brl_24h_change || 0 };
            }
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

  // Refresh withdrawals
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => refetchWithdrawals(), 30000);
    return () => clearInterval(interval);
  }, [user?.id, refetchWithdrawals]);

  // Filter crypto withdrawals
  const cryptoWithdrawals = useMemo(
    () => withdrawals.filter(w => (w as any).withdrawal_type === "crypto"),
    [withdrawals]
  );

  // Check if first crypto withdrawal
  const hasCompletedCrypto = cryptoWithdrawals.some(w => w.status === "approved");
  const dailyLimit = hasCompletedCrypto ? 6000 : 500;

  const handleSelectAsset = (asset: CryptoAsset) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { toast.error("Valor inválido"); return; }
    if (!cryptoAddress.trim()) { toast.error("Insira o endereço da carteira"); return; }

    const fee = numAmount * 0.07 + 5;
    if (numAmount <= fee) { toast.error(`Valor deve ser maior que a taxa de ${fmt(fee)}`); return; }

    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: numAmount,
      withdrawal_type: "crypto",
      crypto_currency: selectedAsset.symbol,
      crypto_network: selectedNetwork.id,
      crypto_address: cryptoAddress.trim(),
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
  const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);

  const currentPrice = prices[selectedAsset.id];
  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount > 0 ? numAmount * 0.07 + 5 : 0;
  const netAmount = numAmount > fee ? numAmount - fee : 0;
  const cryptoAmount = currentPrice && currentPrice.brl > 0 ? netAmount / currentPrice.brl : 0;

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle
          icon={<Wallet className="h-6 w-6" />}
          title="Saques Crypto"
          subtitle="Solicite saques em BTC, USDT ou XMR"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-lg h-9 text-[12px] font-medium">
              <ArrowDownToLine className="h-3.5 w-3.5" /> Novo Saque Crypto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowDownToLine className="h-4 w-4 text-primary" />
                  </div>
                  Saque Crypto
                </DialogTitle>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {/* Asset Selection */}
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Moeda</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {CRYPTO_ASSETS.map(asset => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleSelectAsset(asset)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                        selectedAsset.id === asset.id
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40"
                      )}
                    >
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: asset.color }}
                      >
                        {asset.symbol.charAt(0)}
                      </div>
                      <div className="text-center">
                        <p className="text-[12px] font-bold">{asset.symbol}</p>
                        <p className="text-[9px] text-muted-foreground">{asset.name}</p>
                      </div>
                      {prices[asset.id] && (
                        <div className="text-center">
                          <p className="text-[10px] font-mono font-semibold text-foreground">
                            {fmt(prices[asset.id].brl)}
                          </p>
                          <p className={cn(
                            "text-[9px] font-bold",
                            prices[asset.id].brl_24h_change >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {prices[asset.id].brl_24h_change >= 0 ? "+" : ""}
                            {prices[asset.id].brl_24h_change.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Network Selection */}
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Rede ({selectedAsset.symbol})
                </Label>
                <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {selectedAsset.networks.map(net => (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => setSelectedNetwork(net)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left text-[11px] font-medium",
                        selectedNetwork.id === net.id
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border/40 bg-muted/10 text-muted-foreground hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <span className="text-sm">{net.icon}</span>
                      <span className="truncate">{net.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Endereço da Carteira ({selectedAsset.symbol} - {selectedNetwork.name})
                </Label>
                <Input
                  value={cryptoAddress}
                  onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder={`Cole seu endereço ${selectedAsset.symbol} aqui`}
                  required
                  className="mt-1.5 h-11 font-mono text-[12px] rounded-lg"
                />
              </div>

              {/* Amount */}
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  Valor em BRL (R$)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                  className="mt-1.5 h-14 text-xl font-display font-bold rounded-lg"
                />
                <div className="flex items-center justify-between mt-2.5">
                  <p className="text-[11px] text-muted-foreground/70">Taxa: 7% + R$ 5,00</p>
                  {fee > 0 && <p className="text-[12px] font-medium text-warning">- {fmt(fee)}</p>}
                </div>

                {netAmount > 0 && (
                  <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[12px] text-muted-foreground">Você receberá</span>
                      </div>
                      <span className="text-lg font-display font-bold text-primary">{fmt(netAmount)}</span>
                    </div>
                    {currentPrice && currentPrice.brl > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                        <span className="text-[11px] text-muted-foreground">≈ em {selectedAsset.symbol}</span>
                        <span className="text-[14px] font-mono font-bold" style={{ color: selectedAsset.color }}>
                          {cryptoAmount < 0.0001
                            ? cryptoAmount.toFixed(8)
                            : cryptoAmount < 1
                            ? cryptoAmount.toFixed(6)
                            : cryptoAmount.toFixed(4)
                          } {selectedAsset.symbol}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Limit info */}
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/10 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">
                    Limite: {fmt(dailyLimit)}{hasCompletedCrypto ? " / dia" : " (primeiro saque)"}
                  </p>
                  <p>Após o primeiro saque, limite diário de R$ 6.000,00.</p>
                  <p>Saques crypto são processados manualmente.</p>
                </div>
              </div>

              <Button type="submit" className="w-full font-medium h-11 rounded-lg text-sm">
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Saque Crypto
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Live Prices */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CRYPTO_ASSETS.map((asset, i) => {
          const price = prices[asset.id];
          return (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: asset.color }}
                >
                  {asset.symbol.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground">{asset.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{asset.name}</p>
                </div>
                {price && (
                  <div className={cn(
                    "ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold",
                    price.brl_24h_change >= 0
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {price.brl_24h_change >= 0 ? "▲" : "▼"} {Math.abs(price.brl_24h_change).toFixed(1)}%
                  </div>
                )}
              </div>
              {price ? (
                <div>
                  <p className="text-2xl font-display font-bold text-foreground tracking-tight">{fmt(price.brl)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmtUSD(price.usd)}</p>
                </div>
              ) : (
                <div className="h-10 flex items-center">
                  <div className="h-4 w-28 rounded bg-muted/50 animate-pulse" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <span className="text-[11px] font-medium text-muted-foreground">Total Sacado (Crypto)</span>
          <p className="text-3xl font-display font-bold text-foreground mt-2 tracking-tight">{fmt(totalApproved)}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">{approved.length} saques aprovados</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <span className="text-[11px] font-medium text-muted-foreground">Pendentes</span>
          <p className="text-2xl font-display font-bold text-foreground mt-2 tracking-tight">{pending.length}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">saques em análise</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }}
          className="col-span-2 lg:col-span-1 rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span className="text-[11px] font-medium text-muted-foreground">Limite Diário</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground tracking-tight">{fmt(dailyLimit)}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {hasCompletedCrypto ? "Limite diário ativo" : "Primeiro saque (limite reduzido)"}
          </p>
        </motion.div>
      </div>

      {/* Crypto Withdrawals Table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 dark:border-foreground/[0.05]">
                {["ID", "Moeda", "Rede", "Valor", "Taxa", "Líquido", "Status", "Data"].map(h => (
                  <th key={h} className="text-left p-4 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 dark:divide-foreground/[0.03]">
              {cryptoWithdrawals.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon={<Wallet className="h-7 w-7" />} title="Nenhum saque crypto" subtitle="Solicite seu primeiro saque em criptomoeda" />
                </td></tr>
              ) : cryptoWithdrawals.map((w, i) => {
                const wa = w as any;
                const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
                return (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                    className="hover:bg-muted/20 dark:hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="p-4 font-mono text-[11px] text-muted-foreground/60">{w.id.slice(0, 8)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {asset && (
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ backgroundColor: asset.color }}
                          >
                            {asset.symbol.charAt(0)}
                          </div>
                        )}
                        <span className="font-bold text-[12px]">{wa.crypto_currency || "—"}</span>
                      </div>
                    </td>
                    <td className="p-4 text-[11px] text-muted-foreground">{wa.crypto_network || "—"}</td>
                    <td className="p-4 font-display font-bold text-foreground text-[15px]">{fmt(Number(w.amount))}</td>
                    <td className="p-4 text-warning font-medium text-[13px]">- {fmt(Number(w.fee_amount))}</td>
                    <td className="p-4 text-primary font-display font-bold text-[15px]">{fmt(Number(w.net_amount))}</td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                        w.status === "approved" && "bg-success/10 text-success",
                        w.status === "pending" && "bg-warning/10 text-warning",
                        w.status === "rejected" && "bg-destructive/10 text-destructive",
                      )}>
                        {w.status === "pending" && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" /></span>}
                        {w.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                        {w.status === "rejected" && <XCircle className="h-3 w-3" />}
                        {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground/70 text-[12px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
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
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {asset && (
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: asset.color }}
                    >
                      {asset.symbol.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-foreground font-display font-bold text-xl">{fmt(Number(w.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{wa.crypto_currency} · {wa.crypto_network}</p>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider",
                  w.status === "approved" && "bg-success/10 text-success",
                  w.status === "pending" && "bg-warning/10 text-warning",
                  w.status === "rejected" && "bg-destructive/10 text-destructive",
                )}>
                  {w.status === "approved" ? "Aprovado" : w.status === "pending" ? "Pendente" : "Recusado"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/20 dark:border-foreground/[0.04]">
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Taxa</p>
                    <p className="text-warning font-medium text-[12px] mt-0.5">- {fmt(Number(w.fee_amount))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Líquido</p>
                    <p className="text-primary font-display font-bold text-[14px] mt-0.5">{fmt(Number(w.net_amount))}</p>
                  </div>
                </div>
                <span className="text-muted-foreground/60 text-[11px]">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {wa.crypto_address && (
                <div className="mt-3 pt-3 border-t border-border/20 dark:border-foreground/[0.04]">
                  <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-medium mb-1">Endereço</p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">{wa.crypto_address}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground/70">
            Saques crypto são processados manualmente. Taxa de 7% + R$ 5,00 por operação.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Info className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground/50">
            Primeiro saque: limite R$ 500. Após aprovação, limite diário de R$ 6.000.
            Cotações atualizadas a cada minuto via CoinGecko.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

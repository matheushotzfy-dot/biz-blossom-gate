import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, useInvalidateAll } from "@/hooks/useQueryData";
import {
  ArrowDownToLine, Clock, Shield, Wallet, AlertTriangle, Globe, Link2,
  Eye, EyeOff, Search, X, Plus, Layers, TrendingUp, Banknote, Percent,
  ArrowUpRight, ArrowDownRight, Bitcoin, ClipboardPaste,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Crypto definitions ── */
interface CryptoNetwork { id: string; name: string; shortName: string; }
interface CryptoAsset { id: string; symbol: string; name: string; coingeckoId: string; tone: string; networks: CryptoNetwork[]; }

const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    id: "btc", symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", tone: "warning",
    networks: [
      { id: "onchain", name: "Bitcoin Onchain", shortName: "BTC" },
      { id: "lightning", name: "Lightning Network", shortName: "LN" },
      { id: "liquid", name: "Liquid Network", shortName: "L-BTC" },
    ],
  },
  {
    id: "usdt", symbol: "USDT", name: "Tether", coingeckoId: "tether", tone: "success",
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
    id: "xmr", symbol: "XMR", name: "Monero", coingeckoId: "monero", tone: "warning",
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

/* Asset glyph — letter inside square tile with semantic tone bg */
function AssetGlyph({ asset, size = 36 }: { asset: CryptoAsset; size?: number }) {
  const toneMap: Record<string, string> = {
    warning: "bg-warning/12 border-warning/30 text-warning",
    success: "bg-success/12 border-success/30 text-success",
    info: "bg-info/12 border-info/30 text-info",
  };
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
 "flex shrink-0 items-center justify-center rounded-lg border font-display font-black tabular-nums",
        toneMap[asset.tone] || toneMap.warning,
      )}
    >
      <span style={{ fontSize: Math.round(size * 0.4) }}>{asset.symbol.slice(0, 1)}</span>
    </div>
  );
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
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });
  const [search, setSearch] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const toggleHidden = useCallback(() => {
    setHidden(p => { const n = !p; try { localStorage.setItem("privacy_mode", String(n)); } catch { /* noop */ } return n; });
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
          setLastUpdate(new Date());
        }
      } catch { /* silent */ }
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
    () => withdrawals.filter(w => w.withdrawal_type === "crypto"),
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
    });
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

  const handlePasteAddress = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) {
        setCryptoAddress(txt.trim());
        toast.success("Endereço colado");
      }
    } catch {
      toast.error("Não foi possível ler a área de transferência");
    }
  };

  const pending = cryptoWithdrawals.filter(w => w.status === "pending");
  const approved = cryptoWithdrawals.filter(w => w.status === "approved");
  const totalApproved = approved.reduce((a, w) => a + Number(w.net_amount), 0);
  const totalRequested = cryptoWithdrawals.reduce((a, w) => a + Number(w.amount), 0);
  const totalFees = cryptoWithdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);
  const avgTicket = approved.length > 0 ? totalApproved / approved.length : 0;
  const networksUsed = new Set(cryptoWithdrawals.map(w => w.crypto_network).filter(Boolean)).size;

  const markupPrice = getMarkupPrice(selectedAsset.id);
  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount > 0 ? numAmount * 0.05 + 5 : 0;
  const netAmount = numAmount > fee ? numAmount - fee : 0;
  const cryptoAmount = markupPrice && markupPrice.brl > 0 ? netAmount / markupPrice.brl : 0;

  const filtered = useMemo(() => {
    if (!search) return cryptoWithdrawals;
    const q = search.toLowerCase();
    return cryptoWithdrawals.filter(w => w.id.toLowerCase().includes(q) || w.crypto_currency?.toLowerCase().includes(q));
  }, [cryptoWithdrawals, search]);

  const ease = "transition-all duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

  return (
    <div
      className="mx-auto w-full max-w-[1480px] pb-24 md:pb-10 antialiased [text-rendering:geometricPrecision] [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]"
      style={{ fontFeatureSettings: '"ss01","cv11","tnum","kern"' }}
    >
      <div className="px-5 pt-4 sm:px-8 sm:pt-6">
        {/* ─────────── HERO ─────────── */}
        <header className="border-b border-border pb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-[13px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Tesouraria · Crypto
              </h1>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <p
                  className={cn(
 "font-display text-[54px] font-black leading-[0.84] tracking-[-0.075em] tabular-nums sm:text-[78px]",
                    hidden ? "text-foreground" : (totalApproved > 0 ? "text-success" : "text-foreground"),
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {hidden ? HIDE : fmt(totalApproved)}
                </p>
                <div className="pb-1.5">
                  <p className="text-[11.5px] font-medium text-muted-foreground">
                    <span className="font-bold text-foreground">{approved.length} {approved.length === 1 ? "saque aprovado" : "saques aprovados"}</span>
                    <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                    Limite diário <span className="font-bold text-foreground tabular-nums">{hidden ? HIDE : fmt(dailyLimit)}</span>
                    <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                    {pending.length > 0 ? `${pending.length} em análise` : "Sem fila"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-1 xl:w-auto xl:justify-end">
              {/* Privacy toggle */}
              <button
                onClick={toggleHidden}
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                className={cn(
 "inline-flex h-8 w-8 items-center justify-center rounded-md border",
                  ease,
 "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                  hidden
                    ? "border-foreground/80 bg-secondary text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {hidden ? <EyeOff className="h-[15px] w-[15px]" strokeWidth={2.1} /> : <Eye className="h-[15px] w-[15px]" strokeWidth={2.1} />}
              </button>

              <span className="hidden h-5 w-px bg-border md:mx-1 md:block" />

              {/* CTA */}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button className={cn(
 "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[11px] font-black tracking-[-0.005em] text-primary-foreground border border-primary/40",
 "hover:bg-primary/90 ",
                    ease,
 "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  )}>
                    <Plus className="h-[14px] w-[14px]" strokeWidth={2.6} />
                    Novo saque crypto
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[460px] rounded-[12px] border border-border bg-card p-0 overflow-hidden max-h-[92vh] overflow-y-auto">
                  <div className="px-6 pt-6 pb-4 border-b border-border">
                    <DialogHeader>
                      <DialogTitle className="font-display font-black text-[15px] tracking-[-0.02em] flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <ArrowDownToLine className="h-4 w-4 text-primary" strokeWidth={2.5} />
                        </div>
                        Solicitar Saque Crypto
                      </DialogTitle>
                    </DialogHeader>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    {/* Asset selector */}
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Moeda</Label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {CRYPTO_ASSETS.map(asset => {
                          const isSel = selectedAsset.id === asset.id;
                          const mp = getMarkupPrice(asset.id);
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => handleSelectAsset(asset)}
                              className={cn(
 "relative flex flex-col items-center gap-2 p-3 rounded-xl border bg-background text-center",
                                ease,
                                isSel
                                  ? "border-primary/50 bg-primary/5"
                                  : "border-border hover:border-foreground/30",
                              )}
                            >
                              <AssetGlyph asset={asset} size={36} />
                              <div>
                                <p className="font-display text-[12px] font-black text-foreground">{asset.symbol}</p>
                                <p className="text-[9.5px] text-muted-foreground font-medium">{asset.name}</p>
                              </div>
                              {mp && (
                                <p className="font-mono text-[10px] font-bold text-muted-foreground tabular-nums">
                                  {fmtCompact(mp.brl)}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Network */}
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                        <Globe className="h-3 w-3" /> Rede · {selectedAsset.symbol}
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedAsset.networks.map(net => {
                          const isSel = selectedNetwork.id === net.id;
                          return (
                            <button
                              key={net.id}
                              type="button"
                              onClick={() => setSelectedNetwork(net)}
                              className={cn(
 "inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-bold",
                                ease,
                                isSel
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-primary" : "bg-muted-foreground/40")} />
                              <span className="font-mono text-[10px] opacity-80">{net.shortName}</span>
                              <span>{net.name.replace(`(${net.shortName})`, "").trim()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                        <Link2 className="h-3 w-3" /> Endereço da carteira
                      </Label>
                      <div className="relative mt-2">
                        <Input
                          value={cryptoAddress}
                          onChange={(e) => setCryptoAddress(e.target.value)}
                          placeholder={`Cole seu endereço ${selectedAsset.symbol}`}
                          required
                          className={cn(
 "h-11 pr-20 font-mono text-[11.5px] rounded-xl border border-border bg-background",
                            ease,
                          )}
                        />
                        <button
                          type="button"
                          onClick={handlePasteAddress}
                          className={cn(
 "absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-secondary border border-border text-[10px] font-black uppercase tracking-[0.12em] text-foreground/80",
 "hover:bg-muted active:scale-95",
                            ease,
                          )}
                        >
                          <ClipboardPaste className="h-3 w-3" /> Colar
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-medium">
                        {selectedNetwork.name} · Verifique antes de enviar — saques crypto são irreversíveis.
                      </p>
                    </div>

                    {/* Amount */}
                    <div>
                      <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Valor em BRL</Label>
                      <div className="relative mt-2">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-[15px] font-black text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0,00"
                          required
                          className={cn(
 "h-14 pl-12 font-display text-[22px] font-black tabular-nums tracking-[-0.02em] rounded-xl border border-border bg-background",
                            ease,
                          )}
                          style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                        />
                      </div>

                      {/* Breakdown */}
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Valor solicitado</span>
                          <span className="font-display font-bold tabular-nums text-foreground">{fmt(numAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Taxa · 5% + R$ 5,00</span>
                          <span className="font-display font-bold tabular-nums text-warning">- {fmt(fee)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-border">
                          <span className="text-[11px] font-bold text-foreground/80">Você receberá</span>
                          <div className="text-right">
                            <p className="font-display text-[16px] font-black tabular-nums text-success leading-none">{fmt(netAmount)}</p>
                            {markupPrice && markupPrice.brl > 0 && cryptoAmount > 0 && (
                              <p className="font-mono text-[10px] text-muted-foreground tabular-nums mt-0.5">
                                ≈ {cryptoAmount < 0.0001 ? cryptoAmount.toFixed(8) : cryptoAmount < 1 ? cryptoAmount.toFixed(6) : cryptoAmount.toFixed(4)} {selectedAsset.symbol}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Irreversibility warning */}
                    <div className="p-3 rounded-lg border border-warning/30 bg-warning/8 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div className="text-[11px] text-foreground/80 space-y-0.5">
                        <p className="font-bold text-foreground">Operação irreversível</p>
                        <p className="font-medium text-muted-foreground">
                          Limite: {fmt(dailyLimit)}{hasCompletedCrypto ? " / dia" : " (primeiro saque)"}. Confira a rede e o endereço antes de confirmar.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={numAmount <= fee || !cryptoAddress.trim()}
                      className={cn(
 "w-full h-12 rounded-xl font-display font-black text-[12px] uppercase tracking-[0.14em] flex items-center justify-center gap-2",
 "bg-primary text-primary-foreground border border-primary/40",
 "hover:bg-primary/90 ",
                        ease,
 "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
                      )}
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                      Confirmar saque de {fmt(netAmount)}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Processamento manual · Aprovação em até 24h úteis
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-8 grid grid-cols-1 border-y border-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
            {[
              { label: "Total Sacado", value: hidden ? HIDE : fmtCompact(totalApproved), sub: `${approved.length} ${approved.length === 1 ? "operação" : "operações"}`, accent: "text-foreground" },
              { label: "Ticket Médio", value: hidden ? HIDE : fmtCompact(avgTicket), sub: avgTicket > 0 ? "Por saque aprovado" : "Sem dados", accent: "text-foreground" },
              { label: "Total em Taxas", value: hidden ? HIDE : fmtCompact(totalFees), sub: `${cryptoWithdrawals.length} operações`, accent: "text-warning" },
              { label: "Redes Utilizadas", value: String(networksUsed), sub: networksUsed === 1 ? "rede ativa" : "redes ativas", accent: "text-info" },
            ].map((k, idx) => (
              <div
                key={k.label}
                className={cn(
 "group relative min-h-[140px] px-6 py-6",
                  ease,
 "hover:bg-muted/25",
                  idx === 1 && "sm:border-l border-border lg:border-l",
                  idx === 2 && "border-t border-border sm:border-l sm:border-t-0",
                  idx === 3 && "sm:border-l border-border lg:border-l",
                )}
              >
                <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-muted-foreground">{k.label}</p>
                <p
                  className={cn(
 "mt-3.5 font-display text-[32px] font-black leading-[0.9] tracking-[-0.06em] tabular-nums sm:text-[40px]",
                    k.accent,
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {k.value}
                </p>
                <p className="mt-3 truncate text-[12px] font-semibold text-muted-foreground/85">{k.sub}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Live prices strip */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <h2 className="text-[12px] font-display font-black text-foreground tracking-[-0.01em]">Cotações ao vivo</h2>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium tabular-nums">
              {lastUpdate ? `Atualizado às ${format(lastUpdate, "HH:mm:ss")}` : "Carregando..."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CRYPTO_ASSETS.map((asset) => {
              const mp = getMarkupPrice(asset.id);
              const raw = prices[asset.id];
              const up = raw && raw.brl_24h_change >= 0;
              return (
                <div
                  key={asset.id}
                  className={cn("rounded-xl border border-border bg-card p-4", ease, "hover:border-foreground/30")}
                >
                  <div className="flex items-center gap-3">
                    <AssetGlyph asset={asset} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[13px] font-black text-foreground leading-tight">{asset.symbol}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{asset.name}</p>
                    </div>
                    {raw && (
                      <span className={cn(
 "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums border",
                        up ? "text-success bg-success/10 border-success/25" : "text-destructive bg-destructive/10 border-destructive/25",
                      )}>
                        {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                        {Math.abs(raw.brl_24h_change).toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    {mp ? (
                      <>
                        <p className="font-display text-[22px] font-black tabular-nums tracking-[-0.04em] text-foreground leading-none">
                          {hidden ? HIDE : fmt(mp.brl)}
                        </p>
                        <p className="font-mono text-[10.5px] text-muted-foreground tabular-nums mt-1.5">
                          {hidden ? HIDE : fmtUSD(mp.usd)} · spread 3%
                        </p>
                      </>
                    ) : (
                      <div className="h-12 flex items-center">
                        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* History */}
        <section className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Histórico Crypto</h2>
              <span className="text-[10px] font-black tabular-nums text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{filtered.length}</span>
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ID ou moeda…"
                className={cn(
 "h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground font-medium",
                  ease,
 "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50",
                )}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 active:scale-90">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-left w-[14%]">Identificador</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-left w-[14%]">Moeda</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-left w-[12%]">Rede</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-right w-[12%]">Bruto</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-right w-[10%]">Taxa</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-right w-[14%]">Líquido</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-left w-[12%]">Status</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] text-left w-[12%]">Solicitado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-[12px] bg-muted border border-border flex items-center justify-center">
                          <Bitcoin className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-[12px] text-foreground font-display font-bold">Nenhum saque crypto</p>
                        <p className="text-[10px] text-muted-foreground">Solicite seu primeiro saque em criptomoeda</p>
                      </div>
                    </td></tr>
                  ) : filtered.map((w) => {
                    const wa = w;
                    const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
                    const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={w.id} className={cn("border-b border-border/40 last:border-0", ease, "hover:bg-muted/30 group")}>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] text-foreground/80 font-bold">#{w.id.slice(0, 8)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {asset && <AssetGlyph asset={asset} size={26} />}
                            <span className="font-display text-[12px] font-black text-foreground">{wa.crypto_currency || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-border bg-secondary text-foreground/80">
                            {wa.crypto_network || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-display text-[13px] font-black text-foreground tabular-nums">{hidden ? HIDE : fmt(Number(w.amount))}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-display font-bold text-warning text-[11px] tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-display font-black text-success text-[13px] tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border", st.fg, st.bg, st.border)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-[11px] text-foreground/80 font-medium tabular-nums">{format(new Date(w.created_at), "dd MMM yyyy", { locale: ptBR })}</p>
                          <p className="text-[9px] text-muted-foreground tabular-nums">{format(new Date(w.created_at), "HH:mm")}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
                <p className="text-[11px] font-bold text-muted-foreground">
                  Exibindo <span className="text-foreground tabular-nums">{filtered.length}</span> {filtered.length !== 1 ? "operações" : "operação"}
                </p>
                <p className="text-[11px] font-bold text-muted-foreground">
                  Total líquido: <span className="text-success font-display font-black tabular-nums">{hidden ? HIDE : fmt(filtered.reduce((a, w) => a + Number(w.net_amount), 0))}</span>
                </p>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-14 w-14 rounded-[12px] bg-muted border border-border flex items-center justify-center">
                  <Bitcoin className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-[12px] text-foreground font-display font-bold">Nenhum saque crypto</p>
              </div>
            ) : filtered.map((w) => {
              const wa = w;
              const asset = CRYPTO_ASSETS.find(a => a.symbol === wa.crypto_currency);
              const st = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
              return (
                <div key={w.id} className="p-4 active:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {asset && <AssetGlyph asset={asset} size={36} />}
                      <div>
                        <p className="font-display text-lg font-black text-foreground tabular-nums leading-none">{hidden ? HIDE : fmt(Number(w.amount))}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">{wa.crypto_currency} · {wa.crypto_network}</p>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 h-5 rounded-md text-[9px] font-bold border", st.fg, st.bg, st.border)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-[0.16em] font-bold">Taxa</p>
                        <p className="text-warning font-display font-bold text-[11px] mt-0.5 tabular-nums">{hidden ? HIDE : `- ${fmt(Number(w.fee_amount))}`}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-[0.16em] font-bold">Líquido</p>
                        <p className="text-success font-display font-black text-[13px] mt-0.5 tabular-nums">{hidden ? HIDE : fmt(Number(w.net_amount))}</p>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-[10px] font-medium tabular-nums">{format(new Date(w.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  {wa.crypto_address && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[8px] text-muted-foreground uppercase tracking-[0.18em] font-bold mb-1">Endereço</p>
                      <p className="font-mono text-[10px] text-muted-foreground break-all">{wa.crypto_address}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-success/10 border border-success/25 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-display font-black text-foreground tracking-[-0.01em]">
                Ambiente seguro · Processamento manual com verificação anti-fraude
              </p>
              <p className="text-[10.5px] text-muted-foreground/90 font-medium">
                Taxa de 5% + R$ 5,00 por operação · Primeiro saque limitado a R$ 500 · Após aprovação, limite diário de R$ 6.000.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-success uppercase tracking-[0.16em]">
              <Clock className="h-3 w-3" />
              ATÉ 24H
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

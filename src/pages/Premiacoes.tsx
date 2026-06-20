/**
 * Premiações — Sala de Conquistas HOTZFY
 * Cinematic achievement vault. Dark stage, spotlit plaque, achievement stamps,
 * progress arcs, locked-vault interactions. Solid borders, emerald accents.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, ChevronLeft, ChevronRight, Gift, Sparkles, Crown,
  Flame, Award, Star, Gem, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import heroStage from "@/assets/awards/premiacoes-hero-stage.jpg";
import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

type AwardItem = {
  id: string; value: number; label: string; tier: string; roman: string;
  title: string; description: string; image: string;
  rewards: string[]; phrase: string; ref: string; icon: typeof Trophy;
};

const AWARDS: AwardItem[] = [
  { id: "10k",  roman: "I",   value: 10_000,     label: "R$ 10K",  tier: "Iniciante", title: "Kit Couro & Cartão Black",  description: "Pulseira de couro premium costurada à mão e Cartão Black numerado. Entregue em estojo lacrado.", image: braceletCard, rewards: ["Pulseira de couro premium", "Cartão Black numerado"], phrase: "Toda jornada bilionária começa com a primeira venda.", ref: "HZF-001", icon: Flame },
  { id: "100k", roman: "II",  value: 100_000,    label: "R$ 100K", tier: "Bronze",    title: "Placa Bronze Patinado",     description: "Placa em mármore negro com chapa de bronze envelhecido. Numerada, gravada com o seu nome.",     image: plaque100k,   rewards: ["Placa em bronze numerada"], phrase: "Bronze não é metal — é a prova de que você começou.", ref: "HZF-100", icon: Award },
  { id: "250k", roman: "III", value: 250_000,    label: "R$ 250K", tier: "Prata",     title: "Placa Prata Platinada",     description: "Acabamento prata platinada sobre base em mármore negro. Marco intermediário de prestígio.",       image: plaque250k,   rewards: ["Placa prata platinada"], phrase: "Prata pesa porque foi merecida.", ref: "HZF-250", icon: Star },
  { id: "500k", roman: "IV",  value: 500_000,    label: "R$ 500K", tier: "Ouro 24K",  title: "Placa Ouro 24K",            description: "Banhada a ouro 24K com detalhes em esmeralda. Para sellers que dominaram seu mercado.",         image: plaque500k,   rewards: ["Placa banhada a ouro 24K", "Acesso ao grupo VIP"], phrase: "Ouro não brilha sozinho. Você fez ele brilhar.", ref: "HZF-500", icon: Crown },
  { id: "1m",   roman: "V",   value: 1_000_000,  label: "R$ 1M",   tier: "Diamante",  title: "Placa Diamante",            description: "Cravejada em diamante autêntico. O primeiro milhão registrado em catálogo.",                     image: plaque1m,     rewards: ["Placa cravejada", "Convite Hotzfy Inner Circle"], phrase: "Diamante é carbono que resistiu à pressão.", ref: "HZF-1MM", icon: Gem },
  { id: "5m",   roman: "VI",  value: 5_000_000,  label: "R$ 5M",   tier: "Elite",     title: "Placa Elite Rose Gold",     description: "Rose Gold com diamantes negros. Reservada à elite — menos de 0,5% dos sellers atingem.",         image: plaque5m,     rewards: ["Placa Rose Gold", "Jantar privado com a fundação"], phrase: "Elite não é título — é hábito.", ref: "HZF-5MM", icon: Sparkles },
  { id: "10m",  roman: "VII", value: 10_000_000, label: "R$ 10M",  tier: "Lenda",     title: "Placa Lenda",               description: "Gemas preciosas multicoloridas, peça única numerada, assinada pela fundação HOTZFY.",             image: plaque10m,    rewards: ["Placa Lenda numerada", "Hall of Fame HOTZFY", "Bonificação personalizada"], phrase: "Lendas não morrem. Faturam.", ref: "HZF-10M", icon: Trophy },
];

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}M`
  : v >= 1_000   ? `R$ ${(v / 1_000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

/* ---------- Tilt wrapper ---------- */
function Tilt({ children, intensity = 10, className }: { children: React.ReactNode; intensity?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50, on: false });
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setT({ rx: (0.5 - y) * intensity, ry: (x - 0.5) * intensity, mx: x * 100, my: y * 100, on: true });
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setT((s) => ({ ...s, rx: 0, ry: 0, on: false }))}
      className={cn("relative [perspective:1400px]", className)}
    >
      <div
        className="relative transition-transform duration-300 ease-out [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg)` }}
      >
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: t.on ? 1 : 0,
            background: `radial-gradient(circle at ${t.mx}% ${t.my}%, hsl(var(--primary) / 0.18), transparent 55%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Progress ring ---------- */
function Ring({ value, size = 168, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90 block">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="hsl(var(--primary))" strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
    </svg>
  );
}

/* ---------- Page ---------- */
export default function Premiacoes() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [existingClaims, setExistingClaims] = useState<any[]>([]);
  const [claimForm, setClaimForm] = useState({
    recipient_name: "", phone: "", document: "",
    shipping_street: "", shipping_number: "", shipping_complement: "",
    shipping_neighborhood: "", shipping_city: "", shipping_state: "", shipping_zip: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("net_amount")
      .eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => { if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0)); });
    (supabase as any).from("reward_claims").select("id, tier_id, status").eq("user_id", user.id)
      .then(({ data }: any) => { if (data) setExistingClaims(data); });
  }, [user?.id]);

  const { unlockedCount, nextAward, currentTier, overallProgress, remaining } = useMemo(() => {
    const currentIdx = AWARDS.findIndex((a) => revenue < a.value);
    const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
    const nextAward = currentIdx >= 0 ? AWARDS[currentIdx] : null;
    const currentTier = unlockedCount > 0 ? AWARDS[unlockedCount - 1] : null;
    const overallProgress = (unlockedCount / AWARDS.length) * 100;
    const remaining = nextAward ? nextAward.value - revenue : 0;
    return { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, remaining };
  }, [revenue]);

  const focused = useMemo(() => {
    if (focusId) return AWARDS.find((a) => a.id === focusId) ?? nextAward ?? AWARDS[AWARDS.length - 1];
    return nextAward ?? AWARDS[AWARDS.length - 1];
  }, [focusId, nextAward]);

  const focusedIdx = AWARDS.findIndex((a) => a.id === focused.id);
  const focusedDone = revenue >= focused.value;
  const focusedProgress = Math.min((revenue / focused.value) * 100, 100);
  const alreadyClaimed = existingClaims.some(c => c.tier_id === focused.id && c.status !== "cancelled");
  const FocusedIcon = focused.icon;

  const goPrev = () => setFocusId(AWARDS[Math.max(focusedIdx - 1, 0)].id);
  const goNext = () => setFocusId(AWARDS[Math.min(focusedIdx + 1, AWARDS.length - 1)].id);

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      {/* =================== HERO VAULT =================== */}
      <section className="relative overflow-hidden border border-border bg-[#05070a] text-white">
        {/* Stage backdrop */}
        <div className="absolute inset-0">
          <img src={heroStage} alt="" className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070a]/40 via-[#05070a]/70 to-[#05070a]" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
          {/* Spotlight */}
          <div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 h-[520px] w-[820px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.22), transparent 65%)" }}
          />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />
        </div>

        {/* Top rail */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 sm:px-8 py-3 font-mono text-[10px] uppercase tracking-[0.28em]">
          <span className="text-white/60">HOTZFY · Sala de Conquistas</span>
          <span className="hidden sm:flex items-center gap-2 text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sincronizado · {new Date().toLocaleDateString("pt-BR")}
          </span>
          <span className="text-white tabular-nums">{unlockedCount.toString().padStart(2,"0")} / {AWARDS.length.toString().padStart(2,"0")}</span>
        </div>

        {/* Hero body */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
          {/* Plaque pedestal */}
          <div className="relative px-6 sm:px-10 pt-10 pb-12 flex items-center justify-center min-h-[520px]">
            {/* Nav arrows */}
            <button
              type="button" aria-label="Anterior" onClick={goPrev} disabled={focusedIdx === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 border border-white/15 bg-white/[0.04] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            ><ChevronLeft className="h-4 w-4" strokeWidth={2.25} /></button>
            <button
              type="button" aria-label="Próximo" onClick={goNext} disabled={focusedIdx === AWARDS.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 border border-white/15 bg-white/[0.04] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            ><ChevronRight className="h-4 w-4" strokeWidth={2.25} /></button>

            <Tilt intensity={9} className="w-full max-w-[460px]">
              {/* Plaque frame */}
              <div className="relative aspect-square border border-white/12 bg-[#0a0c10]">
                {/* corner ticks */}
                {[
                  "top-0 left-0", "top-0 right-0 -scale-x-100",
                  "bottom-0 left-0 -scale-y-100", "bottom-0 right-0 -scale-100",
                ].map((p, i) => (
                  <span key={i} className={cn("absolute h-3 w-3 border-l border-t border-white/40 pointer-events-none", p)} />
                ))}

                {/* Lot tag */}
                <div className="absolute top-0 left-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55 border-r border-b border-white/10 bg-[#05070a]/70">
                  Lote {focused.ref}
                </div>

                {/* Status stamp */}
                {focusedDone ? (
                  <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-primary/60 bg-primary/15 text-primary font-mono text-[10px] uppercase tracking-[0.24em]">
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2.75} /> Conquistado
                  </div>
                ) : (
                  <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-white/15 bg-white/[0.04] text-white/70 font-mono text-[10px] uppercase tracking-[0.24em]">
                    <Lock className="h-3 w-3" strokeWidth={2.5} /> Selado
                  </div>
                )}

                {/* Pedestal floor */}
                <div className="absolute inset-x-10 bottom-8 h-10 opacity-60 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.45), transparent 70%)", filter: "blur(18px)" }}
                />

                {/* Plaque image */}
                <div className="absolute inset-0 flex items-center justify-center p-10 [transform:translateZ(40px)]">
                  <img
                    key={focused.id}
                    src={focused.image}
                    alt={focused.title}
                    className={cn(
                      "max-h-[78%] max-w-[78%] object-contain transition-all duration-700 animate-fade-in drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]",
                      !focusedDone && "grayscale opacity-45"
                    )}
                  />
                </div>

                {/* Bottom tier strip */}
                <div className="absolute bottom-0 inset-x-0 border-t border-white/10 bg-[#05070a]/80 px-4 py-3 flex items-end justify-between [transform:translateZ(50px)]">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-primary">
                      {focused.roman} · {focused.tier}
                    </p>
                    <p className="font-display font-black text-white text-2xl leading-none mt-1.5 tracking-[-0.025em] tabular-nums">
                      {focused.label}
                    </p>
                  </div>
                  <FocusedIcon className="h-5 w-5 text-primary/90" strokeWidth={2} />
                </div>
              </div>
            </Tilt>
          </div>

          {/* Right panel — achievement info */}
          <div className="relative border-t lg:border-t-0 lg:border-l border-white/10 px-6 sm:px-10 py-10 flex flex-col bg-[#05070a]/40">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/90">
              {focused.roman}. Conquista em destaque
            </p>
            <h1 className="mt-3 font-display font-black text-white text-[36px] sm:text-[44px] leading-[0.98] tracking-[-0.035em]">
              {focused.title}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[14px] leading-[1.7] text-white/65">
              {focused.description}
            </p>

            <figure className="mt-6 border-l border-primary pl-4">
              <blockquote className="font-display text-[16px] leading-snug text-white/90 italic tracking-[-0.01em]">
                “{focused.phrase}”
              </blockquote>
            </figure>

            {/* Rewards stamps */}
            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45 mb-2.5">Inclui</p>
              <div className="flex flex-wrap gap-2">
                {focused.rewards.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-white/15 bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.16em] text-white/85">
                    <Gift className="h-3 w-3 text-primary" strokeWidth={2.5} />
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Progress / CTA */}
            <div className="mt-auto pt-8 grid grid-cols-[auto_1fr] gap-5 items-center">
              <div className="relative shrink-0 h-[88px] w-[88px]">
                <Ring value={focusedProgress} size={88} stroke={4} />
                <span className="absolute inset-0 flex items-center justify-center font-display font-black text-white text-[14px] tabular-nums">
                  {focusedProgress.toFixed(0)}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
                  {focusedDone ? "Status" : "Faltam"}
                </p>
                <p className="font-display font-black text-white text-xl tabular-nums tracking-[-0.02em] mt-0.5 truncate">
                  {focusedDone ? "Pronto para resgate" : fmtFull(Math.max(focused.value - revenue, 0))}
                </p>
              </div>

              <button
                type="button"
                onClick={() => focusedDone && !alreadyClaimed && setClaimOpen(true)}
                disabled={!focusedDone || alreadyClaimed}
                className={cn(
                  "col-span-2 group inline-flex items-center justify-between gap-3 px-5 h-12 border font-mono text-[11px] uppercase tracking-[0.24em] transition-colors",
                  focusedDone && !alreadyClaimed
                    ? "border-primary bg-primary text-primary-foreground hover:brightness-110"
                    : alreadyClaimed
                      ? "border-white/15 bg-white/[0.04] text-white/60 cursor-default"
                      : "border-white/12 bg-white/[0.02] text-white/45 cursor-default"
                )}
              >
                <span>
                  {alreadyClaimed ? "Solicitação registrada"
                    : focusedDone ? "Solicitar resgate"
                    : "Continue faturando"}
                </span>
                {focusedDone && !alreadyClaimed
                  ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.25} />
                  : alreadyClaimed
                    ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                    : <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom journey rail */}
        <div className="relative z-10 border-t border-white/10 px-5 sm:px-8 py-5 bg-[#05070a]/70">
          <div className="flex items-center justify-between mb-3 font-mono text-[10px] uppercase tracking-[0.24em]">
            <span className="text-white/55">Jornada · {unlockedCount}/{AWARDS.length} marcos</span>
            <span className="text-white tabular-nums">{overallProgress.toFixed(0)}%</span>
          </div>
          <div className="relative h-[3px] bg-white/10 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-1000"
              style={{ width: `${Math.max(overallProgress, 1.5)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {AWARDS.map((a) => {
              const done = revenue >= a.value;
              const isFocused = focused.id === a.id;
              return (
                <button
                  key={a.id} onClick={() => setFocusId(a.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-1 transition-colors",
                    isFocused ? "text-white" : done ? "text-white/80 hover:text-white" : "text-white/35 hover:text-white/70"
                  )}
                >
                  <span className={cn(
                    "h-1.5 w-1.5 transition-all",
                    isFocused ? "bg-primary scale-150"
                    : done ? "bg-white" : "bg-white/25"
                  )} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] tabular-nums">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== ACHIEVEMENT STATS =================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "Faturamento", v: fmtShort(revenue), s: "Total aprovado" },
          { k: "Tier atual", v: currentTier?.tier ?? "—", s: currentTier ? `${currentTier.roman} · ${currentTier.label}` : "Comece sua jornada" },
          { k: "Próximo marco", v: nextAward ? nextAward.label : "Lenda", s: nextAward ? `Faltam ${fmtShort(remaining)}` : "Hall of Fame" },
          { k: "Conquistados", v: `${unlockedCount}/${AWARDS.length}`, s: `${overallProgress.toFixed(0)}% da jornada` },
        ].map((s) => (
          <div key={s.k} className="relative border border-border bg-card p-4 group hover:border-primary/40 transition-colors">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{s.k}</p>
            <p className="mt-2 font-display font-black text-foreground text-2xl tabular-nums tracking-[-0.02em] leading-none">
              {s.v}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground truncate">{s.s}</p>
            <span className="absolute right-0 top-0 h-full w-[2px] bg-primary scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500" />
          </div>
        ))}
      </section>

      {/* =================== ACHIEVEMENT GRID =================== */}
      <section className="border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 border border-border bg-background flex items-center justify-center text-primary">
              <Trophy className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="font-display font-black text-foreground text-lg tracking-[-0.02em] leading-none">Sala de Conquistas</h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground mt-1.5">
                Clique para inspecionar · {unlockedCount}/{AWARDS.length} desbloqueados
              </p>
            </div>
          </div>
        </header>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {AWARDS.map((a, i) => {
            const done = revenue >= a.value;
            const isFocused = focused.id === a.id;
            const progress = Math.min((revenue / a.value) * 100, 100);
            const Icon = a.icon;
            return (
              <li
                key={a.id}
                className={cn(
                  "relative border-border",
                  i % 2 ? "border-l" : "border-l sm:border-l",
                  "border-t sm:border-t-0",
                  i >= 4 && "border-t",
                )}
              >
                <button
                  type="button"
                  onClick={() => setFocusId(a.id)}
                  className={cn(
                    "group relative w-full text-left flex flex-col transition-colors",
                    "hover:bg-muted/40",
                    isFocused && "bg-muted/30"
                  )}
                >
                  {/* image cell */}
                  <div className="relative aspect-square flex items-center justify-center p-5 bg-[#0a0c10]/30 overflow-hidden">
                    <div
                      className="absolute inset-x-6 bottom-3 h-6 opacity-70 pointer-events-none"
                      style={{ background: done ? "radial-gradient(ellipse at center, hsl(var(--primary) / 0.45), transparent 70%)" : "transparent", filter: "blur(14px)" }}
                    />
                    <img
                      src={a.image} alt={a.title}
                      className={cn(
                        "relative max-h-[78%] max-w-[78%] object-contain transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1",
                        !done && "grayscale opacity-45"
                      )}
                    />

                    {/* roman index */}
                    <span className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/80">
                      {a.roman}
                    </span>

                    {/* stamp */}
                    {done ? (
                      <span className="absolute top-2 right-2 inline-flex items-center justify-center h-5 w-5 bg-primary text-primary-foreground">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2.25} />
                    )}

                    {isFocused && (
                      <span className="absolute inset-0 border-2 border-primary pointer-events-none" />
                    )}
                  </div>

                  {/* footer */}
                  <div className="px-3 py-3 border-t border-border bg-card">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3 w-3", done ? "text-primary" : "text-muted-foreground")} strokeWidth={2.5} />
                      <span className={cn(
                        "font-mono text-[9px] uppercase tracking-[0.22em] truncate",
                        done ? "text-foreground" : "text-muted-foreground"
                      )}>{a.tier}</span>
                    </div>
                    <p className="font-display font-black text-foreground text-base tabular-nums tracking-[-0.02em] mt-1 leading-none">
                      {a.label}
                    </p>
                    <div className="mt-2.5 h-[2px] bg-border overflow-hidden">
                      <div
                        className={cn("h-full transition-[width] duration-700", done ? "bg-primary" : "bg-foreground/40")}
                        style={{ width: `${Math.max(progress, 1.5)}%` }}
                      />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Hall of fame strip */}
        <div className={cn(
          "flex items-center gap-4 border-t border-border px-5 py-4",
          revenue >= AWARDS[AWARDS.length - 1].value ? "bg-primary/[0.06]" : ""
        )}>
          <div className={cn(
            "h-10 w-10 border flex items-center justify-center shrink-0",
            revenue >= AWARDS[AWARDS.length - 1].value
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-background text-muted-foreground"
          )}>
            <Crown className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Hall of Fame HOTZFY</p>
            <p className="font-display font-black text-foreground tracking-[-0.02em] mt-1">
              {revenue >= AWARDS[AWARDS.length - 1].value
                ? "Você é Lenda. Seu nome está gravado."
                : "Reservado a quem ultrapassa R$ 10M."}
            </p>
          </div>
        </div>
      </section>

      {/* =================== Claim dialog =================== */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display tracking-tight">
              <Gift className="h-4 w-4 text-primary" /> Solicitar {focused.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Preencha os dados de envio. A equipe HOTZFY entrará em contato após a postagem.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Nome do recebedor *" value={claimForm.recipient_name} onChange={e => setClaimForm({ ...claimForm, recipient_name: e.target.value })} />
              <Input placeholder="Telefone (com DDD) *" value={claimForm.phone} onChange={e => setClaimForm({ ...claimForm, phone: e.target.value })} />
              <Input placeholder="CPF / CNPJ" value={claimForm.document} onChange={e => setClaimForm({ ...claimForm, document: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Rua *" value={claimForm.shipping_street} onChange={e => setClaimForm({ ...claimForm, shipping_street: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Número *" value={claimForm.shipping_number} onChange={e => setClaimForm({ ...claimForm, shipping_number: e.target.value })} />
              <Input placeholder="Complemento" value={claimForm.shipping_complement} onChange={e => setClaimForm({ ...claimForm, shipping_complement: e.target.value })} />
              <Input placeholder="Bairro *" value={claimForm.shipping_neighborhood} onChange={e => setClaimForm({ ...claimForm, shipping_neighborhood: e.target.value })} className="sm:col-span-2" />
              <Input placeholder="Cidade *" value={claimForm.shipping_city} onChange={e => setClaimForm({ ...claimForm, shipping_city: e.target.value })} />
              <Input placeholder="UF *" maxLength={2} value={claimForm.shipping_state} onChange={e => setClaimForm({ ...claimForm, shipping_state: e.target.value.toUpperCase() })} />
              <Input placeholder="CEP *" value={claimForm.shipping_zip} onChange={e => setClaimForm({ ...claimForm, shipping_zip: e.target.value })} className="sm:col-span-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaimOpen(false)}>Cancelar</Button>
            <Button disabled={submittingClaim} onClick={async () => {
              if (!user?.id) return;
              const required = ["recipient_name","phone","shipping_street","shipping_number","shipping_neighborhood","shipping_city","shipping_state","shipping_zip"] as const;
              for (const k of required) if (!String((claimForm as any)[k] || "").trim()) { toast.error("Preencha todos os campos obrigatórios"); return; }
              setSubmittingClaim(true);
              const { error, data } = await (supabase as any).from("reward_claims").insert({
                user_id: user.id,
                tier_id: focused.id, tier_label: focused.title, tier_value: focused.value,
                recipient_name: claimForm.recipient_name.trim(),
                phone: claimForm.phone.trim(),
                document: claimForm.document.trim() || null,
                shipping_street: claimForm.shipping_street.trim(),
                shipping_number: claimForm.shipping_number.trim(),
                shipping_complement: claimForm.shipping_complement.trim() || null,
                shipping_neighborhood: claimForm.shipping_neighborhood.trim(),
                shipping_city: claimForm.shipping_city.trim(),
                shipping_state: claimForm.shipping_state.trim(),
                shipping_zip: claimForm.shipping_zip.trim(),
              }).select().maybeSingle();
              setSubmittingClaim(false);
              if (error) { toast.error("Erro ao solicitar premiação"); return; }
              if (data) setExistingClaims(prev => [...prev, data]);
              toast.success("Premiação solicitada! Você receberá atualizações por notificação.");
              setClaimOpen(false);
            }}>{submittingClaim ? "Enviando..." : "Confirmar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

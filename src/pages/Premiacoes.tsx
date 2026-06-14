/**
 * Premiações — Showcase cinematográfico HOTZFY
 * @module Premiacoes
 * @version 13.0.0 — Interactive 3D plaque showcase
 */

import { useEffect, useState, useRef, useMemo, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Lock, CheckCircle2, Gift, Crown, Target, Sparkles, Flame,
  Gem, Star, Award, Quote, ChevronLeft, ChevronRight, Zap, Eye, MapPin, Clock, Truck, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


import heroStage from "@/assets/awards/premiacoes-hero-stage.jpg";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";


type AwardItem = {
  id: string; value: number; label: string; tier: string; title: string;
  description: string; image: string; rewards: string[];
  phrase: string; accentRgb: string; glowHsl: string; icon: typeof Trophy;
};

const AWARDS: AwardItem[] = [
  { id: "10k",  value: 10_000,     label: "R$ 10K",  tier: "Iniciante", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY entregue na sua casa.", image: braceletCard, rewards: ["Pulseira Premium", "Cartão Black HOTZFY"], phrase: "Toda jornada bilionária começa com a primeira venda.", accentRgb: "251 146 60", glowHsl: "25 95% 53%", icon: Flame },
  { id: "100k", value: 100_000,    label: "R$ 100K", tier: "Bronze",    title: "Plaquinha Bronze",     description: "Plaquinha em mármore negro com placa em bronze envelhecido. Numerada e gravada com seu nome.",          image: plaque100k,   rewards: ["Plaquinha Bronze numerada"], phrase: "Bronze não é metal — é a prova de que você começou.", accentRgb: "217 119 6", glowHsl: "32 95% 44%", icon: Award },
  { id: "250k", value: 250_000,    label: "R$ 250K", tier: "Prata",     title: "Plaquinha Prata",      description: "Acabamento prata platinada com base em mármore negro. Marco intermediário de prestígio.",                                  image: plaque250k,   rewards: ["Plaquinha Prata Platinada"], phrase: "Prata pesa porque foi merecida.", accentRgb: "203 213 225", glowHsl: "215 20% 65%", icon: Star },
  { id: "500k", value: 500_000,    label: "R$ 500K", tier: "Ouro",      title: "Plaquinha Ouro 24K",   description: "Banhada a ouro 24K com detalhes em esmeralda — para sellers que dominaram o mercado.",                image: plaque500k,   rewards: ["Plaquinha Ouro 24K", "Acesso ao grupo VIP"], phrase: "Ouro não brilha sozinho. Você fez ele brilhar.", accentRgb: "234 179 8", glowHsl: "48 96% 53%", icon: Crown },
  { id: "1m",   value: 1_000_000,  label: "R$ 1M",   tier: "Diamante",  title: "Plaquinha Diamante",   description: "Cravejada em diamante autêntico. O marco de 1 Milhão de reais em faturamento.",                  image: plaque1m,     rewards: ["Plaquinha Diamante", "Convite Hotzfy Inner Circle"], phrase: "Diamante é carbono que resistiu à pressão.", accentRgb: "34 211 238", glowHsl: "189 94% 53%", icon: Gem },
  { id: "5m",   value: 5_000_000,  label: "R$ 5M",   tier: "Elite",     title: "Plaquinha Elite",      description: "Rose Gold com diamantes negros. Reservada à elite — menos de 0.5% dos sellers atingem.",                              image: plaque5m,     rewards: ["Plaquinha Elite Rose Gold", "Jantar privado com a fundação"], phrase: "Elite não é título — é hábito.", accentRgb: "251 113 133", glowHsl: "350 89% 60%", icon: Sparkles },
  { id: "10m",  value: 10_000_000, label: "R$ 10M",  tier: "Lenda",     title: "Plaquinha Lenda",      description: "Gemas preciosas multicoloridas, peça única numerada — assinada pela fundação HOTZFY.",         image: plaque10m,    rewards: ["Plaquinha Lenda numerada", "Hall of Fame HOTZFY", "Bonificação personalizada"], phrase: "Lendas não morrem. Faturam.", accentRgb: "167 139 250", glowHsl: "258 90% 66%", icon: Trophy },
];

const fmtC = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}M`
  : v >= 1_000   ? `R$ ${(v / 1_000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function AnimNum({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value) return;
    const s = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - s) / 1100, 1);
      setD(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{fmtFull(d)}</>;
}

/** Mouse-tracked 3D tilt card. */
function TiltCard({ children, intensity = 12, className }: { children: React.ReactNode; intensity?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setT({ rx: (0.5 - y) * intensity, ry: (x - 0.5) * intensity, mx: x * 100, my: y * 100, active: true });
  };
  const onLeave = () => setT((s) => ({ ...s, rx: 0, ry: 0, active: false }));

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("relative will-change-transform [perspective:1400px]", className)}
    >
      <div
        className="relative transition-transform duration-300 ease-out [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg)` }}
      >
        {children}
        {/* Specular highlight that follows the mouse */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300",
            t.active ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: `radial-gradient(circle at ${t.mx}% ${t.my}%, rgba(255,255,255,0.18), transparent 50%)`,
            mixBlendMode: "overlay",
          }}
        />
      </div>
    </div>
  );
}

/** Circular progress ring SVG. */
function ProgressRing({ value, size = 64, stroke = 5, color = "hsl(var(--primary))" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" opacity={0.4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
    </svg>
  );
}

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


  const { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, nextProgress, remaining } = useMemo(() => {
    const currentIdx = AWARDS.findIndex((a) => revenue < a.value);
    const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
    const nextAward = currentIdx >= 0 ? AWARDS[currentIdx] : null;
    const currentTier = unlockedCount > 0 ? AWARDS[unlockedCount - 1] : null;
    const overallProgress = (unlockedCount / AWARDS.length) * 100;
    const nextProgress = nextAward ? Math.min((revenue / nextAward.value) * 100, 100) : 100;
    const remaining = nextAward ? nextAward.value - revenue : 0;
    return { currentIdx, unlockedCount, nextAward, currentTier, overallProgress, nextProgress, remaining };
  }, [revenue]);

  // Focused award for the showcase (defaults to next or last unlocked)
  const focused = useMemo(() => {
    if (focusId) return AWARDS.find((a) => a.id === focusId) ?? nextAward ?? AWARDS[AWARDS.length - 1];
    return nextAward ?? AWARDS[AWARDS.length - 1];
  }, [focusId, nextAward]);

  const focusedIdx = AWARDS.findIndex((a) => a.id === focused.id);
  const focusedDone = revenue >= focused.value;
  const focusedProgress = Math.min((revenue / focused.value) * 100, 100);
  const FocusedIcon = focused.icon;

  const goPrev = () => setFocusId(AWARDS[Math.max(focusedIdx - 1, 0)].id);
  const goNext = () => setFocusId(AWARDS[Math.min(focusedIdx + 1, AWARDS.length - 1)].id);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ===== CINEMATIC HERO ===== */}
      <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-[#05070a]">
        <div className="absolute inset-0">
          <img src={heroStage} alt="" width={1920} height={896}
            className="h-full w-full object-cover object-center opacity-95" />
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#05070a] via-[#05070a]/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#05070a] via-[#05070a]/80 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-[#05070a]/80 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-[#05070a]/80 to-transparent" />
          <div
            className="absolute left-1/2 top-[15%] -translate-x-1/2 h-[420px] w-[720px] rounded-full blur-[120px] pointer-events-none transition-colors duration-700"
            style={{ background: `hsl(${focused.glowHsl} / 0.18)` }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
          />
        </div>

        <div className="relative z-10 px-6 sm:px-12 lg:px-16 pt-12 pb-14 sm:pt-16 sm:pb-20 min-h-[520px] flex flex-col">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md">
              <img src={hotzfyLogo} alt="HOTZFY" className="h-4 w-auto" />
              <span className="h-3 w-px bg-white/20" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">Premiações</span>
            </div>

            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors",
              currentTier
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-white/15 bg-white/[0.04] text-white/70"
            )}>
              {currentTier ? <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} /> : <Sparkles className="h-3 w-3" />}
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                {currentTier ? `${currentTier.tier} desbloqueado` : "Trilha iniciada"}
              </span>
            </div>
          </div>

          <div className="mt-auto max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-primary/90 mb-4">Hall das Conquistas</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[64px] font-black text-white leading-[0.95] tracking-[-0.035em]">
              Seja reconhecido <br className="hidden sm:block" />
              pelo seu <span className="text-primary">trabalho</span>.
            </h1>
            <p className="mt-5 max-w-xl text-[14px] sm:text-[15px] leading-relaxed text-white/65 font-medium">
              Cada marco entrega uma plaquinha física exclusiva HOTZFY — peças premium
              que materializam sua jornada de faturamento.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">
                {unlockedCount}/{AWARDS.length} marcos
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70 tabular-nums">
                {overallProgress.toFixed(0)}% da jornada
              </span>
            </div>
            <div className="relative h-[3px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/80 transition-[width] duration-1000"
                style={{ width: `${Math.max(overallProgress, 2)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {AWARDS.map((a) => {
                const done = revenue >= a.value;
                return (
                  <button
                    key={a.id}
                    onClick={() => setFocusId(a.id)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all group-hover:scale-150",
                      done ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-white/25"
                    )} />
                    <span className={cn(
                      "text-[9px] font-black tabular-nums uppercase tracking-widest transition-colors",
                      done ? "text-white" : "text-white/40",
                      "group-hover:text-white"
                    )}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== INTERACTIVE SHOWCASE — Focused plaque with 3D tilt ===== */}
      <section
        className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card transition-colors duration-700"
        style={{ ['--accent-glow' as any]: `hsl(${focused.glowHsl})` }}
      >
        {/* Dynamic colored gradient backdrop */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 30% 20%, hsl(${focused.glowHsl} / 0.22), transparent 55%), radial-gradient(circle at 80% 80%, hsl(${focused.glowHsl} / 0.10), transparent 60%)`,
          }}
        />
        {/* Grid texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0">
          {/* Plaque side — 3D tilt */}
          <div className="relative px-8 pt-10 pb-8 sm:px-12 sm:pt-14 sm:pb-12 flex items-center justify-center min-h-[460px]">
            <TiltCard intensity={14} className="w-full max-w-[420px]">
              <div
                className="relative aspect-square rounded-[28px] overflow-hidden border bg-gradient-to-br from-[#0e1116] via-[#15191f] to-[#0a0c10]"
                style={{
                  borderColor: `rgb(${focused.accentRgb} / 0.25)`,
                  boxShadow: `0 30px 80px -20px hsl(${focused.glowHsl} / 0.35), 0 0 0 1px hsl(${focused.glowHsl} / 0.10) inset`,
                }}
              >
                {/* Ambient inner glow */}
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(circle at 50% 40%, hsl(${focused.glowHsl} / 0.25), transparent 70%)` }}
                />
                {/* Floor reflection */}
                <div
                  className="absolute inset-x-8 bottom-6 h-12 rounded-full blur-2xl opacity-60"
                  style={{ background: `hsl(${focused.glowHsl} / 0.5)` }}
                />

                {/* The plaque image, centered & lifted */}
                <div className="absolute inset-0 flex items-center justify-center p-6 [transform:translateZ(40px)]">
                  <img
                    src={focused.image}
                    alt={focused.title}
                    className={cn(
                      "max-h-[78%] max-w-[78%] object-contain transition-all duration-700 drop-shadow-[0_30px_30px_rgba(0,0,0,0.5)]",
                      !focusedDone && "grayscale opacity-40"
                    )}
                  />
                </div>

                {/* Locked overlay */}
                {!focusedDone && (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-md [transform:translateZ(60px)]">
                    <Lock className="h-3 w-3 text-white/70" strokeWidth={2.5} />
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/80">Bloqueado</span>
                  </div>
                )}
                {focusedDone && (
                  <div
                    className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md [transform:translateZ(60px)]"
                    style={{ borderColor: `rgb(${focused.accentRgb} / 0.5)`, background: `rgb(${focused.accentRgb} / 0.15)` }}
                  >
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} style={{ color: `rgb(${focused.accentRgb})` }} />
                    <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `rgb(${focused.accentRgb})` }}>
                      Desbloqueado
                    </span>
                  </div>
                )}

                {/* Tier label bottom */}
                <div className="absolute bottom-0 inset-x-0 p-5 [transform:translateZ(50px)]">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: `rgb(${focused.accentRgb})` }}>
                        {focused.tier}
                      </p>
                      <p className="font-display text-white text-2xl font-black leading-none mt-1 tracking-[-0.02em]">
                        {focused.label}
                      </p>
                    </div>
                    <FocusedIcon className="h-5 w-5 opacity-70" style={{ color: `rgb(${focused.accentRgb})` }} strokeWidth={2.25} />
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Nav arrows */}
            <button
              type="button"
              aria-label="Anterior"
              onClick={goPrev}
              disabled={focusedIdx === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-center text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Próximo"
              onClick={goNext}
              disabled={focusedIdx === AWARDS.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-center text-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Info side */}
          <div className="relative px-8 py-10 sm:px-10 sm:py-12 border-t lg:border-t-0 lg:border-l border-border/40 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground/70 mb-4">
              <Eye size={12} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                Em destaque
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-[34px] font-black text-foreground leading-[1.05] tracking-[-0.02em]">
              {focused.title}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-medium max-w-[42ch]">
              {focused.description}
            </p>

            {/* Phrase */}
            <div className="mt-5 pl-4 border-l-2 rounded-[2px]" style={{ borderColor: `rgb(${focused.accentRgb} / 0.6)` }}>
              <div className="flex items-start gap-2">
                <Quote className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: `rgb(${focused.accentRgb})` }} />
                <p className="text-[13px] italic text-foreground/85 leading-relaxed">{focused.phrase}</p>
              </div>
            </div>

            {/* Rewards chips */}
            <div className="mt-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2.5">Inclui</p>
              <div className="flex flex-wrap gap-2">
                {focused.rewards.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/60 text-foreground"
                  >
                    <Gift className="h-3 w-3" style={{ color: `rgb(${focused.accentRgb})` }} />
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Progress / status block */}
            <div className="mt-auto pt-7">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <ProgressRing
                    value={focusedProgress}
                    size={72}
                    stroke={6}
                    color={`rgb(${focused.accentRgb})`}
                  />
                  <span className="absolute inset-0 flex items-center justify-center font-display text-[14px] font-black text-foreground tabular-nums">
                    {focusedProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
                    {focusedDone ? "Conquistado" : "Progresso"}
                  </p>
                  {focusedDone ? (
                    <p className="text-[15px] font-display font-black text-foreground tracking-tight mt-0.5">
                      Resgate disponível
                    </p>
                  ) : (
                    <>
                      <p className="text-[15px] font-display font-black text-foreground tabular-nums tracking-tight mt-0.5">
                        <AnimNum value={revenue} />
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5 tabular-nums">
                        Faltam <span className="font-black text-foreground">{fmtFull(Math.max(focused.value - revenue, 0))}</span> para {focused.tier}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {(() => {
                const alreadyClaimed = existingClaims.some(c => c.tier_id === focused.id && c.status !== "cancelled");
                return (
                  <button
                    type="button"
                    onClick={() => focusedDone && !alreadyClaimed && setClaimOpen(true)}
                    className={cn(
                      "mt-5 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-[12px] font-black uppercase tracking-[0.18em] transition-all",
                      focusedDone && !alreadyClaimed
                        ? "text-primary-foreground hover:brightness-110"
                        : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 cursor-default"
                    )}
                    style={focusedDone && !alreadyClaimed ? { background: `rgb(${focused.accentRgb})` } : undefined}
                    disabled={!focusedDone || alreadyClaimed}
                  >
                    {alreadyClaimed ? (<><CheckCircle2 className="h-3.5 w-3.5" /> Solicitação registrada</>) :
                     focusedDone ? (<><Zap className="h-3.5 w-3.5" strokeWidth={2.5} /> Solicitar resgate</>) :
                     (<><Lock className="h-3 w-3" strokeWidth={2.5} /> Atinja a meta para desbloquear</>)}
                  </button>
                );
              })()}

            </div>
          </div>
        </div>
      </section>

      {/* ===== KPI MINI STRIP ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Faturamento líquido", value: fmtC(revenue), sub: "Total aprovado", icon: Trophy },
          { label: "Tier atual", value: currentTier?.tier || "—", sub: currentTier ? `${currentTier.label} desbloqueado` : "Faça sua primeira venda", icon: currentTier?.icon || Award },
          { label: "Próximo marco", value: nextAward ? `${nextProgress.toFixed(0)}%` : "Lenda", sub: nextAward ? `Faltam ${fmtC(remaining)}` : "Hall of Fame", icon: Target },
          { label: "Jornada", value: `${overallProgress.toFixed(0)}%`, sub: `${unlockedCount}/${AWARDS.length} marcos`, icon: Sparkles },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm hover:border-foreground/20 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">{k.label}</p>
              <p className="font-display text-xl font-black text-foreground tracking-tight mt-1 leading-tight">{k.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ===== INTERACTIVE PLAQUE GALLERY ===== */}
      <section className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Trophy size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display font-black text-foreground tracking-tight leading-none uppercase">Galeria de Marcos</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Clique para visualizar • {unlockedCount}/{AWARDS.length} desbloqueados
              </p>
            </div>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/60">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {overallProgress.toFixed(0)}% da jornada
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
            {AWARDS.map((a) => {
              const done = revenue >= a.value;
              const isCurrent = AWARDS.indexOf(a) === currentIdx;
              const isFocused = focused.id === a.id;
              const Icon = a.icon;
              const progress = Math.min((revenue / a.value) * 100, 100);

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setFocusId(a.id)}
                  className={cn(
                    "group relative text-left rounded-2xl border bg-card overflow-hidden transition-all duration-300",
                    "hover:-translate-y-1 hover:shadow-lg",
                    isFocused
                      ? "border-foreground/30 shadow-md"
                      : done
                      ? "border-border/60 hover:border-foreground/20"
                      : "border-border/40 opacity-80 hover:opacity-100"
                  )}
                  style={isFocused ? { boxShadow: `0 12px 36px -8px hsl(${a.glowHsl} / 0.35)` } : undefined}
                >
                  {/* Glow on hover */}
                  <div
                    aria-hidden
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(circle at 50% 0%, hsl(${a.glowHsl} / 0.18), transparent 70%)` }}
                  />

                  {/* Plaque image */}
                  <div className="relative aspect-square p-4 flex items-center justify-center bg-gradient-to-br from-[#0e1116]/40 via-[#15191f]/30 to-[#0a0c10]/40">
                    <div
                      className="absolute inset-x-6 bottom-3 h-6 rounded-full blur-xl opacity-50"
                      style={{ background: done ? `hsl(${a.glowHsl} / 0.4)` : "transparent" }}
                    />
                    <img
                      src={a.image}
                      alt={a.title}
                      className={cn(
                        "relative max-h-[80%] max-w-[80%] object-contain transition-transform duration-500 group-hover:scale-110",
                        !done && "grayscale opacity-50"
                      )}
                    />
                    {!done && (
                      <Lock className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2.5} />
                    )}
                    {done && (
                      <div
                        className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ background: `rgb(${a.accentRgb})` }}
                      >
                        <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={2.75} />
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-3 py-2.5 border-t border-border/40 relative">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 shrink-0" style={{ color: done ? `rgb(${a.accentRgb})` : "hsl(var(--muted-foreground) / 0.5)" }} strokeWidth={2.5} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.16em] truncate",
                        done ? "text-foreground" : "text-muted-foreground/70"
                      )}>{a.tier}</span>
                    </div>
                    <p className="font-display text-sm font-black tabular-nums tracking-tight text-foreground mt-0.5">
                      {a.label}
                    </p>
                    {!done && (
                      <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${Math.max(progress, 2)}%`, background: `rgb(${a.accentRgb})` }}
                        />
                      </div>
                    )}
                    {isCurrent && !done && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-primary/15 text-primary border border-primary/25">
                        Em curso
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hall of Fame ribbon */}
          <div className="mt-7 flex items-center gap-3 p-4 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.05] via-transparent to-fuchsia-500/[0.05]">
            <div className={cn(
              "h-11 w-11 rounded-xl border-2 flex items-center justify-center shrink-0",
              revenue >= AWARDS[AWARDS.length - 1].value
                ? "bg-violet-500/10 border-violet-400 text-violet-400"
                : "bg-card border-border/60 text-muted-foreground/40"
            )}>
              <Crown className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Hall of Fame HOTZFY</p>
              <p className="text-[13px] font-display font-black text-foreground tracking-tight mt-0.5">
                {revenue >= AWARDS[AWARDS.length - 1].value
                  ? "Você é Lenda. Seu nome está gravado."
                  : "Reservado às lendas — quem ultrapassa R$ 10M."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Claim dialog */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Solicitar {focused.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Preencha os dados de envio. A equipe HOTZFY entrará em contato após a postagem.</p>
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


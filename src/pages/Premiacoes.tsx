/**
 * Premiações — Sala de Conquistas HOTZFY
 * Cinematic. Soft curves, emerald lighting, parallax plaque, Apple-keynote energy.
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
  accent: string; // hsl pair for tier lighting
};

const AWARDS: AwardItem[] = [
  { id: "10k",  roman: "I",   value: 10_000,     label: "R$ 10K",  tier: "Iniciante", title: "Kit Couro & Cartão Black",  description: "Pulseira de couro premium costurada à mão e Cartão Black numerado. Entregue em estojo lacrado.", image: braceletCard, rewards: ["Pulseira de couro premium", "Cartão Black numerado"], phrase: "Toda jornada bilionária começa com a primeira venda.", ref: "HZF-001", icon: Flame, accent: "24 95% 60%" },
  { id: "100k", roman: "II",  value: 100_000,    label: "R$ 100K", tier: "Bronze",    title: "Placa Bronze Patinado",     description: "Placa em mármore negro com chapa de bronze envelhecido. Numerada, gravada com o seu nome.",     image: plaque100k,   rewards: ["Placa em bronze numerada"], phrase: "Bronze não é metal — é a prova de que você começou.", ref: "HZF-100", icon: Award, accent: "28 70% 55%" },
  { id: "250k", roman: "III", value: 250_000,    label: "R$ 250K", tier: "Prata",     title: "Placa Prata Platinada",     description: "Acabamento prata platinada sobre base em mármore negro. Marco intermediário de prestígio.",       image: plaque250k,   rewards: ["Placa prata platinada"], phrase: "Prata pesa porque foi merecida.", ref: "HZF-250", icon: Star, accent: "210 15% 75%" },
  { id: "500k", roman: "IV",  value: 500_000,    label: "R$ 500K", tier: "Ouro 24K",  title: "Placa Ouro 24K",            description: "Banhada a ouro 24K com detalhes em esmeralda. Para sellers que dominaram seu mercado.",         image: plaque500k,   rewards: ["Placa banhada a ouro 24K", "Acesso ao grupo VIP"], phrase: "Ouro não brilha sozinho. Você fez ele brilhar.", ref: "HZF-500", icon: Crown, accent: "45 95% 60%" },
  { id: "1m",   roman: "V",   value: 1_000_000,  label: "R$ 1M",   tier: "Diamante",  title: "Placa Diamante",            description: "Cravejada em diamante autêntico. O primeiro milhão registrado em catálogo.",                     image: plaque1m,     rewards: ["Placa cravejada", "Convite Hotzfy Inner Circle"], phrase: "Diamante é carbono que resistiu à pressão.", ref: "HZF-1MM", icon: Gem, accent: "190 90% 65%" },
  { id: "5m",   roman: "VI",  value: 5_000_000,  label: "R$ 5M",   tier: "Elite",     title: "Placa Elite Rose Gold",     description: "Rose Gold com diamantes negros. Reservada à elite — menos de 0,5% dos sellers atingem.",         image: plaque5m,     rewards: ["Placa Rose Gold", "Jantar privado com a fundação"], phrase: "Elite não é título — é hábito.", ref: "HZF-5MM", icon: Sparkles, accent: "340 80% 65%" },
  { id: "10m",  roman: "VII", value: 10_000_000, label: "R$ 10M",  tier: "Lenda",     title: "Placa Lenda",               description: "Gemas preciosas multicoloridas, peça única numerada, assinada pela fundação HOTZFY.",             image: plaque10m,    rewards: ["Placa Lenda numerada", "Hall of Fame HOTZFY", "Bonificação personalizada"], phrase: "Lendas não morrem. Faturam.", ref: "HZF-10M", icon: Trophy, accent: "152 76% 52%" },
];

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtShort = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}M`
  : v >= 1_000   ? `R$ ${(v / 1_000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

/* ---------- Parallax tilt ---------- */
function Tilt({ children, intensity = 12, className }: { children: React.ReactNode; intensity?: number; className?: string }) {
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
      className={cn("relative [perspective:1600px]", className)}
    >
      <div
        className="relative transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${t.rx}deg) rotateY(${t.ry}deg)` }}
      >
        {children}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500"
          style={{
            opacity: t.on ? 1 : 0,
            background: `radial-gradient(circle at ${t.mx}% ${t.my}%, hsl(var(--primary) / 0.28), transparent 60%)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Progress ring ---------- */
function Ring({ value, size = 168, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90 block">
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="url(#ringGrad)" strokeWidth={stroke} fill="none" strokeLinecap="round"
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
    supabase.from("reward_claims").select("id, tier_id, status").eq("user_id", user.id)
      .then(({ data }) => { if (data) setExistingClaims(data); });
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
    <div className="space-y-6 animate-fade-in pb-8">
      {/* =================== HERO — CINEMATIC STAGE =================== */}
      <section
        className="relative overflow-hidden rounded-[28px] border border-border/60 text-white isolate"
        style={{ ['--tier' as string]: focused.accent } as React.CSSProperties}
      >
        {/* Cinematic backdrop */}
        <div className="absolute inset-0 -z-10">
          <img src={heroStage} alt="" className="h-full w-full object-cover scale-110 opacity-80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,hsl(var(--tier)/0.45),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/95" />
          {/* aurora */}
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 h-[760px] w-[1100px] rounded-full blur-3xl opacity-60 transition-all duration-700"
            style={{ background: "conic-gradient(from 220deg, hsl(var(--tier)/0.35), transparent 35%, hsl(var(--primary)/0.32) 60%, transparent 80%)" }}
          />
          {/* film grain */}
          <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          {/* vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,black_100%)] opacity-90" />
        </div>

        {/* Top rail */}
        <div className="relative flex items-center justify-between px-6 sm:px-10 py-4 text-[11px] font-mono uppercase tracking-[0.32em]">
          <span className="flex items-center gap-2 text-white/55">
            <Trophy className="h-3.5 w-3.5 text-[hsl(var(--primary))]" strokeWidth={2.25} />
            HOTZFY · Sala de Conquistas
          </span>
          <span className="hidden md:flex items-center gap-2 text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · {new Date().toLocaleDateString("pt-BR")}
          </span>
          <span className="text-white tabular-nums tracking-[0.2em]">
            {unlockedCount.toString().padStart(2,"0")}<span className="text-white/40"> / {AWARDS.length.toString().padStart(2,"0")}</span>
          </span>
        </div>

        {/* Hero body */}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-center gap-6 lg:gap-12 px-6 sm:px-10 pt-6 pb-10 lg:pb-14 min-h-[600px]">
          {/* Plaque pedestal */}
          <div className="relative flex items-center justify-center">
            {/* nav */}
            <button
              type="button" aria-label="Anterior" onClick={goPrev} disabled={focusedIdx === 0}
              className="absolute left-0 sm:-left-2 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 hover:bg-black/60 hover:scale-110 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            ><ChevronLeft className="h-5 w-5" strokeWidth={2} /></button>
            <button
              type="button" aria-label="Próximo" onClick={goNext} disabled={focusedIdx === AWARDS.length - 1}
              className="absolute right-0 sm:-right-2 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 hover:bg-black/60 hover:scale-110 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            ><ChevronRight className="h-5 w-5" strokeWidth={2} /></button>

            <Tilt intensity={11} className="w-full max-w-[520px]">
              <div className="relative aspect-[4/5] rounded-[32px] overflow-hidden">
                {/* glow halo behind */}
                <div
                  className="absolute -inset-12 rounded-full blur-3xl opacity-70 transition-all duration-700"
                  style={{ background: `radial-gradient(circle at 50% 40%, hsl(var(--tier)/0.55), hsl(var(--primary)/0.18) 45%, transparent 70%)` }}
                />

                {/* Glass card */}
                <div className="absolute inset-0 rounded-[32px] border border-white/15 bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-white/[0.06] backdrop-blur-xl overflow-hidden">
                  {/* inner light edge */}
                  <div className="absolute inset-0 rounded-[32px] pointer-events-none [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.18),inset_0_-1px_0_0_rgba(255,255,255,0.04)]" />

                  {/* Lot tag */}
                  <div className="absolute top-5 left-5 px-3 py-1.5 rounded-full border border-white/15 bg-black/30 backdrop-blur-md font-mono text-[10px] uppercase tracking-[0.28em] text-white/70 [transform:translateZ(40px)]">
                    Lote · {focused.ref}
                  </div>

                  {/* Status badge */}
                  <div className="absolute top-5 right-5 z-10 [transform:translateZ(40px)]">
                    {focusedDone ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.18)] backdrop-blur-md text-[hsl(var(--primary))] font-mono text-[10px] uppercase tracking-[0.24em]">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.75} /> Conquistado
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-black/30 backdrop-blur-md text-white/75 font-mono text-[10px] uppercase tracking-[0.24em]">
                        <Lock className="h-3 w-3" strokeWidth={2.5} /> Selado
                      </div>
                    )}
                  </div>

                  {/* Pedestal glow */}
                  <div
                    className="absolute inset-x-12 bottom-24 h-24 rounded-[100%] pointer-events-none transition-all duration-700"
                    style={{ background: `radial-gradient(ellipse at center, hsl(var(--tier)/0.7), transparent 70%)`, filter: "blur(28px)" }}
                  />

                  {/* Plaque image floating */}
                  <div className="absolute inset-0 flex items-center justify-center p-12 [transform:translateZ(60px)]">
                    <img
                      key={focused.id}
                      src={focused.image}
                      alt={focused.title}
                      className={cn(
                        "max-h-[72%] max-w-[82%] object-contain transition-all duration-700 animate-scale-in",
                        "drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)] drop-shadow-[0_0_40px_hsl(var(--tier)/0.45)]",
                        !focusedDone && "grayscale opacity-55"
                      )}
                    />
                  </div>

                  {/* Bottom tier strip */}
                  <div className="absolute bottom-0 inset-x-0 px-6 py-5 backdrop-blur-xl bg-gradient-to-t from-black/70 via-black/40 to-transparent border-t border-white/10 [transform:translateZ(50px)]">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(var(--primary))]">
                          {focused.roman} · {focused.tier}
                        </p>
                        <p className="font-display font-black text-white text-[32px] leading-none mt-2 tracking-[-0.035em] tabular-nums">
                          {focused.label}
                        </p>
                      </div>
                      <div className="h-11 w-11 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md flex items-center justify-center">
                        <FocusedIcon className="h-5 w-5 text-[hsl(var(--primary))]" strokeWidth={2} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Tilt>
          </div>

          {/* Right — story panel */}
          <div className="relative flex flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.36em] text-[hsl(var(--primary))]">
              Conquista {focused.roman} · em destaque
            </p>
            <h1 className="mt-4 font-display font-black text-white text-[42px] sm:text-[56px] leading-[0.95] tracking-[-0.04em]">
              {focused.title}
            </h1>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.7] text-white/65">
              {focused.description}
            </p>

            <figure className="mt-7 relative pl-5">
              <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-gradient-to-b from-[hsl(var(--primary))] via-[hsl(var(--tier))] to-transparent" />
              <blockquote className="font-display text-[18px] leading-snug text-white/90 italic tracking-[-0.015em]">
                "{focused.phrase}"
              </blockquote>
            </figure>

            {/* Rewards chips */}
            <div className="mt-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45 mb-3">Inclui</p>
              <div className="flex flex-wrap gap-2">
                {focused.rewards.map((r) => (
                  <span key={r} className="group inline-flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md text-[12px] text-white/85 hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.08)] transition-all">
                    <span className="h-5 w-5 rounded-full bg-[hsl(var(--primary)/0.18)] flex items-center justify-center">
                      <Gift className="h-2.5 w-2.5 text-[hsl(var(--primary))]" strokeWidth={2.5} />
                    </span>
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Progress + CTA */}
            <div className="mt-8 flex items-center gap-5">
              <div className="relative shrink-0 h-[96px] w-[96px]">
                <Ring value={focusedProgress} size={96} stroke={5} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display font-black text-white text-[18px] tabular-nums leading-none">
                    {focusedProgress.toFixed(0)}%
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/40 mt-0.5">progresso</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/45">
                  {focusedDone ? "Status" : "Faltam para desbloquear"}
                </p>
                <p className="font-display font-black text-white text-[26px] tabular-nums tracking-[-0.025em] mt-1 truncate">
                  {focusedDone ? "Pronto para resgate" : fmtFull(Math.max(focused.value - revenue, 0))}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => focusedDone && !alreadyClaimed && setClaimOpen(true)}
              disabled={!focusedDone || alreadyClaimed}
              className={cn(
                "mt-6 group relative overflow-hidden inline-flex items-center justify-between gap-3 px-6 h-14 rounded-full transition-all duration-300",
                focusedDone && !alreadyClaimed
                  ? "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary))] to-[hsl(var(--tier))] text-primary-foreground hover:scale-[1.02] shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)]"
                  : alreadyClaimed
                    ? "border border-white/15 bg-white/[0.04] text-white/60 cursor-default"
                    : "border border-white/10 bg-white/[0.02] text-white/45 cursor-default"
              )}
            >
              <span className="relative font-display font-bold text-[14px] tracking-[0.04em] uppercase">
                {alreadyClaimed ? "Solicitação registrada"
                  : focusedDone ? "Solicitar resgate"
                  : "Continue faturando para desbloquear"}
              </span>
              <span className="relative flex items-center justify-center h-9 w-9 rounded-full bg-black/15">
                {focusedDone && !alreadyClaimed
                  ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
                  : alreadyClaimed
                    ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                    : <Lock className="h-4 w-4" strokeWidth={2.25} />}
              </span>
              {focusedDone && !alreadyClaimed && (
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom journey rail */}
        <div className="relative border-t border-white/10 px-6 sm:px-10 py-5 bg-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 font-mono text-[10px] uppercase tracking-[0.28em]">
            <span className="text-white/55">Sua jornada · {unlockedCount}/{AWARDS.length} marcos</span>
            <span className="text-white tabular-nums">{overallProgress.toFixed(0)}%</span>
          </div>
          <div className="relative h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--tier))] transition-[width] duration-1000"
              style={{ width: `${Math.max(overallProgress, 1.5)}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {AWARDS.map((a) => {
              const done = revenue >= a.value;
              const isFocused = focused.id === a.id;
              return (
                <button
                  key={a.id} onClick={() => setFocusId(a.id)}
                  className={cn(
                    "group flex flex-col items-center gap-2 py-1 rounded-lg transition-all",
                    isFocused ? "text-white" : done ? "text-white/75 hover:text-white" : "text-white/35 hover:text-white/70"
                  )}
                >
                  <span className={cn(
                    "h-2 w-2 rounded-full transition-all duration-300",
                    isFocused ? "bg-[hsl(var(--primary))] scale-[1.8] shadow-[0_0_12px_hsl(var(--primary))]"
                    : done ? "bg-white" : "bg-white/25 group-hover:bg-white/50"
                  )} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] tabular-nums">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== STATS =================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "Faturamento", v: fmtShort(revenue), s: "Total aprovado", icon: Flame },
          { k: "Tier atual", v: currentTier?.tier ?? "—", s: currentTier ? `${currentTier.roman} · ${currentTier.label}` : "Comece sua jornada", icon: Star },
          { k: "Próximo marco", v: nextAward ? nextAward.label : "Lenda", s: nextAward ? `Faltam ${fmtShort(remaining)}` : "Hall of Fame", icon: ArrowRight },
          { k: "Conquistados", v: `${unlockedCount}/${AWARDS.length}`, s: `${overallProgress.toFixed(0)}% da jornada`, icon: Trophy },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.k} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/0 group-hover:bg-primary/[0.08] blur-2xl transition-all duration-500" />
              <div className="relative flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-muted-foreground">{s.k}</p>
                  <p className="mt-2.5 font-display font-black text-foreground text-[26px] tabular-nums tracking-[-0.025em] leading-none truncate">
                    {s.v}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground truncate">{s.s}</p>
                </div>
                <div className="h-9 w-9 rounded-xl border border-border bg-background flex items-center justify-center text-primary group-hover:bg-primary/10 group-hover:border-primary/40 transition-colors shrink-0">
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* =================== GRID =================== */}
      <section className="relative overflow-hidden rounded-[24px] border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="relative h-11 w-11 rounded-xl border border-border bg-background flex items-center justify-center text-primary">
              <Trophy className="h-5 w-5" strokeWidth={2.25} />
              <span className="absolute inset-0 rounded-xl bg-primary/10 blur-md -z-10" />
            </div>
            <div>
              <h2 className="font-display font-black text-foreground text-xl tracking-[-0.025em] leading-none">Catálogo Completo</h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-muted-foreground mt-1.5">
                Clique para inspecionar · {unlockedCount}/{AWARDS.length} desbloqueados
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {AWARDS.length} níveis
          </div>
        </header>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 p-3 gap-3">
          {AWARDS.map((a) => {
            const done = revenue >= a.value;
            const isFocused = focused.id === a.id;
            const progress = Math.min((revenue / a.value) * 100, 100);
            const Icon = a.icon;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setFocusId(a.id)}
                  style={{ ['--tier' as any]: a.accent }}
                  className={cn(
                    "group relative w-full text-left flex flex-col rounded-2xl overflow-hidden transition-all duration-300",
                    "border bg-background hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_hsl(var(--tier)/0.5)]",
                    isFocused
                      ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_20px_40px_-20px_hsl(var(--primary)/0.5)]"
                      : "border-border hover:border-[hsl(var(--tier)/0.5)]"
                  )}
                >
                  {/* image cell */}
                  <div className="relative aspect-square flex items-center justify-center p-5 overflow-hidden bg-gradient-to-br from-[hsl(var(--tier)/0.06)] via-transparent to-[hsl(var(--tier)/0.03)]">
                    {/* halo on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `radial-gradient(circle at 50% 60%, hsl(var(--tier)/0.22), transparent 65%)` }}
                    />
                    {/* pedestal glow */}
                    <div
                      className="absolute inset-x-8 bottom-3 h-6 pointer-events-none transition-opacity duration-500"
                      style={{
                        background: done
                          ? `radial-gradient(ellipse at center, hsl(var(--tier)/0.6), transparent 70%)`
                          : "transparent",
                        filter: "blur(14px)",
                        opacity: done ? 0.85 : 0,
                      }}
                    />
                    <img
                      src={a.image} alt={a.title}
                      className={cn(
                        "relative max-h-[78%] max-w-[78%] object-contain transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1",
                        done
                          ? "drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                          : "grayscale opacity-45 group-hover:opacity-60"
                      )}
                    />

                    {/* roman index */}
                    <span className="absolute top-2.5 left-3 font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground/80">
                      {a.roman}
                    </span>

                    {/* stamp */}
                    {done ? (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_hsl(var(--primary)/0.5)]">
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center h-6 w-6 rounded-full border border-border bg-background text-muted-foreground/60">
                        <Lock className="h-3 w-3" strokeWidth={2.25} />
                      </span>
                    )}
                  </div>

                  {/* footer */}
                  <div className="relative px-4 py-3.5 border-t border-border bg-card/80">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3 w-3", done ? "text-primary" : "text-muted-foreground")} strokeWidth={2.5} />
                      <span className={cn(
                        "font-mono text-[9px] uppercase tracking-[0.22em] truncate",
                        done ? "text-foreground" : "text-muted-foreground"
                      )}>{a.tier}</span>
                    </div>
                    <p className="font-display font-black text-foreground text-[17px] tabular-nums tracking-[-0.025em] mt-1.5 leading-none">
                      {a.label}
                    </p>
                    <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700",
                          done ? "bg-gradient-to-r from-primary to-[hsl(var(--tier))]" : "bg-foreground/30"
                        )}
                        style={{ width: `${Math.max(progress, 2)}%` }}
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
          "relative flex items-center gap-4 border-t border-border px-6 py-5 overflow-hidden",
          revenue >= AWARDS[AWARDS.length - 1].value && "bg-gradient-to-r from-primary/[0.08] via-transparent to-primary/[0.05]"
        )}>
          <div className={cn(
            "h-12 w-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors",
            revenue >= AWARDS[AWARDS.length - 1].value
              ? "border-primary bg-primary/15 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.4)]"
              : "border-border bg-background text-muted-foreground"
          )}>
            <Crown className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Hall of Fame HOTZFY</p>
            <p className="font-display font-black text-foreground text-[17px] tracking-[-0.025em] mt-1.5">
              {revenue >= AWARDS[AWARDS.length - 1].value
                ? "Você é Lenda. Seu nome está gravado."
                : "Reservado a quem ultrapassa R$ 10M em faturamento."}
            </p>
          </div>
          <Sparkles className="hidden sm:block h-5 w-5 text-primary/60" strokeWidth={2} />
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

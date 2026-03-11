import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Trophy, Lock, CheckCircle2, ArrowLeft, Sparkles, Star, Crown, Gem, Zap, Gift, ChevronRight, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import braceletCard from "@/assets/awards/bracelet-card-10k.png";
import plaque10k from "@/assets/awards/plaque-10k.png";
import plaque100k from "@/assets/awards/plaque-100k.png";
import plaque250k from "@/assets/awards/plaque-250k.png";
import plaque500k from "@/assets/awards/plaque-500k.png";
import plaque1m from "@/assets/awards/plaque-1m.png";
import plaque5m from "@/assets/awards/plaque-5m.png";
import plaque10m from "@/assets/awards/plaque-10m.png";

const AWARDS = [
  {
    id: "10k",
    value: 10000,
    label: "R$ 10K",
    tier: "Primeiro Marco",
    title: "Kit Exclusivo HOTZFY",
    description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY. Você provou que tem o que é preciso.",
    motivation: "Essa é a prova de que você está no caminho certo. O primeiro passo sempre é o mais difícil — e você já deu.",
    image: braceletCard,
    accent: "amber",
    icon: Zap,
    rewards: ["Pulseira HOTZFY Premium", "Cartão Black Exclusivo"],
  },
  {
    id: "100k",
    value: 100000,
    label: "R$ 100K",
    tier: "Bronze",
    title: "Plaquinha Bronze",
    description: "Plaquinha de faturamento em mármore negro com detalhes dourados. Reconhecimento oficial HOTZFY.",
    motivation: "100K é onde a brincadeira acaba e o jogo real começa. Você já é mais forte que 95% dos empreendedores.",
    image: plaque100k,
    accent: "orange",
    icon: Star,
    rewards: ["Plaquinha Bronze em Mármore"],
  },
  {
    id: "250k",
    value: 250000,
    label: "R$ 250K",
    tier: "Prata",
    title: "Plaquinha Prata",
    description: "Plaquinha em acabamento prata platinado. Você está no topo do mercado digital.",
    motivation: "Um quarto de milhão. Enquanto muitos sonham, você executa. Sua disciplina é sua maior arma.",
    image: plaque250k,
    accent: "slate",
    icon: Star,
    rewards: ["Plaquinha Prata Platinada"],
  },
  {
    id: "500k",
    value: 500000,
    label: "R$ 500K",
    tier: "Ouro",
    title: "Plaquinha Ouro",
    description: "Plaquinha banhada a ouro com detalhes em esmeralda. Meio milhão — marca de poucos.",
    motivation: "Meio milhão. Você não é mais um vendedor — é uma máquina de valor. Cada passo agora vale ouro.",
    image: plaque500k,
    accent: "yellow",
    icon: Crown,
    rewards: ["Plaquinha Ouro 24K"],
  },
  {
    id: "1m",
    value: 1000000,
    label: "R$ 1M",
    tier: "Diamante",
    title: "Plaquinha Diamante",
    description: "Plaquinha cravejada em diamante. 1 Milhão — você é uma lenda do mercado digital.",
    motivation: "1 MILHÃO. Você entrou no clube dos que transformam ideias em impérios. O céu não é o limite — é só o começo.",
    image: plaque1m,
    accent: "cyan",
    icon: Gem,
    rewards: ["Plaquinha Diamante Cravejada"],
  },
  {
    id: "5m",
    value: 5000000,
    label: "R$ 5M",
    tier: "Elite",
    title: "Plaquinha Elite",
    description: "Plaquinha Rose Gold com diamantes negros. Apenas os melhores dos melhores chegam aqui.",
    motivation: "5 MILHÕES. Você não joga no mesmo nível que os outros. Você criou seu próprio nível. Respeito absoluto.",
    image: plaque5m,
    accent: "rose",
    icon: Crown,
    rewards: ["Plaquinha Elite Rose Gold"],
  },
  {
    id: "10m",
    value: 10000000,
    label: "R$ 10M",
    tier: "Lenda",
    title: "Plaquinha Lenda",
    description: "Plaquinha com gemas preciosas multicoloridas. Você é uma LENDA imortal do digital.",
    motivation: "10 MILHÕES. Você transcendeu. Seu nome será lembrado para sempre na história do mercado digital.",
    image: plaque10m,
    accent: "purple",
    icon: Sparkles,
    rewards: ["Plaquinha Lenda com Gemas"],
  },
];

const accentMap: Record<string, { bg: string; text: string; border: string; glow: string; ring: string }> = {
  amber:  { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/25",  glow: "shadow-amber-500/15",  ring: "ring-amber-500/30" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/25", glow: "shadow-orange-500/15", ring: "ring-orange-500/30" },
  slate:  { bg: "bg-slate-400/10",  text: "text-slate-300",  border: "border-slate-400/25",  glow: "shadow-slate-400/15",  ring: "ring-slate-400/30" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/25", glow: "shadow-yellow-500/15", ring: "ring-yellow-500/30" },
  cyan:   { bg: "bg-cyan-400/10",   text: "text-cyan-300",   border: "border-cyan-400/25",   glow: "shadow-cyan-400/15",   ring: "ring-cyan-400/30" },
  rose:   { bg: "bg-rose-400/10",   text: "text-rose-300",   border: "border-rose-400/25",   glow: "shadow-rose-400/15",   ring: "ring-rose-400/30" },
  purple: { bg: "bg-purple-400/10", text: "text-purple-300", border: "border-purple-400/25", glow: "shadow-purple-400/15", ring: "ring-purple-400/30" },
};

export default function Premiacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("transactions")
      .select("net_amount")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0));
      });
  }, [user?.id]);

  const fmtCurrency = (v: number) =>
    v >= 1000000
      ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
      : v >= 1000
      ? `R$ ${(v / 1000).toFixed(0)}K`
      : `R$ ${v.toLocaleString("pt-BR")}`;

  const currentTierIdx = AWARDS.findIndex((a) => revenue < a.value);
  const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Dashboard
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Trophy className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-[26px] font-black text-foreground tracking-tight">Trilha de Conquistas</h1>
            <p className="text-[12px] text-muted-foreground font-medium">Sua jornada rumo ao topo — cada marco, um prêmio exclusivo</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-5 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/60">Faturamento</p>
            <p className="text-[22px] font-black text-primary">{fmtCurrency(revenue)}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/60 px-5 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Conquistas</p>
            <p className="text-[22px] font-black text-foreground">
              {unlockedCount}
              <span className="text-[13px] text-muted-foreground font-semibold">/{AWARDS.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Trail */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-[2px] bg-border/20" />
        {/* Filled progress line */}
        <div
          className="absolute left-[27px] top-0 w-[2px] bg-primary/50 transition-all duration-1000"
          style={{
            height: unlockedCount === 0
              ? "0%"
              : unlockedCount === AWARDS.length
              ? "100%"
              : `${((unlockedCount) / AWARDS.length) * 100}%`,
          }}
        />

        <div className="space-y-2">
          {AWARDS.map((award, idx) => {
            const unlocked = revenue >= award.value;
            const isCurrent = idx === currentTierIdx;
            const Icon = award.icon;
            const colors = accentMap[award.accent];
            const progress = Math.min((revenue / award.value) * 100, 100);

            return (
              <motion.div
                key={award.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.4 }}
                className="relative flex gap-5"
              >
                {/* Trail node */}
                <div className="relative z-10 shrink-0 flex flex-col items-center pt-6">
                  <div
                    className={cn(
                      "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                      unlocked
                        ? cn(colors.bg, colors.border, colors.text, "shadow-lg", colors.glow)
                        : isCurrent
                        ? "border-primary/40 bg-primary/10 text-primary shadow-md shadow-primary/10"
                        : "border-border/20 bg-card/30 text-muted-foreground/20"
                    )}
                  >
                    {unlocked ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                </div>

                {/* Card */}
                <div
                  className={cn(
                    "flex-1 rounded-2xl border p-5 transition-all duration-500 mb-2",
                    unlocked
                      ? cn(colors.border, "bg-card/60 shadow-lg", colors.glow)
                      : isCurrent
                      ? "border-primary/25 bg-card/50 shadow-md shadow-primary/5 ring-1 ring-primary/10"
                      : "border-border/15 bg-card/20"
                  )}
                >
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* Image — always visible */}
                    <div className="relative w-full lg:w-44 h-36 lg:h-auto shrink-0 flex items-center justify-center rounded-xl overflow-hidden bg-background/30">
                      <img
                        src={award.image}
                        alt={award.title}
                        className={cn(
                          "h-full w-full object-contain max-h-32 lg:max-h-36 drop-shadow-xl transition-transform duration-500",
                          unlocked && "hover:scale-105"
                        )}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center border border-border/30">
                            <Lock className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        </div>
                      )}
                      {unlocked && (
                        <div className="absolute top-2 right-2">
                          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", colors.bg, colors.border, "border")}>
                            <CheckCircle2 className={cn("h-3.5 w-3.5", colors.text)} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn("h-3.5 w-3.5", unlocked ? colors.text : isCurrent ? "text-primary" : "text-muted-foreground/20")} />
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-md border",
                              unlocked
                                ? cn(colors.border, colors.bg, colors.text)
                                : isCurrent
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-border/15 bg-muted/10 text-muted-foreground/20"
                            )}>
                              {award.tier}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-md border border-primary/30 bg-primary/15 text-primary animate-pulse">
                                Próximo
                              </span>
                            )}
                          </div>
                          <h3 className={cn(
                            "text-[17px] font-black tracking-tight",
                            unlocked ? "text-foreground" : isCurrent ? "text-foreground/80" : "text-muted-foreground/30"
                          )}>
                            {award.title}
                          </h3>
                        </div>
                        <span className={cn(
                          "text-[18px] font-black shrink-0",
                          unlocked ? colors.text : isCurrent ? "text-foreground/60" : "text-muted-foreground/15"
                        )}>
                          {award.label}
                        </span>
                      </div>

                      <p className={cn(
                        "text-[11px] leading-relaxed mb-3",
                        unlocked ? "text-muted-foreground" : isCurrent ? "text-muted-foreground/60" : "text-muted-foreground/20"
                      )}>
                        {award.description}
                      </p>

                      {/* Rewards */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {award.rewards.map((r) => (
                          <span
                            key={r}
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-flex items-center gap-1",
                              unlocked
                                ? cn(colors.border, colors.bg, colors.text)
                                : isCurrent
                                ? "border-primary/15 bg-primary/[0.04] text-primary/60"
                                : "border-border/10 bg-muted/5 text-muted-foreground/15"
                            )}
                          >
                            <Gift className="h-3 w-3" /> {r}
                          </span>
                        ))}
                      </div>

                      {/* Status */}
                      {unlocked ? (
                        <div className={cn("rounded-xl px-4 py-2.5 border", colors.border, colors.bg)}>
                          <p className={cn("text-[11px] font-semibold italic leading-relaxed", colors.text)}>
                            "{award.motivation}"
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("text-[10px] font-bold", isCurrent ? "text-primary/50" : "text-muted-foreground/20")}>Progresso</span>
                            <span className={cn("text-[10px] font-bold", isCurrent ? "text-primary/50" : "text-muted-foreground/20")}>{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/15 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1.2, delay: idx * 0.1 }}
                              className={cn(
                                "h-full rounded-full transition-all",
                                isCurrent ? "bg-primary/40" : "bg-muted-foreground/10"
                              )}
                            />
                          </div>
                          <p className={cn("text-[10px] mt-1.5", isCurrent ? "text-muted-foreground/40" : "text-muted-foreground/15")}>
                            Faltam {fmtCurrency(award.value - revenue)} para desbloquear
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Final node — goal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: AWARDS.length * 0.06 + 0.2 }}
            className="relative flex gap-5"
          >
            <div className="relative z-10 shrink-0 flex flex-col items-center pt-4">
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center border-2",
                unlockedCount === AWARDS.length
                  ? "border-primary/40 bg-primary/15 text-primary shadow-lg shadow-primary/20"
                  : "border-border/15 bg-card/20 text-muted-foreground/15"
              )}>
                <Target className="h-6 w-6" />
              </div>
            </div>
            <div className={cn(
              "flex-1 rounded-2xl border p-5",
              unlockedCount === AWARDS.length
                ? "border-primary/25 bg-primary/[0.04]"
                : "border-border/10 bg-card/10"
            )}>
              <p className={cn(
                "text-[14px] font-black",
                unlockedCount === AWARDS.length ? "text-primary" : "text-muted-foreground/20"
              )}>
                {unlockedCount === AWARDS.length
                  ? "Todas as conquistas desbloqueadas — Você é uma Lenda!"
                  : "Continue sua jornada para desbloquear todas as conquistas"}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

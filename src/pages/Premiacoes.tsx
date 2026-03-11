import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Trophy, Lock, CheckCircle2, ArrowLeft, Sparkles, Star, Crown, Gem, Zap } from "lucide-react";
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
    motivation: "Essa é a prova de que você está no caminho certo. O primeiro passo sempre é o mais difícil — e você já deu. 🔥",
    image: braceletCard,
    color: "from-amber-500/20 to-amber-900/10",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-amber-500/20",
    icon: Zap,
    iconColor: "text-amber-400",
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
    color: "from-orange-600/20 to-orange-900/10",
    borderColor: "border-orange-500/30",
    glowColor: "shadow-orange-500/20",
    icon: Star,
    iconColor: "text-orange-400",
    rewards: ["Plaquinha Bronze em Mármore"],
  },
  {
    id: "250k",
    value: 250000,
    label: "R$ 250K",
    tier: "Prata",
    title: "Plaquinha Prata",
    description: "Plaquinha em acabamento prata platinado. Você está no topo do mercado digital.",
    motivation: "Um quarto de milhão. Enquanto muitos sonham, você executa. Sua disciplina é sua maior arma. 💎",
    image: plaque250k,
    color: "from-slate-400/20 to-slate-600/10",
    borderColor: "border-slate-400/30",
    glowColor: "shadow-slate-400/20",
    icon: Star,
    iconColor: "text-slate-300",
    rewards: ["Plaquinha Prata Platinada"],
  },
  {
    id: "500k",
    value: 500000,
    label: "R$ 500K",
    tier: "Ouro",
    title: "Plaquinha Ouro",
    description: "Plaquinha banhada a ouro com detalhes em esmeralda. Meio milhão — marca de poucos.",
    motivation: "Meio milhão. Você não é mais um vendedor — é uma máquina de valor. Cada passo agora vale ouro. ⚡",
    image: plaque500k,
    color: "from-yellow-500/20 to-yellow-800/10",
    borderColor: "border-yellow-500/30",
    glowColor: "shadow-yellow-500/20",
    icon: Crown,
    iconColor: "text-yellow-400",
    rewards: ["Plaquinha Ouro 24K"],
  },
  {
    id: "1m",
    value: 1000000,
    label: "R$ 1M",
    tier: "Diamante",
    title: "Plaquinha Diamante",
    description: "Plaquinha cravejada em diamante. 1 Milhão — você é uma lenda do mercado digital.",
    motivation: "1 MILHÃO. Você entrou no clube dos que transformam ideias em impérios. O céu não é o limite — é só o começo. 🏆",
    image: plaque1m,
    color: "from-cyan-400/20 to-blue-600/10",
    borderColor: "border-cyan-400/30",
    glowColor: "shadow-cyan-400/20",
    icon: Gem,
    iconColor: "text-cyan-300",
    rewards: ["Plaquinha Diamante Cravejada"],
  },
  {
    id: "5m",
    value: 5000000,
    label: "R$ 5M",
    tier: "Elite",
    title: "Plaquinha Elite",
    description: "Plaquinha Rose Gold com diamantes negros. Apenas os melhores dos melhores chegam aqui.",
    motivation: "5 MILHÕES. Você não joga no mesmo nível que os outros. Você criou seu próprio nível. Respeito absoluto. 👑",
    image: plaque5m,
    color: "from-rose-400/20 to-rose-700/10",
    borderColor: "border-rose-400/30",
    glowColor: "shadow-rose-400/20",
    icon: Crown,
    iconColor: "text-rose-300",
    rewards: ["Plaquinha Elite Rose Gold"],
  },
  {
    id: "10m",
    value: 10000000,
    label: "R$ 10M",
    tier: "Lenda",
    title: "Plaquinha Lenda",
    description: "Plaquinha com gemas preciosas multicoloridas. Você é uma LENDA imortal do digital.",
    motivation: "10 MILHÕES. Você transcendeu. Seu nome será lembrado para sempre na história do mercado digital. Lenda. 🌟",
    image: plaque10m,
    color: "from-purple-500/20 via-pink-500/10 to-cyan-500/10",
    borderColor: "border-purple-400/30",
    glowColor: "shadow-purple-500/20",
    icon: Sparkles,
    iconColor: "text-purple-300",
    rewards: ["Plaquinha Lenda com Gemas"],
  },
];

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

  return (
    <div className="min-h-screen pb-32">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-primary/[0.06] via-card to-card/80 p-8 lg:p-12 mb-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/5 rounded-full blur-2xl" />

        <div className="relative z-10">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Dashboard
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-[28px] font-black text-foreground tracking-tight">Premiações HOTZFY</h1>
              <p className="text-[12px] text-muted-foreground font-medium">Conquiste marcos, ganhe prêmios exclusivos</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60">Seu Faturamento</p>
              <p className="text-[24px] font-black text-primary">{fmtCurrency(revenue)}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card/60 px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conquistas</p>
              <p className="text-[24px] font-black text-foreground">
                {AWARDS.filter((a) => revenue >= a.value).length}
                <span className="text-[14px] text-muted-foreground font-semibold">/{AWARDS.length}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Awards Grid */}
      <div className="space-y-5">
        {AWARDS.map((award, idx) => {
          const unlocked = revenue >= award.value;
          const Icon = award.icon;
          const progress = Math.min((revenue / award.value) * 100, 100);

          return (
            <motion.div
              key={award.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className={cn(
                "group relative rounded-2xl border overflow-hidden transition-all duration-500",
                unlocked
                  ? cn(award.borderColor, "bg-gradient-to-r", award.color, "shadow-lg", award.glowColor)
                  : "border-border/20 bg-card/30"
              )}
            >
              <div className="flex flex-col lg:flex-row items-stretch">
                {/* Image */}
                <div className={cn(
                  "relative w-full lg:w-56 h-48 lg:h-auto shrink-0 flex items-center justify-center p-6 overflow-hidden",
                  !unlocked && "grayscale opacity-40"
                )}>
                  <img
                    src={award.image}
                    alt={award.title}
                    className="h-full w-full object-contain max-h-40 lg:max-h-44 drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                  />
                  {unlocked && (
                    <div className="absolute top-3 right-3 lg:top-4 lg:right-4">
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
                      <Lock className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("h-4 w-4", unlocked ? award.iconColor : "text-muted-foreground/30")} />
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border",
                          unlocked
                            ? cn(award.borderColor, "bg-background/30", award.iconColor)
                            : "border-border/20 bg-muted/20 text-muted-foreground/30"
                        )}>
                          {award.tier}
                        </span>
                      </div>
                      <h3 className={cn(
                        "text-[18px] font-black tracking-tight",
                        unlocked ? "text-foreground" : "text-muted-foreground/40"
                      )}>
                        {award.title}
                      </h3>
                    </div>
                    <span className={cn(
                      "text-[20px] font-black shrink-0",
                      unlocked ? "text-foreground" : "text-muted-foreground/20"
                    )}>
                      {award.label}
                    </span>
                  </div>

                  <p className={cn(
                    "text-[12px] leading-relaxed mb-3",
                    unlocked ? "text-muted-foreground" : "text-muted-foreground/25"
                  )}>
                    {award.description}
                  </p>

                  {/* Rewards tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {award.rewards.map((r) => (
                      <span
                        key={r}
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                          unlocked
                            ? "border-primary/20 bg-primary/[0.06] text-primary"
                            : "border-border/10 bg-muted/10 text-muted-foreground/20"
                        )}
                      >
                        🎁 {r}
                      </span>
                    ))}
                  </div>

                  {/* Motivation quote */}
                  {unlocked ? (
                    <div className="rounded-xl bg-primary/[0.06] border border-primary/10 px-4 py-3">
                      <p className="text-[11px] font-semibold text-primary/80 italic leading-relaxed">
                        "{award.motivation}"
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/30">Progresso</span>
                        <span className="text-[10px] font-bold text-muted-foreground/30">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-muted-foreground/15 transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/20 mt-2">
                        Faltam {fmtCurrency(award.value - revenue)} para desbloquear
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

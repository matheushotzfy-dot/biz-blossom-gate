import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Trophy, Lock, CheckCircle2, Sparkles, Star, Crown, Gem, Zap, Gift, Target, Flame } from "lucide-react";
import { PageShell, PageTitle, GlassKpi, Panel } from "@/components/PageShell";
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
  { id: "10k", value: 10000, label: "R$ 10K", tier: "Primeiro Marco", title: "Kit Exclusivo HOTZFY", description: "Pulseira de couro premium + Cartão Black exclusivo HOTZFY. Você provou que tem o que é preciso.", motivation: "Essa é a prova de que você está no caminho certo. O primeiro passo sempre é o mais difícil — e você já deu.", image: braceletCard, icon: Zap, rewards: ["Pulseira HOTZFY Premium", "Cartão Black Exclusivo"], tone: "primary" as const },
  { id: "100k", value: 100000, label: "R$ 100K", tier: "Bronze", title: "Plaquinha Bronze", description: "Plaquinha de faturamento em mármore negro com detalhes dourados. Reconhecimento oficial HOTZFY.", motivation: "100K é onde a brincadeira acaba e o jogo real começa. Você já é mais forte que 95% dos empreendedores.", image: plaque100k, icon: Star, rewards: ["Plaquinha Bronze em Mármore"], tone: "warning" as const },
  { id: "250k", value: 250000, label: "R$ 250K", tier: "Prata", title: "Plaquinha Prata", description: "Plaquinha em acabamento prata platinado. Você está no topo do mercado digital.", motivation: "Um quarto de milhão. Enquanto muitos sonham, você executa. Sua disciplina é sua maior arma.", image: plaque250k, icon: Star, rewards: ["Plaquinha Prata Platinada"], tone: "info" as const },
  { id: "500k", value: 500000, label: "R$ 500K", tier: "Ouro", title: "Plaquinha Ouro", description: "Plaquinha banhada a ouro com detalhes em esmeralda. Meio milhão — marca de poucos.", motivation: "Meio milhão. Você não é mais um vendedor — é uma máquina de valor. Cada passo agora vale ouro.", image: plaque500k, icon: Crown, rewards: ["Plaquinha Ouro 24K"], tone: "warning" as const },
  { id: "1m", value: 1000000, label: "R$ 1M", tier: "Diamante", title: "Plaquinha Diamante", description: "Plaquinha cravejada em diamante. 1 Milhão — você é uma lenda do mercado digital.", motivation: "1 MILHÃO. Você entrou no clube dos que transformam ideias em impérios. O céu não é o limite — é só o começo.", image: plaque1m, icon: Gem, rewards: ["Plaquinha Diamante Cravejada"], tone: "info" as const },
  { id: "5m", value: 5000000, label: "R$ 5M", tier: "Elite", title: "Plaquinha Elite", description: "Plaquinha Rose Gold com diamantes negros. Apenas os melhores dos melhores chegam aqui.", motivation: "5 MILHÕES. Você não joga no mesmo nível que os outros. Você criou seu próprio nível. Respeito absoluto.", image: plaque5m, icon: Crown, rewards: ["Plaquinha Elite Rose Gold"], tone: "destructive" as const },
  { id: "10m", value: 10000000, label: "R$ 10M", tier: "Lenda", title: "Plaquinha Lenda", description: "Plaquinha com gemas preciosas multicoloridas. Você é uma LENDA imortal do digital.", motivation: "10 MILHÕES. Você transcendeu. Seu nome será lembrado para sempre na história do mercado digital.", image: plaque10m, icon: Sparkles, rewards: ["Plaquinha Lenda com Gemas"], tone: "primary" as const },
];

type Tone = "primary" | "info" | "warning" | "success" | "destructive";

const TONE_STYLES: Record<Tone, { accent: string; bg: string; ring: string; text: string }> = {
  primary:     { accent: "bg-primary",     bg: "bg-primary/8",     ring: "ring-primary/15",     text: "text-primary" },
  info:        { accent: "bg-info",        bg: "bg-info/8",        ring: "ring-info/15",        text: "text-info" },
  warning:     { accent: "bg-warning",     bg: "bg-warning/8",     ring: "ring-warning/15",     text: "text-warning" },
  success:     { accent: "bg-success",     bg: "bg-success/8",     ring: "ring-success/15",     text: "text-success" },
  destructive: { accent: "bg-destructive", bg: "bg-destructive/8", ring: "ring-destructive/15", text: "text-destructive" },
};

export default function Premiacoes() {
  const { user } = useAuth();
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
    v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
    : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
    : `R$ ${v.toLocaleString("pt-BR")}`;

  const currentTierIdx = AWARDS.findIndex((a) => revenue < a.value);
  const unlockedCount = AWARDS.filter((a) => revenue >= a.value).length;
  const nextAward = currentTierIdx >= 0 ? AWARDS[currentTierIdx] : null;
  const globalProgress = nextAward ? Math.min((revenue / nextAward.value) * 100, 100) : 100;

  return (
    <PageShell>
      {/* ─── Header ─── */}
      <PageTitle icon={<Trophy className="h-6 w-6" />} title="Trilha de Conquistas" subtitle="Sua jornada rumo ao topo — cada marco, um prêmio exclusivo" />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Faturamento" value={fmtCurrency(revenue)} sub="receita líquida total" icon={Flame} tone="primary" delay={0} large />
        <GlassKpi label="Conquistas" value={`${unlockedCount}/${AWARDS.length}`} sub={`${unlockedCount} desbloqueadas`} icon={Trophy} tone="success" delay={1} large />
        <GlassKpi label="Próximo Marco" value={nextAward ? nextAward.label : "Completo!"} sub={nextAward ? nextAward.tier : "Todas desbloqueadas"} icon={Target} tone="warning" delay={2} />
        <GlassKpi label="Progresso" value={`${globalProgress.toFixed(0)}%`} sub={nextAward ? `faltam ${fmtCurrency(nextAward.value - revenue)}` : "lenda absoluta"} icon={Sparkles} tone="info" delay={3} />
      </div>

      {/* ─── Progress Bar Global ─── */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/8 ring-1 ring-primary/10 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-display font-black text-foreground/70">Progresso Geral</span>
          </div>
          <span className="text-[10px] font-display font-bold text-primary/50 tabular-nums">{unlockedCount} de {AWARDS.length} marcos</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted/10 ring-1 ring-border/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlockedCount / AWARDS.length) * 100}%` }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </motion.div>
        </div>
        {/* Mini milestones */}
        <div className="flex justify-between mt-2.5">
          {AWARDS.map((a, idx) => {
            const unlocked = revenue >= a.value;
            return (
              <div key={a.id} className="flex flex-col items-center gap-1">
                <div className={cn(
                  "h-3 w-3 rounded-full ring-1 transition-all duration-500",
                  unlocked ? "bg-primary ring-primary/20 scale-110" : idx === currentTierIdx ? "bg-primary/30 ring-primary/15 animate-pulse" : "bg-muted/10 ring-border/10"
                )} />
                <span className={cn(
                  "text-[7px] font-display font-bold tabular-nums hidden sm:block",
                  unlocked ? "text-primary/60" : "text-muted-foreground/15"
                )}>{a.label}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ─── Awards Trail ─── */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[23px] md:left-[27px] top-4 bottom-4 w-[2px] bg-border/10" />
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: unlockedCount === 0 ? "0%" : unlockedCount === AWARDS.length ? "100%" : `${((unlockedCount) / AWARDS.length) * 100}%` }}
          transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-[23px] md:left-[27px] top-4 w-[2px] bg-primary/40"
        />

        <div className="space-y-2">
          {AWARDS.map((award, idx) => {
            const unlocked = revenue >= award.value;
            const isCurrent = idx === currentTierIdx;
            const Icon = award.icon;
            const tone = TONE_STYLES[award.tone];
            const progress = Math.min((revenue / award.value) * 100, 100);

            return (
              <motion.div
                key={award.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex gap-4 md:gap-5"
              >
                {/* Trail node */}
                <div className="relative z-10 shrink-0 flex flex-col items-center pt-5">
                  <div className={cn(
                    "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center ring-1 transition-all duration-500",
                    unlocked ? cn(tone.bg, tone.ring, tone.text) :
                    isCurrent ? "bg-primary/8 ring-primary/15 text-primary" :
                    "bg-muted/5 ring-border/10 text-muted-foreground/10"
                  )}>
                    {unlocked ? <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" /> : <Icon className="h-4 w-4 md:h-5 md:w-5" />}
                  </div>
                </div>

                {/* Card */}
                <Panel
                  className={cn(
                    "flex-1 mb-1 transition-all duration-500",
                    unlocked ? "border-border/40 hover:border-border/60" :
                    isCurrent ? "border-primary/15 ring-1 ring-primary/8" :
                    "border-border/10 opacity-60 hover:opacity-80"
                  )}
                >
                  {/* Accent bar */}
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                    unlocked ? tone.accent : isCurrent ? "bg-primary" : "bg-border/15"
                  )} />

                  <div className="flex flex-col lg:flex-row gap-4 pl-1.5">
                    {/* Image */}
                    <div className="relative w-full lg:w-40 h-32 lg:h-auto shrink-0 flex items-center justify-center rounded-xl overflow-hidden bg-muted/5 ring-1 ring-border/10">
                      <img
                        src={award.image}
                        alt={award.title}
                        className={cn(
                          "h-full w-full object-contain max-h-28 lg:max-h-32 drop-shadow-lg transition-transform duration-500",
                          unlocked && "hover:scale-105"
                        )}
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
                          <div className="h-9 w-9 rounded-xl bg-card/80 backdrop-blur-sm ring-1 ring-border/15 flex items-center justify-center">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/25" />
                          </div>
                        </div>
                      )}
                      {unlocked && (
                        <div className="absolute top-2 right-2">
                          <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center ring-1", tone.bg, tone.ring)}>
                            <CheckCircle2 className={cn("h-3 w-3", tone.text)} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn(
                              "text-[8px] font-display font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg ring-1",
                              unlocked ? cn(tone.bg, tone.ring, tone.text) :
                              isCurrent ? "bg-primary/8 ring-primary/10 text-primary" :
                              "bg-muted/5 ring-border/10 text-muted-foreground/15"
                            )}>
                              {award.tier}
                            </span>
                            {isCurrent && (
                              <span className="text-[8px] font-display font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg bg-primary/10 ring-1 ring-primary/15 text-primary animate-pulse">
                                Próximo
                              </span>
                            )}
                          </div>
                          <h3 className={cn(
                            "text-[15px] md:text-[17px] font-display font-black tracking-[-0.03em]",
                            unlocked ? "text-foreground" : isCurrent ? "text-foreground/70" : "text-muted-foreground/20"
                          )}>
                            {award.title}
                          </h3>
                        </div>
                        <span className={cn(
                          "text-[16px] md:text-[18px] font-display font-black shrink-0 tabular-nums tracking-[-0.03em]",
                          unlocked ? tone.text : isCurrent ? "text-foreground/40" : "text-muted-foreground/10"
                        )}>
                          {award.label}
                        </span>
                      </div>

                      <p className={cn(
                        "text-[11px] leading-relaxed mb-3 font-medium",
                        unlocked ? "text-muted-foreground/60" : isCurrent ? "text-muted-foreground/40" : "text-muted-foreground/15"
                      )}>
                        {award.description}
                      </p>

                      {/* Rewards */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {award.rewards.map((r) => (
                          <span
                            key={r}
                            className={cn(
                              "text-[9px] font-display font-bold px-2 py-0.5 rounded-lg ring-1 inline-flex items-center gap-1",
                              unlocked ? cn(tone.bg, tone.ring, tone.text) :
                              isCurrent ? "bg-primary/5 ring-primary/8 text-primary/40" :
                              "bg-muted/5 ring-border/5 text-muted-foreground/10"
                            )}
                          >
                            <Gift className="h-2.5 w-2.5" /> {r}
                          </span>
                        ))}
                      </div>

                      {/* Status / Progress */}
                      {unlocked ? (
                        <div className={cn("rounded-xl px-4 py-3 ring-1", tone.bg, tone.ring)}>
                          <p className={cn("text-[10px] font-display font-semibold italic leading-relaxed", tone.text)}>
                            "{award.motivation}"
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("text-[9px] font-display font-bold", isCurrent ? "text-primary/40" : "text-muted-foreground/10")}>Progresso</span>
                            <span className={cn("text-[9px] font-display font-bold tabular-nums", isCurrent ? "text-primary/40" : "text-muted-foreground/10")}>{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/8 ring-1 ring-border/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1.2, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                              className={cn("h-full rounded-full", isCurrent ? "bg-primary/30" : "bg-muted-foreground/5")}
                            />
                          </div>
                          <p className={cn("text-[9px] mt-1.5 font-display font-semibold", isCurrent ? "text-muted-foreground/30" : "text-muted-foreground/10")}>
                            Faltam {fmtCurrency(award.value - revenue)} para desbloquear
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>
              </motion.div>
            );
          })}

          {/* Final node */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: AWARDS.length * 0.06 + 0.2 }}
            className="relative flex gap-4 md:gap-5"
          >
            <div className="relative z-10 shrink-0 flex flex-col items-center pt-4">
              <div className={cn(
                "h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center ring-1 transition-all",
                unlockedCount === AWARDS.length ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/5 ring-border/10 text-muted-foreground/10"
              )}>
                <Target className="h-5 w-5 md:h-6 md:w-6" />
              </div>
            </div>
            <Panel className={cn(
              "flex-1",
              unlockedCount === AWARDS.length ? "border-primary/15" : "border-border/5 opacity-40"
            )}>
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", unlockedCount === AWARDS.length ? "bg-primary" : "bg-border/10")} />
              <p className={cn(
                "text-[13px] font-display font-black pl-1.5",
                unlockedCount === AWARDS.length ? "text-primary" : "text-muted-foreground/15"
              )}>
                {unlockedCount === AWARDS.length
                  ? "🏆 Todas as conquistas desbloqueadas — Você é uma Lenda!"
                  : "Continue sua jornada para desbloquear todas as conquistas"}
              </p>
            </Panel>
          </motion.div>
        </div>
      </div>
    </PageShell>
  );
}

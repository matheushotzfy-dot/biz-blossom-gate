import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Star, Crown, Gem, Zap, Flame, Target, Shield, Award, TrendingUp, CheckCircle2, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const LEVELS = [
  { name: "Iniciante", min: 0, max: 999, icon: Zap, tone: "muted-foreground" },
  { name: "Explorador", min: 1000, max: 9999, icon: Target, tone: "info" },
  { name: "Guerreiro", min: 10000, max: 49999, icon: Shield, tone: "primary" },
  { name: "Mestre", min: 50000, max: 99999, icon: Star, tone: "warning" },
  { name: "Elite", min: 100000, max: 499999, icon: Crown, tone: "warning" },
  { name: "Diamante", min: 500000, max: 999999, icon: Gem, tone: "info" },
  { name: "Lenda", min: 1000000, max: Infinity, icon: Flame, tone: "destructive" },
];

const BADGES = [
  { id: "first_sale", label: "Primeira Venda", desc: "Realizou a primeira venda", icon: Zap, check: (s: Stats) => s.totalSales >= 1 },
  { id: "ten_sales", label: "10 Vendas", desc: "Atingiu 10 vendas aprovadas", icon: Target, check: (s: Stats) => s.totalSales >= 10 },
  { id: "hundred_sales", label: "100 Vendas", desc: "Atingiu 100 vendas aprovadas", icon: Star, check: (s: Stats) => s.totalSales >= 100 },
  { id: "first_product", label: "Criador", desc: "Criou o primeiro produto", icon: Award, check: (s: Stats) => s.products >= 1 },
  { id: "five_products", label: "Empreendedor", desc: "Tem 5+ produtos ativos", icon: Crown, check: (s: Stats) => s.products >= 5 },
  { id: "10k_revenue", label: "R$ 10K", desc: "Faturou R$ 10.000+", icon: TrendingUp, check: (s: Stats) => s.revenue >= 10000 },
  { id: "100k_revenue", label: "R$ 100K", desc: "Faturou R$ 100.000+", icon: Gem, check: (s: Stats) => s.revenue >= 100000 },
  { id: "1m_revenue", label: "R$ 1M", desc: "Faturou R$ 1.000.000+", icon: Flame, check: (s: Stats) => s.revenue >= 1000000 },
];

type Stats = { revenue: number; totalSales: number; products: number };

function getLevel(revenue: number) {
  return LEVELS.find((l) => revenue >= l.min && revenue <= l.max) || LEVELS[0];
}

function getNextLevel(revenue: number) {
  const idx = LEVELS.findIndex((l) => revenue >= l.min && revenue <= l.max);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

const fmtCurrency = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
  : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
  : `R$ ${v.toLocaleString("pt-BR")}`;

export default function Gamificacao() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ revenue: 0, totalSales: 0, products: 0 });

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
      supabase.from("products").select("id").eq("user_id", user.id),
    ]).then(([txRes, prodRes]) => {
      const revenue = txRes.data?.reduce((s, t) => s + Number(t.net_amount), 0) ?? 0;
      setStats({ revenue, totalSales: txRes.data?.length ?? 0, products: prodRes.data?.length ?? 0 });
    });
  }, [user?.id]);

  const level = useMemo(() => getLevel(stats.revenue), [stats.revenue]);
  const nextLevel = useMemo(() => getNextLevel(stats.revenue), [stats.revenue]);
  const LevelIcon = level.icon;

  const progress = nextLevel
    ? Math.min(((stats.revenue - level.min) / (nextLevel.min - level.min)) * 100, 100)
    : 100;

  const unlockedBadges = useMemo(() => BADGES.filter((b) => b.check(stats)), [stats]);
  const currentLevelIdx = LEVELS.findIndex(l => l.name === level.name);

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ═══ HERO ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 mesh-gradient-hero noise-overlay scan-line"
      >
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-warning/6 rounded-full blur-[160px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          {/* Top bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
                <Trophy className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Ranking & Conquistas</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-primary">{unlockedBadges.length}/{BADGES.length} Conquistas</span>
            </div>
          </div>

          {/* Level Display */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-8">
            <div className="flex items-center gap-5">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn("h-20 w-20 md:h-24 md:w-24 rounded-3xl flex items-center justify-center ring-2 ring-offset-2 ring-offset-transparent", `bg-${level.tone}/10 ring-${level.tone}/20 text-${level.tone}`)}
              >
                <LevelIcon className="h-10 w-10 md:h-12 md:w-12" />
              </motion.div>
              <div>
                <p className="text-[9px] font-heading uppercase tracking-[0.25em] text-muted-foreground/40 mb-1">Seu Nível</p>
                <h2 className={cn("text-[32px] md:text-[42px] font-heading tracking-[-0.04em] text-foreground leading-none", `drop-shadow-[0_0_20px_hsl(var(--${level.tone})/0.15)]`)}>
                  {level.name}
                </h2>
                <p className="text-[12px] text-muted-foreground/40 mt-1 font-display">
                  Faturamento: {fmtCurrency(stats.revenue)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 ml-auto">
              <div className="text-center px-5 py-3 rounded-2xl glass-panel card-premium">
                <p className="text-[28px] font-heading font-bold text-foreground tabular-nums leading-none">{stats.totalSales}</p>
                <p className="text-[9px] text-muted-foreground/30 uppercase tracking-wider font-heading mt-1">Vendas</p>
              </div>
              <div className="text-center px-5 py-3 rounded-2xl glass-panel card-premium">
                <p className="text-[28px] font-heading font-bold text-foreground tabular-nums leading-none">{stats.products}</p>
                <p className="text-[9px] text-muted-foreground/30 uppercase tracking-wider font-heading mt-1">Produtos</p>
              </div>
            </div>
          </div>

          {/* Progress to next level */}
          {nextLevel && (
            <div className="rounded-2xl glass-panel card-premium p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center ring-1", `bg-${level.tone}/8 ring-${level.tone}/10`)}>
                    <Flame className={cn("h-3.5 w-3.5", `text-${level.tone}`)} />
                  </div>
                  <span className="text-[11px] font-display font-bold text-foreground/70">Próximo: {nextLevel.name}</span>
                </div>
                <span className="text-[10px] font-heading font-bold tabular-nums text-primary/50">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/10 ring-1 ring-border/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </motion.div>
              </div>
              <p className="text-[10px] mt-2 text-muted-foreground/30 font-display">
                Faltam {fmtCurrency(nextLevel.min - stats.revenue)} para o nível {nextLevel.name}
              </p>
            </div>
          )}
        </div>
      </motion.section>

      {/* ═══ CONQUISTAS ═══ */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-7 w-7 rounded-lg bg-warning/8 ring-1 ring-warning/10 flex items-center justify-center">
            <Award className="h-3.5 w-3.5 text-warning" />
          </div>
          <h3 className="text-[14px] font-display font-bold text-foreground">Conquistas ({unlockedBadges.length}/{BADGES.length})</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGES.map((badge, i) => {
            const unlocked = badge.check(stats);
            const BadgeIcon = badge.icon;
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "group rounded-2xl glass-panel card-premium overflow-hidden text-center p-5 relative transition-all duration-300",
                  unlocked ? "hover:shadow-lg hover:shadow-primary/5" : "opacity-40 grayscale"
                )}
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                  unlocked ? "bg-primary" : "bg-muted-foreground/10"
                )} />
                <div className={cn(
                  "mx-auto mb-3 h-14 w-14 rounded-2xl flex items-center justify-center ring-1 transition-all group-hover:scale-110",
                  unlocked
                    ? "bg-primary/10 ring-primary/15 text-primary"
                    : "bg-muted/10 ring-border/10 text-muted-foreground/30"
                )}>
                  {unlocked ? <BadgeIcon className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
                </div>
                <p className="text-[13px] font-display font-bold text-foreground">{badge.label}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1">{badge.desc}</p>
                {unlocked && (
                  <div className="mt-3 inline-flex items-center gap-1 text-[9px] font-heading text-success bg-success/8 px-2 py-0.5 rounded-full border border-success/10">
                    <CheckCircle2 className="h-3 w-3" /> Desbloqueada
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ═══ NÍVEIS ═══ */}
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-7 w-7 rounded-lg bg-info/8 ring-1 ring-info/10 flex items-center justify-center">
            <Crown className="h-3.5 w-3.5 text-info" />
          </div>
          <h3 className="text-[14px] font-display font-bold text-foreground">Níveis do Sistema</h3>
        </div>

        <div className="space-y-2">
          {LEVELS.map((lvl, i) => {
            const Icon = lvl.icon;
            const isCurrentOrPast = stats.revenue >= lvl.min;
            const isCurrent = lvl.name === level.name;

            return (
              <motion.div
                key={lvl.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "group rounded-2xl glass-panel card-premium overflow-hidden relative transition-all",
                  !isCurrentOrPast && "opacity-40",
                  isCurrent && "ring-1 ring-primary/15"
                )}
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                  isCurrentOrPast ? `bg-${lvl.tone}` : "bg-muted-foreground/10"
                )} />

                <div className="flex items-center gap-4 p-4 pl-5">
                  <div className={cn(
                    "h-11 w-11 rounded-xl flex items-center justify-center ring-1 shrink-0 transition-all",
                    isCurrentOrPast
                      ? `bg-${lvl.tone}/10 ring-${lvl.tone}/15 text-${lvl.tone}`
                      : "bg-muted/10 ring-border/10 text-muted-foreground/20"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-[13px] font-display font-bold", isCurrentOrPast ? "text-foreground" : "text-muted-foreground/30")}>
                        {lvl.name}
                      </p>
                      {isCurrent && (
                        <span className="text-[8px] font-heading uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/10">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/30 mt-0.5">
                      A partir de {fmtCurrency(lvl.min)}
                      {lvl.max < Infinity && ` — até ${fmtCurrency(lvl.max)}`}
                    </p>
                  </div>
                  {isCurrentOrPast && (
                    <div className="h-7 w-7 rounded-lg bg-success/8 flex items-center justify-center ring-1 ring-success/10 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

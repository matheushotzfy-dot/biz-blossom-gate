import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { Trophy, Star, Crown, Gem, Zap, Flame, Target, Shield, Award, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = [
  { name: "Iniciante", min: 0, max: 999, icon: Zap, color: "text-muted-foreground", bg: "bg-muted/20" },
  { name: "Explorador", min: 1000, max: 9999, icon: Target, color: "text-info", bg: "bg-info/10" },
  { name: "Guerreiro", min: 10000, max: 49999, icon: Shield, color: "text-primary", bg: "bg-primary/10" },
  { name: "Mestre", min: 50000, max: 99999, icon: Star, color: "text-warning", bg: "bg-warning/10" },
  { name: "Elite", min: 100000, max: 499999, icon: Crown, color: "text-warning", bg: "bg-warning/10" },
  { name: "Diamante", min: 500000, max: 999999, icon: Gem, color: "text-info", bg: "bg-info/10" },
  { name: "Lenda", min: 1000000, max: Infinity, icon: Flame, color: "text-destructive", bg: "bg-destructive/10" },
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

  return (
    <PageShell>
      <PageTitle icon={<Trophy className="h-6 w-6" />} title="Ranking & Conquistas" subtitle="Seu progresso e conquistas na plataforma" />

      {/* Current Level Card */}
      <Panel className="relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-[60px]" />
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className={cn("flex h-24 w-24 items-center justify-center rounded-3xl border-2", level.bg, "border-current", level.color)}>
            <LevelIcon className={cn("h-12 w-12", level.color)} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Seu nível atual</p>
            <h2 className={cn("text-3xl font-display font-black tracking-tight", level.color)}>{level.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Faturamento: R$ {stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-display font-black text-foreground">{stats.totalSales}</p>
            <p className="text-xs text-muted-foreground font-bold">vendas</p>
          </div>
        </div>

        {nextLevel && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className={level.color}>{level.name}</span>
              <span className="text-muted-foreground">
                Próximo: {nextLevel.name} (R$ {nextLevel.min.toLocaleString("pt-BR")})
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-primary font-bold">{progress.toFixed(1)}% concluído</p>
          </div>
        )}
      </Panel>

      {/* Badges */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4">Conquistas ({unlockedBadges.length}/{BADGES.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGES.map((badge) => {
            const unlocked = badge.check(stats);
            const BadgeIcon = badge.icon;
            return (
              <Panel
                key={badge.id}
                className={cn("text-center transition", !unlocked && "opacity-40 grayscale")}
              >
                <div className={cn("mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl", unlocked ? "bg-primary/10" : "bg-muted/30")}>
                  <BadgeIcon className={cn("h-7 w-7", unlocked ? "text-primary" : "text-muted-foreground")} />
                </div>
                <p className="text-sm font-bold text-foreground">{badge.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
                {unlocked && <CheckCircle2 className="mx-auto mt-2 h-4 w-4 text-success" />}
              </Panel>
            );
          })}
        </div>
      </div>

      {/* All Levels */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4">Níveis do Sistema</h3>
        <div className="space-y-2">
          {LEVELS.map((lvl) => {
            const Icon = lvl.icon;
            const isCurrentOrPast = stats.revenue >= lvl.min;
            return (
              <Panel key={lvl.name} className={cn("flex items-center gap-4", !isCurrentOrPast && "opacity-50")}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", lvl.bg)}>
                  <Icon className={cn("h-5 w-5", lvl.color)} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-bold", isCurrentOrPast ? "text-foreground" : "text-muted-foreground")}>{lvl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    A partir de R$ {lvl.min.toLocaleString("pt-BR")}
                  </p>
                </div>
                {isCurrentOrPast && <CheckCircle2 className="h-5 w-5 text-success" />}
              </Panel>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}

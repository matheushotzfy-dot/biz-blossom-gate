import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, Copy, Users, DollarSign, CheckCircle2, Link2, Share2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageShell, PageTitle, GlassKpi, Panel, SectionHeader } from "@/components/PageShell";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Referral = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  referred_email: string;
  status: string;
  reward_amount: number;
  paid_at: string | null;
  created_at: string;
};

export default function Indicacoes() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const referralCode = user?.id?.slice(0, 8).toUpperCase() || "---";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const loadData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("referrals" as any)
      .select("*")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setReferrals(data as unknown as Referral[]);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Link copiado!");
  };

  const stats = useMemo(() => {
    const total = referrals.length;
    const converted = referrals.filter(r => r.status === "converted").length;
    const totalReward = referrals.filter(r => r.status === "converted").reduce((acc, r) => acc + Number(r.reward_amount), 0);
    const pending = referrals.filter(r => r.status === "pending").length;
    return { total, converted, totalReward, pending };
  }, [referrals]);

  return (
    <PageShell>
      <PageTitle icon={<Gift className="h-6 w-6" />} title="Programa de Indicações" subtitle="Convide outros vendedores e ganhe recompensas" />

      {/* Referral Link Card */}
      <Panel accent="bg-primary">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
            <Share2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-black text-foreground">Seu Link de Indicação</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Compartilhe com outros vendedores. Ganhe R$ 50 por cada indicação que ativar a conta.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted/20 rounded-xl px-3 py-2.5 text-muted-foreground truncate border border-border/20">
                {referralLink}
              </code>
              <Button size="sm" onClick={copyLink} className="rounded-xl gap-1.5 h-10 px-4 font-display font-bold shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Indicações Enviadas" value={String(stats.total)} icon={Users} tone="primary" delay={0} />
        <GlassKpi label="Convertidas" value={String(stats.converted)} icon={CheckCircle2} tone="success" delay={1} />
        <GlassKpi label="Pendentes" value={String(stats.pending)} icon={Link2} tone="warning" delay={2} />
        <GlassKpi label="Total Ganho" value={fmt(stats.totalReward)} icon={DollarSign} tone="primary" delay={3} />
      </div>

      {/* How it Works */}
      <Panel>
        <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Como Funciona" />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {[
            { step: "1", title: "Compartilhe", desc: "Envie seu link para outros empreendedores digitais" },
            { step: "2", title: "Cadastro", desc: "Quando alguém se cadastra pelo seu link, a indicação é registrada" },
            { step: "3", title: "Recompensa", desc: "Ao ativar a conta e fazer a primeira venda, você recebe R$ 50" },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-4 rounded-2xl bg-muted/5 border border-border/10"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary font-display font-black text-sm">
                {item.step}
              </div>
              <p className="text-sm font-display font-bold text-foreground">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Referral List */}
      <Panel>
        <SectionHeader icon={<Users className="h-4 w-4" />} title="Suas Indicações" />
        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/40">Nenhuma indicação ainda</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Compartilhe seu link para começar</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {referrals.map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-border/10"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${ref.status === "converted" ? "bg-success" : "bg-warning animate-pulse"}`} />
                  <div>
                    <span className="text-[12px] font-bold text-foreground">{ref.referred_email}</span>
                    <span className="text-[10px] text-muted-foreground/40 ml-2">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ref.status === "converted" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}>
                    {ref.status === "converted" ? "Convertida" : "Pendente"}
                  </span>
                  {ref.status === "converted" && (
                    <span className="text-[11px] font-bold text-primary">{fmt(Number(ref.reward_amount))}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

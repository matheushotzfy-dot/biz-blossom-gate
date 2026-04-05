import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Landmark, CheckCircle2, TrendingUp, Loader2, AlertCircle,
  Shield, Zap, Globe, Signal, Crown, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageShell, PageTitle, Panel, GlowPanel, GlassKpi, EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface VisibleAcquirer {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  conversion_rate: number;
}

export default function Adquirente() {
  const { user } = useAuth();
  const [acquirers, setAcquirers] = useState<VisibleAcquirer[]>([]);
  const [currentAcquirerId, setCurrentAcquirerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    const [acqRes, profileRes] = await Promise.all([
      supabase.from("acquirers").select("id, name, slug, type, description, conversion_rate").order("conversion_rate", { ascending: false }),
      supabase.from("profiles").select("acquirer_id").eq("user_id", user!.id).maybeSingle(),
    ]);
    if (acqRes.data) setAcquirers(acqRes.data as unknown as VisibleAcquirer[]);
    if (profileRes.data?.acquirer_id) setCurrentAcquirerId(profileRes.data.acquirer_id);
    setLoading(false);
  };

  const selectAcquirer = async (acquirerId: string) => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId }).eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao selecionar adquirente");
    } else {
      setCurrentAcquirerId(acquirerId);
      toast.success("Adquirente selecionada com sucesso!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  const selectedAcq = acquirers.find(a => a.id === currentAcquirerId);
  const avgConversion = acquirers.length > 0 ? (acquirers.reduce((a, b) => a + b.conversion_rate, 0) / acquirers.length) : 0;

  return (
    <PageShell>
      <PageTitle
        icon={<Landmark className="h-6 w-6" />}
        title="Adquirente"
        subtitle="Selecione e gerencie seu processador de pagamentos"
      />

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi
          label="Disponíveis"
          value={String(acquirers.length)}
          sub="Adquirentes ativas"
          icon={Globe}
          tone="primary"
          delay={0}
        />
        <GlassKpi
          label="Selecionada"
          value={selectedAcq ? "1" : "0"}
          sub={selectedAcq?.name || "Nenhuma"}
          icon={CheckCircle2}
          tone="success"
          delay={1}
        />
        <GlassKpi
          label="Conversão Atual"
          value={selectedAcq ? `${selectedAcq.conversion_rate}%` : "—"}
          sub="Taxa de aprovação"
          icon={TrendingUp}
          tone="info"
          delay={2}
        />
        <GlassKpi
          label="Média Geral"
          value={`${avgConversion.toFixed(1)}%`}
          sub="Todas adquirentes"
          icon={Signal}
          tone="warning"
          delay={3}
        />
      </div>

      {/* ─── Current Selection Banner ─── */}
      {selectedAcq && (
        <GlowPanel glow="success">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-success/60">Adquirente Ativa</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              </div>
              <h3 className="text-lg font-display font-black text-foreground tracking-tight">{selectedAcq.name}</h3>
              {selectedAcq.description && (
                <p className="text-[12px] text-muted-foreground/60 mt-0.5 line-clamp-1">{selectedAcq.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-display font-black text-success tabular-nums tracking-tight">{selectedAcq.conversion_rate}%</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">conversão</p>
            </div>
          </div>
        </GlowPanel>
      )}

      {/* ─── Acquirers Grid ─── */}
      {acquirers.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Landmark className="h-8 w-8" />}
            title="Nenhuma adquirente disponível"
            subtitle="O administrador ainda não liberou adquirentes para seleção."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {acquirers.map((acq, i) => {
            const isSelected = currentAcquirerId === acq.id;
            const isBlack = acq.type === "black";
            return (
              <motion.div
                key={acq.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <Panel
                  className={cn(
                    "cursor-pointer group relative",
                    isSelected && "ring-2 ring-primary/20 border-primary/30"
                  )}
                  onClick={() => !saving && selectAcquirer(acq.id)}
                  accent={isSelected ? "bg-primary" : isBlack ? "bg-foreground/60" : "bg-info"}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center text-base font-display font-black border transition-all duration-300 group-hover:scale-105",
                        isBlack
                          ? "bg-foreground/5 text-foreground border-border/40"
                          : "bg-primary/8 text-primary border-primary/15"
                      )}>
                        {acq.name[0]}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-display font-black text-foreground tracking-tight">{acq.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                            isBlack
                              ? "bg-foreground/5 text-muted-foreground border-border/30"
                              : "bg-info/8 text-info border-info/15"
                          )}>
                            {isBlack && <Crown className="h-2.5 w-2.5 inline mr-1" />}
                            {acq.type}
                          </span>
                          {isSelected && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold border border-primary/15">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Ativa
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {acq.description && (
                    <p className="text-[12px] text-muted-foreground/50 mb-4 leading-relaxed line-clamp-2">{acq.description}</p>
                  )}

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/10 border border-border/20">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-success/8 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 font-medium">Taxa de Conversão</span>
                    </div>
                    <span className="text-xl font-display font-black text-foreground tabular-nums tracking-tight">
                      {acq.conversion_rate}%
                    </span>
                  </div>

                  {!isSelected && (
                    <Button
                      size="sm"
                      className="w-full mt-4 text-xs rounded-xl h-10 font-bold gap-2 shadow-lg shadow-primary/15"
                      disabled={saving}
                      onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      Selecionar Adquirente
                    </Button>
                  )}
                </Panel>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Info Section ─── */}
      <GlowPanel glow="info">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="h-10 w-10 rounded-xl bg-info/10 ring-1 ring-info/20 flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-info" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Como funciona</h3>
            <p className="text-[11px] text-muted-foreground/60">Entenda o processamento de pagamentos</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: "Processamento", desc: "A adquirente processa todas as suas transações via cartão de crédito e PIX.", accent: "bg-primary", icon: Zap },
            { label: "Taxa de Conversão", desc: "Indica o percentual de transações aprovadas. Quanto maior, melhor.", accent: "bg-success", icon: TrendingUp },
            { label: "Segurança", desc: "Todas as transações são criptografadas e seguem os padrões PCI DSS.", accent: "bg-info", icon: Shield },
          ].map((item) => (
            <div key={item.label} className="relative flex items-start gap-3 p-3.5 rounded-xl bg-muted/10 border border-border/30 overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", item.accent)} />
              <div className="h-8 w-8 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 ml-1">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground/80">{item.label}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </GlowPanel>
    </PageShell>
  );
}

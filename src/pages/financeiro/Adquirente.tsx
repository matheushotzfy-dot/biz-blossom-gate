import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Landmark, CheckCircle2, TrendingUp, Loader2,
  Shield, Zap, Crown, Activity, Info, Layers, ArrowRight,
  Gauge, Sparkles, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";

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
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    const [acqRes, profileRes] = await Promise.all([
      supabase.from("acquirers").select("id, name, slug, type, description, conversion_rate").eq("seller_visible", true).eq("is_active", true).order("conversion_rate", { ascending: false }),
      supabase.from("profiles").select("acquirer_id").eq("user_id", user!.id).maybeSingle(),
    ]);
    if (acqRes.data) setAcquirers(acqRes.data as unknown as VisibleAcquirer[]);
    if (profileRes.data?.acquirer_id) setCurrentAcquirerId(profileRes.data.acquirer_id);
    setLoading(false);
  };

  const selectAcquirer = async (acquirerId: string) => {
    if (!user?.id) return;
    setSavingId(acquirerId);
    const { error } = await supabase.from("profiles").update({ acquirer_id: acquirerId }).eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao selecionar adquirente");
    } else {
      setCurrentAcquirerId(acquirerId);
      toast.success("Adquirente selecionada com sucesso");
    }
    setSavingId(null);
  };

  const { selectedAcq, avgConversion, bestConversion, worstConversion, deltaVsAvg } = useMemo(() => {
    const sel = acquirers.find(a => a.id === currentAcquirerId) || null;
    const rates = acquirers.map(a => a.conversion_rate);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const best = rates.length ? Math.max(...rates) : 0;
    const worst = rates.length ? Math.min(...rates) : 0;
    return {
      selectedAcq: sel,
      avgConversion: avg,
      bestConversion: best,
      worstConversion: worst,
      deltaVsAvg: sel ? sel.conversion_rate - avg : 0,
    };
  }, [acquirers, currentAcquirerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <FinanceiroHero
        eyebrow={`${acquirers.length} ${acquirers.length === 1 ? "processador disponível" : "processadores disponíveis"}`}
        title="Adquirente"
        subtitle="Selecione o gateway que processa suas novas transações. A escolha entra em vigor imediatamente para vendas futuras."
        status={selectedAcq
          ? { tone: "success", label: `Roteando via ${selectedAcq.name}`, pulse: true }
          : { tone: "warning", label: "Nenhum processador ativo" }}
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Processador ativo"
          value={selectedAcq ? selectedAcq.name : "—"}
          sub={selectedAcq ? `${selectedAcq.type.toUpperCase()} · ${selectedAcq.conversion_rate}% conversão` : "Selecione abaixo"}
          icon={Radio}
          tone={selectedAcq ? "success" : "warning"}
        />
        <FinanceiroKpi
          label="Conversão atual"
          value={selectedAcq ? `${selectedAcq.conversion_rate.toFixed(1)}%` : "—"}
          sub={selectedAcq ? `${deltaVsAvg >= 0 ? "+" : ""}${deltaVsAvg.toFixed(1)}pp vs média` : "—"}
          icon={Gauge}
          tone={selectedAcq && deltaVsAvg >= 0 ? "success" : "neutral"}
        />
        <FinanceiroKpi
          label="Melhor do catálogo"
          value={`${bestConversion.toFixed(1)}%`}
          sub={acquirers.find(a => a.conversion_rate === bestConversion)?.name || "—"}
          icon={TrendingUp}
          tone="info"
        />
        <FinanceiroKpi
          label="Catálogo"
          value={String(acquirers.length)}
          sub={`Faixa ${worstConversion.toFixed(1)}–${bestConversion.toFixed(1)}%`}
          icon={Layers}
          tone="neutral"
        />
      </FinanceiroKpiGrid>

      {/* Featured selected processor */}
      {selectedAcq && (
        <section className="relative overflow-hidden rounded-[20px] border border-border bg-card animate-fade-in stagger-2">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{ background: "radial-gradient(circle at 0% 0%, hsl(var(--success) / 0.08), transparent 55%)" }}
          />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className={cn(
                "h-14 w-14 rounded-xl flex items-center justify-center shrink-0 border font-display font-black text-xl",
                selectedAcq.type === "black"
                  ? "bg-foreground/5 border-border text-foreground"
                  : "bg-primary/10 border-primary/30 text-primary"
              )}>
                {selectedAcq.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-success/80">
                    Processador ativo
                  </span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Roteando agora
                  </span>
                </div>
                <h2 className="font-display text-[26px] font-black tracking-[-0.02em] text-foreground leading-tight mb-1">
                  {selectedAcq.name}
                </h2>
                <p className="text-[13px] text-muted-foreground/85 font-medium leading-relaxed max-w-xl">
                  {selectedAcq.description || "Gateway ativo para todas as novas vendas, com roteamento aplicado imediatamente."}
                </p>
                {selectedAcq.type === "black" && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-foreground">
                    <Crown className="h-3 w-3" /> Tier Black
                  </span>
                )}
              </div>
            </div>

            <div className="lg:border-l lg:border-border/60 lg:pl-6 flex lg:flex-col gap-6 lg:gap-3 lg:min-w-[200px]">
              <div className="flex-1 lg:flex-none">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
                  Conversão
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[40px] font-black text-success leading-none tabular-nums">
                    {selectedAcq.conversion_rate.toFixed(1)}
                  </span>
                  <span className="text-[16px] text-success/60 font-bold">%</span>
                </div>
              </div>
              <div className="flex-1 lg:flex-none">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
                  vs Média catálogo
                </p>
                <p className={cn(
                  "font-display text-[18px] font-black tabular-nums leading-none",
                  deltaVsAvg >= 0 ? "text-success" : "text-warning"
                )}>
                  {deltaVsAvg >= 0 ? "+" : ""}{deltaVsAvg.toFixed(1)}pp
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Processors list */}
      {acquirers.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-secondary border border-border/50 flex items-center justify-center">
            <Landmark className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <p className="text-[14px] text-foreground font-display font-bold">Nenhum processador disponível</p>
          <p className="text-[12px] text-muted-foreground/70 font-medium">O administrador ainda não liberou processadores para seleção.</p>
        </div>
      ) : (
        <section className="bg-card rounded-[20px] border border-border overflow-hidden animate-fade-in stagger-3">
          <header className="grid grid-cols-[1fr_auto] items-center px-5 py-3.5 border-b border-border/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-black text-foreground tracking-tight text-[14px]">Catálogo de processadores</h2>
                <p className="text-[11px] text-muted-foreground/70 font-medium">Ordenado por taxa de conversão · Clique em qualquer linha para ativar</p>
              </div>
            </div>
            <span className="text-[10px] font-bold tabular-nums text-muted-foreground bg-secondary/60 border border-border/50 px-2 py-1 rounded">
              {acquirers.length} {acquirers.length === 1 ? "opção" : "opções"}
            </span>
          </header>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_1.4fr_0.7fr_auto] gap-4 items-center px-5 py-2.5 border-b border-border/40 bg-secondary/20">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Processador</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Tier</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Conversão</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 text-right">vs Topo</span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 text-right pr-2">Ação</span>
          </div>

          <div className="divide-y divide-border/40">
            {acquirers.map((acq) => {
              const isSelected = currentAcquirerId === acq.id;
              const isBlack = acq.type === "black";
              const isTop = acq.conversion_rate === bestConversion;
              const conversionPct = bestConversion > 0 ? (acq.conversion_rate / bestConversion) * 100 : 0;
              const deltaTop = acq.conversion_rate - bestConversion;
              const isLoading = savingId === acq.id;

              return (
                <div
                  key={acq.id}
                  onClick={() => !savingId && !isSelected && selectAcquirer(acq.id)}
                  className={cn(
                    "grid md:grid-cols-[1.6fr_0.8fr_1.4fr_0.7fr_auto] grid-cols-1 gap-4 items-center px-5 py-4 transition-colors duration-200 group",
                    isSelected ? "bg-primary/[0.04]" : "hover:bg-secondary/40 cursor-pointer"
                  )}
                >
                  {/* Name + description */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center text-[15px] font-display font-black shrink-0 border",
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : isBlack
                          ? "bg-foreground/[0.04] border-border text-foreground"
                          : "bg-secondary border-border/60 text-foreground/80"
                    )}>
                      {acq.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-black text-foreground text-[14px] tracking-tight truncate">{acq.name}</h3>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded border border-success/25 bg-success/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-success">
                            <span className="h-1 w-1 rounded-full bg-success animate-pulse" />
                            Ativo
                          </span>
                        )}
                      </div>
                      {acq.description && (
                        <p className="text-[11px] text-muted-foreground/75 font-medium line-clamp-1 mt-0.5">{acq.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Tier */}
                  <div>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]",
                      isBlack ? "border-border bg-foreground/5 text-foreground" : "border-info/25 bg-info/10 text-info"
                    )}>
                      {isBlack && <Crown className="h-2.5 w-2.5" />}
                      {acq.type}
                    </span>
                  </div>

                  {/* Conversion bar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-1.5 flex-1 min-w-[60px] rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-500",
                          isSelected ? "bg-primary" : isTop ? "bg-success" : "bg-foreground/30"
                        )}
                        style={{ width: `${conversionPct}%` }}
                      />
                    </div>
                    <span className="font-display font-black text-foreground tabular-nums text-[14px] shrink-0">
                      {acq.conversion_rate.toFixed(1)}<span className="text-muted-foreground/50 font-bold">%</span>
                    </span>
                  </div>

                  {/* Delta vs top */}
                  <div className="text-right">
                    {isTop ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-success">
                        <Sparkles className="h-3 w-3" /> Top
                      </span>
                    ) : (
                      <span className="font-display font-black text-warning/90 tabular-nums text-[12px]">
                        {deltaTop.toFixed(1)}pp
                      </span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex justify-end">
                    {isSelected ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary px-3 py-2 rounded-lg border border-primary/20 bg-primary/5">
                        <CheckCircle2 className="h-3 w-3" />
                        Em uso
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 rounded-lg text-[10px] font-display font-black uppercase tracking-[0.14em] gap-1.5 border-border/60 group-hover:border-primary/40 group-hover:text-primary transition-colors"
                        disabled={!!savingId}
                        onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* INFO strip */}
      <section className="bg-card rounded-[20px] border border-border overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/60">
          <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Como funciona o roteamento</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Sua escolha define qual gateway processa todas as novas transações.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border/40">
          {[
            { icon: Zap, label: "Roteamento instantâneo", desc: "Aplicado em novas vendas", tone: "info" as const },
            { icon: TrendingUp, label: "Taxa de aprovação", desc: "Acompanhada em tempo real", tone: "success" as const },
            { icon: Shield, label: "PCI DSS Level 1", desc: "Criptografia ponta-a-ponta", tone: "warning" as const },
          ].map((item) => {
            const tone = { info: "bg-info/10 text-info", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning" }[item.tone];
            return (
              <div key={item.label} className="bg-card px-4 py-3.5 flex items-center gap-2.5">
                <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", tone)}>
                  <item.icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-display font-black text-foreground truncate">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 font-medium truncate">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

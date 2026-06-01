import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Landmark, CheckCircle2, TrendingUp, Loader2,
  Shield, Zap, Crown, ArrowUpRight, Activity, Info, Layers,
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedAcq = acquirers.find(a => a.id === currentAcquirerId);
  const avgConversion = acquirers.length > 0 ? (acquirers.reduce((a, b) => a + b.conversion_rate, 0) / acquirers.length) : 0;
  const bestConversion = acquirers.length > 0 ? Math.max(...acquirers.map(a => a.conversion_rate)) : 0;
  const deltaVsAvg = selectedAcq ? selectedAcq.conversion_rate - avgConversion : 0;
  const deltaVsBest = selectedAcq ? selectedAcq.conversion_rate - bestConversion : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Adquirente</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Escolha o processador de pagamentos
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi
          label="Conversão atual"
          value={selectedAcq ? `${selectedAcq.conversion_rate}%` : "—"}
          sub={selectedAcq ? `${deltaVsAvg >= 0 ? "+" : ""}${deltaVsAvg.toFixed(1)}pp vs média` : "Selecione um processador"}
          icon={Activity}
          tone={selectedAcq && deltaVsAvg >= 0 ? "success" : "neutral"}
        />
        <FinanceiroKpi
          label="vs Melhor"
          value={selectedAcq ? (deltaVsBest === 0 ? "Top" : `${deltaVsBest.toFixed(1)}pp`) : "—"}
          sub={selectedAcq && deltaVsBest === 0 ? "Você está no topo" : `Top: ${bestConversion}%`}
          icon={TrendingUp}
          tone={selectedAcq && deltaVsBest === 0 ? "success" : "info"}
        />
        <FinanceiroKpi
          label="Conversão média"
          value={`${avgConversion.toFixed(1)}%`}
          sub={`Entre ${acquirers.length} processadores`}
          icon={Activity}
          tone="info"
        />
        <FinanceiroKpi
          label="Catálogo"
          value={String(acquirers.length)}
          sub={`${acquirers.length === 1 ? "Processador disponível" : "Processadores disponíveis"}`}
          icon={Layers}
          tone="neutral"
        />
      </FinanceiroKpiGrid>

      {/* Selected card */}
      {selectedAcq && (
        <section className="bg-card rounded-[24px] border border-primary/30 shadow-sm overflow-hidden animate-fade-in stagger-2">
          <div className="flex items-center gap-4 p-5">
            <div className={cn(
              "h-14 w-14 rounded-xl flex items-center justify-center shrink-0 border font-display font-black text-lg",
              selectedAcq.type === "black"
                ? "bg-foreground/5 border-border text-foreground"
                : "bg-primary/10 border-primary/30 text-primary"
            )}>
              {selectedAcq.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-display text-[20px] font-black tracking-tight text-foreground">{selectedAcq.name}</h2>
                <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Ativo
                </span>
                {selectedAcq.type === "black" && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-foreground/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                    <Crown className="h-3 w-3" /> Black
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground/80 font-medium line-clamp-2">
                {selectedAcq.description || "Processador ativo para roteamento de novas transações."}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground mb-1">Conversão</p>
              <p className="font-display text-[32px] font-black text-success leading-none tabular-nums">
                {selectedAcq.conversion_rate}<span className="text-[16px] text-success/70 font-bold">%</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Acquirers list */}
      {acquirers.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-secondary border border-border/50 flex items-center justify-center">
            <Landmark className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <p className="text-[14px] text-foreground font-display font-bold">Nenhuma adquirente disponível</p>
          <p className="text-[12px] text-muted-foreground/70 font-medium">O administrador ainda não liberou processadores para seleção.</p>
        </div>
      ) : (
        <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-3">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Activity className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div>
                <h2 className="font-black text-foreground tracking-tight">Processadores disponíveis</h2>
                <p className="text-[11px] text-muted-foreground/70 font-medium">Ordenados por taxa de conversão · Clique para selecionar</p>
              </div>
            </div>
            <span className="text-[10px] font-black tabular-nums text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
              {acquirers.length}
            </span>
          </div>

          <div className="divide-y divide-border/40">
            {acquirers.map((acq) => {
              const isSelected = currentAcquirerId === acq.id;
              const isBlack = acq.type === "black";
              const isTop = acq.conversion_rate === bestConversion;
              const conversionPct = bestConversion > 0 ? (acq.conversion_rate / bestConversion) * 100 : 0;

              return (
                <div
                  key={acq.id}
                  onClick={() => !saving && !isSelected && selectAcquirer(acq.id)}
                  className={cn(
                    "px-5 py-4 transition-colors duration-200 group cursor-pointer",
                    isSelected ? "bg-primary/5" : "hover:bg-secondary/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={cn(
                        "h-11 w-11 rounded-xl flex items-center justify-center text-base font-display font-black shrink-0 border",
                        isSelected
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : isBlack
                            ? "bg-foreground/5 border-border text-foreground"
                            : "bg-secondary border-border/50 text-foreground/80"
                      )}>
                        {acq.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-display font-black text-foreground text-[14px] tracking-tight">{acq.name}</h3>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]",
                            isBlack ? "border-border bg-foreground/5 text-foreground" : "border-info/20 bg-info/10 text-info"
                          )}>
                            {isBlack && <Crown className="h-2.5 w-2.5" />}
                            {acq.type}
                          </span>
                          {isTop && !isSelected && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-success">
                              <TrendingUp className="h-2.5 w-2.5" /> Top
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-primary">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Ativo
                            </span>
                          )}
                        </div>
                        {acq.description && (
                          <p className="text-[11px] text-muted-foreground/80 font-medium line-clamp-1">{acq.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="text-[18px] font-display font-black text-foreground tabular-nums leading-none">
                          {acq.conversion_rate}<span className="text-xs text-muted-foreground/60 font-normal">%</span>
                        </span>
                        <div className="h-1 w-24 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-[width] duration-300", isSelected ? "bg-primary" : isTop ? "bg-success" : "bg-foreground/40")}
                            style={{ width: `${conversionPct}%` }}
                          />
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-primary px-3">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Selecionado
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 rounded-lg text-[11px] font-display font-black uppercase tracking-[0.12em] gap-1.5 border-border/50"
                          disabled={saving}
                          onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
                          Selecionar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* INFO */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/50">
          <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Como o processador é usado</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Sua escolha define qual gateway processa todas as novas transações.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border/40">
          {[
            { icon: Zap, label: "Roteamento instantâneo", desc: "Aplicado em novas vendas", tone: "info" as const },
            { icon: TrendingUp, label: "Taxa de aprovação", desc: "% transações aprovadas", tone: "success" as const },
            { icon: Shield, label: "PCI DSS Level 1", desc: "Criptografia ponta-a-ponta", tone: "warning" as const },
          ].map((item) => {
            const tone = { info: "bg-info/10 text-info", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning" }[item.tone];
            return (
              <div key={item.label} className="bg-card px-4 py-3 flex items-center gap-2.5">
                <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", tone)}>
                  <item.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
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

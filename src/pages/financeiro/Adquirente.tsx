import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Landmark, CheckCircle2, TrendingUp, Loader2,
  Shield, Zap, Crown, ArrowUpRight, Activity, Info, Layers,
  ChevronRight, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const bestConversion = acquirers.length > 0 ? Math.max(...acquirers.map(a => a.conversion_rate)) : 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] pb-10">
      <div className="px-5 pt-4 sm:px-8 sm:pt-6">
        
        {/* ─── HEADER PREMIUM ─── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 bg-primary/10 border border-primary/25 rounded-xl flex items-center justify-center">
                <Layers className="h-4 w-4 text-primary" strokeWidth={2.5} />
              </div>
              <h1 className="text-[13px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">Roteamento de Vendas</h1>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-x-12 gap-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Processador Ativo</p>
                <h2 className="font-display text-[42px] md:text-[54px] font-black leading-none tracking-[-0.05em] text-foreground">
                  {selectedAcq?.name || "Nenhum"}
                </h2>
              </div>
              {selectedAcq && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Conversão Atual</p>
                  <h3 className="font-display text-[32px] md:text-[40px] font-black leading-none tracking-[-0.05em] text-success tabular-nums">
                    {selectedAcq.conversion_rate}%
                  </h3>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-muted/40 border border-border/40 flex items-center gap-2.5">
              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gateway Online</span>
            </div>
          </div>
        </header>

        {/* ─── GRID DE PROCESSADORES ─── */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Activity size={16} strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Processadores Disponíveis</h2>
              </div>
              <span className="text-[10px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-md uppercase tracking-widest">
                Total: {acquirers.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {acquirers.map((acq) => {
                const isSelected = currentAcquirerId === acq.id;
                const isBlack = acq.type === "black";
                const isTop = acq.conversion_rate === bestConversion;

                return (
                  <div
                    key={acq.id}
                    onClick={() => !saving && !isSelected && selectAcquirer(acq.id)}
                    className={cn(
                      "p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer relative overflow-hidden group",
                      isSelected 
                        ? "bg-primary/[0.03] border-primary/40 shadow-lg shadow-primary/5" 
                        : "bg-card border-border/60 hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-6 relative z-10">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-display font-black border transition-transform duration-500 group-hover:scale-110",
                          isSelected 
                            ? "bg-primary text-primary-foreground border-transparent" 
                            : isBlack ? "bg-foreground/5 border-border text-foreground" : "bg-muted border-border/60 text-muted-foreground"
                        )}>
                          {acq.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-black text-lg text-foreground tracking-tight">{acq.name}</h3>
                            {isBlack && (
                              <span className="px-2 py-0.5 rounded-md bg-foreground/5 border border-border text-[9px] font-black uppercase tracking-widest">
                                <Crown size={10} className="inline mr-1" /> Black
                              </span>
                            )}
                            {isTop && !isSelected && (
                              <span className="px-2 py-0.5 rounded-md bg-success/10 border border-success/20 text-[9px] font-black uppercase tracking-widest text-success">
                                Top Conversão
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-bold leading-relaxed mt-1 line-clamp-1">
                            {acq.description || "Processador de alta performance para roteamento dinâmico."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 opacity-50">Taxa de Conversão</p>
                          <p className={cn(
                            "text-2xl font-black tabular-nums tracking-tighter",
                            isSelected ? "text-primary" : isTop ? "text-success" : "text-foreground"
                          )}>
                            {acq.conversion_rate}%
                          </p>
                        </div>
                        
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        )}>
                          {isSelected ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg]">
                        <CheckCircle2 size={160} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="p-8 rounded-[2rem] bg-card border border-border/60 space-y-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Shield size={20} />
                </div>
                <h3 className="font-black text-foreground uppercase tracking-widest text-[11px]">Segurança & Roteamento</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { icon: Zap, label: "Roteamento Inteligente", desc: "Aplicação imediata em novas vendas.", color: "text-info" },
                  { icon: TrendingUp, label: "Foco em Conversão", desc: "Gateways otimizados para aprovação.", color: "text-success" },
                  { icon: Landmark, label: "Payout Automático", desc: "Saldo liberado conforme adquirente.", color: "text-primary" }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-muted/30 border border-border/40 transition-colors hover:bg-muted/50">
                    <item.icon className={cn("h-5 w-5 shrink-0 mt-0.5", item.color)} />
                    <div>
                      <p className="text-[12px] font-black text-foreground uppercase tracking-tight">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={14} className="text-primary" />
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Informação Importante</p>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
                  A troca de adquirente é processada instantaneamente. Vendas já realizadas continuam no processador de origem até o payout.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

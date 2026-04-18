import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Landmark, CheckCircle2, TrendingUp, Loader2,
 Shield, Zap, Crown, ArrowUpRight, Activity, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  <div className="relative animate-fade-in">
   <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-5 pb-10">

    {/* ════ SELECTED PROCESSOR SUMMARY ════ */}
    <motion.section
     initial={{ opacity: 0, y: 8 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.4 }}
     className="rounded-2xl border border-border bg-card overflow-hidden"
    >
     <div className="flex flex-col lg:flex-row lg:items-stretch">
      {/* Identity */}
      <div className="flex-1 p-6 lg:border-r border-border">
       <div className="flex items-start gap-4">
        <div className={cn(
         "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
         selectedAcq
          ? selectedAcq.type === "black"
           ? "bg-foreground/5 ring-1 ring-border text-foreground font-display font-black text-base"
           : "bg-primary/10 ring-1 ring-primary/20 text-primary font-display font-black text-base"
          : "bg-muted/40 ring-1 ring-border"
        )}>
         {selectedAcq ? selectedAcq.name[0] : <Landmark className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground">
           Processador Ativo
          </span>
          {selectedAcq ? (
           <span className="inline-flex items-center gap-1 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-success">
            <span className="relative flex h-1.5 w-1.5">
             <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-50" />
             <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Roteando
           </span>
          ) : (
           <span className="inline-flex items-center gap-1 rounded border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-warning">
            <Info className="h-2.5 w-2.5" /> Não selecionado
           </span>
          )}
          {selectedAcq?.type === "black" && (
           <span className="inline-flex items-center gap-1 rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-foreground">
            <Crown className="h-2.5 w-2.5" /> Black
           </span>
          )}
         </div>
         <h1 className="text-xl font-heading font-black text-foreground tracking-[-0.02em]">
          {selectedAcq ? selectedAcq.name : "Nenhum processador selecionado"}
         </h1>
         <p className="text-xs text-muted-foreground font-display mt-0.5 line-clamp-2">
          {selectedAcq?.description || "Escolha uma adquirente abaixo para iniciar o roteamento de transações."}
         </p>
        </div>
       </div>
      </div>

      {/* Live metrics tied to the selected acquirer */}
      <div className="grid grid-cols-3 lg:w-[520px] border-t lg:border-t-0 border-border">
       <div className="p-5 border-r border-border">
        <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Conversão</p>
        <p className="text-2xl font-heading font-black text-foreground tabular-nums leading-none">
         {selectedAcq ? `${selectedAcq.conversion_rate}` : "—"}
         {selectedAcq && <span className="text-sm text-muted-foreground/60 font-normal">%</span>}
        </p>
        {selectedAcq && (
         <p className={cn(
          "text-[10px] font-display font-bold mt-1 flex items-center gap-1",
          deltaVsAvg >= 0 ? "text-success" : "text-destructive"
         )}>
          <TrendingUp className={cn("h-2.5 w-2.5", deltaVsAvg < 0 && "rotate-180")} />
          {deltaVsAvg >= 0 ? "+" : ""}{deltaVsAvg.toFixed(1)}pp vs média
         </p>
        )}
       </div>
       <div className="p-5 border-r border-border">
        <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">vs Melhor</p>
        <p className="text-2xl font-heading font-black text-foreground tabular-nums leading-none">
         {selectedAcq
          ? deltaVsBest === 0
           ? "Top"
           : `${deltaVsBest.toFixed(1)}`
          : "—"}
         {selectedAcq && deltaVsBest !== 0 && <span className="text-sm text-muted-foreground/60 font-normal">pp</span>}
        </p>
        <p className="text-[10px] text-muted-foreground/60 font-display mt-1">
         {selectedAcq && deltaVsBest === 0 ? "Você está no topo" : `Top: ${bestConversion}%`}
        </p>
       </div>
       <div className="p-5 flex flex-col justify-between">
        <div>
         <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Catálogo</p>
         <p className="text-2xl font-heading font-black text-foreground tabular-nums leading-none">
          {acquirers.length}
         </p>
        </div>
        <p className="text-[10px] text-muted-foreground/60 font-display mt-1">Média {avgConversion.toFixed(1)}%</p>
       </div>
      </div>
     </div>
    </motion.section>

    {/* ════ ACQUIRERS LIST ════ */}
    {acquirers.length === 0 ? (
     <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-xl bg-muted/30 border border-border flex items-center justify-center mx-auto mb-4">
       <Landmark className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-display font-bold text-foreground mb-1">Nenhuma adquirente disponível</h3>
      <p className="text-xs text-muted-foreground">O administrador ainda não liberou processadores para seleção.</p>
     </div>
    ) : (
     <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
     >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
       <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
         <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
         <h3 className="text-sm font-display font-black text-foreground tracking-tight">Processadores Disponíveis</h3>
         <p className="text-[11px] text-muted-foreground font-display">Ordenados pela maior taxa de conversão · Clique para selecionar</p>
        </div>
       </div>
       <span className="text-[11px] font-display font-bold text-muted-foreground">
        {acquirers.length} {acquirers.length === 1 ? "opção" : "opções"}
       </span>
      </div>

      <div className="divide-y divide-border">
       {acquirers.map((acq, i) => {
        const isSelected = currentAcquirerId === acq.id;
        const isBlack = acq.type === "black";
        const isTop = acq.conversion_rate === bestConversion;
        const conversionPct = bestConversion > 0 ? (acq.conversion_rate / bestConversion) * 100 : 0;

        return (
         <motion.div
          key={acq.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className={cn(
           "px-6 py-4 transition-colors group cursor-pointer",
           isSelected ? "bg-primary/[0.03]" : "hover:bg-muted/30"
          )}
          onClick={() => !saving && !isSelected && selectAcquirer(acq.id)}
         >
          <div className="flex items-center justify-between gap-4">
           <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className={cn(
             "h-11 w-11 rounded-lg flex items-center justify-center text-base font-display font-black shrink-0 border",
             isSelected
              ? "bg-primary/10 border-primary/30 text-primary"
              : isBlack
               ? "bg-foreground/5 border-border text-foreground"
               : "bg-muted/50 border-border text-foreground/70"
            )}>
             {acq.name[0]}
            </div>
            <div className="min-w-0 flex-1">
             <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-display font-black text-foreground text-sm">{acq.name}</h4>
              <span className={cn(
               "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider",
               isBlack
                ? "border-border bg-foreground/5 text-foreground"
                : "border-info/20 bg-info/10 text-info"
              )}>
               {isBlack && <Crown className="h-2.5 w-2.5" />}
               {acq.type}
              </span>
              {isTop && !isSelected && (
               <span className="inline-flex items-center gap-1 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-success">
                <TrendingUp className="h-2.5 w-2.5" /> Maior conversão
               </span>
              )}
              {isSelected && (
               <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-primary">
                <CheckCircle2 className="h-2.5 w-2.5" /> Ativo
               </span>
              )}
             </div>
             {acq.description && (
              <p className="text-[11px] text-muted-foreground font-display line-clamp-1">{acq.description}</p>
             )}
            </div>
           </div>

           {/* Conversion bar + value */}
           <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex flex-col items-end gap-1">
             <span className="text-lg font-heading font-black text-foreground tabular-nums leading-none">
              {acq.conversion_rate}<span className="text-xs text-muted-foreground/60 font-normal">%</span>
             </span>
             <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
              <div
               className={cn("h-full rounded-full", isSelected ? "bg-primary" : isTop ? "bg-success" : "bg-foreground/40")}
               style={{ width: `${conversionPct}%` }}
              />
             </div>
            </div>

            {isSelected ? (
             <div className="flex items-center gap-1.5 text-xs font-display font-bold text-primary px-3">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selecionado
             </div>
            ) : (
             <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 rounded-lg text-xs font-display font-bold gap-1.5"
              disabled={saving}
              onClick={(e) => { e.stopPropagation(); selectAcquirer(acq.id); }}
             >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
              Selecionar
             </Button>
            )}
           </div>
          </div>
         </motion.div>
        );
       })}
      </div>
     </motion.section>
    )}

    {/* ════ INFO STRIP ════ */}
    <div className="rounded-xl border border-border bg-muted/20 p-4">
     <div className="flex items-start gap-3 mb-3">
      <div className="h-8 w-8 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center shrink-0">
       <Info className="h-3.5 w-3.5 text-info" />
      </div>
      <div>
       <p className="text-xs font-display font-bold text-foreground">Como o processador é usado</p>
       <p className="text-[11px] text-muted-foreground font-display">
        Sua escolha define qual gateway processa todas as novas transações (cartão e PIX). Pagamentos em andamento não são afetados.
       </p>
      </div>
     </div>
     <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {[
       { icon: Zap, label: "Roteamento instantâneo", desc: "Aplicado em novas vendas" },
       { icon: TrendingUp, label: "Taxa de aprovação", desc: "% transações aprovadas" },
       { icon: Shield, label: "PCI DSS Level 1", desc: "Criptografia ponta-a-ponta" },
      ].map((item) => (
       <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card border border-border">
        <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
         <p className="text-[11px] font-display font-bold text-foreground truncate">{item.label}</p>
         <p className="text-[10px] text-muted-foreground font-display truncate">{item.desc}</p>
        </div>
       </div>
      ))}
     </div>
    </div>
   </div>
  </div>
 );
}

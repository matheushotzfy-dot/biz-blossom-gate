import { useFees } from "@/hooks/useQueryData";
import { Percent, Info, DollarSign, Calculator, Receipt, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Taxas() {
 const { data: fees = [] } = useFees();
 const percentFees = fees.filter(f => f.fee_type === "percentage");
 const fixedFees = fees.filter(f => f.fee_type === "fixed");
 const avgPercent = percentFees.length > 0 ? (percentFees.reduce((a, f) => a + f.value, 0) / percentFees.length) : 0;
 const totalFixed = fixedFees.reduce((a, f) => a + f.value, 0);

 // Simulation example: R$ 1.000 transaction
 const exampleAmount = 1000;
 const examplePctCost = exampleAmount * (avgPercent / 100);
 const exampleNet = exampleAmount - examplePctCost - totalFixed;

 return (
  <div className="relative animate-fade-in">
   <div className="relative z-[1] mx-auto w-full max-w-[1180px] space-y-5 pb-10">

    {/* ════ HEADER + LIVE SIMULATION ════ */}
    <motion.section
     initial={{ opacity: 0, y: 8 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.4 }}
     className="rounded-2xl border border-border bg-card overflow-hidden"
    >
     <div className="flex flex-col lg:flex-row lg:items-stretch">
      <div className="flex-1 p-6 lg:border-r border-border">
       <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
         <Percent className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
         <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground">
           Estrutura de Taxas
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9px] font-display font-bold uppercase tracking-wider text-success">
           <ShieldCheck className="h-2.5 w-2.5" /> Transparente
          </span>
         </div>
         <h1 className="text-xl font-heading font-black text-foreground tracking-[-0.02em]">
          Taxas e Tarifas
         </h1>
         <p className="text-xs text-muted-foreground font-display mt-0.5">
          {percentFees.length} percentual{percentFees.length !== 1 ? "is" : ""} · {fixedFees.length} valor{fixedFees.length !== 1 ? "es" : ""} fixo{fixedFees.length !== 1 ? "s" : ""}
         </p>
        </div>
       </div>
      </div>

      {/* Simulação ao vivo */}
      <div className="lg:w-[520px] border-t lg:border-t-0 border-border bg-muted/10 p-5">
       <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        <Calculator className="h-3 w-3" />
        Simulação · venda de R$ 1.000,00
       </div>
       <div className="space-y-1.5 text-xs font-display">
        <div className="flex items-center justify-between">
         <span className="text-muted-foreground">Valor bruto</span>
         <span className="font-mono font-bold text-foreground tabular-nums">R$ 1.000,00</span>
        </div>
        <div className="flex items-center justify-between">
         <span className="text-muted-foreground">Taxa percentual ({avgPercent.toFixed(2)}%)</span>
         <span className="font-mono font-bold text-destructive tabular-nums">−R$ {examplePctCost.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
         <span className="text-muted-foreground">Tarifas fixas</span>
         <span className="font-mono font-bold text-destructive tabular-nums">−R$ {totalFixed.toFixed(2)}</span>
        </div>
        <div className="border-t border-border my-2" />
        <div className="flex items-center justify-between">
         <span className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-foreground">Líquido estimado</span>
         <span className="font-heading font-black text-success tabular-nums text-base">R$ {exampleNet.toFixed(2)}</span>
        </div>
       </div>
      </div>
     </div>
    </motion.section>

    {fees.length === 0 ? (
     <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="h-14 w-14 rounded-xl bg-muted/30 border border-border flex items-center justify-center mx-auto mb-4">
       <Percent className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-display font-bold text-foreground mb-1">Nenhuma taxa configurada</h3>
      <p className="text-xs text-muted-foreground">As taxas serão exibidas quando configuradas pelo administrador</p>
     </div>
    ) : (
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* ════ PERCENTUAIS ════ */}
      <motion.section
       initial={{ opacity: 0, y: 8 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ delay: 0.1 }}
       className="rounded-2xl border border-border bg-card overflow-hidden"
      >
       <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-info/[0.03]">
        <div className="flex items-center gap-2.5">
         <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
          <Percent className="h-3.5 w-3.5 text-info" />
         </div>
         <div>
          <h3 className="text-sm font-display font-black text-foreground tracking-tight">Taxas Percentuais</h3>
          <p className="text-[10px] text-muted-foreground font-display">Aplicadas sobre o valor bruto da transação</p>
         </div>
        </div>
        <span className="text-[11px] font-display font-bold text-info tabular-nums">
         {percentFees.length} {percentFees.length === 1 ? "taxa" : "taxas"}
        </span>
       </div>

       {percentFees.length === 0 ? (
        <div className="px-5 py-10 text-center">
         <p className="text-xs text-muted-foreground font-display">Nenhuma taxa percentual ativa</p>
        </div>
       ) : (
        <div className="divide-y divide-border">
         {percentFees.map((fee, i) => (
          <motion.div
           key={fee.id}
           initial={{ opacity: 0 }} animate={{ opacity: 1 }}
           transition={{ duration: 0.2, delay: i * 0.04 }}
           className="px-5 py-4 hover:bg-muted/20 transition-colors"
          >
           <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
             <h4 className="text-sm font-display font-bold text-foreground">{fee.name}</h4>
             {fee.description && (
              <p className="text-[11px] text-muted-foreground font-display mt-0.5 line-clamp-2">{fee.description}</p>
             )}
            </div>
            <div className="text-right shrink-0">
             <p className="text-2xl font-heading font-black text-foreground tabular-nums leading-none tracking-tight">
              {fee.value}<span className="text-sm text-info/70 font-bold">%</span>
             </p>
             <p className="text-[10px] text-muted-foreground font-display mt-1">por transação</p>
            </div>
           </div>
          </motion.div>
         ))}
        </div>
       )}

       {percentFees.length > 0 && (
        <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between text-[11px] font-display">
         <span className="font-bold uppercase tracking-[0.12em] text-muted-foreground">Média</span>
         <span className="font-mono font-bold text-foreground tabular-nums">{avgPercent.toFixed(2)}%</span>
        </div>
       )}
      </motion.section>

      {/* ════ FIXOS ════ */}
      <motion.section
       initial={{ opacity: 0, y: 8 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ delay: 0.15 }}
       className="rounded-2xl border border-border bg-card overflow-hidden"
      >
       <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-warning/[0.03]">
        <div className="flex items-center gap-2.5">
         <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
          <DollarSign className="h-3.5 w-3.5 text-warning" />
         </div>
         <div>
          <h3 className="text-sm font-display font-black text-foreground tracking-tight">Tarifas Fixas</h3>
          <p className="text-[10px] text-muted-foreground font-display">Cobradas por operação realizada</p>
         </div>
        </div>
        <span className="text-[11px] font-display font-bold text-warning tabular-nums">
         {fixedFees.length} {fixedFees.length === 1 ? "tarifa" : "tarifas"}
        </span>
       </div>

       {fixedFees.length === 0 ? (
        <div className="px-5 py-10 text-center">
         <p className="text-xs text-muted-foreground font-display">Nenhuma tarifa fixa ativa</p>
        </div>
       ) : (
        <div className="divide-y divide-border">
         {fixedFees.map((fee, i) => (
          <motion.div
           key={fee.id}
           initial={{ opacity: 0 }} animate={{ opacity: 1 }}
           transition={{ duration: 0.2, delay: i * 0.04 }}
           className="px-5 py-4 hover:bg-muted/20 transition-colors"
          >
           <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
             <h4 className="text-sm font-display font-bold text-foreground">{fee.name}</h4>
             {fee.description && (
              <p className="text-[11px] text-muted-foreground font-display mt-0.5 line-clamp-2">{fee.description}</p>
             )}
            </div>
            <div className="text-right shrink-0">
             <p className="text-2xl font-heading font-black text-foreground tabular-nums leading-none tracking-tight">
              <span className="text-sm text-warning/70 font-bold">R$ </span>
              {Number(fee.value).toFixed(2)}
             </p>
             <p className="text-[10px] text-muted-foreground font-display mt-1">por operação</p>
            </div>
           </div>
          </motion.div>
         ))}
        </div>
       )}

       {fixedFees.length > 0 && (
        <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between text-[11px] font-display">
         <span className="font-bold uppercase tracking-[0.12em] text-muted-foreground">Total combinado</span>
         <span className="font-mono font-bold text-foreground tabular-nums">R$ {totalFixed.toFixed(2)}</span>
        </div>
       )}
      </motion.section>
     </div>
    )}

    {/* ════ COMO É CALCULADO ════ */}
    <motion.div
     initial={{ opacity: 0, y: 8 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ delay: 0.2 }}
     className="rounded-2xl border border-border bg-card overflow-hidden"
    >
     <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
       <Receipt className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
       <h3 className="text-sm font-display font-black text-foreground tracking-tight">Fórmula de cálculo</h3>
       <p className="text-[10px] text-muted-foreground font-display">Como o valor líquido é calculado em cada transação</p>
      </div>
     </div>

     <div className="p-5">
      <div className="rounded-xl bg-muted/30 border border-border p-4 font-mono text-xs sm:text-sm text-foreground tabular-nums">
       <span className="text-muted-foreground">líquido</span>
       <span className="text-muted-foreground/60 mx-2">=</span>
       <span className="font-bold">bruto</span>
       <span className="text-destructive mx-2">−</span>
       <span className="font-bold">(bruto × %)</span>
       <span className="text-destructive mx-2">−</span>
       <span className="font-bold">tarifas fixas</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
       {[
        { label: "Percentuais", desc: "Calculadas sobre o valor bruto", color: "info" },
        { label: "Fixas", desc: "Cobradas por operação", color: "warning" },
        { label: "Transparência", desc: "Exibidas antes da confirmação", color: "success" },
       ].map((item) => (
        <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/10">
         <span className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          item.color === "info" && "bg-info",
          item.color === "warning" && "bg-warning",
          item.color === "success" && "bg-success",
         )} />
         <div className="min-w-0">
          <p className="text-[11px] font-display font-bold text-foreground">{item.label}</p>
          <p className="text-[10px] text-muted-foreground font-display truncate">{item.desc}</p>
         </div>
        </div>
       ))}
      </div>

      <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-info/[0.04] border border-info/15">
       <Info className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
       <p className="text-[11px] text-muted-foreground font-display">
        Os valores acima são informativos. A taxa exata aplicada pode variar conforme o método de pagamento e perfil de risco da operação.
       </p>
      </div>
     </div>
    </motion.div>
   </div>
  </div>
 );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Percent, Zap } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Taxas() {
  const [fees, setFees] = useState<Tables<"fees">[]>([]);

  useEffect(() => {
    supabase.from("fees").select("*").order("created_at").then(({ data }) => {
      if (data) setFees(data);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 text-foreground font-display">
          <Percent className="h-6 w-6 text-primary" /> Taxas e Tarifas
        </h1>
        <p className="text-foreground/40 text-sm mt-1">Taxas aplicadas às suas transações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {fees.map((fee) => (
          <div key={fee.id} className="glass-card-hover rounded-2xl p-5 group">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground">{fee.name}</h3>
            </div>
            <p className="text-3xl font-extrabold text-foreground font-display">
              {fee.fee_type === "percentage" ? `${fee.value}%` : `R$ ${Number(fee.value).toFixed(2)}`}
            </p>
            <p className="text-sm text-foreground/40 mt-2">{fee.description}</p>
            <span className="inline-block mt-3 text-xs px-3 py-1.5 rounded-xl bg-white/[0.04] text-foreground/50 font-semibold capitalize">
              {fee.fee_type === "percentage" ? "Percentual" : "Valor Fixo"}
            </span>
          </div>
        ))}
        {fees.length === 0 && (
          <div className="col-span-full glass-card rounded-2xl p-8 text-center text-foreground/30">
            Nenhuma taxa configurada
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-bold mb-4 text-foreground">Como as taxas funcionam</h3>
        <div className="space-y-3 text-sm text-foreground/50">
          <p>• <strong className="text-foreground">Taxas percentuais</strong> são calculadas sobre o valor bruto da transação.</p>
          <p>• <strong className="text-foreground">Taxas fixas</strong> são cobradas por operação realizada.</p>
          <p>• O valor líquido é calculado automaticamente: <span className="text-foreground font-mono">valor bruto - taxas = valor líquido</span>.</p>
          <p>• As taxas podem variar conforme o método de pagamento utilizado.</p>
        </div>
      </div>
    </div>
  );
}

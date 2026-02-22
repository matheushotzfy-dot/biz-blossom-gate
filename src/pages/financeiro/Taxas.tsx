import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Percent } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Taxas() {
  const [fees, setFees] = useState<Tables<"fees">[]>([]);

  useEffect(() => {
    supabase.from("fees").select("*").order("created_at").then(({ data }) => {
      if (data) setFees(data);
    });
  }, []);

  return (
    <div className="space-y-6 dark">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Percent className="h-6 w-6 text-primary" /> Taxas e Tarifas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Taxas aplicadas às suas transações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {fees.map((fee) => (
          <div key={fee.id} className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{fee.name}</h3>
            </div>
            <p className="text-2xl font-bold">
              {fee.fee_type === "percentage" ? `${fee.value}%` : `R$ ${Number(fee.value).toFixed(2)}`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{fee.description}</p>
            <span className="inline-block mt-3 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
              {fee.fee_type === "percentage" ? "Percentual" : "Valor Fixo"}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">Como as taxas funcionam</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>• <strong className="text-foreground">Taxas percentuais</strong> são calculadas sobre o valor bruto da transação.</p>
          <p>• <strong className="text-foreground">Taxas fixas</strong> são cobradas por operação realizada.</p>
          <p>• O valor líquido é calculado automaticamente: <span className="text-foreground font-mono">valor bruto - taxas = valor líquido</span>.</p>
          <p>• As taxas podem variar conforme o método de pagamento utilizado.</p>
        </div>
      </div>
    </div>
  );
}

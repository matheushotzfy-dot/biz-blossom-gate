import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Percent, Zap } from "lucide-react";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Taxas() {
  const [fees, setFees] = useState<Tables<"fees">[]>([]);

  useEffect(() => {
    supabase.from("fees").select("*").order("created_at").then(({ data }) => { if (data) setFees(data); });
  }, []);

  return (
    <PageShell>
      <PageTitle icon={<Percent className="h-6 w-6" />} title="Taxas e Tarifas" subtitle="Taxas aplicadas às suas transações" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {fees.map((fee) => (
          <Panel key={fee.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground text-[14px]">{fee.name}</h3>
            </div>
            <p className="text-[28px] font-extrabold text-foreground">
              {fee.fee_type === "percentage" ? `${fee.value}%` : `R$ ${Number(fee.value).toFixed(2)}`}
            </p>
            <p className="text-[12px] text-muted-foreground mt-2">{fee.description}</p>
            <span className="inline-block mt-3 text-[10px] px-3 py-1 rounded-lg font-semibold capitalize text-muted-foreground bg-muted/50">
              {fee.fee_type === "percentage" ? "Percentual" : "Valor Fixo"}
            </span>
          </Panel>
        ))}
        {fees.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground text-[13px]">Nenhuma taxa configurada</div>
        )}
      </div>

      <Panel>
        <h3 className="font-bold mb-4 text-foreground text-[14px]">Como as taxas funcionam</h3>
        <div className="space-y-2.5 text-[13px] text-muted-foreground">
          <p>• <strong className="text-foreground/70">Taxas percentuais</strong> são calculadas sobre o valor bruto da transação.</p>
          <p>• <strong className="text-foreground/70">Taxas fixas</strong> são cobradas por operação realizada.</p>
          <p>• O valor líquido é calculado: <span className="text-foreground/60 font-mono text-[12px]">valor bruto - taxas = líquido</span>.</p>
        </div>
      </Panel>
    </PageShell>
  );
}

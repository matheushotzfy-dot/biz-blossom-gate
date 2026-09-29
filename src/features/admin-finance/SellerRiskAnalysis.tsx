import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SellerSelect } from "./SellerSelect";
import type { Tables } from "@/integrations/supabase/types";

interface Analysis {
  risk_level: "low" | "medium" | "high" | "critical";
  summary: string;
  risks: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
  next_actions: { priority: number; action: string; reason: string }[];
}

const LEVEL: Record<Analysis["risk_level"], { label: string; cls: string }> = {
  low: { label: "Risco baixo", cls: "border-primary/30 bg-primary/10 text-primary" },
  medium: { label: "Risco médio", cls: "border-border bg-accent text-accent-foreground" },
  high: { label: "Risco alto", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  critical: { label: "Risco crítico", cls: "border-destructive bg-destructive text-destructive-foreground" },
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Admin picks a seller + period; the server aggregates facts and asks the AI for risks and next actions. */
export function SellerRiskAnalysis({ profiles }: { profiles: Tables<"profiles">[] }) {
  const [seller, setSeller] = useState("");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 90 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  const run = async () => {
    if (!seller) { toast.error("Selecione um seller"); return; }
    const end = new Date(to); end.setDate(end.getDate() + 1);
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke("analyze-seller-risk", {
      body: { sellerId: seller, from: new Date(from).toISOString(), to: end.toISOString() },
    });
    setLoading(false);
    if (error || !data?.success) {
      let msg = (data as { error?: string } | null)?.error;
      if (!msg && error && "context" in error) {
        try { msg = (await (error as { context: Response }).context.json())?.error; } catch { /* ignore */ }
      }
      toast.error(msg || "Não foi possível concluir a análise");
      return;
    }
    setResult(data.analysis as Analysis);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <div className="space-y-1"><Label>Seller</Label><SellerSelect profiles={profiles} value={seller} onChange={setSeller} /></div>
        <div className="space-y-1"><Label htmlFor="ra-from">De</Label><Input id="ra-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ra-to">Até</Label><Input id="ra-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          {loading ? "Analisando..." : "Analisar com IA"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">A análise usa apenas números agregados do período (sem dados pessoais de compradores) e fica registrada na auditoria.</p>

      {result && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", LEVEL[result.risk_level].cls)}>{LEVEL[result.risk_level].label}</span>
          <p className="text-sm leading-relaxed">{result.summary}</p>
          {result.risks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Riscos identificados</h4>
              {result.risks.map((r, i) => (
                <div key={`${r.title}-${i}`} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{r.title} <span className={cn("ml-1 text-[11px]", r.severity === "high" ? "text-destructive" : "text-muted-foreground")}>({r.severity === "high" ? "alto" : r.severity === "medium" ? "médio" : "baixo"})</span></p>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          )}
          {result.next_actions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximas ações</h4>
              <ol className="space-y-2">
                {result.next_actions.map((a) => (
                  <li key={a.priority} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{a.priority}</span>
                    <div><p className="font-medium">{a.action}</p><p className="text-xs text-muted-foreground">{a.reason}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

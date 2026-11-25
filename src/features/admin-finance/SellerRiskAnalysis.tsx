import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { cn } from "@/lib/utils";
import { SellerSelect } from "./SellerSelect";
import { brDay, resolveRange } from "./FinancialMetricsPanel";

export interface Analysis {
  risk_level: "low" | "medium" | "high" | "critical";
  summary: string;
  risks: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
  next_actions: { priority: number; action: string; reason: string }[];
}
/** A função de IA recusa períodos maiores que um ano. */
export const MAX_AI_DAYS = 366;

const LEVEL: Record<Analysis["risk_level"], { label: string; cls: string }> = {
  low: { label: "Risco baixo", cls: "border-success/30 bg-success/10 text-success" },
  medium: { label: "Risco médio", cls: "border-warning/30 bg-warning/10 text-warning" },
  high: { label: "Risco alto", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  critical: { label: "Risco crítico", cls: "border-destructive bg-destructive text-destructive-foreground" },
};
const SEVERITY: Record<string, string> = { high: "alto", medium: "médio", low: "baixo" };

/** Valida seller e período antes de gastar uma chamada de IA. */
export function validateAnalysis(seller: string, from: string, to: string): { error: string | null; s: string; e: string } {
  if (!seller) return { error: "Escolha um seller para analisar.", s: "", e: "" };
  const r = resolveRange(from, to);
  // O limite da IA (1 ano) é menor que o das métricas; vale a mensagem dele mesmo quando o período passa dos dois.
  const days = (Date.parse(`${to}T00:00:00-03:00`) - Date.parse(`${from}T00:00:00-03:00`)) / 86_400_000 + 1;
  if (days > MAX_AI_DAYS) return { error: "A análise por IA aceita no máximo 1 ano de período.", s: "", e: "" };
  return r;
}

/** Quem pede a análise escolhe seller e período; o servidor soma os fatos e a IA aponta riscos e próximas ações. */
export function SellerRiskAnalysis({ profiles }: { profiles: Tables<"profiles">[] }) {
  const today = useMemo(() => brDay(new Date()), []);
  const [seller, setSeller] = useState("");
  const [from, setFrom] = useState(() => brDay(new Date(Date.now() - 90 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<{ analysis: Analysis; seller: string; from: string; to: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const check = validateAnalysis(seller, from, to);
  const nameOf = (id: string) => { const p = profiles.find((x) => x.user_id === id); return p?.full_name || p?.email || "o seller"; };

  const run = async () => {
    setTouched(true);
    if (check.error) return;
    setLoading(true); setResult(null); setFailure(null);
    const { data, error } = await supabase.functions.invoke("analyze-seller-risk", { body: { sellerId: seller, from: check.s, to: check.e } });
    setLoading(false);
    if (error || !data?.success) {
      let msg = (data as { error?: string } | null)?.error;
      if (!msg && error && "context" in error) {
        try { msg = (await (error as { context: Response }).context.json())?.error; } catch { /* sem corpo */ }
      }
      setFailure(msg || "Não foi possível concluir a análise.");
      toast.error("A análise não foi concluída.");
      return;
    }
    setResult({ analysis: data.analysis as Analysis, seller, from, to });
  };

  const a = result?.analysis;
  return (
    <div className="space-y-5">
      <PremiumPanel eyebrow="Inteligência artificial" title="Análise de risco de um seller" icon={Sparkles}>
        <div className="space-y-4">
          <p className="text-[12.5px] text-muted-foreground">O servidor resume vendas, reembolsos, chargebacks, disputas e ajustes do período e a IA aponta riscos e próximas ações. Só números somados vão para a IA, sem dados pessoais de compradores. Cada análise fica registrada na auditoria.</p>
          <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
            <div className="space-y-1"><label className="text-[12.5px] font-medium text-muted-foreground">Seller</label><SellerSelect profiles={profiles} value={seller} onChange={setSeller} /></div>
            <div className="space-y-1"><label htmlFor="ra-from" className="text-[12.5px] font-medium text-muted-foreground">De</label><Input id="ra-from" type="date" max={to || today} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><label htmlFor="ra-to" className="text-[12.5px] font-medium text-muted-foreground">Até</label><Input id="ra-to" type="date" min={from} max={today} value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button type="button" onClick={() => void run()} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {loading ? "Analisando…" : "Analisar com IA"}
            </Button>
          </div>
          {touched && check.error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{check.error}</p>}
          {loading && <p role="status" className="text-[12.5px] text-muted-foreground">Isso pode levar até meio minuto. Não feche esta tela.</p>}
          {failure && (
            <div role="alert" className="flex items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-3 text-[13px]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div><p className="font-semibold text-destructive">Não foi possível analisar.</p><p className="text-muted-foreground">{failure}</p></div>
            </div>
          )}
        </div>
      </PremiumPanel>

      {result && a && (
        <PremiumPanel title={`Análise de ${nameOf(result.seller)}`} eyebrow={`${result.from.split("-").reverse().join("/")} a ${result.to.split("-").reverse().join("/")}`}>
          <div className="space-y-5">
            <span className={cn("inline-flex rounded-full border px-3 py-1 text-[12.5px] font-semibold", LEVEL[a.risk_level].cls)}>{LEVEL[a.risk_level].label}</span>
            <p className="max-w-[70ch] text-[14px] leading-relaxed text-foreground">{a.summary}</p>
            {a.risks.length > 0 && (
              <section className="space-y-2" aria-label="Riscos identificados">
                <h3 className="text-[14px] font-semibold text-foreground">Riscos identificados</h3>
                {a.risks.map((r, i) => (
                  <div key={`${r.title}-${i}`} className="rounded-[12px] border border-border/60 p-3">
                    <p className="text-[13.5px] font-semibold text-foreground">{r.title} <span className={cn("ml-1 text-[12px] font-medium", r.severity === "high" ? "text-destructive" : "text-muted-foreground")}>({SEVERITY[r.severity] ?? "médio"})</span></p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </section>
            )}
            {a.next_actions.length > 0 && (
              <section className="space-y-2" aria-label="Próximas ações">
                <h3 className="text-[14px] font-semibold text-foreground">Próximas ações, em ordem de prioridade</h3>
                <ol className="space-y-2.5">
                  {a.next_actions.map((n) => (
                    <li key={n.priority} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">{n.priority}</span>
                      <div><p className="text-[13.5px] font-medium text-foreground">{n.action}</p><p className="text-[12.5px] text-muted-foreground">{n.reason}</p></div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <p className="text-[12px] text-muted-foreground">A IA pode errar. Confira os números no histórico e nas métricas do seller antes de agir.</p>
          </div>
        </PremiumPanel>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Database, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassPanel as Panel } from "./AdminOverviewTab";
import { useAuth } from "@/hooks/useAuth";

type Finding = Tables<"security_findings">;
type Recommendation = { priority: number; title: string; action: string; rationale: string };
const riskStyle: Record<string, string> = { critical: "bg-destructive/10 text-destructive", high: "bg-orange-500/10 text-orange-600", medium: "bg-warning/10 text-warning", low: "bg-emerald-500/10 text-emerald-600" };

function recommendations(value: Json): Recommendation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Recommendation => !!item && typeof item === "object" && "title" in item && "action" in item) as Recommendation[];
}

export function SecurityFindingsPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("database");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("security_findings").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast.error("Não foi possível carregar os achados");
    else setItems(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const analyze = async (id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: "analyzing" } : item));
    const { data, error } = await supabase.functions.invoke("analyze-security-finding", { body: { findingId: id } });
    if (error || !data?.success) toast.error(data?.error || "A análise não pôde ser concluída");
    else toast.success("Risco classificado e recomendações priorizadas");
    await load();
  };

  const create = async () => {
    if (!user || title.trim().length < 3 || description.trim().length < 10) { toast.error("Informe um título e uma descrição detalhada"); return; }
    setSaving(true);
    const evidenceJson: Json = evidence.trim() ? { notes: evidence.trim().slice(0, 5000) } : {};
    const { data, error } = await supabase.from("security_findings").insert({ created_by: user.id, source, title: title.trim(), description: description.trim(), evidence: evidenceJson }).select("id").single();
    if (error || !data) { toast.error("Não foi possível registrar o achado"); setSaving(false); return; }
    setOpen(false); setTitle(""); setDescription(""); setEvidence(""); setSaving(false);
    toast.success("Achado registrado");
    await analyze(data.id);
  };

  const resolve = async (id: string) => {
    const { error } = await supabase.from("security_findings").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Não foi possível resolver o achado");
    else { toast.success("Achado resolvido"); await load(); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-bold text-foreground">Achados de Segurança</h2><p className="text-xs text-muted-foreground">Banco, catálogo e armazenamento com classificação assistida e plano priorizado.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Atualizar</Button><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Novo achado</Button></div>
    </div>
    {loading ? <Panel><div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div></Panel> : items.length === 0 ? <Panel><div className="py-16 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-emerald-500" /><p className="mt-3 text-sm font-semibold">Nenhum achado registrado</p></div></Panel> : items.map((item) => {
      const recs = recommendations(item.ai_recommendations);
      return <Panel key={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase">{item.source}</span>{item.risk_level && <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${riskStyle[item.risk_level]}`}>{item.risk_level}</span>}<span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span></div><h3 className="mt-2 text-sm font-bold text-foreground">{item.title}</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{item.description}</p></div>
          <div className="flex gap-2">{item.status !== "resolved" && <Button size="sm" variant="outline" disabled={item.status === "analyzing"} onClick={() => void analyze(item.id)}>{item.status === "analyzing" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}Analisar</Button>}{item.status !== "resolved" && <Button size="sm" variant="ghost" onClick={() => void resolve(item.id)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Resolver</Button>}</div>
        </div>
        {item.error_message && <p className="mt-3 flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{item.error_message}</p>}
        {item.ai_summary && <div className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.03] p-4"><p className="flex items-center gap-2 text-xs font-bold"><Bot className="h-4 w-4 text-primary" />Análise assistida</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.ai_summary}</p></div>}
        {recs.length > 0 && <div className="mt-3 grid gap-2">{recs.map((rec) => <div key={`${item.id}-${rec.priority}`} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[32px_1fr]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">{rec.priority}</span><div><p className="text-xs font-bold text-foreground">{rec.title}</p><p className="mt-1 text-xs text-muted-foreground">{rec.action}</p><p className="mt-1 text-[10px] text-muted-foreground/70">{rec.rationale}</p></div></div>)}</div>}
      </Panel>;
    })}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Registrar achado de segurança</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Origem</Label><Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="database">Banco de dados</SelectItem><SelectItem value="catalog">Catálogo</SelectItem><SelectItem value="storage">Armazenamento</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Título</Label><Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: leitura pública excessiva no catálogo" /></div><div className="space-y-2"><Label>Descrição</Label><Textarea value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} className="min-h-28" placeholder="Explique o comportamento, impacto e caminho afetado." /></div><div className="space-y-2"><Label>Evidências</Label><Textarea value={evidence} maxLength={5000} onChange={(e) => setEvidence(e.target.value)} className="min-h-20" placeholder="Política, tabela, bucket, consulta ou passos de reprodução. Não inclua segredos." /></div><Button className="w-full" disabled={saving} onClick={() => void create()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}Registrar e analisar</Button></div></DialogContent></Dialog>
  </div>;
}
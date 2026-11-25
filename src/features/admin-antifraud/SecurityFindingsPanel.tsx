import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, CheckCircle2, Database, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { useConfirm } from "@/components/seller-ui/confirm";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/features/admin-finance/format";
import { functionErrorMessage } from "@/lib/functionError";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ErrorBlock } from "./BlacklistPanel";

type Finding = Tables<"security_findings">;
type Recommendation = { priority: number; title: string; action: string; rationale: string };
type Source = "database" | "catalog" | "storage";

export const SOURCE_LABEL: Record<string, string> = { database: "Banco de dados", catalog: "Catálogo", storage: "Armazenamento" };
export const RISK_LABEL: Record<string, string> = { critical: "Risco crítico", high: "Risco alto", medium: "Risco médio", low: "Risco baixo" };
export const STATUS_LABEL: Record<string, string> = { pending: "Aguardando análise", analyzing: "Analisando…", analyzed: "Analisado", failed: "A análise falhou", resolved: "Resolvido" };
const RISK_TONE: Record<string, string> = {
  critical: "border-destructive/25 bg-destructive/10 text-destructive", high: "border-orange-500/25 bg-orange-500/10 text-orange-600",
  medium: "border-warning/25 bg-warning/10 text-warning", low: "border-success/25 bg-success/10 text-success",
};
const LIMIT = 100;

export function recommendations(value: Json): Recommendation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((i): i is Recommendation => !!i && typeof i === "object" && "title" in i && "action" in i);
}

export function SecurityFindingsPanel() {
  const qc = useQueryClient();
  const { ask, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-security-findings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("security_findings").select("*").order("created_at", { ascending: false }).limit(LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });
  const items = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-security-findings"] });

  const analyze = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-security-finding", { body: { findingId: id } });
      if (error || !data?.success) toast.error("A análise não foi concluída.", { description: await functionErrorMessage(error, data, "Tente de novo em instantes.") });
      else toast.success("Risco classificado e recomendações priorizadas.");
    } finally { setBusyId(null); await refresh(); }
  };

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("security_findings").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Achado marcado como resolvido."); void refresh(); },
    onError: (e) => toast.error("Não foi possível resolver o achado.", { description: friendlyError(e, "Tente de novo em instantes.") }),
  });
  const onResolve = async (f: Finding) => {
    if (await ask({ title: "Marcar como resolvido?", description: `"${f.title}" sai da lista de pendências. Confirme só se a correção já está no ar.`, confirmLabel: "Marcar como resolvido", tone: "default" })) resolve.mutate(f.id);
  };

  return (
    <PremiumPanel title="Achados de segurança" icon={ShieldCheck}
      action={<div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} /> Atualizar</Button>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Registrar achado</Button>
      </div>}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
        Falhas que você encontrou no banco, no catálogo ou no armazenamento. A análise por IA classifica o risco e sugere o que fazer primeiro; ela orienta, não decide.
      </p>
      {q.isError ? (
        <ErrorBlock title="Não foi possível carregar os achados." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os achados…</p>
      ) : items.length === 0 ? (
        <PremiumEmpty icon={ShieldCheck} title="Nenhum achado registrado" subtitle="Quando você encontrar uma falha, registre aqui para a IA classificar e priorizar." />
      ) : (
        <div className="space-y-3">
          {items.length >= LIMIT && <p className="text-[12.5px] text-muted-foreground">Mostrando os {LIMIT} achados mais recentes.</p>}
          {items.map((f) => <FindingCard key={f.id} f={f} busy={busyId === f.id} onAnalyze={() => void analyze(f.id)} onResolve={() => void onResolve(f)} resolving={resolve.isPending && resolve.variables === f.id} />)}
        </div>
      )}
      <NewFindingDialog open={open} onClose={() => setOpen(false)} onCreated={(id) => { void refresh(); void analyze(id); }} />
      {confirmDialog}
    </PremiumPanel>
  );
}

function FindingCard({ f, busy, resolving, onAnalyze, onResolve }: { f: Finding; busy: boolean; resolving: boolean; onAnalyze: () => void; onResolve: () => void }) {
  const recs = recommendations(f.ai_recommendations);
  const analyzing = busy || f.status === "analyzing";
  const done = f.status === "resolved";
  return (
    <article className="rounded-[12px] border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">{SOURCE_LABEL[f.source] ?? "Outro"}</span>
            {f.risk_level && <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", RISK_TONE[f.risk_level])}>{RISK_LABEL[f.risk_level]}</span>}
            <span className="text-[12px] text-muted-foreground">{STATUS_LABEL[f.status] ?? f.status} · {fmtDateTime(f.created_at)}</span>
          </div>
          <h3 className="mt-2 text-[14px] font-semibold text-foreground">{f.title}</h3>
          <p className="mt-1 max-w-3xl whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
        </div>
        {!done && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={analyzing} onClick={onAnalyze}>
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}{analyzing ? "Analisando…" : f.status === "failed" ? "Analisar de novo" : f.ai_summary ? "Reanalisar" : "Analisar com IA"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={resolving} onClick={onResolve}>
              {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Resolver
            </Button>
          </div>
        )}
      </div>
      {f.error_message && <p role="alert" className="mt-3 flex items-start gap-2 text-[12.5px] text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f.error_message}</p>}
      {f.ai_summary && (
        <div className="mt-4 rounded-[12px] border border-primary/15 bg-primary/[0.03] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><Bot className="h-4 w-4 text-primary" /> O que a IA concluiu</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.ai_summary}</p>
        </div>
      )}
      {recs.length > 0 && (
        <ol className="mt-3 grid gap-2">
          {recs.map((r, i) => (
            <li key={`${f.id}-${i}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[12px] border border-border/60 p-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-[12px] font-bold text-primary">{r.priority ?? i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{r.title}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{r.action}</p>
                {r.rationale && <p className="mt-0.5 text-[12px] text-muted-foreground/80">{r.rationale}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

const SOURCES: { value: Source; label: string }[] = [
  { value: "database", label: "Banco de dados" }, { value: "catalog", label: "Catálogo" }, { value: "storage", label: "Armazenamento" },
];

function NewFindingDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [source, setSource] = useState<Source>("database");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setSource("database"); setTitle(""); setDescription(""); setEvidence(""); setTouched(false); setServerError(null); } }, [open]);

  const titleError = title.trim().length < 3 ? "Dê um título com pelo menos 3 caracteres." : null;
  const descError = description.trim().length < 10 ? "Descreva o problema com pelo menos 10 caracteres." : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (titleError || descError) return;
    if (!user) { setServerError("Sua sessão expirou. Entre de novo."); return; }
    setSaving(true);
    const evidenceJson: Json = evidence.trim() ? { notes: evidence.trim().slice(0, 5000) } : {};
    const { data, error } = await supabase.from("security_findings").insert({ created_by: user.id, source, title: title.trim(), description: description.trim(), evidence: evidenceJson }).select("id").single();
    setSaving(false);
    if (error || !data) { setServerError(friendlyError(error, "Não foi possível registrar o achado.")); return; }
    toast.success("Achado registrado. Analisando…");
    onClose();
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Database className="h-5 w-5" />} title="Registrar achado de segurança" subtitle="Ao salvar, a IA classifica o risco e sugere os primeiros passos." />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <DialogBody>
            <div className="space-y-5">
              <ChoiceGrid<Source> label="Onde está o problema" columns={3} value={source} onChange={setSource} options={SOURCES} />
              <FormField id="sf-title" label="Título" error={touched ? titleError : null}>
                <input id="sf-title" className="vp-field" maxLength={160} value={title} placeholder="Ex.: leitura pública excessiva no catálogo" onChange={(e) => setTitle(e.target.value)} aria-invalid={touched && titleError ? true : undefined} aria-describedby="sf-title-msg" />
              </FormField>
              <FormField id="sf-desc" label="O que acontece" hint="Comportamento, impacto e caminho afetado." error={touched ? descError : null}>
                <textarea id="sf-desc" className="vp-field resize-none" rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={touched && descError ? true : undefined} aria-describedby="sf-desc-msg" />
              </FormField>
              <FormField id="sf-evid" label="Evidências (opcional)" hint="Política, tabela, bucket, consulta ou passos para reproduzir. Não cole senhas nem chaves.">
                <textarea id="sf-evid" className="vp-field resize-none" rows={3} maxLength={5000} value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-describedby="sf-evid-msg" />
              </FormField>
            </div>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[170px]" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Registrando…</> : "Registrar e analisar"}</button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

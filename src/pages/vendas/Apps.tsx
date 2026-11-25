/**
 * Apps: conecta ferramentas de terceiros (UTMify, Z-API, Notazz, áreas de membros…).
 * Cada conexão fica em `app_integrations` (segredos criptografados no banco) e pode cobrir um produto ou todos.
 * O banco enfileira um envio em `app_deliveries` a cada evento marcado; o worker entrega com 5 tentativas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, ListChecks, Plug, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useAppIntegrations, useInvalidateAll, useProducts } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Pager } from "@/components/seller-ui/Pager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCard } from "@/components/integrations/AppCard";
import { ConnectDialog, type ConnectSave, type ConnectTarget } from "@/components/integrations/ConnectDialog";
import { ConnectionsList, type ConnectionHealth } from "@/components/integrations/ConnectionsList";
import { TestAppDialog, type TestTarget } from "@/components/integrations/TestAppDialog";
import { DeliveryLedger } from "@/components/integrations/DeliveryLedger";
import { DeliveryDialog } from "@/components/integrations/DeliveryDialog";
import type { SaveResult } from "@/components/integrations/KeyDialogs";
import { APPS, CATEGORIES, appById, appDeliveryOutcome, appErrorMessage, readTestResult, type AppConnection, type AppDef, type TestResult } from "@/components/integrations/appCatalog";
import { deliveryKind, type DeliveryRow } from "@/components/integrations/webhookMeta";

type View = "catalog" | "mine" | "activity";
type StatusFilter = "all" | "success" | "open" | "failed";

const LIST_LIMIT = 200;
const PAGE_SIZE = 10;
const DAY = 86_400_000;
const COLUMNS = "id, integration_id, transaction_id, event, attempt, status, response_status, error, next_retry_at, delivered_at, created_at";
const OPEN = ["queued", "sending", "retrying"];

export default function Apps() {
  const { user } = useAuth();
  const invalidateAll = useInvalidateAll();
  const { data: products = [] } = useProducts();
  const { data: raw = [], isLoading, isError, refetch } = useAppIntegrations();
  const connections = raw as unknown as AppConnection[];

  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view: View = requested === "mine" || requested === "activity" || requested === "catalog" ? requested : connections.length > 0 ? "mine" : "catalog";
  const setView = (v: View) => { const next = new URLSearchParams(params); next.set("view", v); setParams(next, { replace: true }); };

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState(false);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [connectTarget, setConnectTarget] = useState<ConnectTarget | null>(null);
  const [testTarget, setTestTarget] = useState<TestTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppConnection | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<DeliveryRow | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [connFilter, setConnFilter] = useState("all");
  const [page, setPage] = useState(1);

  const loadDeliveries = useCallback(async () => {
    if (!user) return;
    const list = await supabase.from("app_deliveries").select(COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false }).limit(LIST_LIMIT);
    if (list.error) { setDeliveriesError(true); } else {
      // Mesmo formato das entregas de webhook: o "destino" aqui é a conexão.
      setDeliveries(((list.data ?? []) as Array<DeliveryRow & { integration_id: string }>).map((d) => ({ ...d, webhook_config_id: d.integration_id })));
      setDeliveriesError(false);
    }
    setLoadingDeliveries(false);
  }, [user]);

  useEffect(() => { void loadDeliveries(); }, [loadDeliveries]);

  const hasOpen = useMemo(() => deliveries.some((d) => OPEN.includes(deliveryKind(d))), [deliveries]);
  const loadRef = useRef(loadDeliveries);
  loadRef.current = loadDeliveries;
  useEffect(() => {
    if (!hasOpen || view === "catalog") return;
    const id = window.setInterval(() => { if (!document.hidden) void loadRef.current(); }, 5000);
    return () => window.clearInterval(id);
  }, [hasOpen, view]);

  useEffect(() => { setPage(1); }, [status, connFilter]);

  const productName = useCallback((id: string | null) => (id ? products.find((p) => p.id === id)?.name ?? "Produto removido" : "Todos os produtos"), [products]);

  const labelById = useMemo(() => new Map(connections.map((c) => [c.id, `${appById(c.app_name)?.name ?? c.app_name} (${productName(c.product_id)})`])), [connections, productName]);

  const health = useMemo(() => {
    const map = new Map<string, ConnectionHealth>();
    const dayAgo = Date.now() - DAY;
    for (const d of deliveries) {
      const cur = map.get(d.webhook_config_id) ?? { last: null, failed: 0 };
      if (!cur.last) cur.last = d;
      if (deliveryKind(d) === "exhausted" && new Date(d.created_at).getTime() >= dayAgo) cur.failed += 1;
      map.set(d.webhook_config_id, cur);
    }
    return map;
  }, [deliveries]);

  const byApp = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    for (const c of connections) { const cur = map.get(c.app_name) ?? { total: 0, active: 0 }; cur.total += 1; if (c.is_active) cur.active += 1; map.set(c.app_name, cur); }
    return map;
  }, [connections]);

  const catalog = useMemo(() => {
    const term = q.trim().toLowerCase();
    return APPS.filter((a) => (category === "all" || a.category === category) && (!term || a.name.toLowerCase().includes(term) || a.desc.toLowerCase().includes(term) || a.category.toLowerCase().includes(term)))
      .sort((a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon));
  }, [q, category]);

  const counts = useMemo(() => ({
    all: deliveries.length,
    success: deliveries.filter((d) => deliveryKind(d) === "success").length,
    open: deliveries.filter((d) => OPEN.includes(deliveryKind(d))).length,
    failed: deliveries.filter((d) => deliveryKind(d) === "exhausted").length,
  }), [deliveries]);

  const shown = useMemo(() => deliveries.filter((d) => {
    const k = deliveryKind(d);
    if (status === "success" && k !== "success") return false;
    if (status === "open" && !OPEN.includes(k)) return false;
    if (status === "failed" && k !== "exhausted") return false;
    return connFilter === "all" || d.webhook_config_id === connFilter;
  }), [deliveries, status, connFilter]);
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const refresh = async () => { invalidateAll(["app_integrations"]); await refetch(); };

  const saveConnection = async (values: ConnectSave): Promise<SaveResult> => {
    if (!user || !connectTarget) return { ok: false, message: "Sessão expirada. Entre de novo." };
    const { app, connection } = connectTarget;
    const urlField = app.fields.find((f) => f.target === "api_url");
    const secretValue = (target: "api_key" | "webhook_url") => { const f = app.fields.find((x) => x.target === target); return f ? (values.fields[f.key] ?? "").trim() : ""; };

    const config: Record<string, unknown> = { ...(connection?.config ?? {}) };
    for (const f of app.fields.filter((x) => x.target === "config")) {
      const v = (values.fields[f.key] ?? "").trim();
      if (v) config[f.key] = v; else delete config[f.key];
    }

    const base = {
      product_id: values.productId, events: values.events, config: config as Json,
      api_url: urlField ? (values.fields[urlField.key] ?? "").trim() || null : null,
    };
    const apiKey = secretValue("api_key"); const clientToken = secretValue("webhook_url");

    if (connection) {
      const patch: { api_key?: string; webhook_url?: string } & typeof base = { ...base };
      if (apiKey) patch.api_key = apiKey;
      if (clientToken) patch.webhook_url = clientToken;
      const { error } = await supabase.from("app_integrations").update(patch).eq("id", connection.id).eq("user_id", user.id);
      if (error) return { ok: false, message: appErrorMessage(error, "Não foi possível salvar a conexão.") };
      toast.success(`${app.name} atualizado.`);
    } else {
      const { error } = await supabase.from("app_integrations").insert({ user_id: user.id, app_name: app.id, is_active: true, ...base, api_key: apiKey || null, webhook_url: clientToken || null });
      if (error) return { ok: false, message: appErrorMessage(error, "Não foi possível criar a conexão.") };
      toast.success(`${app.name} conectado.`);
    }
    setConnectTarget(null);
    await refresh();
    if (!connection) setView("mine");
    return { ok: true };
  };

  const toggle = async (c: AppConnection) => {
    if (!user || busyId) return;
    setBusyId(c.id);
    const { error } = await supabase.from("app_integrations").update({ is_active: !c.is_active }).eq("id", c.id).eq("user_id", user.id);
    setBusyId(null);
    if (error) { toast.error(c.is_active ? "Não foi possível pausar a conexão." : "Não foi possível reativar a conexão."); return; }
    toast.success(c.is_active ? "Conexão pausada. Ela não recebe eventos enquanto estiver assim." : "Conexão reativada.");
    await refresh();
  };

  const runDelete = async () => {
    if (!confirmDelete || !user) return;
    setConfirmBusy(true);
    const { error } = await supabase.from("app_integrations").delete().eq("id", confirmDelete.id).eq("user_id", user.id);
    setConfirmBusy(false);
    if (error) { toast.error("Não foi possível remover a conexão."); return; }
    toast.success("Conexão removida.");
    setConfirmDelete(null);
    await Promise.all([refresh(), loadDeliveries()]);
  };

  const runTest = async (connectionId: string): Promise<TestResult> => {
    const { data, error } = await supabase.functions.invoke("apps-dispatcher", { body: { action: "test", integration_id: connectionId } });
    if (!error && data) return readTestResult(data);
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") { try { return readTestResult(await ctx.json()); } catch { /* corpo ilegível */ } }
    return { ok: false, status: 0, message: "Não foi possível falar com o servidor. Confira sua conexão e tente de novo.", detail: "" };
  };

  const connect = (app: AppDef) => { if (!app.comingSoon && app.id !== "webhooks") setConnectTarget({ app }); };
  const manage = (app: AppDef) => { setConnFilter("all"); setView("mine"); setQ(app.name); };
  const activityOf = (c: AppConnection) => { setConnFilter(c.id); setStatus("all"); setView("activity"); };

  const mineShown = useMemo(() => {
    const term = view === "mine" ? q.trim().toLowerCase() : "";
    return term ? connections.filter((c) => (appById(c.app_name)?.name ?? c.app_name).toLowerCase().includes(term) || productName(c.product_id).toLowerCase().includes(term)) : connections;
  }, [connections, q, view, productName]);

  const siblings = connectTarget ? connections.filter((c) => c.app_name === connectTarget.app.id && c.is_active && c.id !== connectTarget.connection?.id) : [];

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Apps | Vemprapay" description="Conecte suas ferramentas e envie cada venda automaticamente." path="/integracoes?tab=apps" noindex />

      <PageHead title="Apps" subtitle="Conecte as ferramentas que você já usa. A cada venda, a gente envia o que você escolher, sem copiar e colar nada." />

      {isError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar suas conexões" text="Confira sua conexão e tente de novo. Suas conexões continuam salvas." action={<button type="button" className="vp-ghost" onClick={() => { void refetch(); }}>Tentar de novo</button>} />
        </section>
      ) : (
        <>
          <FilterPills<View>
            label="Visão dos apps" value={view} onChange={(v) => { setView(v); if (v !== "mine" && v !== "catalog") setQ(""); }}
            options={[{ value: "catalog", label: "Catálogo" }, { value: "mine", label: "Minhas conexões", count: connections.length }, { value: "activity", label: "Atividade" }]}
          />

          {view === "catalog" && (
            <>
              <div className="flex flex-col gap-3">
                <SearchField label="Buscar app" value={q} onChange={setQ} placeholder="Buscar por nome ou categoria" className="sm:w-[340px]" />
                <FilterPills<string> label="Filtrar apps por categoria" value={category} onChange={setCategory} options={[{ value: "all", label: "Todos" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
              </div>
              {catalog.length === 0 ? (
                <section className="vp-sheet"><EmptyPanel icon={<Search className="h-7 w-7" strokeWidth={1.8} />} title="Nenhum app encontrado" text="Tente outro nome ou limpe os filtros." action={<button type="button" className="vp-ghost" onClick={() => { setQ(""); setCategory("all"); }}>Limpar filtros</button>} /></section>
              ) : (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(3,minmax(0,1fr))]" aria-label="Apps disponíveis">
                  {catalog.map((a) => (
                    <li key={a.id}><AppCard app={a} connected={byApp.get(a.id)?.total ?? 0} active={(byApp.get(a.id)?.active ?? 0) > 0} onConnect={connect} onManage={manage} /></li>
                  ))}
                </ul>
              )}
            </>
          )}

          {view === "mine" && (
            isLoading ? <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-[84px] !rounded-[22px]" />)}</div>
            : connections.length === 0 ? (
              <section className="vp-sheet">
                <EmptyPanel icon={<Plug className="h-7 w-7" strokeWidth={1.8} />} title="Você ainda não conectou nenhum app" text="Escolha uma ferramenta no catálogo, cole a chave dela e marque o que enviar. Leva um minuto." action={<button type="button" className="vp-cta" onClick={() => setView("catalog")}>Ver catálogo</button>} />
              </section>
            ) : (
              <>
                {connections.length > 4 && <SearchField label="Buscar conexão" value={q} onChange={setQ} placeholder="App ou produto" className="sm:w-[320px]" />}
                {mineShown.length === 0 ? (
                  <section className="vp-sheet"><EmptyPanel title="Nenhuma conexão encontrada" text="Tente outro nome." action={<button type="button" className="vp-ghost" onClick={() => setQ("")}>Limpar busca</button>} /></section>
                ) : (
                  <ConnectionsList
                    rows={mineShown} productName={productName} health={health} busyId={busyId}
                    onTest={(c) => { const app = appById(c.app_name); if (app) setTestTarget({ app, connectionId: c.id, productLabel: productName(c.product_id) }); }}
                    onEdit={(c) => { const app = appById(c.app_name); if (app) setConnectTarget({ app, connection: c }); }}
                    onToggle={(c) => void toggle(c)} onActivity={activityOf} onDelete={setConfirmDelete}
                  />
                )}
              </>
            )
          )}

          {view === "activity" && (
            deliveriesError ? (
              <section className="vp-sheet"><EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar a atividade" text="Confira sua conexão e tente de novo." action={<button type="button" className="vp-ghost" onClick={() => { setLoadingDeliveries(true); void loadDeliveries(); }}>Tentar de novo</button>} /></section>
            ) : loadingDeliveries ? <div className="space-y-3" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="vp-skel h-[72px] !rounded-[22px]" />)}</div>
            : deliveries.length === 0 ? (
              <section className="vp-sheet"><EmptyPanel icon={<ListChecks className="h-7 w-7" strokeWidth={1.8} />} title="Nada enviado ainda" text="Assim que uma venda disparar um evento marcado nas suas conexões, cada envio aparece aqui com a resposta do app." /></section>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <FilterPills<StatusFilter> label="Filtrar envios por situação" value={status} onChange={setStatus} options={[{ value: "all", label: "Todos", count: counts.all }, { value: "success", label: "Entregues", count: counts.success }, { value: "open", label: "Em andamento", count: counts.open }, { value: "failed", label: "Falharam", count: counts.failed }]} />
                  {connections.length > 1 && (
                    <Select value={connFilter} onValueChange={setConnFilter}>
                      <SelectTrigger aria-label="Filtrar por conexão" className="vp-r16 h-11 sm:w-[300px]"><SelectValue /></SelectTrigger>
                      <SelectContent collisionPadding={16}>
                        <SelectItem value="all">Todas as conexões</SelectItem>
                        {connections.map((c) => <SelectItem key={c.id} value={c.id}>{labelById.get(c.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {shown.length === 0 ? (
                  <section className="vp-sheet"><EmptyPanel title="Nenhum envio encontrado" text="Tente outro filtro." action={<button type="button" className="vp-ghost" onClick={() => { setStatus("all"); setConnFilter("all"); }}>Limpar filtros</button>} /></section>
                ) : (
                  <div className="space-y-3">
                    <DeliveryLedger rows={pageRows} hostById={labelById} onOpen={setOpen} targetHeader="Conexão" targetGone="Conexão removida" describe={appDeliveryOutcome} footer={<Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />} />
                    {deliveries.length >= LIST_LIMIT && <p className="px-1 text-[13px] text-muted-foreground">Mostrando os {LIST_LIMIT} envios mais recentes.</p>}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}

      <ConnectDialog
        target={connectTarget} products={products.map((p) => ({ id: p.id, name: p.name }))} siblings={siblings}
        onOpenChange={(o) => { if (!o) setConnectTarget(null); }} onSave={saveConnection}
      />
      <TestAppDialog target={testTarget} onClose={() => setTestTarget(null)} onRun={runTest} />
      <DeliveryDialog delivery={open} url={open ? labelById.get(open.webhook_config_id) ?? "" : ""} table="app_deliveries" targetLabel="Conexão" onClose={() => setOpen(null)} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirmDelete(null); }}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {confirmDelete ? appById(confirmDelete.app_name)?.name : "a conexão"}?</AlertDialogTitle>
            <AlertDialogDescription>A conexão deixa de receber eventos e o histórico de envios dela é apagado. Se quiser só dar um tempo, pause em vez de remover. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="vp-cta vp-cta-danger" disabled={confirmBusy} onClick={(e) => { e.preventDefault(); void runDelete(); }}>{confirmBusy ? "Aguarde…" : "Remover conexão"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


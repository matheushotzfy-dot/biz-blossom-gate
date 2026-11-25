import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpDown, CheckCircle2, Clock, FileText, Loader2, RefreshCw, Search, ShieldAlert, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useReason } from "@/components/seller-ui/confirm";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { brl } from "@/features/admin-finance/types";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "./AdminPremium";
import { AdjustmentDialog } from "@/features/admin-withdrawals/AdjustmentDialog";
import { AutoApprovalDialog, type AutoConfig } from "@/features/admin-withdrawals/AutoApprovalDialog";
import { AdjustmentList, StatementList } from "@/features/admin-withdrawals/LedgerLists";
import { QueueCards, QueueTable, type RowContext } from "@/features/admin-withdrawals/WithdrawalRows";
import {
  PAYOUTS_AVAILABLE, buildStatement, isHighValue, isNewSeller, sortQueue, summarizeWithdrawals, withdrawalFlags,
  type Adjustment, type RejectOutcome,
} from "@/features/admin-withdrawals/withdrawalsModel";

type SubTab = "queue" | "adjustments" | "statement";
type StatusFilter = "pending" | "approved" | "rejected" | "all";
type PersonRow = Pick<Tables<"profiles">, "user_id" | "full_name" | "email" | "created_at" | "seller_type">;

const PAGE_SIZE = 50;
/** Limite com que o painel carrega os saques (ver AdminDashboard). */
const LOAD_CAP = 5000;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

interface Props {
  withdrawals: Tables<"withdrawals">[];
  profiles: Tables<"profiles">[];
  onReload: () => void;
}

function LoadProblem({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
      <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar {what}.</p>
      <p className="text-muted-foreground">{friendlyError(error, "Tente de novo em instantes.")}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}

export default function AdminWithdrawalsTab({ withdrawals, profiles, onReload }: Props) {
  const { user } = useAuth();
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const [subTab, setSubTab] = useState<SubTab>("queue");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [riskFilter, setRiskFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adjPage, setAdjPage] = useState(1);
  const [stmtPage, setStmtPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [autoSeller, setAutoSeller] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState<string | null>(null);

  const autoQ = useQuery({
    queryKey: ["wd-auto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_auto_withdraw").select("id, user_id, enabled, max_amount, admin_user_id");
      if (error) throw error;
      return (data ?? []) as AutoConfig[];
    },
  });
  const adjQ = useQuery({
    queryKey: ["wd-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("balance_adjustments").select("id, user_id, amount, type, reason, admin_user_id, created_at").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Adjustment[];
    },
  });
  const adjustments = adjQ.data ?? [];

  /* ── Nomes: a lista do painel tem só os perfis mais novos; o resto é buscado sob demanda ── */
  const knownProfiles = useMemo(() => new Map<string, PersonRow>(profiles.map((p) => [p.user_id, p])), [profiles]);
  const missingIds = useMemo(() => {
    const need = new Set<string>();
    for (const w of withdrawals) { need.add(w.user_id); if (w.processed_by) need.add(w.processed_by); }
    for (const a of adjustments) { need.add(a.user_id); need.add(a.admin_user_id); }
    return [...need].filter((id) => !knownProfiles.has(id)).sort().slice(0, 100);
  }, [withdrawals, adjustments, knownProfiles]);
  const extraQ = useQuery({
    queryKey: ["wd-extra-profiles", missingIds.join(",")],
    enabled: missingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email, created_at, seller_type").in("user_id", missingIds);
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });
  const people = useMemo(() => {
    const m = new Map(knownProfiles);
    for (const p of extraQ.data ?? []) m.set(p.user_id, p);
    return m;
  }, [knownProfiles, extraQ.data]);

  const nameOf = useCallback((id: string | null) => {
    if (!id) return "—";
    const p = people.get(id);
    return p?.full_name || p?.email || `Conta ${id.slice(0, 8)}`;
  }, [people]);
  const emailOf = useCallback((id: string) => people.get(id)?.email || "", [people]);
  const createdAtOf = useCallback((id: string) => people.get(id)?.created_at, [people]);
  const autoOf = useCallback((id: string) => (autoQ.data ?? []).find((c) => c.user_id === id), [autoQ.data]);

  const now = useMemo(() => Date.now(), [withdrawals]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => summarizeWithdrawals(withdrawals, createdAtOf, now), [withdrawals, createdAtOf, now]);

  /* ── Fila ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = withdrawals.filter((w) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (originFilter !== "all" && (w.origin || "manual") !== originFilter) return false;
      const amount = Number(w.amount) || 0;
      if (riskFilter === "flagged" && withdrawalFlags(amount, createdAtOf(w.user_id), now).length === 0) return false;
      if (riskFilter === "new_seller" && !isNewSeller(createdAtOf(w.user_id), now)) return false;
      if (riskFilter === "high_value" && !isHighValue(amount)) return false;
      if (!q) return true;
      return nameOf(w.user_id).toLowerCase().includes(q) || emailOf(w.user_id).toLowerCase().includes(q) || w.id.toLowerCase().includes(q);
    });
    return sortQueue(rows, statusFilter === "pending");
  }, [withdrawals, statusFilter, originFilter, riskFilter, search, createdAtOf, nameOf, emailOf, now]);

  const pageRows = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const pagePending = useMemo(() => pageRows.filter((w) => w.status === "pending"), [pageRows]);
  const pendingIds = useMemo(() => new Set(withdrawals.filter((w) => w.status === "pending").map((w) => w.id)), [withdrawals]);
  const selectedIds = useMemo(() => [...selected].filter((id) => pendingIds.has(id)), [selected, pendingIds]);
  const allSelected = pagePending.length > 0 && pagePending.every((w) => selected.has(w.id));

  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, riskFilter, originFilter, search]);
  useEffect(() => { setSelected(new Set()); }, [page]);
  useEffect(() => {
    const last = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > last) setPage(last);
  }, [filtered.length, page]);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allSelected) pagePending.forEach((w) => n.delete(w.id)); else pagePending.forEach((w) => n.add(w.id));
    return n;
  });

  /* ── Recusar (um ou vários): cada saque é tratado sozinho e o resultado é contado de verdade ── */
  const rejectMany = async (ids: string[]) => {
    if (ids.length === 0) return;
    const many = ids.length > 1;
    const reason = await askReason({
      title: many ? `Recusar ${ids.length} saques` : "Recusar este saque",
      description: many
        ? "O valor reservado de cada saque volta para o saldo do seller. O mesmo motivo vale para todos e fica na auditoria."
        : "O valor reservado volta para o saldo do seller. O motivo fica na auditoria; o seller recebe só o aviso de saque recusado.",
      label: "Motivo da recusa", minLength: 5, confirmLabel: many ? "Recusar saques" : "Recusar saque", tone: "danger",
    });
    if (!reason) return;
    setRejecting(true);
    const out: RejectOutcome = { done: [], skipped: [], failed: [] };
    try {
      for (const id of ids) {
        const { data, error } = await supabase.from("withdrawals")
          .update({ status: "rejected", rejection_reason: reason.slice(0, 500), processed_by: user?.id ?? null })
          .eq("id", id).eq("status", "pending").select("id");
        if (error) out.failed.push({ id, message: friendlyError(error, "Não foi possível recusar.") });
        else if (!data || data.length === 0) out.skipped.push(id);
        else out.done.push(id);
      }
      await Promise.all(out.done.map((id) => logAdminAction("reject_withdrawal", "withdrawal", id, { reason, method: many ? "batch" : "single" })));
    } finally {
      setRejecting(false);
    }
    const parts: string[] = [];
    if (out.done.length) parts.push(out.done.length === 1 ? "1 saque recusado" : `${out.done.length} saques recusados`);
    if (out.skipped.length) parts.push(`${out.skipped.length} já tinha${out.skipped.length > 1 ? "m" : ""} sido processado${out.skipped.length > 1 ? "s" : ""} por outra pessoa`);
    if (out.failed.length) parts.push(`${out.failed.length} com erro (${out.failed[0].message})`);
    const text = parts.join(" · ");
    if (out.failed.length === 0 && out.skipped.length === 0) toast.success(`${text}. O valor voltou para o saldo do seller.`);
    else if (out.done.length === 0) toast.error(text);
    else toast.warning(text);
    setSelected(new Set());
    if (out.done.length > 0 || out.skipped.length > 0) onReload();
  };

  /* ── Comprovante ── */
  const uploadProof = async (id: string, file: File) => {
    if (!user) { toast.error("Sessão expirada. Entre de novo."); return; }
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) { toast.error("Envie uma imagem ou um PDF."); return; }
    if (file.size > MAX_PROOF_BYTES) { toast.error("O arquivo passa de 5 MB."); return; }
    setProofBusy(id);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("withdrawal-proofs").upload(path, file, { upsert: true });
      if (upErr) { toast.error(friendlyError(upErr, "Não foi possível enviar o arquivo.")); return; }
      const { error } = await supabase.from("withdrawals").update({ payment_proof_url: path }).eq("id", id);
      if (error) { toast.error(friendlyError(error, "O arquivo subiu, mas não foi possível vinculá-lo ao saque.")); return; }
      await logAdminAction("upload_withdrawal_proof", "withdrawal", id, { path });
      toast.success("Comprovante anexado.");
      onReload();
    } finally {
      setProofBusy(null);
    }
  };
  const viewProof = async (path: string) => {
    // a janela é aberta antes da espera, senão o navegador trata como pop-up bloqueado
    const win = window.open("about:blank", "_blank");
    const { data, error } = await supabase.storage.from("withdrawal-proofs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { win?.close(); toast.error("Não foi possível abrir o comprovante."); return; }
    if (win) { win.opener = null; win.location.href = data.signedUrl; } else toast.error("O navegador bloqueou a janela. Libere pop-ups e tente de novo.");
  };

  const refresh = async () => {
    setRefreshing(true);
    try { onReload(); await Promise.all([autoQ.refetch(), adjQ.refetch()]); } finally { setRefreshing(false); }
  };

  const ctx: RowContext = {
    nameOf: (id) => nameOf(id), emailOf, createdAtOf, autoOf, adminNameOf: nameOf, selected, onToggle: toggle,
    onReject: (id) => void rejectMany([id]), onAuto: setAutoSeller, onProof: (id, f) => void uploadProof(id, f), onViewProof: (p) => void viewProof(p), proofBusy, now,
  };

  /* ── Ajustes e extrato ── */
  const adjTotals = useMemo(() => ({
    credit: adjustments.filter((a) => a.type === "credit").reduce((s, a) => s + Number(a.amount), 0),
    debit: adjustments.filter((a) => a.type === "debit").reduce((s, a) => s + Number(a.amount), 0),
  }), [adjustments]);
  const adjRows = adjustments.slice((adjPage - 1) * PAGE_SIZE, adjPage * PAGE_SIZE);
  const statement = useMemo(() => buildStatement(withdrawals, adjustments, (id) => nameOf(id), 100), [withdrawals, adjustments, nameOf]);
  const stmtRows = statement.slice((stmtPage - 1) * PAGE_SIZE, stmtPage * PAGE_SIZE);

  const heroStatus = totals.pendingCount > 0
    ? { tone: "warning" as const, label: `${totals.pendingCount} ${totals.pendingCount === 1 ? "saque na fila" : "saques na fila"}`, pulse: true }
    : { tone: "success" as const, label: "Fila zerada" };

  const emptySub = withdrawals.length === 0 ? "Ainda não há pedidos de saque."
    : statusFilter === "pending" && totals.pendingCount === 0 && !search && riskFilter === "all" && originFilter === "all" ? "Nenhum saque está esperando. O histórico está em “Todos”."
      : "Nenhum saque com esses filtros.";

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero
        eyebrow="Financeiro · Saques" title="Saques"
        subtitle="Fila de pedidos dos sellers, ajustes de saldo e regras de auto-aprovação."
        status={heroStatus}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setAdjustOpen(true)}>
              <ArrowUpDown className="h-3.5 w-3.5" /> Ajuste de saldo
            </Button>
          </div>
        )}
      />

      {!PAYOUTS_AVAILABLE && (
        <div role="note" className="flex items-start gap-3 rounded-[12px] border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Aprovar saque está desligado enquanto não houver uma adquirente configurada. Você pode recusar saques (o valor volta para o saldo do seller) e anexar comprovante aos que já foram aprovados.</p>
        </div>
      )}

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Clock} label="Na fila" value={brl(totals.pendingAmount)} sub={`${totals.pendingCount} ${totals.pendingCount === 1 ? "pedido" : "pedidos"} · qualquer data`} tone="warning" />
        <PremiumMetric icon={ShieldAlert} label="Pedem atenção" value={String(totals.flagged)} sub="Seller novo ou valor alto" tone={totals.flagged > 0 ? "destructive" : "neutral"} />
        <PremiumMetric icon={CheckCircle2} label="Aprovados no período" value={brl(totals.paidAmount)} sub={`${totals.paidCount} aprovados · ${totals.rejectedCount} recusados`} tone="success" />
        <PremiumMetric icon={Wallet} label="Taxas no período" value={brl(totals.fees)} sub="Só de saques aprovados" tone="primary" />
      </PremiumMetricGrid>
      {withdrawals.length >= LOAD_CAP && (
        <p role="status" className="text-[12.5px] text-warning">Mostrando os {LOAD_CAP} saques mais recentes. Estreite o período no topo para ver o restante.</p>
      )}

      <PremiumSegmented<SubTab> value={subTab} onChange={setSubTab} options={[
        { value: "queue", label: `Fila${totals.pendingCount > 0 ? ` · ${totals.pendingCount}` : ""}` },
        { value: "adjustments", label: "Ajustes de saldo" },
        { value: "statement", label: "Extrato" },
      ]} />

      {subTab === "queue" && (
        <PremiumPanel eyebrow="Saques" title={statusFilter === "pending" ? `Pedidos esperando · ${filtered.length}` : `Saques · ${filtered.length}`} icon={ArrowDownToLine}>
          <div className="mb-4 space-y-3">
            <PremiumSegmented<StatusFilter> value={statusFilter} onChange={setStatusFilter} options={[
              { value: "pending", label: `Pendentes · ${totals.pendingCount}` },
              { value: "approved", label: `Aprovados · ${totals.paidCount}` },
              { value: "rejected", label: `Recusados · ${totals.rejectedCount}` },
              { value: "all", label: "Todos" },
            ]} />
            <p className="text-[12px] text-muted-foreground">
              Pendentes aparecem de qualquer data, do mais antigo para o mais novo. Aprovados e recusados seguem o período escolhido no topo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Buscar saque" placeholder="Buscar seller, e-mail ou código" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }}
                  className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger aria-label="Filtrar por risco" className="h-10 w-[180px] rounded-xl text-xs"><SelectValue placeholder="Risco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer risco</SelectItem>
                  <SelectItem value="flagged">Com alerta</SelectItem>
                  <SelectItem value="new_seller">Sellers novos</SelectItem>
                  <SelectItem value="high_value">Acima de R$ 50 mil</SelectItem>
                </SelectContent>
              </Select>
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger aria-label="Filtrar por origem" className="h-10 w-[160px] rounded-xl text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer origem</SelectItem>
                  <SelectItem value="manual">Pedido manual</SelectItem>
                  <SelectItem value="auto">Pedido automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(autoQ.isError || extraQ.isError) && (
              <p role="alert" className="flex flex-wrap items-center gap-2 text-[12.5px] text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {autoQ.isError ? "As regras de auto-aprovação não carregaram." : "Alguns nomes de seller não carregaram."}
                <button type="button" className="font-semibold underline" onClick={() => void (autoQ.isError ? autoQ.refetch() : extraQ.refetch())}>Tentar de novo</button>
              </p>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border/60 bg-muted/30 px-4 py-2.5">
              <span className="text-[13px] font-semibold">{selectedIds.length} {selectedIds.length === 1 ? "selecionado" : "selecionados"}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={rejecting}>Limpar</Button>
                <Button type="button" size="sm" variant="outline" disabled={rejecting} onClick={() => void rejectMany(selectedIds)}
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Recusar selecionados
                </Button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div>
              <PremiumEmpty icon={ArrowDownToLine} title="Nenhum saque aqui" subtitle={emptySub} />
              {statusFilter === "pending" && withdrawals.length > 0 && (
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={() => setStatusFilter("all")}>Ver todos os saques</Button></div>
              )}
            </div>
          ) : (
            <>
              <QueueTable rows={pageRows} ctx={ctx} allSelected={allSelected} onToggleAll={toggleAll} canSelect={pagePending.length > 0} />
              <QueueCards rows={pageRows} ctx={ctx} />
              <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={filtered.length} onPageChange={setPage} />
            </>
          )}
        </PremiumPanel>
      )}

      {subTab === "adjustments" && (
        <PremiumPanel eyebrow="Manual" title={`Ajustes de saldo · ${adjustments.length}`} icon={ArrowUpDown}
          action={<Button type="button" size="sm" onClick={() => setAdjustOpen(true)}>Novo ajuste</Button>}>
          {adjQ.isError ? <LoadProblem what="os ajustes" error={adjQ.error} onRetry={() => void adjQ.refetch()} />
            : adjQ.isLoading ? <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando ajustes…</p>
              : adjustments.length === 0 ? <PremiumEmpty icon={ArrowUpDown} title="Nenhum ajuste ainda" subtitle="Use “Novo ajuste” para creditar ou debitar o saldo de um seller." />
                : (
                  <div className="space-y-3">
                    <p className="text-[12.5px] text-muted-foreground">
                      Créditos <strong className="text-success">{brl(adjTotals.credit)}</strong> · Débitos <strong className="text-destructive">{brl(adjTotals.debit)}</strong> nos últimos {adjustments.length} ajustes. Todo ajuste fica na auditoria.
                    </p>
                    <AdjustmentList rows={adjRows} nameOf={(id) => nameOf(id)} />
                    <AdminPager page={adjPage} pageSize={PAGE_SIZE} totalCount={adjustments.length} onPageChange={setAdjPage} />
                  </div>
                )}
        </PremiumPanel>
      )}

      {subTab === "statement" && (
        <PremiumPanel eyebrow="Plataforma" title="Extrato de saques e ajustes" icon={FileText}>
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted-foreground">
              Visto pela plataforma: sai o que ela aprova pagar aos sellers; entra a taxa de saque e os débitos de ajuste. Considera os saques aprovados no período do topo e os últimos 300 ajustes (até 100 lançamentos).
            </p>
            {adjQ.isError && <LoadProblem what="os ajustes (o extrato está incompleto sem eles)" error={adjQ.error} onRetry={() => void adjQ.refetch()} />}
            {statement.length === 0 ? <PremiumEmpty icon={FileText} title="Sem lançamentos" subtitle="Saques aprovados e ajustes aparecem aqui." /> : (
              <>
                <StatementList rows={stmtRows} />
                <AdminPager page={stmtPage} pageSize={PAGE_SIZE} totalCount={statement.length} onPageChange={setStmtPage} />
              </>
            )}
          </div>
        </PremiumPanel>
      )}

      <AdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} profiles={profiles} onApplied={() => { void adjQ.refetch(); onReload(); }} />
      <AutoApprovalDialog sellerId={autoSeller} sellerName={autoSeller ? nameOf(autoSeller) : ""} config={autoSeller ? autoOf(autoSeller) : undefined} adminId={user?.id}
        onClose={() => setAutoSeller(null)} onSaved={() => void autoQ.refetch()} />
      {reasonDialog}
    </div>
  );
}

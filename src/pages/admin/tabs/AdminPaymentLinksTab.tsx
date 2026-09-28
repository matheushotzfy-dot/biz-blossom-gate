import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link as LinkIcon, Search, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw,
  Ban, ShieldCheck, Eye as EyeIcon, Clock, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, PremiumSegmented, premiumTable } from "./AdminPremium";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { logAdminAction } from "@/lib/auditLog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  fmtCurrency: (v: number) => string;
}

interface AdminPaymentLink extends Tables<"payment_links"> {
  seller_name: string | null;
  seller_email: string | null;
  pending_count: number;
  net_revenue: number;
  last_payment_at: string | null;
}

type PageResponse = { items: AdminPaymentLink[]; total: number };

const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

type StatusKey = "all" | "active" | "paused" | "blocked" | "archived";

const ADMIN_STATUS_LABEL: Record<string, string> = {
  clear: "Livre",
  blocked: "Bloqueado",
  review: "Em revisão",
};
const ADMIN_STATUS_TONE: Record<string, string> = {
  clear: "border-success/20 bg-success/10 text-success",
  blocked: "border-destructive/20 bg-destructive/10 text-destructive",
  review: "border-warning/20 bg-warning/10 text-warning",
};

export default function AdminPaymentLinksTab({ fmtCurrency }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminPaymentLink[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AdminPaymentLink | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [events, setEvents] = useState<Tables<"payment_link_events">[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<AdminPaymentLink | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("get_admin_payment_links_page" as never, {
      _search: debouncedSearch || null,
      _status: statusFilter,
      _billing_type: "all",
      _page: page,
      _page_size: PAGE_SIZE,
    } as never);
    if (err) { setError(err.message); setLoading(false); return; }
    const payload = data as unknown as PageResponse;
    setItems(payload.items || []);
    setTotal(Number(payload.total || 0));
    setLoading(false);
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openEvents = useCallback(async (link: AdminPaymentLink) => {
    setSelected(link);
    setSheetOpen(true);
    setEventsLoading(true);
    const { data, error: err } = await supabase
      .from("payment_link_events")
      .select("*")
      .eq("payment_link_id", link.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) { toast.error("Erro ao carregar eventos"); setEvents([]); }
    else setEvents(data || []);
    setEventsLoading(false);
  }, []);

  const runStatusChange = async (link: AdminPaymentLink, status: "clear" | "blocked" | "review", reason?: string) => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc("admin_set_payment_link_status" as never, {
        _payment_link_id: link.id,
        _status: status,
        _reason: reason || null,
      } as never);
      if (err) { toast.error(err.message || "Erro ao atualizar link"); return; }
      await logAdminAction("payment_link_admin_status", "payment_link", link.id, { status, reason: reason || null });
      toast.success(status === "blocked" ? "Link bloqueado" : status === "review" ? "Link marcado para revisão" : "Link desbloqueado");
      setBlockOpen(false);
      setBlockReason("");
      setBlockTarget(null);
      void load();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setActionLoading(false);
    }
  };

  const openBlockDialog = (link: AdminPaymentLink) => { setBlockTarget(link); setBlockReason(""); setBlockOpen(true); };
  const confirmBlock = () => {
    if (!blockTarget) return;
    if (!blockReason.trim() || blockReason.trim().length < 5) { toast.error("Motivo obrigatório (mín. 5 caracteres)"); return; }
    void runStatusChange(blockTarget, "blocked", blockReason.trim().slice(0, 500));
  };

  const linkStatusLabel = (link: AdminPaymentLink) => {
    if (link.archived_at) return { label: "Arquivado", tone: "border-border bg-muted/30 text-muted-foreground" };
    if (!link.is_active) return { label: "Pausado", tone: "border-warning/20 bg-warning/10 text-warning" };
    return { label: "Ativo", tone: "border-success/20 bg-success/10 text-success" };
  };

  const statusPills: { value: StatusKey; label: string }[] = useMemo(() => ([
    { value: "all", label: "Tudo" },
    { value: "active", label: "Ativos" },
    { value: "paused", label: "Pausados" },
    { value: "blocked", label: "Bloqueados" },
    { value: "archived", label: "Arquivados" },
  ]), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Operações · Pagamentos"
        title="Links de Pagamento"
        subtitle="Moderação e auditoria de links de pagamento criados pelos vendedores."
        status={{ tone: "info", label: `${total} link(s)`, pulse: false }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, slug, vendedor ou e-mail..."
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
          />
        </div>
        <PremiumSegmented<StatusKey> value={statusFilter} onChange={setStatusFilter} options={statusPills} />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Erro ao carregar links: {error}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      <PremiumPanel
        eyebrow="Links"
        title={`Resultados · ${total}`}
        icon={LinkIcon}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <PremiumEmpty icon={LinkIcon} title="Nenhum link encontrado" subtitle="Ajuste os filtros de busca ou status." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Título / Slug</th>
                  <th className={premiumTable.th}>Vendedor</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Moderação</th>
                  <th className={premiumTable.th}>Receita líquida</th>
                  <th className={premiumTable.th}>Pendências</th>
                  <th className={premiumTable.th}>Criado em</th>
                  <th className={premiumTable.th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((link) => {
                  const status = linkStatusLabel(link);
                  return (
                    <tr key={link.id} className={premiumTable.row}>
                      <td className={premiumTable.td}>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{link.title}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">/{link.slug}</span>
                        </div>
                      </td>
                      <td className={premiumTable.td}>
                        <div className="flex flex-col">
                          <span className="text-foreground/80">{link.seller_name || "—"}</span>
                          <span className="text-[10px] text-muted-foreground">{link.seller_email || link.user_id.slice(0, 8) + "…"}</span>
                        </div>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${status.tone}`}>{status.label}</span>
                      </td>
                      <td className={premiumTable.td}>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${ADMIN_STATUS_TONE[link.admin_status] || "border-border bg-muted/30 text-muted-foreground"}`}>
                          {ADMIN_STATUS_LABEL[link.admin_status] || link.admin_status}
                        </span>
                        {link.admin_status === "blocked" && link.admin_block_reason && (
                          <div className="mt-1 max-w-[220px] truncate text-[10px] text-muted-foreground" title={link.admin_block_reason}>
                            {link.admin_block_reason}
                          </div>
                        )}
                      </td>
                      <td className={premiumTable.td}><span className="font-semibold tabular-nums text-foreground">{fmtCurrency(Number(link.net_revenue || 0))}</span></td>
                      <td className={premiumTable.td}><span className="tabular-nums text-muted-foreground">{link.pending_count}</span></td>
                      <td className={premiumTable.td}><span className="text-muted-foreground">{dateFmt.format(new Date(link.created_at))}</span></td>
                      <td className={premiumTable.td}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver eventos" onClick={() => void openEvents(link)}>
                            <EyeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          {link.admin_status === "blocked" ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Desbloquear" disabled={actionLoading}
                              onClick={() => void runStatusChange(link, "clear")}>
                              <ShieldCheck className="h-3.5 w-3.5 text-success" />
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Bloquear" disabled={actionLoading}
                                onClick={() => openBlockDialog(link)}>
                                <Ban className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                              {link.admin_status !== "review" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar para revisão" disabled={actionLoading}
                                  onClick={() => void runStatusChange(link, "review")}>
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      {/* Block dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Bloquear link de pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Bloquear <span className="font-semibold text-foreground">{blockTarget?.title}</span> impede novos pagamentos. Informe o motivo (obrigatório).
            </p>
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Motivo do bloqueio (mín. 5 caracteres)"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)} disabled={actionLoading}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmBlock} disabled={actionLoading}>
              {actionLoading ? "Bloqueando..." : "Confirmar bloqueio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Events side panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Eventos · {selected?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {eventsLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : events.length === 0 ? (
              <PremiumEmpty icon={Clock} title="Nenhum evento registrado" subtitle="Este link ainda não possui eventos." />
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{ev.event_type}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{dateFmt.format(new Date(ev.created_at))}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded-full border border-border px-1.5 py-0.5 uppercase font-semibold">{ev.actor_type}</span>
                    {ev.actor_id && <span className="font-mono">{ev.actor_id.slice(0, 8)}…</span>}
                  </div>
                  {ev.metadata && Object.keys(ev.metadata as Record<string, unknown>).length > 0 && (
                    <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-muted-foreground/80">
                      {JSON.stringify(ev.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

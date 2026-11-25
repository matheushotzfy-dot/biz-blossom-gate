import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Loader2, Plus, RotateCcw, Search, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { useReason } from "@/components/seller-ui/confirm";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { fmtDateTime } from "@/features/admin-finance/format";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { AddBlacklistDialog, type BlacklistPreset } from "./AddBlacklistDialog";
import { ENTRY_TYPES, PAGE_SIZE, entryLabel, parseBlacklistPage, useDebouncedValue, type BlacklistItem, type BlacklistStatus, type EntryType } from "./antifraudModel";

type TypeFilter = EntryType | "all";

export function BlacklistPanel() {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm();
  const { ask, dialog: reasonDialog } = useReason();
  const [status, setStatus] = useState<BlacklistStatus>("active");
  const [type, setType] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; preset: BlacklistPreset | null }>({ open: false, preset: null });
  const [removing, setRemoving] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-blacklist", debounced, type, status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_blacklist_page" as never, { _search: debounced || null, _type: type, _status: status, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseBlacklistPage(data);
    },
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const summary = q.data?.summary;

  const remove = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_blacklist_remove" as never, { _id: id, _reason: reason } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido da blacklist.");
      void qc.invalidateQueries({ queryKey: ["admin-blacklist"] });
      void qc.invalidateQueries({ queryKey: ["admin-antifraud-overview"] });
    },
    onError: (e) => toast.error("Não foi possível remover. A entrada continua bloqueada.", { description: friendlyError(e, "Tente de novo em instantes.") }),
    onSettled: () => setRemoving(null),
  });

  const onRemove = async (b: BlacklistItem) => {
    const reason = await ask({
      title: "Remover da blacklist?", label: "Motivo da remoção", minLength: 3, confirmLabel: "Continuar", tone: "danger",
      description: `Compras com ${entryLabel(b.entry_type)} ${b.entry_value} voltam a ser aceitas. A remoção fica registrada com o seu nome.`,
    });
    if (!reason) return;
    sensitive.confirm(`Remover ${entryLabel(b.entry_type)} ${b.entry_value} da blacklist.`, async () => {
      setRemoving(b.id);
      await remove.mutateAsync({ id: b.id, reason }).catch(() => undefined);
    });
  };

  const filtersActive = status !== "active" || type !== "all" || !!debounced;
  const clear = () => { setStatus("active"); setType("all"); setSearch(""); setPage(1); };
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills = useMemo<{ value: BlacklistStatus; label: string }[]>(() => [
    { value: "active", label: withCount("Bloqueadas", summary?.active) },
    { value: "removed", label: withCount("Removidas", summary?.removed) },
    { value: "all", label: withCount("Todas", summary?.all) },
  ], [summary]);

  const ctx: Ctx = { removing, busy: remove.isPending, onRemove, onAgain: (b) => setDialog({ open: true, preset: { type: b.entry_type as EntryType, value: b.entry_value } }) };

  return (
    <PremiumPanel title="Blacklist" icon={Ban}
      action={<Button type="button" size="sm" className="gap-1.5" onClick={() => setDialog({ open: true, preset: null })}><Plus className="h-3.5 w-3.5" /> Bloquear um dado</Button>}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">CPFs, CNPJs, e-mails, IPs e BINs de cartão que não podem comprar. A lista vale para a plataforma inteira, de qualquer seller.</p>
      <div className="mb-4 space-y-3">
        <PremiumSegmented<BlacklistStatus> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar na blacklist" placeholder="Valor ou motivo" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Tipo
            <select aria-label="Filtrar por tipo" value={type} onChange={(e) => { setType(e.target.value as TypeFilter); setPage(1); }}
              className="h-10 rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
              <option value="all">Todos</option>
              {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>
      </div>

      {q.isError && !q.isFetching ? (
        <ErrorBlock title="Não foi possível carregar a blacklist." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a blacklist…</p>
      ) : items.length === 0 ? (
        <div>
          <PremiumEmpty icon={Ban} title={filtersActive ? "Nada por aqui" : "A blacklist está vazia"}
            subtitle={filtersActive ? "Nenhuma entrada bate com esses filtros." : "Bloqueie um CPF, e-mail, IP ou BIN quando houver fraude confirmada."} />
          {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
        </div>
      ) : (
        <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <BlacklistTable rows={items} ctx={ctx} />
          <BlacklistCards rows={items} ctx={ctx} />
          <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
        </div>
      )}
      <AddBlacklistDialog open={dialog.open} preset={dialog.preset} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
      {reasonDialog}
      {sensitive.dialog}
    </PremiumPanel>
  );
}

export function ErrorBlock({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
      <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> {title}</p>
      <p className="text-muted-foreground">{friendlyError(error, "Tente de novo em instantes.")}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}

interface Ctx { removing: string | null; busy: boolean; onRemove: (b: BlacklistItem) => void; onAgain: (b: BlacklistItem) => void }

const Value = ({ b }: { b: BlacklistItem }) => (
  <>
    <p className="text-[12px] font-medium text-muted-foreground">{entryLabel(b.entry_type)}</p>
    <p className="break-all font-mono text-[13px] font-semibold text-foreground">{b.entry_value}</p>
  </>
);
const Why = ({ b }: { b: BlacklistItem }) => <p className="text-[13px] leading-snug text-foreground/85">{b.reason || "Sem motivo registrado"}</p>;
const Who = ({ b }: { b: BlacklistItem }) => (
  <p className="text-[12px] text-muted-foreground">{b.is_active ? "Bloqueado" : "Removido"} em {fmtDateTime(b.is_active ? b.created_at : b.updated_at)}{b.is_active && b.added_by_name ? ` por ${b.added_by_name}` : ""}</p>
);
const Tag = ({ active }: { active: boolean }) => (
  <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", active ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted/40 text-muted-foreground")}>{active ? "Bloqueada" : "Removida"}</span>
);
const Actions = ({ b, ctx }: { b: BlacklistItem; ctx: Ctx }) => b.is_active ? (
  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={ctx.busy} onClick={() => ctx.onRemove(b)} aria-label={`Remover ${b.entry_value} da blacklist`}>
    {ctx.removing === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Remover
  </Button>
) : (
  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => ctx.onAgain(b)} aria-label={`Bloquear ${b.entry_value} de novo`}>
    <RotateCcw className="h-3.5 w-3.5" /> Bloquear de novo
  </Button>
);

function BlacklistTable({ rows, ctx }: { rows: BlacklistItem[]; ctx: Ctx }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Dado", "Motivo", "Situação", "Quando e quem", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className={cn("border-b border-border/40 align-top last:border-b-0", !b.is_active && "text-muted-foreground")}>
              <td className="max-w-[280px] px-4 py-3.5"><Value b={b} /></td>
              <td className="max-w-[320px] px-4 py-3.5"><Why b={b} /></td>
              <td className="px-4 py-3.5"><Tag active={b.is_active} /></td>
              <td className="px-4 py-3.5"><Who b={b} /></td>
              <td className="px-4 py-3.5 text-right"><Actions b={b} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlacklistCards({ rows, ctx }: { rows: BlacklistItem[]; ctx: Ctx }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((b) => (
        <li key={b.id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", !b.is_active && "bg-muted/20")}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Value b={b} /></div><Tag active={b.is_active} /></div>
          <Why b={b} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <Who b={b} />
            <Actions b={b} ctx={ctx} />
          </div>
        </li>
      ))}
    </ul>
  );
}

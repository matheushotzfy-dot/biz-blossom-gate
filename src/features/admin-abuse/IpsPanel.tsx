import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Network, Search, ShieldBan, Undo2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { fmtDateTime } from "@/features/admin-finance/format";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { BlockIpDialog } from "./BlockIpDialog";
import { PAGE_SIZE, clockLabel, lastLabel, parseIps, shortHash, type IpRow } from "./abuseModel";
import { useAbuseActions } from "./useAbuseActions";

export function IpsPanel({ hours }: { hours: number }) {
  const act = useAbuseActions();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [blocking, setBlocking] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-abuse-ips", hours, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_abuse_ips" as never, { _hours: hours, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseIps(data);
    },
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const summary = q.data?.summary;
  const filtersActive = !!debounced;

  return (
    <PremiumPanel title="IPs mais ativos" icon={Network}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
        IPs com mais tentativas de login com erro {lastLabel(hours)}. O IP aparece só como código; muitos e-mails diferentes no mesmo IP costuma ser alguém tentando senhas em várias contas.
        {summary ? ` ${summary.ips.toLocaleString("pt-BR")} ${summary.ips === 1 ? "IP" : "IPs"} no período${summary.blocked ? `, ${summary.blocked} em quarentena` : ""}.` : ""}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Buscar IP pelo código" placeholder="Início do código do IP" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
            className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
        </div>
        {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => { setSearch(""); setPage(1); }}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
      </div>

      {q.isError && !q.isFetching ? (
        <ErrorBlock title="Não foi possível carregar os IPs." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os IPs…</p>
      ) : items.length === 0 ? (
        <div>
          <PremiumEmpty icon={Network} title={filtersActive ? "Nenhum IP aqui" : "Nenhum IP com tentativas"} subtitle={filtersActive ? "Nenhum código bate com essa busca." : "Quando alguém errar a senha no login, o IP aparece aqui."} />
          {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={() => { setSearch(""); setPage(1); }}>Limpar filtros</Button></div>}
        </div>
      ) : (
        <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <IpTable rows={items} act={act} onBlock={setBlocking} />
          <IpCards rows={items} act={act} onBlock={setBlocking} />
          <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
        </div>
      )}
      <BlockIpDialog ipHash={blocking} onClose={() => setBlocking(null)} />
      {act.dialogs}
    </PremiumPanel>
  );
}

type Act = ReturnType<typeof useAbuseActions>;

const Quarantine = ({ r }: { r: IpRow }) => (r.blocked_until
  ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-[12px] font-semibold text-warning"><ShieldBan className="h-3 w-3" /> Em quarentena até {clockLabel(r.blocked_until)}</span>
  : <span className="text-[12.5px] text-muted-foreground">Livre</span>);

function Action({ r, act, onBlock }: { r: IpRow; act: Act; onBlock: (h: string) => void }) {
  if (r.block_id) {
    return (
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={act.busy !== null} onClick={() => void act.releaseBlock(r.block_id!, r.ip_hash)} aria-label={`Liberar o IP ${shortHash(r.ip_hash)}`}>
        {act.busy === r.block_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Liberar
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => onBlock(r.ip_hash)} aria-label={`Colocar o IP ${shortHash(r.ip_hash)} em quarentena`}>
      <ShieldBan className="h-3.5 w-3.5" /> Bloquear
    </Button>
  );
}

function IpTable({ rows, act, onBlock }: { rows: IpRow[]; act: Act; onBlock: (h: string) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["IP (código)", "Tentativas", "E-mails diferentes", "Última tentativa", "Situação", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ip_hash} className="border-b border-border/40 align-top last:border-b-0">
              <td className="px-4 py-3.5 font-mono text-[13px] font-semibold text-foreground" title={r.ip_hash}>{shortHash(r.ip_hash)}</td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums">
                {r.events.toLocaleString("pt-BR")}
                <span className="block text-[12px] text-muted-foreground">{r.failed.toLocaleString("pt-BR")} com erro{r.rate_limited > 0 ? ` · ${r.rate_limited.toLocaleString("pt-BR")} barradas` : ""}</span>
              </td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums">{r.accounts.toLocaleString("pt-BR")}</td>
              <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-muted-foreground">{fmtDateTime(r.last_at)}</td>
              <td className="px-4 py-3.5"><Quarantine r={r} /></td>
              <td className="px-4 py-3.5 text-right"><Action r={r} act={act} onBlock={onBlock} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IpCards({ rows, act, onBlock }: { rows: IpRow[]; act: Act; onBlock: (h: string) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((r) => (
        <li key={r.ip_hash} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[13px] font-semibold text-foreground" title={r.ip_hash}>{shortHash(r.ip_hash)}</p>
            <Quarantine r={r} />
          </div>
          <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-[12px]">
            <div><dt className="text-muted-foreground">Tentativas</dt><dd className="text-[14px] font-semibold tabular-nums">{r.events.toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-muted-foreground">Com erro</dt><dd className="text-[14px] font-semibold tabular-nums">{r.failed.toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-muted-foreground">E-mails</dt><dd className="text-[14px] font-semibold tabular-nums">{r.accounts.toLocaleString("pt-BR")}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <p className="text-[12px] text-muted-foreground">Última: {fmtDateTime(r.last_at)}</p>
            <Action r={r} act={act} onBlock={onBlock} />
          </div>
        </li>
      ))}
    </ul>
  );
}

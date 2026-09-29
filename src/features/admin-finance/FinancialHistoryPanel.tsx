import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { brl } from "./types";
import { SellerSelect } from "./SellerSelect";
import type { Tables } from "@/integrations/supabase/types";

interface LogRow {
  id: string; created_at: string; action: string; actor_role: string | null; actor_name: string | null; actor_email: string | null;
  seller_name: string | null; seller_email: string | null; reason: string | null; amount: number;
  balance_before: number | null; balance_after: number | null;
}

const ACTION_LABEL: Record<string, string> = {
  ajuste_credito: "Ajuste · crédito", ajuste_debito: "Ajuste · débito", reembolso: "Reembolso", chargeback: "Chargeback",
  disputa_bloqueio: "Disputa · bloqueio", disputa_liberacao: "Disputa · liberação", disputa_taxa: "Disputa · taxa",
  disputa_em_analise: "Disputa · em análise", disputa_ganha: "Disputa · ganha", disputa_perdida: "Disputa · perdida",
};
const ROLE_LABEL: Record<string, string> = { admin: "Dono", manager: "Gerente", employee: "Funcionário", sistema: "Sistema", seller: "Seller" };
const FILTERS = [
  { v: "all", l: "Todas as ações" }, { v: "ajuste", l: "Ajustes de saldo" }, { v: "reembolso", l: "Reembolsos" },
  { v: "chargeback", l: "Chargebacks" }, { v: "disputa", l: "Disputas / MED" },
];
const PAGE = 50;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function FinancialHistoryPanel({ profiles }: { profiles: Tables<"profiles">[] }) {
  const [seller, setSeller] = useState<string>("");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setRows(null);
    const end = new Date(to); end.setDate(end.getDate() + 1);
    const { data, error } = await supabase.rpc("get_financial_action_history", {
      _seller: seller || undefined, _from: new Date(from).toISOString(), _to: end.toISOString(),
      _action: action === "all" ? undefined : action, _limit: PAGE, _offset: page * PAGE,
    });
    if (error) { setRows([]); setTotal(0); return; }
    const res = data as unknown as { total: number; rows: LogRow[] };
    setRows(res.rows ?? []); setTotal(res.total ?? 0);
  }, [seller, from, to, action, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [seller, from, to, action]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="space-y-1"><Label>Seller</Label><SellerSelect profiles={profiles} value={seller} onChange={setSeller} allowAll /></div>
        <div className="space-y-1"><Label htmlFor="fh-from">De</Label><Input id="fh-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="fh-to">Até</Label><Input id="fh-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1"><Label>Ação</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FILTERS.map((f) => <SelectItem key={f.v} value={f.v}>{f.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {rows === null ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma ação financeira neste filtro</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>{["Data", "Ação", "Seller", "Responsável", "Justificativa", "Valor", "Saldo antes", "Saldo depois"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td className="px-3 py-2">{r.seller_name || r.seller_email || "—"}</td>
                  <td className="px-3 py-2">{r.actor_name || r.actor_email || "—"}<span className="block text-muted-foreground">{ROLE_LABEL[r.actor_role ?? ""] ?? r.actor_role}</span></td>
                  <td className="max-w-[260px] px-3 py-2 text-muted-foreground">{r.reason || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">{brl(r.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">{r.balance_before == null ? "—" : brl(r.balance_before)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">{r.balance_after == null ? "—" : brl(r.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} registros</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Search, ArrowDownToLine, History, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  profiles: Tables<"profiles">[];
}

interface StaffSummary {
  user_id: string;
  full_name: string;
  email: string;
  role: "manager" | "employee";
  base_pct: number;
  accrued: number;
  clawbacks: number;
  paid: number;
  balance: number;
  last_payout_at: string | null;
}

export default function AdminStaffCommissionsTab({ profiles }: Props) {
  const [rows, setRows] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<StaffSummary | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: ur } = await supabase
      .from("user_roles").select("user_id, role")
      .in("role", ["manager", "employee"] as any);
    const roleMap = new Map((ur ?? []).map((r: any) => [r.user_id, r.role]));
    const ids = Array.from(roleMap.keys());
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: cfg }, { data: ledger }, { data: payouts }] = await Promise.all([
      supabase.from("staff_commission_config").select("user_id, base_pct").in("user_id", ids),
      supabase.from("staff_commissions_ledger").select("staff_user_id, type, amount, balance_after, created_at").in("staff_user_id", ids),
      supabase.from("staff_commission_payouts").select("staff_user_id, status, processed_at").in("staff_user_id", ids).eq("status", "paid"),
    ]);

    const cfgMap = new Map((cfg ?? []).map((c: any) => [c.user_id, Number(c.base_pct)]));
    const sums = new Map<string, { accrued: number; clawbacks: number; paid: number; balance: number; lastBalanceTime: string }>();

    (ledger ?? []).forEach((e: any) => {
      const cur = sums.get(e.staff_user_id) ?? { accrued: 0, clawbacks: 0, paid: 0, balance: 0, lastBalanceTime: "" };
      const amt = Number(e.amount);
      if (e.type === "accrual") cur.accrued += amt;
      else if (e.type === "payout") cur.paid += -amt;
      else cur.clawbacks += -amt;
      if (!cur.lastBalanceTime || e.created_at > cur.lastBalanceTime) {
        cur.lastBalanceTime = e.created_at;
        cur.balance = Number(e.balance_after);
      }
      sums.set(e.staff_user_id, cur);
    });

    const lastPayout = new Map<string, string>();
    (payouts ?? []).forEach((p: any) => {
      const prev = lastPayout.get(p.staff_user_id);
      if (!prev || (p.processed_at && p.processed_at > prev)) {
        lastPayout.set(p.staff_user_id, p.processed_at);
      }
    });

    const list: StaffSummary[] = ids.map((uid) => {
      const p = profiles.find((x) => x.user_id === uid);
      const s = sums.get(uid) ?? { accrued: 0, clawbacks: 0, paid: 0, balance: 0, lastBalanceTime: "" };
      return {
        user_id: uid,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        role: (roleMap.get(uid) as any) ?? "employee",
        base_pct: cfgMap.get(uid) ?? 0,
        accrued: s.accrued,
        clawbacks: s.clawbacks,
        paid: s.paid,
        balance: s.balance,
        last_payout_at: lastPayout.get(uid) ?? null,
      };
    });
    setRows(list.sort((a, b) => b.balance - a.balance));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profiles]);

  const filtered = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, filter]);

  const totals = useMemo(() => ({
    balance: rows.reduce((s, r) => s + Math.max(r.balance, 0), 0),
    accrued: rows.reduce((s, r) => s + r.accrued, 0),
    clawbacks: rows.reduce((s, r) => s + r.clawbacks, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
  }), [rows]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-400" /> Comissões Staff & Gerentes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comissão sobre net_amount. Refunds/MEDs descontam automaticamente.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Saldo total a pagar", v: totals.balance, color: "text-emerald-400" },
          { label: "Acumulado (total)", v: totals.accrued, color: "text-foreground" },
          { label: "Clawbacks (refund/MED)", v: totals.clawbacks, color: "text-rose-400" },
          { label: "Pago (total)", v: totals.paid, color: "text-blue-400" },
        ].map((k) => (
          <div key={k.label} className="border border-border rounded-md bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={cn("text-lg font-bold font-mono mt-0.5", k.color)}>{fmt(k.v)}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar..." className="pl-8 h-9 text-sm rounded-md" />
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-2.5">Conta</th>
              <th className="text-left p-2.5">Função</th>
              <th className="text-right p-2.5">% padrão</th>
              <th className="text-right p-2.5">Acumulado</th>
              <th className="text-right p-2.5">Clawbacks</th>
              <th className="text-right p-2.5">Pago</th>
              <th className="text-right p-2.5">Saldo a pagar</th>
              <th className="text-right p-2.5">Último pagto</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sem registros.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.user_id} onClick={() => setSelected(r)}
                className="border-t border-border hover:bg-muted/20 cursor-pointer">
                <td className="p-2.5">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email}</div>
                </td>
                <td className="p-2.5">
                  <span className={cn(
                    "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold",
                    r.role === "manager"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  )}>{r.role === "manager" ? "Gerente" : "Staff"}</span>
                </td>
                <td className="p-2.5 text-right font-mono tabular-nums text-xs">{r.base_pct.toFixed(2)}%</td>
                <td className="p-2.5 text-right font-mono tabular-nums">{fmt(r.accrued)}</td>
                <td className="p-2.5 text-right font-mono tabular-nums text-rose-400">{r.clawbacks > 0 ? `-${fmt(r.clawbacks)}` : fmt(0)}</td>
                <td className="p-2.5 text-right font-mono tabular-nums text-blue-400">{fmt(r.paid)}</td>
                <td className={cn("p-2.5 text-right font-mono tabular-nums font-bold",
                  r.balance > 0 ? "text-emerald-400" : "text-muted-foreground")}>{fmt(r.balance)}</td>
                <td className="p-2.5 text-right font-mono text-[11px] text-muted-foreground">
                  {r.last_payout_at ? new Date(r.last_payout_at).toLocaleDateString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StaffCommissionPanel selected={selected} onClose={() => setSelected(null)} onChanged={load} profiles={profiles} />
    </div>
  );
}

// ============== Detail panel ==============
function StaffCommissionPanel({ selected, onClose, onChanged, profiles }: {
  selected: StaffSummary | null; onClose: () => void; onChanged: () => void; profiles: Tables<"profiles">[];
}) {
  const [ledger, setLedger] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [tab, setTab] = useState<"ledger" | "overrides" | "payouts">("ledger");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("PIX");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [newOverrideSeller, setNewOverrideSeller] = useState("");
  const [newOverridePct, setNewOverridePct] = useState("");
  const [newPct, setNewPct] = useState("");

  useEffect(() => {
    if (!selected) return;
    setNewPct(selected.base_pct.toFixed(2));
    (async () => {
      const [{ data: l }, { data: o }, { data: p }] = await Promise.all([
        supabase.from("staff_commissions_ledger").select("*")
          .eq("staff_user_id", selected.user_id).order("created_at", { ascending: false }).limit(500),
        supabase.from("staff_commission_overrides").select("*").eq("staff_user_id", selected.user_id),
        supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false }),
      ]);
      setLedger(l ?? []); setOverrides(o ?? []); setPayouts(p ?? []);
    })();
  }, [selected]);

  if (!selected) return null;

  const saveBasePct = async () => {
    const v = parseFloat(newPct);
    if (!Number.isFinite(v)) return;
    const { error } = await supabase.from("staff_commission_config").upsert({
      user_id: selected.user_id, base_pct: v, base: "net_amount", is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("% atualizada.");
    onChanged();
  };

  const addOverride = async () => {
    if (!newOverrideSeller || !newOverridePct) return;
    const { error } = await supabase.from("staff_commission_overrides").insert({
      staff_user_id: selected.user_id, seller_user_id: newOverrideSeller, pct: parseFloat(newOverridePct),
    });
    if (error) { toast.error(error.message); return; }
    setNewOverrideSeller(""); setNewOverridePct("");
    toast.success("Override adicionado.");
    const { data } = await supabase.from("staff_commission_overrides").select("*").eq("staff_user_id", selected.user_id);
    setOverrides(data ?? []);
  };

  const removeOverride = async (id: string) => {
    await supabase.from("staff_commission_overrides").delete().eq("id", id);
    setOverrides(overrides.filter((o) => o.id !== id));
  };

  const createPayout = async () => {
    const v = parseFloat(payoutAmount);
    if (!Number.isFinite(v) || v <= 0) { toast.error("Valor inválido."); return; }
    const { error } = await supabase.from("staff_commission_payouts").insert({
      staff_user_id: selected.user_id, amount: v, method: payoutMethod, notes: payoutNotes, status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    setPayoutAmount(""); setPayoutNotes("");
    toast.success("Pagamento registrado como pendente. Marque como 'paid' para efetivar.");
    const { data } = await supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false });
    setPayouts(data ?? []);
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("staff_commission_payouts").update({ status: "paid" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento efetivado e debitado do saldo.");
    const { data } = await supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false });
    setPayouts(data ?? []);
    onChanged();
  };

  return (
    <Dialog open={!!selected} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{selected.full_name} — {fmt(selected.balance)} a pagar</span>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0"><X className="h-4 w-4" /></Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3 p-2 border border-border rounded-md bg-card/50">
          <Label className="text-xs">% padrão (sobre net):</Label>
          <Input value={newPct} onChange={(e) => setNewPct(e.target.value)} type="number" step="0.01" min="0" max="100"
            className="h-8 w-24 font-mono text-sm" />
          <Button size="sm" onClick={saveBasePct} className="h-8">Salvar</Button>
        </div>

        <div className="flex gap-1 border-b border-border">
          {(["ledger", "overrides", "payouts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors",
                tab === t ? "border-amber-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t === "ledger" ? "Movimentações" : t === "overrides" ? "Overrides por seller" : "Pagamentos"}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {tab === "ledger" && (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20 sticky top-0">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-right p-2">Base</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Valor</th>
                  <th className="text-right p-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem movimentações ainda.</td></tr>
                ) : ledger.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2 font-mono text-[11px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                        e.type === "accrual" ? "bg-emerald-500/10 text-emerald-400" :
                        e.type === "payout" ? "bg-blue-500/10 text-blue-400" :
                        "bg-rose-500/10 text-rose-400")}>{e.type}</span>
                    </td>
                    <td className="p-2 text-right font-mono">{fmt(Number(e.base_amount))}</td>
                    <td className="p-2 text-right font-mono">{Number(e.pct).toFixed(2)}%</td>
                    <td className={cn("p-2 text-right font-mono font-semibold",
                      Number(e.amount) >= 0 ? "text-emerald-400" : "text-rose-400")}>{fmt(Number(e.amount))}</td>
                    <td className="p-2 text-right font-mono">{fmt(Number(e.balance_after))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "overrides" && (
            <div className="space-y-3 p-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Seller</Label>
                  <select value={newOverrideSeller} onChange={(e) => setNewOverrideSeller(e.target.value)}
                    className="w-full h-9 text-sm bg-card border border-border rounded-md px-2 mt-1">
                    <option value="">Selecione...</option>
                    {profiles.map((p) => (
                      <option key={p.user_id} value={p.user_id}>{p.full_name || p.email}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <Label className="text-xs">% específica</Label>
                  <Input value={newOverridePct} onChange={(e) => setNewOverridePct(e.target.value)}
                    type="number" step="0.01" className="h-9 text-sm mt-1 font-mono" />
                </div>
                <Button size="sm" onClick={addOverride} className="h-9 gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
              </div>
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="text-left p-2">Seller</th>
                    <th className="text-right p-2">%</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((o) => {
                    const p = profiles.find((x) => x.user_id === o.seller_user_id);
                    return (
                      <tr key={o.id} className="border-t border-border">
                        <td className="p-2">{p?.full_name || p?.email || o.seller_user_id}</td>
                        <td className="p-2 text-right font-mono">{Number(o.pct).toFixed(2)}%</td>
                        <td className="p-2"><Button size="sm" variant="ghost" onClick={() => removeOverride(o.id)} className="h-7 w-7 p-0 text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "payouts" && (
            <div className="space-y-3 p-2">
              <div className="grid grid-cols-4 gap-2 items-end p-3 border border-border rounded-md bg-card/50">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} type="number" step="0.01" className="h-9 mt-1 font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Método</Label>
                  <Input value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className="h-9 mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Input value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} className="h-9 mt-1" />
                </div>
                <div className="col-span-4 flex justify-end">
                  <Button size="sm" onClick={createPayout} className="gap-1.5">
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Registrar pagamento
                  </Button>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-right p-2">Valor</th>
                    <th className="text-left p-2">Método</th>
                    <th className="text-left p-2">Status</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem pagamentos.</td></tr>
                  ) : payouts.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-2 font-mono text-[11px]">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2 text-right font-mono font-semibold">{fmt(Number(p.amount))}</td>
                      <td className="p-2">{p.method}</td>
                      <td className="p-2">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          p.status === "paid" ? "bg-blue-500/10 text-blue-400" :
                          p.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                          "bg-rose-500/10 text-rose-400")}>{p.status}</span>
                      </td>
                      <td className="p-2 text-right">
                        {p.status === "pending" && (
                          <Button size="sm" onClick={() => markPaid(p.id)} className="h-7 text-[11px]">Marcar pago</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

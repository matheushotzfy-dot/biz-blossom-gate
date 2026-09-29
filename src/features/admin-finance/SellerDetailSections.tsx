import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { brl, rpcErrorMessage } from "./types";

const Spinner = () => <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>;
const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{text}</p>;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

interface AcqHistory {
  current: { id: string; name: string } | null;
  history: { at: string; from: string | null; to: string; reason: string | null; trigger: string | null; success: boolean }[];
  usage: { acquirer: string; tx_total: number; tx_paid: number; gross: number; net: number; fee: number; first_at: string; last_at: string }[];
}

/** Current acquirer, every change and sales/balance split by the acquirer actually used. */
export function SellerAcquirersSection({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ["seller-acq", userId], queryFn: async () => {
    const { data, error } = await supabase.rpc("get_seller_acquirer_history", { _user_id: userId });
    if (error) throw new Error(rpcErrorMessage(error)); return data as unknown as AcqHistory;
  } });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <Empty text="Não foi possível carregar" />;
  const d = q.data;
  return (
    <div className="space-y-4 text-xs">
      <p>Adquirente atual: <span className="font-semibold">{d.current?.name ?? "Padrão da plataforma (com reserva automática)"}</span></p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full"><thead className="bg-muted/40 text-left text-muted-foreground"><tr>{["Adquirente usada", "Vendas", "Conversão", "Volume", "Líquido (após reembolsos)", "Taxas", "Período"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{d.usage.length === 0 ? <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Sem vendas</td></tr> : d.usage.map((u) => (
            <tr key={u.acquirer} className="border-t border-border font-mono tabular-nums"><td className="px-3 py-2 font-sans font-semibold">{u.acquirer}</td><td className="px-3 py-2">{u.tx_paid}/{u.tx_total}</td>
              <td className="px-3 py-2">{u.tx_total ? ((u.tx_paid * 100) / u.tx_total).toFixed(1) : 0}%</td><td className="px-3 py-2">{brl(u.gross)}</td><td className="px-3 py-2">{brl(u.net)}</td><td className="px-3 py-2">{brl(u.fee)}</td>
              <td className="px-3 py-2 font-sans">{new Date(u.first_at).toLocaleDateString("pt-BR")} – {new Date(u.last_at).toLocaleDateString("pt-BR")}</td></tr>))}</tbody></table>
      </div>
      <h4 className="font-semibold">Histórico de trocas</h4>
      {d.history.length === 0 ? <Empty text="Nenhuma troca registrada" /> : (
        <ul className="space-y-1">{d.history.map((h, i) => (
          <li key={i} className="rounded-lg border border-border p-2">{fmt(h.at)} · {h.from ?? "Padrão"} → <span className="font-semibold">{h.to}</span> · {h.trigger === "manual" ? "manual" : "automática"}{h.reason ? ` · ${h.reason}` : ""}</li>))}</ul>)}
    </div>
  );
}

const WD_LABEL: Record<string, string> = { pending: "Pendente", processing: "Processando", completed: "Pago", paid: "Pago", approved: "Aprovado", rejected: "Recusado", failed: "Falhou", cancelled: "Cancelado" };

/** All seller withdrawals with Pix key, amount and reject-with-reason (balance returns via server trigger). */
export function SellerWithdrawalsSection({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const q = useQuery({ queryKey: ["seller-wd", userId], queryFn: async () => {
    const { data, error } = await supabase.from("withdrawals").select("id,amount,fee_amount,net_amount,status,created_at,processed_at,rejection_reason,withdrawal_type,pix_key_id,pix_keys(key_type,key_value)").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  const reject = async (id: string) => {
    const reason = reasons[id]?.trim() ?? "";
    if (reason.length < 5) { toast.error("Motivo da recusa obrigatório (mín. 5 caracteres)"); return; }
    const { data, error } = await supabase.from("withdrawals").update({ status: "rejected", rejection_reason: reason.slice(0, 500), processed_by: user?.id }).eq("id", id).eq("status", "pending").select("id");
    if (error || !data?.length) { toast.error(error ? rpcErrorMessage(error) : "Saque não está mais pendente"); return; }
    toast.success("Saque recusado; saldo devolvido ao seller"); void qc.invalidateQueries({ queryKey: ["seller-wd", userId] }); onChanged?.();
  };
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  if (!rows.length) return <Empty text="Nenhum saque solicitado" />;
  return (
    <div className="space-y-2 text-xs">
      {rows.map((w) => {
        const pk = w.pix_keys as unknown as { key_type: string; key_value: string } | null;
        return (
          <div key={w.id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-0.5">
              <p><span className="font-mono text-sm font-semibold">{brl(w.amount)}</span> <span className="text-muted-foreground">taxa {brl(w.fee_amount)} · líquido {brl(w.net_amount)}</span> · <span className="font-semibold">{WD_LABEL[w.status] ?? w.status}</span></p>
              <p className="text-muted-foreground">Chave Pix: {pk ? `${pk.key_type.toUpperCase()} · ${pk.key_value}` : w.withdrawal_type ?? "—"}</p>
              <p className="text-muted-foreground">Pedido {fmt(w.created_at)}{w.processed_at ? ` · processado ${fmt(w.processed_at)}` : ""}</p>
              {w.rejection_reason && <p className="text-destructive">Motivo da recusa: {w.rejection_reason}</p>}
            </div>
            {w.status === "pending" && (
              <div className="flex flex-col gap-1 md:w-64">
                <Input placeholder="Motivo da recusa" maxLength={500} value={reasons[w.id] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [w.id]: e.target.value }))} />
                <Button size="sm" variant="outline" onClick={() => void reject(w.id)}>Recusar saque</Button>
              </div>)}
          </div>);
      })}
    </div>
  );
}

const REWARD_STATUS = [{ v: "pending", l: "Solicitada" }, { v: "preparing", l: "Em preparo" }, { v: "shipped", l: "Enviada / a caminho" }, { v: "delivered", l: "Entregue" }, { v: "cancelled", l: "Cancelada" }];

/** Award claims with editable status and tracking. */
export function SellerRewardsSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<string, { status: string; code: string; carrier: string }>>({});
  const q = useQuery({ queryKey: ["seller-rewards", userId], queryFn: async () => {
    const { data, error } = await supabase.from("reward_claims").select("id,tier_label,tier_value,status,tracking_code,tracking_carrier,shipping_city,shipping_state,created_at,delivered_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  const save = async (id: string) => {
    const e = edit[id]; if (!e) return;
    const { error } = await supabase.from("reward_claims").update({
      status: e.status, tracking_code: e.code.trim().slice(0, 100) || null, tracking_carrier: e.carrier.trim().slice(0, 60) || null,
      delivered_at: e.status === "delivered" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) { toast.error(rpcErrorMessage(error)); return; }
    toast.success("Premiação atualizada"); void qc.invalidateQueries({ queryKey: ["seller-rewards", userId] });
  };
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  if (!rows.length) return <Empty text="Nenhuma premiação solicitada" />;
  return (
    <div className="space-y-2 text-xs">
      {rows.map((r) => {
        const e = edit[r.id] ?? { status: r.status, code: r.tracking_code ?? "", carrier: r.tracking_carrier ?? "" };
        const set = (p: Partial<typeof e>) => setEdit((s) => ({ ...s, [r.id]: { ...e, ...p } }));
        return (
          <div key={r.id} className="space-y-2 rounded-xl border border-border p-3">
            <p><span className="font-semibold">{r.tier_label}</span> · meta {brl(r.tier_value)} · pedido {fmt(r.created_at)} · {r.shipping_city ?? "—"}/{r.shipping_state ?? ""}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <Select value={e.status} onValueChange={(v) => set({ status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REWARD_STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Transportadora" maxLength={60} value={e.carrier} onChange={(ev) => set({ carrier: ev.target.value })} />
              <Input placeholder="Código de rastreio" maxLength={100} value={e.code} onChange={(ev) => set({ code: ev.target.value })} />
              <Button size="sm" onClick={() => void save(r.id)}>Salvar</Button>
            </div>
          </div>);
      })}
    </div>
  );
}

const TX_LABEL: Record<string, string> = { approved: "Aprovada", paid: "Paga", completed: "Paga", pending: "Pendente", refunded: "Reembolsada", partially_refunded: "Reemb. parcial", expired: "Expirada", failed: "Recusada", chargeback: "Chargeback" };

/** Latest 100 seller transactions with acquirer and fee split. */
export function SellerTransactionsSection({ userId }: { userId: string }) {
  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => (await supabase.rpc("list_acquirers_basic")).data ?? [] });
  const q = useQuery({ queryKey: ["seller-tx", userId], queryFn: async () => {
    const { data, error } = await supabase.from("transactions").select("id,amount,fee_amount,fee_percent_amount,fee_fixed_amount,net_amount,refunded_amount,status,payment_method,customer_name,customer_email,buyer_ip,acquirer_id,created_at").eq("user_id", userId).eq("is_simulated", false).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  if (q.isLoading) return <Spinner />;
  const rows = q.data ?? [];
  if (!rows.length) return <Empty text="Nenhuma transação" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border text-xs">
      <table className="w-full"><thead className="bg-muted/40 text-left text-muted-foreground"><tr>{["Data", "Status", "Método", "Valor", "Taxa %", "Taxa fixa", "Líquido", "Reemb.", "Comprador", "IP", "Adquirente"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((t) => (
          <tr key={t.id} className="border-t border-border">
            <td className="whitespace-nowrap px-3 py-2">{fmt(t.created_at)}</td><td className="px-3 py-2">{TX_LABEL[t.status] ?? t.status}</td><td className="px-3 py-2">{t.payment_method ?? "—"}</td>
            <td className="px-3 py-2 font-mono">{brl(t.amount)}</td><td className="px-3 py-2 font-mono">{brl(t.fee_percent_amount)}</td><td className="px-3 py-2 font-mono">{brl(t.fee_fixed_amount)}</td>
            <td className="px-3 py-2 font-mono">{brl(t.net_amount)}</td><td className="px-3 py-2 font-mono">{brl(t.refunded_amount)}</td>
            <td className="px-3 py-2">{t.customer_name ?? "—"}<span className="block text-muted-foreground">{t.customer_email}</span></td>
            <td className="px-3 py-2 font-mono">{t.buyer_ip ?? "—"}</td><td className="px-3 py-2">{acqs.data?.find((a) => a.id === t.acquirer_id)?.name ?? "—"}</td>
          </tr>))}</tbody></table>
    </div>
  );
}

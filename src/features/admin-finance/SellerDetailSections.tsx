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
import { logAdminAction } from "@/lib/auditLog";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

const Spinner = () => <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>;
const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">{text}</p>;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const day = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const METHOD_LABEL: Record<string, string> = { pix: "Pix", credit_card: "Cartão", card: "Cartão", boleto: "Boleto" };
const PIX_TYPE: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave aleatória", evp: "Chave aleatória" };
function LoadError({ retry }: { retry: () => void }) { return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os registros.<Button variant="outline" onClick={retry}>Tentar novamente</Button></div>; }

interface AcqHistory {
  current: { id: string; name: string } | null;
  history: { at: string; from: string | null; to: string; reason: string | null; trigger: string | null; success: boolean }[];
  usage: { acquirer: string; tx_total: number; tx_paid: number; gross: number; net: number; fee: number; first_at: string; last_at: string }[];
}

/** Current acquirer, every change and sales/balance split by the acquirer actually used. */
export function SellerAcquirersSection({ userId }: { userId: string }) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["seller-acq", user?.id, userId], staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.rpc("get_seller_acquirer_history", { _user_id: userId });
    if (error) throw new Error(rpcErrorMessage(error)); return data as unknown as AcqHistory;
  } });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <LoadError retry={() => void q.refetch()} />;
  if (!q.data) return <Empty text="Ainda não há registro de adquirente para este seller." />;
  const d = q.data;
  return (
    <div className="space-y-4 text-[13px]">
      <p>Adquirente atual: <span className="font-semibold">{d.current?.name ?? "Padrão da plataforma"}</span></p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>{["Adquirente usada", "Vendas pagas", "Conversão", "Volume", "Líquido após reembolsos", "Taxas", "Período"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{d.usage.length === 0 ? <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Nenhuma venda ainda.</td></tr> : d.usage.map((u) => (
            <tr key={u.acquirer} className="border-t border-border tabular-nums"><td className="px-3 py-2 font-semibold">{u.acquirer}</td><td className="px-3 py-2">{u.tx_paid} de {u.tx_total}</td>
              <td className="px-3 py-2">{u.tx_total ? ((u.tx_paid * 100) / u.tx_total).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%</td><td className="px-3 py-2">{brl(u.gross)}</td><td className="px-3 py-2">{brl(u.net)}</td><td className="px-3 py-2">{brl(u.fee)}</td>
              <td className="whitespace-nowrap px-3 py-2">{day(u.first_at)} a {day(u.last_at)}</td></tr>))}</tbody></table>
      </div>
      <h4 className="font-semibold">Histórico de trocas</h4>
      {d.history.length === 0 ? <Empty text="Nenhuma troca registrada." /> : (
        <ul className="space-y-1.5">{d.history.map((h, i) => (
          <li key={i} className="rounded-lg border border-border px-3 py-2">
            <p><span className="text-muted-foreground">{h.from ?? "Padrão"}</span> → <span className="font-semibold">{h.to}</span></p>
            <p className="text-xs text-muted-foreground">{fmt(h.at)}, troca {h.trigger === "manual" ? "manual" : "automática"}{h.reason ? `. Motivo: ${h.reason}` : ""}</p>
          </li>))}</ul>)}
    </div>
  );
}

const WD_LABEL: Record<string, string> = { pending: "Pendente", processing: "Processando", completed: "Pago", paid: "Pago", approved: "Aprovado", rejected: "Recusado", failed: "Falhou", cancelled: "Cancelado" };

/** All seller withdrawals with Pix key, amount and reject-with-reason (balance returns via server trigger). */
export function SellerWithdrawalsSection({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useSensitiveConfirm();
  const q = useQuery({ queryKey: ["seller-wd", user?.id, userId, page], staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from("withdrawals").select("id,amount,fee_amount,net_amount,status,created_at,processed_at,rejection_reason,withdrawal_type,pix_key_id,pix_keys(key_type,key_value)").eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 24);
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  const reject = (id: string) => {
    if (!user || busy) return;
    const reason = reasons[id]?.trim() ?? "";
    if (reason.length < 5) { toast.error("Motivo da recusa obrigatório (mín. 5 caracteres)"); return; }
    confirm("Recusar este saque e devolver a reserva ao seller?", () => executeReject(id, reason));
  };
  const executeReject = async (id: string, reason: string) => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("withdrawals").update({ status: "rejected", rejection_reason: reason.slice(0, 500), processed_by: user.id }).eq("id", id).eq("user_id", userId).eq("status", "pending").select("id");
    setBusy(false);
    if (error || !data?.length) { toast.error(error ? rpcErrorMessage(error) : "Saque não está mais pendente"); return; }
    await logAdminAction("reject_withdrawal", "withdrawal", id, { reason: reason.slice(0, 500) });
    toast.success("Saque recusado; saldo devolvido ao seller"); void qc.invalidateQueries({ queryKey: ["seller-wd", user.id, userId] }); onChanged?.();
  };
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <LoadError retry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (!rows.length && !page) return <Empty text="Nenhum saque solicitado." />;
  return (
    <div className="space-y-2 text-[13px]">
      {rows.map((w) => {
        const pk = w.pix_keys as unknown as { key_type: string; key_value: string } | null;
        return (
          <div key={w.id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2"><span className="text-sm font-semibold tabular-nums">{brl(w.amount)}</span><span className="font-medium">{WD_LABEL[w.status] ?? w.status}</span></p>
              <p className="tabular-nums text-muted-foreground">Taxa {brl(w.fee_amount)}, o seller recebe {brl(w.net_amount)}</p>
              <p className="text-muted-foreground">Chave Pix: {pk ? <>{PIX_TYPE[pk.key_type?.toLowerCase()] ?? pk.key_type} <span className="font-mono">{pk.key_value}</span></> : w.withdrawal_type ?? "não informada"}</p>
              <p className="text-muted-foreground">Pedido em {fmt(w.created_at)}{w.processed_at ? `, processado em ${fmt(w.processed_at)}` : ""}</p>
              {w.rejection_reason && <p className="text-destructive">Motivo da recusa: {w.rejection_reason}</p>}
            </div>
            {w.status === "pending" && (
              <div className="flex flex-col gap-1 md:w-64">
                <Input placeholder="Motivo da recusa (o seller lê)" aria-label="Motivo da recusa do saque" maxLength={500} value={reasons[w.id] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [w.id]: e.target.value }))} />
                <Button size="sm" variant="outline" disabled={busy || (reasons[w.id]?.trim().length ?? 0) < 5} onClick={() => reject(w.id)}>Recusar saque</Button>
              </div>)}
          </div>);
      })}
      {(page > 0 || rows.length === 25) && <div className="flex items-center justify-between"><Button variant="outline" size="sm" disabled={!page || q.isFetching} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-muted-foreground">Página {page + 1}</span><Button variant="outline" size="sm" disabled={rows.length < 25 || q.isFetching} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>}
      {dialog}
    </div>
  );
}

const REWARD_STATUS_LABEL: Record<string, string> = { pending: "Aguardando", preparing: "Em preparo", approved: "Em preparo", shipped: "Postado", delivered: "Entregue", cancelled: "Cancelado" };

/** Pedidos de premiação do seller, só para consulta: andamento e mudanças ficam na aba Premiações. */
export function SellerRewardsSection({ userId }: { userId: string }) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["seller-rewards", user?.id, userId], staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from("reward_claims").select("id,tier_label,tier_value,status,tracking_code,tracking_carrier,shipping_city,shipping_state,created_at,delivered_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <LoadError retry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (!rows.length) return <Empty text="Nenhuma premiação solicitada." />;
  return (
    <div className="space-y-2 text-[13px]">
      <p className="text-muted-foreground">Só consulta. Para aceitar, postar, cancelar ou corrigir um pedido, use a aba Premiações.</p>
      {rows.map((r) => (
        <div key={r.id} className="space-y-1 rounded-xl border border-border p-3">
          <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{r.tier_label}</span><span className="font-medium text-muted-foreground">{REWARD_STATUS_LABEL[r.status] ?? r.status}</span></p>
          <p className="text-muted-foreground">Meta de {brl(r.tier_value)}, pedido em {fmt(r.created_at)}{r.shipping_city ? `, entrega em ${r.shipping_city}${r.shipping_state ? `/${r.shipping_state}` : ""}` : ""}</p>
          {(r.tracking_code || r.delivered_at) && (
            <p className="text-muted-foreground">
              {r.tracking_code ? <>Rastreio {r.tracking_carrier ? `${r.tracking_carrier} ` : ""}<span className="font-mono">{r.tracking_code}</span></> : null}
              {r.tracking_code && r.delivered_at ? ", " : ""}
              {r.delivered_at ? `entregue em ${fmt(r.delivered_at)}` : ""}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

const TX_LABEL: Record<string, string> = { approved: "Aprovada", paid: "Paga", completed: "Paga", pending: "Pendente", refunded: "Reembolsada", partially_refunded: "Reembolso parcial", expired: "Expirada", failed: "Recusada", chargeback: "Chargeback", disputed: "Em disputa", cancelled: "Cancelada", canceled: "Cancelada" };

/** Latest 100 seller transactions with acquirer and fee split. */
export function SellerTransactionsSection({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const acqs = useQuery({ queryKey: ["acq-basic"], staleTime: 300_000, queryFn: async () => (await supabase.rpc("list_acquirers_basic")).data ?? [] });
  const q = useQuery({ queryKey: ["seller-tx", user?.id, userId, page], staleTime: 30000, queryFn: async () => {
    const { data, error } = await supabase.from("transactions").select("id,amount,fee_amount,fee_percent_amount,fee_fixed_amount,net_amount,refunded_amount,status,payment_method,customer_name,customer_email,buyer_ip,acquirer_id,created_at").eq("user_id", userId).eq("is_simulated", false).order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 24);
    if (error) throw new Error(rpcErrorMessage(error)); return data;
  } });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <LoadError retry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (!rows.length && !page) return <Empty text="Nenhuma venda real ainda (vendas simuladas não aparecem aqui)." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border text-[13px]">
      <table className="w-full"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr>{["Data", "Situação", "Forma", "Valor", "Taxa %", "Taxa fixa", "Líquido", "Reembolsado", "Comprador", "IP", "Adquirente"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((t) => (
          <tr key={t.id} className="border-t border-border">
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(t.created_at)}</td><td className="whitespace-nowrap px-3 py-2">{TX_LABEL[t.status] ?? t.status}</td><td className="px-3 py-2">{t.payment_method ? METHOD_LABEL[t.payment_method] ?? t.payment_method : "—"}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{brl(t.amount)}</td><td className="whitespace-nowrap px-3 py-2 tabular-nums">{brl(t.fee_percent_amount)}</td><td className="whitespace-nowrap px-3 py-2 tabular-nums">{brl(t.fee_fixed_amount)}</td>
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{brl(t.net_amount)}</td><td className="whitespace-nowrap px-3 py-2 tabular-nums">{brl(t.refunded_amount)}</td>
            <td className="px-3 py-2">{t.customer_name ?? "—"}<span className="block text-xs text-muted-foreground">{t.customer_email}</span></td>
            <td className="px-3 py-2 font-mono">{t.buyer_ip ?? "—"}</td><td className="px-3 py-2">{acqs.data?.find((a) => a.id === t.acquirer_id)?.name ?? "—"}</td>
          </tr>))}</tbody></table>
      <div className="flex items-center justify-between gap-3 border-t border-border p-3"><Button variant="outline" size="sm" disabled={!page || q.isFetching} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-muted-foreground">Página {page + 1}</span><Button variant="outline" size="sm" disabled={rows.length < 25 || q.isFetching} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
    </div>
  );
}

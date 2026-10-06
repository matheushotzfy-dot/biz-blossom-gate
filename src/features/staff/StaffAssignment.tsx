import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Clock, RefreshCw, ShieldCheck, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendlyError";

interface AccountOption { user_id: string; email: string | null; full_name: string | null }
interface AssignmentRow { id: string; manager_user_id: string; seller_user_id: string; started_at: string; ended_at: string | null; end_reason: string | null }

export function StaffAssignment({ staff, sellers }: { staff: AccountOption[]; sellers: AccountOption[] }) {
  const [member, setMember] = useState("");
  const [seller, setSeller] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [defaultManager, setDefaultManager] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: assignments, error }, { data: settings }] = await Promise.all([
      supabase.from("manager_seller_assignments").select("id,manager_user_id,seller_user_id,started_at,ended_at,end_reason").order("started_at", { ascending: false }).limit(300),
      supabase.from("manager_settings" as never).select("manager_user_id,auto_assign_new_sellers"),
    ]);
    if (error) { toast.error("Não foi possível carregar os vínculos"); return; }
    setRows((assignments ?? []) as AssignmentRow[]);
    const defaults = (settings ?? []) as unknown as { manager_user_id: string; auto_assign_new_sellers: boolean }[];
    setDefaultManager(defaults.find(item => item.auto_assign_new_sellers)?.manager_user_id ?? "");
  };

  useEffect(() => { void load(); }, []);

  const activeBySeller = useMemo(() => new Map(rows.filter(row => !row.ended_at).map(row => [row.seller_user_id, row])), [rows]);
  const label = (id: string, options: AccountOption[]) => options.find(item => item.user_id === id)?.full_name || options.find(item => item.user_id === id)?.email || id;

  const transfer = async () => {
    if (!member || !seller || reason.trim().length < 5 || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("transfer_seller_manager" as never, { _seller: seller, _new_manager: member, _reason: reason.trim() } as never);
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(activeBySeller.has(seller) ? "Carteira transferida com histórico preservado." : "Seller vinculado ao gerente.");
    setReason("");
    await load();
  };

  const remove = async (sellerId: string) => {
    const removalReason = window.prompt("Motivo da remoção do gerente (mínimo 5 caracteres)");
    if (!removalReason || removalReason.trim().length < 5) return;
    const { error } = await supabase.rpc("remove_seller_manager" as never, { _seller: sellerId, _reason: removalReason.trim() } as never);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Vínculo encerrado. O histórico foi preservado.");
    await load();
  };

  const setDefault = async (managerId: string, enabled: boolean) => {
    const { error } = await supabase.rpc("set_default_manager" as never, { _manager: managerId, _enabled: enabled } as never);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(enabled ? "Gerente padrão ativado." : "Gerente padrão desativado.");
    await load();
  };

  if (!staff.length) return null;
  return (
    <section className="space-y-4 border-y border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-foreground">Carteiras e atribuições</h3><p className="text-xs text-muted-foreground">A transferência encerra o vínculo anterior sem alterar seu extrato histórico.</p></div>
        <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Atualizar vínculos"><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
        <div><Label>Gerente</Label><Select value={member} onValueChange={setMember}><SelectTrigger aria-label="Gerente responsável"><SelectValue placeholder="Selecionar gerente" /></SelectTrigger><SelectContent>{staff.map(item => <SelectItem key={item.user_id} value={item.user_id}>{label(item.user_id, staff)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Seller</Label><Select value={seller} onValueChange={setSeller}><SelectTrigger aria-label="Seller da carteira"><SelectValue placeholder="Selecionar seller" /></SelectTrigger><SelectContent>{sellers.filter(item => !staff.some(manager => manager.user_id === item.user_id)).map(item => <SelectItem key={item.user_id} value={item.user_id}>{label(item.user_id, sellers)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="assignment-reason">Justificativa auditável</Label><Input id="assignment-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} placeholder="Ex.: transferência de carteira" /></div>
        <Button disabled={busy || !member || !seller || reason.trim().length < 5} onClick={() => void transfer()}><ArrowRightLeft className="mr-2 h-4 w-4" />{activeBySeller.has(seller) ? "Transferir" : "Vincular"}</Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {staff.map(manager => {
          const active = rows.filter(row => row.manager_user_id === manager.user_id && !row.ended_at);
          const isDefault = defaultManager === manager.user_id;
          return <article key={manager.user_id} className="border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">{label(manager.user_id, staff)}</p><p className="text-xs text-muted-foreground">{active.length} seller{active.length === 1 ? "" : "s"} ativo{active.length === 1 ? "" : "s"}</p></div><label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={isDefault} onCheckedChange={checked => void setDefault(manager.user_id, checked)} aria-label={`Gerente padrão ${label(manager.user_id, staff)}`} />Novas aprovações</label></div>
            <div className="mt-3 space-y-2">{active.length ? active.map(row => <div key={row.id} className="flex items-center justify-between gap-3 border-t border-border pt-2"><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{label(row.seller_user_id, sellers)}</p><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />Desde {new Date(row.started_at).toLocaleString("pt-BR")}</p></div><Button variant="ghost" size="icon" onClick={() => void remove(row.seller_user_id)} aria-label="Encerrar vínculo"><UserMinus className="h-4 w-4" /></Button></div>) : <p className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Sem sellers ativos</p>}</div>
            {isDefault && <p className="mt-3 flex items-center gap-1 text-[10px] font-medium text-success"><CheckCircle2 className="h-3 w-3" />Recebe novas contas aprovadas sem seleção manual</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
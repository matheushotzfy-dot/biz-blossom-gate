import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/friendlyError';
import { PremiumPanel } from '@/pages/admin/tabs/AdminPremium';
export function WithdrawalBlockControl({ sellers, owner = false }: { sellers: { user_id: string; full_name: string | null; email: string | null }[]; owner?: boolean }) {
  const { user } = useAuth(); const client = useQueryClient();
  const [seller, setSeller] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const access = useQuery({ queryKey: ['withdrawal-block-access', user?.id], enabled: !!user, queryFn: async () => {
    if (!user) return false;
    const { data, error } = await supabase.rpc('has_staff_permission', { _user_id: user.id, _key: 'freeze_seller_withdrawals' });
    if (error) throw error; return data === true;
  } });
  const block = useQuery({ queryKey: ['withdrawal-block', user?.id, seller], enabled: !!user && !!seller && (owner || access.data === true), queryFn: async () => {
    const { data, error } = await supabase.from('seller_withdrawal_blocks').select('active,reason').eq('seller_user_id', seller).maybeSingle();
    if (error) throw error; return data;
  } });
  if (!owner && access.data !== true) return null;
  const submit = async (active: boolean) => {
    if (!seller || busy || reason.trim().length < 5 || block.isError) return;
    setBusy(true);
    const { error } = await supabase.rpc('set_seller_withdrawal_block', { _seller: seller, _block: active, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(active ? 'Saques bloqueados para análise; saldo preservado.' : 'Bloqueio de saques removido.'); setReason('');
    await client.invalidateQueries({ queryKey: ['withdrawal-block', user?.id, seller] });
  };
  return <PremiumPanel title="Bloquear saques para análise" description="Segura os saques de um seller enquanto você investiga. O saldo continua dele, só não pode ser sacado."><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Seller</Label><Select value={seller} onValueChange={setSeller}><SelectTrigger aria-label="Seller para análise de saques"><SelectValue placeholder="Selecionar seller" /></SelectTrigger><SelectContent>{sellers.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.email || s.user_id}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="withdrawal-block-reason">Justificativa</Label><Input id="withdrawal-block-reason" maxLength={1000} placeholder="Motivo (mínimo 5 caracteres)" value={reason} onChange={e => setReason(e.target.value)} /></div></div>{seller && <p className="text-sm text-muted-foreground">{block.isError ? 'Não foi possível consultar o bloqueio.' : block.isFetching ? 'Consultando…' : block.data?.active ? `Saques bloqueados: ${block.data.reason}` : 'Sem bloqueio de saques por análise'}</p>}<div className="flex gap-2"><Button disabled={!seller || busy || block.isFetching || block.isError || reason.trim().length<5} onClick={() => void submit(true)}>Bloquear saques</Button>{!owner && block.data?.active && <Button variant="outline" disabled title="Somente o dono pode liberar saques bloqueados">Somente o dono libera</Button>}{owner && block.data?.active && <Button variant="outline" disabled={busy || reason.trim().length<5} onClick={() => void submit(false)}>Liberar saques</Button>}</div></div></PremiumPanel>;
}

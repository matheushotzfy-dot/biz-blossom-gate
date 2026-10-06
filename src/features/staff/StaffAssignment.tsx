import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/friendlyError';
export function StaffAssignment({ staff, sellers }: { staff: { user_id: string; email: string | null; full_name: string | null }[]; sellers: { user_id: string; email: string | null; full_name: string | null }[] }) {
  const [member, setMember] = useState(''); const [seller, setSeller] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { if (!member || !seller || busy) return; setBusy(true); const { error } = await supabase.rpc('assign_staff_seller',{_staff:member,_seller:seller}); setBusy(false); if(error) toast.error(friendlyError(error)); else toast.success('Seller vinculado à equipe.'); };
  if (!staff.length) return null;
  return <section className="space-y-3 border-y border-border py-4"><h3 className="text-sm font-semibold">Vincular seller à equipe</h3><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div><Label>Conta staff</Label><Select value={member} onValueChange={setMember}><SelectTrigger aria-label="Conta staff"><SelectValue placeholder="Selecionar staff" /></SelectTrigger><SelectContent>{staff.map(s=><SelectItem key={s.user_id} value={s.user_id}>{s.full_name||s.email||s.user_id}</SelectItem>)}</SelectContent></Select></div><div><Label>Seller</Label><Select value={seller} onValueChange={setSeller}><SelectTrigger aria-label="Seller para vincular"><SelectValue placeholder="Selecionar seller" /></SelectTrigger><SelectContent>{sellers.filter(s=>!staff.some(m=>m.user_id===s.user_id)).map(s=><SelectItem key={s.user_id} value={s.user_id}>{s.full_name||s.email||s.user_id}</SelectItem>)}</SelectContent></Select></div><Button disabled={busy||!member||!seller} onClick={()=>void save()}>Vincular</Button></div></section>;
}

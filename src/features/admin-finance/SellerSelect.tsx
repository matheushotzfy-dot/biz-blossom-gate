import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

interface SellerSelectProps {
  profiles: Tables<"profiles">[];
  value: string;
  onChange: (userId: string) => void;
  allowAll?: boolean;
}

/** Searchable seller picker (name or e-mail); shows at most 100 matches to stay fast. */
export function SellerSelect({ profiles, value, onChange, allowAll }: SellerSelectProps) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const s = q.trim().toLowerCase();
    return profiles
      .filter((p) => !s || p.full_name?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s))
      .slice(0, 100);
  }, [profiles, q]);

  return (
    <Select value={value || (allowAll ? "__all" : "")} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder="Selecione um seller" /></SelectTrigger>
      <SelectContent>
        <div className="p-1"><Input placeholder="Buscar nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-8" /></div>
        {allowAll && <SelectItem value="__all">Todos os sellers</SelectItem>}
        {options.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id.slice(0, 8)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

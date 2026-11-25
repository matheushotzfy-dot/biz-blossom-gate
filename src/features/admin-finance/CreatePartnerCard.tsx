import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { functionErrorMessage } from "@/lib/functionError";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";

const schema = z.object({ name: z.string().trim().min(2, "Informe o nome do sócio.").max(120), email: z.string().trim().email("Informe um e-mail válido.").max(254) });

/** Owner creates a partner account; partner receives an invite e-mail and sets their own password. */
export function CreatePartnerCard() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    const p = schema.safeParse({ name, email });
    if (!p.success) { setError(p.error.issues[0].message); return; }
    setError(""); setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-create-staff", { body: { full_name: p.data.name, email: p.data.email, role: "partner", send_invite: true } });
      if (fnError || (data as { error?: string } | null)?.error) { setError(await functionErrorMessage(fnError, data, "Não foi possível criar o sócio.")); return; }
      toast.success("Convite enviado. O sócio entra por /socio e define a própria senha."); setName(""); setEmail("");
    } finally { setBusy(false); }
  };
  return (
    <PremiumPanel title="Adicionar sócio">
      <p className="mb-4 text-[12.5px] text-muted-foreground">O sócio vê as métricas e envia pedidos; não acessa contas de sellers nem executa nada sem você.</p>
      <form className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="space-y-1"><Label htmlFor="pt-name" className="text-[12px] font-medium text-muted-foreground">Nome</Label><Input id="pt-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="pt-email" className="text-[12px] font-medium text-muted-foreground">E-mail</Label><Input id="pt-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar convite"}</Button>
        {error && <p role="alert" className="text-[12.5px] font-medium text-destructive md:col-span-3">{error}</p>}
      </form>
    </PremiumPanel>
  );
}

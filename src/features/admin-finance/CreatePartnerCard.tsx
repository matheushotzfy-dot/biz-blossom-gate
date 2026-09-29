import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({ name: z.string().trim().min(2, "Nome obrigatório").max(120), email: z.string().trim().email("E-mail inválido").max(254) });

/** Owner creates a partner account; partner receives an invite e-mail and sets their own password. */
export function CreatePartnerCard() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = schema.safeParse({ name, email });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-staff", { body: { full_name: p.data.name, email: p.data.email, role: "partner", send_invite: true } });
    setBusy(false);
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) { toast.error(msg ?? "Não foi possível criar o sócio"); return; }
    toast.success("Convite enviado. O sócio acessa em /socio"); setName(""); setEmail("");
  };
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Adicionar sócio</h3>
      <p className="text-xs text-muted-foreground">O sócio vê as métricas e envia pedidos; não acessa contas de sellers nem executa nada sem você.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-1"><Label htmlFor="pt-name">Nome</Label><Input id="pt-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="pt-email">E-mail</Label><Input id="pt-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button onClick={() => void submit()} disabled={busy}>Enviar convite</Button>
      </div>
    </section>
  );
}

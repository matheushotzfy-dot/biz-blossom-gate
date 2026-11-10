import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { FinancialMetricsPanel } from "@/features/admin-finance/FinancialMetricsPanel";
import { StaffRequestForm } from "@/features/staff/StaffRequestForm";

const loginSchema = z.object({ email: z.string().trim().email("E-mail inválido").max(254), password: z.string().min(8, "Senha inválida").max(128) });

/** Partner area: platform metrics (read-only) + requests to the owner. No access to seller accounts. */
export default function PartnerPanel() {
  const { user, loading } = useAuth();
  const [role, setRole] = useState<"checking" | "ok" | "denied">("checking");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setRole("checking"); return; }
    let off = false;
    void supabase.rpc("current_user_has_role", { _role: "partner" }).then(({ data }) => { if (!off) setRole(data === true ? "ok" : "denied"); });
    return () => { off = true; };
  }, [user]);

  const login = async () => {
    const p = loginSchema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
    setBusy(false);
    if (error) toast.error("E-mail ou senha incorretos");
  };

  if (loading || (user && role === "checking")) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" /></div>;

  if (!user) return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Seo title="Painel do Sócio | Vemprapay" description="Acesso restrito aos sócios da Vemprapay." path="/socio" noindex />
      <form className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6" onSubmit={(e) => { e.preventDefault(); void login(); }}>
        <h1 className="text-xl font-semibold">Painel do Sócio</h1>
        <div className="space-y-1"><Label htmlFor="p-email">E-mail</Label><Input id="p-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="p-pass">Senha</Label><Input id="p-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</Button>
      </form>
    </main>
  );

  if (role === "denied") return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
      <p className="text-sm">Esta conta não tem acesso de sócio.</p>
      <Button variant="outline" onClick={() => void supabase.auth.signOut()}>Sair</Button>
    </main>
  );

  return (
    <main className="min-h-screen bg-background">
      <Seo title="Painel do Sócio | Vemprapay" description="Métricas da plataforma e pedidos ao dono." path="/socio" noindex />
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
        <h1 className="text-lg font-semibold">Painel do Sócio</h1>
        <Button size="sm" variant="ghost" onClick={() => void supabase.auth.signOut()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
      </header>
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <Tabs defaultValue="metrics">
          <TabsList><TabsTrigger value="metrics">Métricas</TabsTrigger><TabsTrigger value="requests">Pedidos ao dono</TabsTrigger></TabsList>
          <TabsContent value="metrics" className="mt-4"><FinancialMetricsPanel allowSellerFilter={false} /></TabsContent>
          <TabsContent value="requests" className="mt-4"><StaffRequestForm /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

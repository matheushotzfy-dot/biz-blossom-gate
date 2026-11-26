import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertCircle, BarChart3, Eye, EyeOff, Loader2, Lock, LogOut, Moon, Send, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { FinancialMetricsPanel } from "@/features/admin-finance/FinancialMetricsPanel";
import { StaffRequestForm } from "@/features/staff/StaffRequestForm";
import { validateLoginFields, type LoginFieldErrors } from "@/lib/adminLoginErrors";
import { cn } from "@/lib/utils";

type Tab = "metrics" | "requests";

/** Área do sócio: métricas da plataforma (só leitura) e pedidos ao dono. Sem acesso a contas de sellers. */
export default function PartnerPanel() {
  useSellerSkin();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const [role, setRole] = useState<"checking" | "ok" | "denied" | "failed">("checking");
  const [tab, setTab] = useState<Tab>("metrics");

  useEffect(() => {
    if (!user) { setRole("checking"); return; }
    let off = false;
    void supabase.rpc("current_user_has_role", { _role: "partner" }).then(({ data, error }) => {
      if (off) return;
      setRole(error ? "failed" : data === true ? "ok" : "denied");
    });
    return () => { off = true; };
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.add("vp-admin");
    return () => document.documentElement.classList.remove("vp-admin");
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); qc.clear(); };

  const themeButton = (
    <button type="button" onClick={toggleTheme} aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} title={dark ? "Tema claro" : "Tema escuro"}
      className="inline-flex h-9 w-9 items-center justify-center border af-border af-surface af-text-2 transition-opacity hover:opacity-80">
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
  const head = (
    <Helmet>
      <title>Sócio · Vemprapay</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  if (loading || (user && role === "checking")) {
    return <div className="admin-frame flex min-h-[100dvh] items-center justify-center af-bg-soft" role="status">{head}<Loader2 className="h-6 w-6 animate-spin af-muted" aria-label="Carregando" /></div>;
  }

  if (!user) return <PartnerLogin head={head} themeButton={themeButton} />;

  if (role === "denied" || role === "failed") {
    return (
      <div className="admin-frame flex min-h-[100dvh] items-center justify-center af-bg-soft px-6">
        {head}
        <div role="alert" className="flex max-w-[380px] flex-col items-center gap-3 text-center">
          <p className="text-[16px] font-semibold af-text">{role === "failed" ? "Não deu para confirmar seu acesso" : "Esta conta não é de sócio"}</p>
          <p className="text-[13.5px] af-muted">{role === "failed" ? "Costuma ser a conexão. Tente de novo." : "Entre com a conta de sócio ou fale com o dono."}</p>
          <Button variant="outline" onClick={() => void signOut()}>Sair</Button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "metrics", label: "Métricas", icon: BarChart3 },
    { id: "requests", label: "Pedidos ao dono", icon: Send },
  ];

  return (
    <div className="admin-frame flex min-h-[100dvh] flex-col af-bg-soft af-text">
      {head}
      <header className="flex h-[64px] shrink-0 items-center gap-3 px-4 af-surface af-border border-b sm:px-6">
        <VenxpayLogo size={28} withWordmark className="text-[16px]" />
        <span aria-hidden className="h-5 w-px af-border border-l" />
        <span className="text-[13.5px] font-semibold af-muted">Sócio</span>
        <nav aria-label="Seções" className="ml-4 hidden gap-1 sm:flex">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} data-active={tab === t.id ? "true" : "false"} className="admin-nav-item ax-nav-item !w-auto">
              <t.icon strokeWidth={2} /><span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {themeButton}
          <button type="button" onClick={() => void signOut()} className="ax-refresh flex"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sair</span></button>
        </div>
      </header>
      <nav aria-label="Seções" className="flex gap-1 px-4 pt-3 sm:hidden">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} data-active={tab === t.id ? "true" : "false"} className={cn("admin-nav-item ax-nav-item flex-1 justify-center")}>
            <t.icon strokeWidth={2} /><span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="admin-shell flex-1" data-admin-content>
        <div className="admin-fluid mx-auto max-w-[1400px] p-5 lg:p-8">
          {tab === "metrics" ? <FinancialMetricsPanel allowSellerFilter={false} /> : (
            <div className="space-y-5">
              <div>
                <h1 className="text-[26px] font-bold af-text">Pedidos ao dono</h1>
                <p className="mt-1 text-[14px] af-muted">Peça ao dono o que precisa de decisão dele. Você acompanha a resposta aqui.</p>
              </div>
              <StaffRequestForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PartnerLogin({ head, themeButton }: { head: React.ReactNode; themeButton: React.ReactNode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const clean = email.trim().toLowerCase();
    const invalid = validateLoginFields(clean, password);
    setErrors(invalid); setProblem(null);
    if (invalid.email || invalid.password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
    setBusy(false);
    if (error) setProblem(/fetch|network/i.test(error.message) ? "Não foi possível conectar. Verifique sua internet e tente de novo." : "E-mail ou senha incorretos.");
  };

  return (
    <div className="admin-frame flex min-h-[100dvh] flex-col">
      {head}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-3"><VenxpayLogo size={30} withWordmark className="text-[17px]" /><span aria-hidden className="h-5 w-px af-border border-l" /><span className="text-[13.5px] font-semibold af-muted">Sócio</span></div>
        {themeButton}
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-[clamp(24px,12vh,128px)]">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[28px] font-extrabold leading-[1.15] af-text">Área do sócio</h1>
          <p className="mb-6 mt-2 text-[14px] leading-relaxed af-muted">Métricas da plataforma e pedidos ao dono.</p>
          <div className="rounded-[12px] border af-border af-surface p-6 sm:p-7">
            <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-busy={busy}>
              {problem && (
                <div role="alert" className="flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px]" style={{ background: "var(--as-danger-bg)", color: "var(--as-danger)", border: "1px solid color-mix(in srgb, var(--as-danger) 35%, transparent)" }}>
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden /><span>{problem}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="p-email" className="text-[13px] font-semibold af-text-2">E-mail</Label>
                <input id="p-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com"
                  aria-invalid={!!errors.email} className="af-input h-11 w-full rounded-md px-3 text-[14px] focus:outline-none" />
                {errors.email && <p className="text-[12.5px] font-medium" style={{ color: "var(--as-danger)" }}>{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-pass" className="text-[13px] font-semibold af-text-2">Senha</Label>
                <div className="relative">
                  <input id="p-pass" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha"
                    aria-invalid={!!errors.password} className="af-input h-11 w-full rounded-md px-3 pr-11 text-[14px] focus:outline-none" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center af-muted">
                    {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
                {errors.password && <p className="text-[12.5px] font-medium" style={{ color: "var(--as-danger)" }}>{errors.password}</p>}
              </div>
              <Button type="submit" disabled={busy} className="af-accent-bg h-11 w-full rounded-md text-[14px] font-semibold shadow-none">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Lock className="mr-2 h-4 w-4" aria-hidden />}{busy ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

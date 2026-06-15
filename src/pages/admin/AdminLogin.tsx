import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, AlertCircle, Lock, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError("E-mail inválido."); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres."); return; }

    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-login", {
        body: { email: trimmedEmail, password },
      });
      if (fnError) throw new Error("Erro de conexão.");
      if (!data?.success) {
        setError(data?.locked ? "Muitas tentativas. Aguarde 15 minutos." : data?.error || "Credenciais inválidas ou acesso não autorizado.");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;
      toast.success("Bem-vindo ao painel administrativo!");
      navigate("/admin-matheus/dashboard");
    } catch {
      setError("Credenciais inválidas ou acesso não autorizado.");
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="admin-frame min-h-screen flex items-center justify-center af-bg-soft px-4 py-10 relative">
      {/* Theme toggle (top-right) */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 h-9 w-9 rounded-md af-surface af-border af-text-2 border inline-flex items-center justify-center hover:opacity-80 transition-opacity"
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="text-[18px] font-semibold af-text tracking-tight">HOTZFY Admin</span>
        </div>

        {/* Card */}
        <div className="af-surface af-border border rounded-md shadow-sm">
          <div className="px-7 pt-7 pb-5 af-border-soft border-b">
            <h1 className="text-[17px] font-semibold af-text">Acesso restrito</h1>
            <p className="text-[13px] af-muted mt-1">Entre com suas credenciais administrativas.</p>
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[12.5px]"
                style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)", color: "var(--as-danger)" }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-[12.5px] af-text-2 font-medium">E-mail</Label>
              <input
                id="admin-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
                placeholder="admin@empresa.com"
                className="af-input w-full h-10 rounded-md px-3 text-[13.5px] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-[12.5px] af-text-2 font-medium">Senha</Label>
              <div className="relative">
                <input
                  id="admin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="af-input w-full h-10 rounded-md px-3 pr-10 text-[13.5px] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 af-muted-2 hover:af-text-3 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="af-accent-bg w-full h-10 text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors"
            >
              <Lock className="h-3.5 w-3.5 mr-2" />
              {loading ? "Autenticando..." : "Entrar no painel"}
            </Button>
          </form>

          <div className="px-7 py-3.5 af-border-soft border-t af-bg-soft rounded-b-md">
            <p className="text-[11.5px] af-muted text-center">Sessão protegida · Tentativas monitoradas</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mt-5 text-[11px] af-muted-2">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            SSL ativo
          </span>
          <span>·</span>
          <span>Rate limit no backend</span>
          <span>·</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}

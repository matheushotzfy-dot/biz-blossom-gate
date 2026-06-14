import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("E-mail inválido.");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] px-4 py-10 font-sans">
      <div className="w-full max-w-[400px]">
        {/* Header brand bar */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-md bg-[#1e293b] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-[18px] font-semibold text-[#1e293b] tracking-tight">HOTZFY Admin</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-md shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
          {/* Card header */}
          <div className="px-7 pt-7 pb-5 border-b border-[#eef1f5]">
            <h1 className="text-[17px] font-semibold text-[#0f172a]">Acesso restrito</h1>
            <p className="text-[13px] text-[#64748b] mt-1">Entre com suas credenciais administrativas.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-[#fef2f2] border border-[#fecaca] rounded-md px-3 py-2.5 text-[12.5px] text-[#b91c1c]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-[12.5px] text-[#334155] font-medium">E-mail</Label>
              <Input
                id="admin-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
                className="h-10 rounded-md border-[#cbd5e1] bg-white text-[13.5px] text-[#0f172a] placeholder:text-[#94a3b8] focus-visible:ring-1 focus-visible:ring-[#1e293b]/30 focus-visible:border-[#1e293b]"
                placeholder="admin@empresa.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-[12.5px] text-[#334155] font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="h-10 rounded-md border-[#cbd5e1] bg-white pr-10 text-[13.5px] text-[#0f172a] placeholder:text-[#94a3b8] focus-visible:ring-1 focus-visible:ring-[#1e293b]/30 focus-visible:border-[#1e293b]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] hover:text-[#475569] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#1e293b] hover:bg-[#0f172a] text-white text-[13.5px] font-semibold rounded-md shadow-none active:scale-100 transition-colors"
            >
              <Lock className="h-3.5 w-3.5 mr-2" />
              {loading ? "Autenticando..." : "Entrar no painel"}
            </Button>
          </form>

          {/* Footer */}
          <div className="px-7 py-3.5 border-t border-[#eef1f5] bg-[#fafbfc] rounded-b-md">
            <p className="text-[11.5px] text-[#64748b] text-center">
              Sessão protegida · Tentativas monitoradas
            </p>
          </div>
        </div>

        {/* Status line */}
        <div className="flex items-center justify-center gap-3 mt-5 text-[11px] text-[#94a3b8]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            SSL ativo
          </span>
          <span className="text-[#cbd5e1]">·</span>
          <span>Rate limit no backend</span>
          <span className="text-[#cbd5e1]">·</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}

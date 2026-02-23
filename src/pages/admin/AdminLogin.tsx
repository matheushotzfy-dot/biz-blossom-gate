import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Lock, AlertTriangle } from "lucide-react";
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
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        setError("Acesso negado. Você não tem permissão de administrador.");
        return;
      }

      toast.success("Bem-vindo ao painel administrativo!");
      navigate("/admin-matheus/dashboard");
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,25%,4%)] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(220,20%,12%) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative w-full max-w-md p-8 animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-4 shadow-lg shadow-red-500/20">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Master</h1>
          <p className="text-sm text-zinc-500 mt-1">Acesso restrito à administração</p>
        </div>

        {/* Card */}
        <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-[hsl(220,20%,12%)] p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-xs text-zinc-400 uppercase tracking-wider">E-mail do administrador</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-2 bg-[hsl(220,25%,10%)] border-[hsl(220,20%,15%)] h-12 text-white placeholder:text-zinc-600"
                placeholder="admin@empresa.com"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 uppercase tracking-wider">Senha</Label>
              <div className="relative mt-2">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="bg-[hsl(220,25%,10%)] border-[hsl(220,20%,15%)] h-12 text-white placeholder:text-zinc-600 pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/20 transition-all duration-200" disabled={loading}>
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Verificando..." : "Acessar Painel Admin"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[10px] text-zinc-600 mt-6">
          Área restrita • Acessos monitorados • Somente administradores
        </p>
      </div>
    </div>
  );
}

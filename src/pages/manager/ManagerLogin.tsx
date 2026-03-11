import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Eye, EyeOff, Lock, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

export default function ManagerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockoutUntil) {
      const secsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Muitas tentativas. Aguarde ${secsLeft}s.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data } = await supabase.rpc("current_user_has_role", { _role: "manager" as any });
      if (data !== true) {
        await supabase.auth.signOut();
        setError("Acesso negado. Você não tem permissão de gerente.");
        return;
      }

      toast.success("Bem-vindo ao painel de gerente!");
      navigate("/gerentes/dashboard");
    } catch {
      setAttempts(prev => {
        const next = prev + 1;
        if (next >= 3) setLockoutUntil(Date.now() + 120000);
        return next;
      });
      setError("Credenciais inválidas ou acesso não autorizado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(135deg,#050505_0%,#050F0A_50%,#050505_100%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-900/[0.06] rounded-full blur-[150px]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 0.5px, transparent 0)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative w-full max-w-[420px] p-6 animate-slide-up">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="h-20 w-20 rounded-[22px] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_20px_60px_rgba(16,185,129,0.2)]">
              <Flame className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-[#050505]">
              <Users className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">HOTZFY Gerente</h1>
          <p className="text-[13px] text-white/30 mt-1 font-medium">Painel de Gerente de Contas</p>
        </div>

        <div className="bg-[#0A0A10] rounded-3xl border border-white/[0.06] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/15 rounded-2xl p-4 mb-6 text-[13px] text-red-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-[11px] text-white/40 uppercase tracking-[0.12em] font-semibold">E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-2 bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/15 rounded-2xl text-[14px] focus:border-emerald-500/40 focus:ring-emerald-500/10 transition-all" placeholder="gerente@empresa.com" />
            </div>
            <div>
              <Label className="text-[11px] text-white/40 uppercase tracking-[0.12em] font-semibold">Senha</Label>
              <div className="relative mt-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required minLength={6} className="bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/15 pr-12 rounded-2xl text-[14px] focus:border-emerald-500/40 focus:ring-emerald-500/10 transition-all" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-[52px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white font-semibold rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.25)] hover:shadow-[0_15px_50px_rgba(16,185,129,0.35)] transition-all duration-300 text-[14px]" disabled={loading}>
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Autenticando..." : "Acessar Painel"}
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-4 mt-8">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] text-white/20 font-medium">SSL Ativo</span>
          </div>
          <span className="text-white/10">•</span>
          <span className="text-[10px] text-white/20 font-medium">Acessos monitorados</span>
        </div>
      </div>
    </div>
  );
}

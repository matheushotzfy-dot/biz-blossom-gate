import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ArrowRight, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function MemberAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/membros-area", { replace: true });
      setCheckingSession(false);
    });
  }, [navigate]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Preencha todos os campos"); return; }
    if (password.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true);

    if (mode === "register") {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já possui conta. Faça login.");
          setMode("login");
        } else {
          toast.error("Erro ao criar conta. Tente novamente.");
        }
        setLoading(false);
        return;
      }
      if (signUpData?.user && !signUpData.session) {
        toast.success("Conta criada! Verifique seu e-mail para ativar.");
        setMode("login");
        setLoading(false);
        return;
      }
      toast.success("Conta criada! Redirecionando...");
      navigate("/membros-area", { replace: true });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }
      navigate("/membros-area", { replace: true });
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shadow-primary/10">
            <GraduationCap className="h-7 w-7 text-primary/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-25%] left-[15%] w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[10%] w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex mb-5"
          >
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center shadow-2xl shadow-primary/20 border border-primary/15">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-display font-black text-foreground tracking-[-0.04em]">Área de Membros</h1>
          <p className="text-sm text-muted-foreground/60 mt-2 font-display">
            {mode === "login" ? "Acesse seus cursos e conteúdos" : "Crie sua conta para começar"}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card/50 backdrop-blur-2xl border border-border/25 rounded-2xl p-6 shadow-xl shadow-background/40">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-background/40 border border-border/25 text-foreground text-sm font-display placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-300"
                  readOnly={!!emailParam}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-display font-bold text-muted-foreground/50 uppercase tracking-wider">
                {mode === "register" ? "Crie sua senha" : "Senha"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                  className="w-full h-11 pl-10 pr-12 rounded-xl bg-background/40 border border-border/25 text-foreground text-sm font-display placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-300"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-display font-black shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]">
              {loading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "register" ? "Criar Conta" : "Entrar"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/15 text-center">
            <p className="text-xs text-muted-foreground/50 font-display">
              {mode === "login" ? "Primeira vez?" : "Já tem conta?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary hover:text-primary/80 font-display font-bold transition-colors">
                {mode === "login" ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          <Shield className="h-3 w-3 text-muted-foreground/25" />
          <p className="text-[10px] text-muted-foreground/30 font-display">
            Ambiente seguro · Dados protegidos
          </p>
        </div>
      </motion.div>
    </div>
  );
}

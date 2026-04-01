import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ArrowRight, Shield } from "lucide-react";
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
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-xl shadow-primary/10">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Premium ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[20%] w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[10%] w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[130px]" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[440px]"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex mb-6"
          >
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/25 border border-primary/20">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-3xl font-display font-black text-foreground tracking-[-0.04em]">Área de Membros</h1>
          <p className="text-base text-muted-foreground mt-3 font-display font-medium">
            {mode === "login" ? "Acesse seus cursos e conteúdos" : "Crie sua conta para começar"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card/60 backdrop-blur-2xl border border-border/30 rounded-3xl p-8 shadow-2xl shadow-background/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2.5">
              <label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.1em]">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-13 pl-12 pr-4 rounded-2xl bg-background/50 border border-border/30 text-foreground text-sm font-display font-medium placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all duration-300"
                  readOnly={!!emailParam}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2.5">
              <label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.1em]">
                {mode === "register" ? "Crie sua senha" : "Senha"}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                  className="w-full h-13 pl-12 pr-14 rounded-2xl bg-background/50 border border-border/30 text-foreground text-sm font-display font-medium placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all duration-300"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-base font-display font-black shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-[0.99]"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "register" ? "Criar Conta" : "Entrar"}
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-7 pt-6 border-t border-border/20 text-center">
            <p className="text-sm text-muted-foreground font-display">
              {mode === "login" ? "Primeira vez aqui?" : "Já tem conta?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary hover:text-primary/80 font-display font-bold transition-colors underline-offset-4 hover:underline">
                {mode === "login" ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Shield className="h-3.5 w-3.5 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/40 font-display font-medium">
            Ambiente seguro · Dados protegidos com criptografia
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail, Sparkles, ArrowRight } from "lucide-react";
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
        <div className="h-10 w-10 rounded-2xl bg-primary/12 flex items-center justify-center border border-primary/10">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[400px] bg-primary/3 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex mb-5"
          >
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/20 border border-primary/20">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-display font-black text-foreground tracking-tight">Área de Membros</h1>
          <p className="text-sm text-muted-foreground/50 mt-2 font-display">
            {mode === "login" ? "Acesse seus cursos e conteúdos" : "Crie sua conta para começar"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card/50 backdrop-blur-2xl border border-border/30 rounded-3xl p-7 shadow-2xl shadow-background/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-display font-black text-muted-foreground/60 uppercase tracking-[0.15em]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-muted/10 border border-border/20 text-foreground text-sm font-display placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-300"
                  readOnly={!!emailParam}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-display font-black text-muted-foreground/60 uppercase tracking-[0.15em]">
                {mode === "register" ? "Crie sua senha" : "Senha"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
                  className="w-full h-12 pl-11 pr-12 rounded-2xl bg-muted/10 border border-border/20 text-foreground text-sm font-display placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-300"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-display font-black shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.01] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
            >
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

          {/* Toggle mode */}
          <div className="mt-6 pt-5 border-t border-border/15 text-center">
            <p className="text-xs text-muted-foreground/40 font-display">
              {mode === "login" ? "Primeira vez aqui?" : "Já tem conta?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary hover:text-primary/80 font-display font-bold transition-colors">
                {mode === "login" ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/20 mt-6 font-display font-bold">
          Ambiente seguro · Seus dados estão protegidos
        </p>
      </motion.div>
    </div>
  );
}

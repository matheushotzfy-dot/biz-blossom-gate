/**
 * AuthCallback — handles Supabase email confirmation / password reset / magic link redirects
 * Supabase redirects here with ?code=xxx after email verification
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle error from Supabase
      if (errorParam) {
        setStatus("error");
        toast.error(errorDescription || "Erro na verificação do e-mail.");
        setTimeout(() => navigate("/auth", { replace: true }), 2500);
        return;
      }

      // Exchange PKCE code for session
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Code exchange error:", error.message);
            setStatus("error");
            toast.error("Link expirado ou inválido. Tente fazer login novamente.");
            setTimeout(() => navigate("/auth", { replace: true }), 2500);
            return;
          }
          setStatus("success");
          toast.success("E-mail verificado com sucesso!");
          setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
          return;
        } catch {
          setStatus("error");
          toast.error("Erro ao verificar e-mail. Tente novamente.");
          setTimeout(() => navigate("/auth", { replace: true }), 2500);
          return;
        }
      }

      // Also check hash fragment (implicit flow / legacy)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      if (accessToken) {
        // The onAuthStateChange listener should pick this up
        await new Promise(r => setTimeout(r, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus("success");
          toast.success("E-mail verificado com sucesso!");
          setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
          return;
        }
      }

      // No code or token — redirect to auth
      setStatus("error");
      navigate("/auth", { replace: true });
    }

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        {status === "loading" && (
          <>
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse" />
              <Loader2 className="h-10 w-10 text-primary animate-spin relative" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Verificando sua conta...</p>
              <p className="text-sm text-muted-foreground mt-1">Aguarde um momento</p>
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Conta verificada!</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecionando para o painel...</p>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Erro na verificação</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecionando para o login...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
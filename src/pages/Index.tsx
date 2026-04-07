import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LandingPage from "./LandingPage";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Handle Supabase PKCE auth callback (email confirmation, password reset, etc.)
    const code = searchParams.get("code");
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type") || searchParams.get("type");

    async function handleAuth() {
      // PKCE flow: exchange code for session
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
            navigate("/dashboard", { replace: true });
            return;
          }
        } catch {
          // Fall through to normal flow
        }
      }

      // Implicit flow: access_token in hash (legacy)
      if (accessToken) {
        // onAuthStateChange will pick this up automatically
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.history.replaceState({}, "", window.location.pathname);
          navigate("/dashboard", { replace: true });
          return;
        }
      }

      // Normal session check
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        setChecking(false);
      }
    }

    handleAuth();
  }, [navigate, searchParams]);

  if (checking) return null;
  return <LandingPage />;
};

export default Index;

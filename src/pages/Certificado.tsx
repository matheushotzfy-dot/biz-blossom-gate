/**
 * Public certificate verification page — /certificado/:code
 * No auth required. Renders printable certificate with seal + verification details.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Award, ShieldCheck, Calendar, BookOpen, Loader2, ExternalLink, Printer } from "lucide-react";
import { motion } from "framer-motion";
import { Seo } from "@/components/Seo";

type Cert = {
  id: string;
  code: string;
  course_title: string;
  student_name: string;
  total_lessons: number;
  issued_at: string;
};

export default function Certificado() {
  const { code } = useParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, code, course_title, student_name, total_lessons, issued_at")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      setCert(data as Cert | null);
      setLoading(false);
    })();
  }, [code]);

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </main>
    );
  }

  if (!cert) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
          <Award className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-display font-black text-foreground tracking-tight">
          Certificado não encontrado
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          O código <strong className="font-mono">{code}</strong> não corresponde a nenhum certificado emitido.
        </p>
        <Link to="/" className="mt-5 text-sm font-display font-bold text-primary hover:underline">
          ← Voltar ao início
        </Link>
      </main>
    );
  }

  const date = new Date(cert.issued_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-dvh bg-background py-8 px-4 print:p-0">
      <Seo title={`Certificado — ${cert.course_title}`} description={`Certificado de conclusão do curso ${cert.course_title}.`} path={`/certificado/${cert.code || ""}`} noindex />
      <div className="max-w-4xl mx-auto">
        {/* Toolbar (hidden on print) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="text-xs font-display font-bold text-success">Certificado autenticado</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-display font-bold hover:bg-foreground/90 transition-all active:scale-95"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / Salvar PDF
          </button>
        </div>

        {/* Certificate body */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card border border-border rounded-2xl p-8 sm:p-12 print:border-2 print:border-primary print:rounded-none"
        >
          <div className="border-2 border-primary/20 rounded-xl p-8 sm:p-12 text-center print:border-primary/40">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                <Award className="h-8 w-8 text-primary" />
              </div>
            </div>

            <p className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">
              Certificado de Conclusão
            </p>

            <h1 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-[-0.02em] mb-6">
              {cert.student_name}
            </h1>

            <p className="text-sm text-muted-foreground font-display max-w-xl mx-auto leading-relaxed">
              concluiu com êxito todas as <strong className="text-foreground tabular-nums">{cert.total_lessons}</strong> aulas do curso
            </p>

            <h2 className="text-xl sm:text-2xl font-display font-black text-foreground tracking-tight mt-3 mb-8">
              "{cert.course_title}"
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-xs font-display text-muted-foreground border-t border-border/50 pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-primary/60" />
                <span>Emitido em <strong className="text-foreground">{date}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-primary/60" />
                <span>
                  Código:{" "}
                  <strong className="text-foreground font-mono tracking-wider">{cert.code}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Verification footer */}
          <div className="mt-6 pt-5 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-display text-muted-foreground/70">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Validado e emitido automaticamente pela plataforma.</span>
            </div>
            <a
              href={typeof window !== "undefined" ? window.location.href : "#"}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="font-mono">{typeof window !== "undefined" ? window.location.host : ""}/certificado/{cert.code}</span>
            </a>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

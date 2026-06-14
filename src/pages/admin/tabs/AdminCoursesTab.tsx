import { GraduationCap, Hammer } from "lucide-react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";

export default function AdminCoursesTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Educação"
        title="Cursos da plataforma"
        subtitle="Módulo em desenvolvimento — retornaremos com analytics, gerenciamento e curadoria completa."
        status={{ tone: "warning", label: "Em desenvolvimento", pulse: true }}
      />
      <div className="rounded-2xl border border-border bg-card/50 p-10 flex flex-col items-center justify-center text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
          <Hammer className="h-6 w-6 text-warning" />
        </div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Em construção</h3>
        <p className="text-xs text-muted-foreground max-w-md">
          A área de Cursos será reformulada com analytics de engajamento, controle de publicação, moderação de conteúdo e aprovação de produtores. Aguarde — voltamos com mais.
        </p>
      </div>
    </div>
  );
}

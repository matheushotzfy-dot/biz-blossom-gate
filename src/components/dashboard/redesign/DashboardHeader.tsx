import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  nickname: string;
  privacyHidden: boolean;
  onPrivacyToggle: () => void;
  periodControl: React.ReactNode;
}

export function DashboardHeader({ nickname, privacyHidden, onPrivacyToggle, periodControl }: DashboardHeaderProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <header className="dashboard-heading-band flex flex-col gap-4 border-b border-border pb-5 pt-2 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Visão geral
        </p>
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-2xl font-bold leading-tight text-foreground md:text-[30px]">
            {greeting}, {nickname}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPrivacyToggle}
            aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-sm font-medium text-muted-foreground">Acompanhe o desempenho da sua operação.</p>
      </div>
      <div className="w-full md:w-auto">{periodControl}</div>
    </header>
  );
}

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  privacyHidden: boolean;
  onPrivacyToggle: () => void;
  periodControl: React.ReactNode;
}

export function DashboardHeader({ privacyHidden, onPrivacyToggle, periodControl }: DashboardHeaderProps) {
  return (
    <header className="dashboard-heading-band flex flex-col gap-4 pb-1 pt-1 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-[28px]">Visão geral</h1>
          <Button type="button" variant="ghost" size="icon" onClick={onPrivacyToggle} aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Sua operação em um só lugar · horário de Brasília</p>
      </div>
      <div className="w-full md:w-auto">{periodControl}</div>
    </header>
  );
}

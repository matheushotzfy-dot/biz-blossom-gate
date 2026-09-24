import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  name?: string | null;
  privacyHidden: boolean;
  onPrivacyToggle: () => void;
  periodControl: React.ReactNode;
}

export function DashboardHeader({ name, privacyHidden, onPrivacyToggle, periodControl }: DashboardHeaderProps) {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <header className="dashboard-heading-band flex flex-col gap-4 py-1 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-[28px]">{firstName ? `Olá, ${firstName}` : "Visão geral"}</h1>
          <Button type="button" variant="ghost" size="icon" onClick={onPrivacyToggle} aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Aqui está o resumo da sua operação hoje.</p>
      </div>
      <div className="w-full md:w-auto">{periodControl}</div>
    </header>
  );
}

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardHeaderProps {
  greeting: string;
  nickname: string;
  privacyHidden: boolean;
  onTogglePrivacy: () => void;
  periodControl: React.ReactNode;
}

export function DashboardHeader({
  greeting,
  nickname,
  privacyHidden,
  onTogglePrivacy,
  periodControl,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold text-primary">Visão geral</p>
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-2xl font-semibold leading-tight text-foreground md:text-[28px]">
            {greeting}, {nickname}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onTogglePrivacy}
            aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe o desempenho da sua operação.</p>
      </div>
      <div className="w-full md:w-auto">{periodControl}</div>
    </header>
  );
}

export default DashboardHeader;
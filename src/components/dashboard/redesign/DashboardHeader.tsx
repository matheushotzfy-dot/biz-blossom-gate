import { Eye, EyeOff } from "lucide-react";

interface DashboardHeaderProps {
  nickname: string;
  privacyHidden: boolean;
  onPrivacyToggle: () => void;
}

export function DashboardHeader({ nickname, privacyHidden, onPrivacyToggle }: DashboardHeaderProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <header className="min-w-0">
      <h1 className="font-display font-bold text-[22px] md:text-[28px] leading-[1.15] truncate">
        {greeting}, {nickname}
        <button
          onClick={onPrivacyToggle}
          aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
          className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-[8px] align-middle text-muted-foreground/45 transition-colors hover:text-primary"
        >
          {privacyHidden ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
        </button>
      </h1>
      <p className="text-muted-foreground text-[13px] font-medium mt-1.5">
        Que essa jornada seja leve, produtiva e cheia de conquistas!
      </p>
    </header>
  );
}

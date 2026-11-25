import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { DARK_LOGO_APPS, type AppDef } from "./appCatalog";

export function AppLogo({ app, className }: { app: AppDef; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-[16px] border p-2", DARK_LOGO_APPS.has(app.id) ? "border-transparent bg-[#16211c]" : "border-border bg-logo-surface", className)}>
      <img src={app.logo} alt="" width={96} height={56} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
    </span>
  );
}

/** Cartão do catálogo: conectar um app novo ou acrescentar outra conexão. */
export function AppCard({ app, connected, active, onConnect, onManage }: { app: AppDef; connected: number; active: boolean; onConnect: (a: AppDef) => void; onManage: (a: AppDef) => void }) {
  const soon = !!app.comingSoon;
  const isWebhooks = app.id === "webhooks";
  return (
    <article className={cn("vp-sheet flex flex-col gap-4 p-5", soon && "opacity-75")} aria-label={app.name}>
      <div className="flex items-center gap-4">
        <AppLogo app={app} className="h-16 w-24" />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-bold leading-tight text-foreground">{app.name}</h3>
          <p className="text-[13px] text-muted-foreground">{app.category}</p>
        </div>
      </div>
      <p className="min-h-[2.75rem] text-[14px] leading-snug text-foreground/80">{app.desc}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        {soon ? <StatusPill label="Em breve" tone="idle" />
          : connected > 0 ? <button type="button" onClick={() => onManage(app)} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Ver ${connected} ${connected === 1 ? "conexão" : "conexões"} de ${app.name}`}>
              <StatusPill label={connected === 1 ? (active ? "Conectado" : "Pausado") : `${connected} conexões`} tone={active ? "ok" : "idle"} />
            </button>
          : <span />}
        {soon ? null : isWebhooks ? (
          <Link to="/integracoes?tab=webhooks" className="vp-ghost !h-10 !px-4">Abrir webhooks</Link>
        ) : (
          <button type="button" className={connected > 0 ? "vp-ghost !h-10 !px-4" : "vp-cta !h-10 !px-5"} onClick={() => onConnect(app)}>
            {connected > 0 ? <><Plus className="h-4 w-4" />Adicionar</> : "Conectar"}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Integrations — grade estática de marcas, monocromática, colorindo no hover.
 */
import { Rise } from "./bits";
import logoUtmify from "@/assets/apps/utmify.png";
import logoVoxuy from "@/assets/apps/voxuy.png";
import logoSpedy from "@/assets/apps/spedy.png";
import logoCademi from "@/assets/apps/cademi.png";
import logoMemberkit from "@/assets/apps/memberkit.png";
import logoThemembers from "@/assets/apps/themembers.png";
import logoAstron from "@/assets/apps/astron_members.png";
import logoActive from "@/assets/apps/activecampaign.png";
import logoZapi from "@/assets/apps/zapi.webp";
import logoSms from "@/assets/apps/smsfunnel.png";

const APPS = [
  { src: logoUtmify, name: "UTMify" },
  { src: logoVoxuy, name: "Voxuy" },
  { src: logoSpedy, name: "Spedy" },
  { src: logoCademi, name: "Cademi" },
  { src: logoMemberkit, name: "Memberkit" },
  { src: logoThemembers, name: "The Members" },
  { src: logoAstron, name: "Astron Members" },
  { src: logoActive, name: "ActiveCampaign" },
  { src: logoZapi, name: "Z-API" },
  { src: logoSms, name: "SMS Funnel" },
];

export function Integrations() {
  return (
    <section id="integracoes" className="vx-cv relative py-28 sm:py-36">
      <div className="mx-auto max-w-[1280px] px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="vx-mono">integrações</span>
            <h2 className="mt-5 max-w-[17ch] text-[38px] font-extrabold text-foreground sm:text-[52px]">
              Conecta com o que você já usa
            </h2>
          </div>
          <p className="max-w-[36ch] text-[14px] leading-[1.75] text-muted-foreground">
            E com o que você ainda vai construir: a API pública deixa qualquer integração própria
            no mesmo nível das nativas.
          </p>
        </div>

        <Rise className="mt-14">
          <div className="grid grid-cols-2 border-l border-t border-border sm:grid-cols-3 lg:grid-cols-5">
            {APPS.map((app) => (
              <div
                key={app.name}
                className="group flex items-center gap-3 border-b border-r border-border px-5 py-7 transition-colors duration-300 hover:bg-card"
              >
                <img
                  src={app.src}
                  alt={app.name}
                  loading="lazy"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-md object-contain grayscale transition-all duration-300 group-hover:grayscale-0"
                />
                <span className="truncate text-[13px] font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                  {app.name}
                </span>
              </div>
            ))}
          </div>
        </Rise>
      </div>
    </section>
  );
}

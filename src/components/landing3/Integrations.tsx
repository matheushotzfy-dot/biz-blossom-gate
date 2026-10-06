import logoUtmify from "@/assets/apps/utmify.png";
import logoVoxuy from "@/assets/apps/voxuy.png";
import logoSpedy from "@/assets/apps/spedy.png";
import logoCademi from "@/assets/apps/cademi.png";
import logoMemberkit from "@/assets/apps/memberkit.png";
import logoActive from "@/assets/apps/activecampaign.png";
import logoZapi from "@/assets/apps/zapi.webp";
import logoSms from "@/assets/apps/smsfunnel.png";
import { SectionHead } from "./bits";

const APPS: ReadonlyArray<readonly [string, string]> = [
  [logoUtmify, "UTMify"], [logoVoxuy, "Voxuy"], [logoSpedy, "Spedy"], [logoCademi, "Cademi"],
  [logoMemberkit, "Memberkit"], [logoActive, "ActiveCampaign"], [logoZapi, "Z-API"], [logoSms, "SMS Funnel"],
];

export function Integrations() {
  return (
    <section id="integracoes" className="vx3-section vx3-section-tight">
      <div className="vx3-shell">
        <SectionHead
          kicker="07 · Integrações"
          title={<>Conectada ao que <em>move</em> sua operação.</>}
        />
      </div>
      <div className="vx3-marquee" aria-label="Integrações disponíveis">
        <ul className="vx3-marquee-track">
          {[0, 1].map((copy) =>
            APPS.map(([src, name]) => (
              <li key={`${copy}-${name}`} aria-hidden={copy === 1 || undefined}>
                <img src={src} alt="" width={36} height={36} loading="lazy" />
                <span>{name}</span>
              </li>
            )),
          )}
        </ul>
      </div>
    </section>
  );
}

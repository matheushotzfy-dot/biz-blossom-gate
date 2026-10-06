import logoUtmify from "@/assets/apps/utmify.png";
import logoVoxuy from "@/assets/apps/voxuy.png";
import logoSpedy from "@/assets/apps/spedy.png";
import logoCademi from "@/assets/apps/cademi.png";
import logoMemberkit from "@/assets/apps/memberkit.png";
import logoActive from "@/assets/apps/activecampaign.png";
import logoZapi from "@/assets/apps/zapi.webp";
import logoSms from "@/assets/apps/smsfunnel.png";

const APPS = [
  [logoUtmify, "UTMify"], [logoVoxuy, "Voxuy"], [logoSpedy, "Spedy"],
  [logoCademi, "Cademi"], [logoMemberkit, "Memberkit"], [logoActive, "ActiveCampaign"],
  [logoZapi, "Z-API"], [logoSms, "SMS Funnel"],
];

export function Integrations() {
  return (
    <section id="integracoes" className="vx-section vx-integrations">
      <div className="vx-shell vx-integrations-layout">
        <div>
          <span className="vx-kicker">05 / O ECOSSISTEMA</span>
          <h2>Conectada ao que move sua operação.</h2>
          <p>Integrações nativas e uma API pronta para o que vier depois.</p>
        </div>
        <div className="vx-logo-matrix">
          {APPS.map(([src, name]) => (
            <div key={name} className="vx-logo-cell">
              <img src={src} alt="" width={38} height={38} loading="eager" />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
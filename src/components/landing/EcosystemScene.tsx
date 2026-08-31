/**
 * EcosystemScene — integrações em faixa contínua e cartões do ecossistema.
 */
import { BookOpen, Code2, MessageCircle, Receipt } from "lucide-react";
import { Reveal, SectionHead } from "./parts";
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

const LOGOS = [
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

const PILLARS = [
  { icon: Code2, title: "API REST pública", copy: "Cobrança, consulta, reembolso e estorno com chaves pk_live e sk_live." },
  { icon: MessageCircle, title: "Webhooks assinados", copy: "HMAC-SHA256, reentrega automática e log de cada tentativa." },
  { icon: BookOpen, title: "Documentação viva", copy: "Exemplos prontos em cURL e JavaScript, atualizados junto com a API." },
  { icon: Receipt, title: "Nota fiscal automática", copy: "Emissão integrada para cada venda aprovada, sem trabalho manual." },
];

export function EcosystemScene() {
  return (
    <section id="integracoes" className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          kicker="Ecossistema"
          title={<>Conecta com o que você já usa — e com o que você ainda vai construir</>}
          center
        />
      </div>

      <div className="venx-marquee-wrap relative mt-14 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent"
        />
        <div className="venx-marquee">
          {[...LOGOS, ...LOGOS].map((logo, i) => (
            <span key={`${logo.name}-${i}`} className="flex items-center gap-3 opacity-70 transition-opacity hover:opacity-100">
              <img src={logo.src} alt={logo.name} loading="lazy" className="h-8 w-8 rounded-lg object-contain" />
              <span className="whitespace-nowrap text-[13.5px] font-semibold text-muted-foreground">{logo.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 grid max-w-7xl gap-3 px-5 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.06}>
            <article className="venx-panel group h-full p-6 transition-colors duration-300 hover:border-primary/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-[15px] font-bold text-foreground">{p.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-muted-foreground">{p.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

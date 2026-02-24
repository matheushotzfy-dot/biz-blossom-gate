import { Puzzle, ExternalLink } from "lucide-react";
import { PageShell, PageTitle } from "@/components/PageShell";

const apps = [
  { name: "Notazz", desc: "Emissão automática de notas fiscais", color: "text-cyan-400", bg: "from-cyan-500/15 to-cyan-500/5" },
  { name: "TheMembers", desc: "Plataforma de área de membros", color: "text-white", bg: "from-white/10 to-white/5" },
  { name: "ActiveCampaign", desc: "Automação de e-mail marketing", color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5" },
  { name: "Spedy", desc: "Logística e envios automatizados", color: "text-pink-400", bg: "from-pink-500/15 to-pink-500/5" },
  { name: "Astron Members", desc: "Área de membros premium", color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
  { name: "MemberKit", desc: "Gestão completa de membros", color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
  { name: "UTMify", desc: "Rastreamento UTM avançado", color: "text-blue-500", bg: "from-blue-600/15 to-blue-600/5" },
  { name: "SMSFunnel", desc: "Automação de SMS marketing", color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5" },
  { name: "Voxuy", desc: "Chatbot e automação WhatsApp", color: "text-sky-400", bg: "from-sky-500/15 to-sky-500/5" },
  { name: "Cademi", desc: "Plataforma de cursos online", color: "text-rose-400", bg: "from-rose-500/15 to-rose-500/5" },
  { name: "Webhooks", desc: "Integre com qualquer sistema", color: "text-slate-400", bg: "from-slate-500/15 to-slate-500/5" },
  { name: "Zapier", desc: "Conecte +5000 aplicativos", color: "text-orange-400", bg: "from-orange-500/15 to-orange-500/5" },
];

export default function Apps() {
  return (
    <PageShell>
      <PageTitle icon={<Puzzle className="h-6 w-6" />} title="Apps" subtitle="Integre aplicativos ao seu ecossistema" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {apps.map(app => (
          <button key={app.name}
            className={`group relative overflow-hidden bg-gradient-to-br ${app.bg} border border-white/[0.06] dark:border-white/[0.06] rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:border-white/[0.12] dark:hover:border-white/[0.12]`}>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h3 className={`text-sm font-black ${app.color}`}>{app.name}</h3>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{app.desc}</p>
            <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Em breve</div>
          </button>
        ))}
      </div>
    </PageShell>
  );
}

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, Compass, Loader2, PauseCircle, Settings, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { FeesPanel } from "./FeesPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ReleasePanel } from "./ReleasePanel";
import { SignupPanel } from "./SignupPanel";
import { TicketPanel } from "./TicketPanel";
import { SETTINGS_KEY, callRpc } from "./settingsApi";
import { parseSettings } from "./settingsModel";

const WATCHED = ["platform_settings", "fees", "retention_settings", "custom_user_fees"] as const;

const ELSEWHERE = [
  { tab: "refund-approvals", icon: ShieldCheck, title: "Aprovação manual de saques e reembolsos", hint: "Em Pendentes de aprovação" },
  { tab: "tools", icon: PauseCircle, title: "Pausar saques ou o checkout", hint: "Em Ferramentas" },
  { tab: "sellers", icon: Users, title: "Taxa e limite de um seller só", hint: "Na ficha do seller, em Sellers" },
  { tab: "notifications", icon: Bell, title: "Avisos para os sellers", hint: "Em Notificações" },
] as const;

/** Configurações da plataforma: taxas, prazo do cartão, limite por venda e cadastro. Só administrador. */
export default function SettingsCenter({ isAdmin = true, onNavigate }: { isAdmin?: boolean; onNavigate?: (tab: string) => void }) {
  if (!isAdmin) return <PremiumEmpty icon={Settings} title="As configurações são do administrador" subtitle="Peça ao administrador para fazer a mudança." />;
  return <Center onNavigate={onNavigate} />;
}

function Center({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => parseSettings(await callRpc("get_admin_settings")),
  });

  useEffect(() => {
    let ch = supabase.channel(uniqueChannelName("admin-settings-center"));
    for (const table of WATCHED) ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => { void qc.invalidateQueries({ queryKey: SETTINGS_KEY }); });
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const d = q.data;
  const status = !d
    ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : d.signup.requireEmailVerification
      ? { tone: "success" as const, label: "Cadastro exige confirmação de e-mail" }
      : { tone: "warning" as const, label: "Cadastro sem confirmação de e-mail" };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Sistema" title="Configurações" status={status}
        subtitle="As taxas, o prazo do cartão, o limite por venda e as regras de cadastro de toda a plataforma. Cada mudança pede o motivo e a sua senha, e fica no histórico." />

      {q.isError && !q.isFetching && !d ? (
        <ErrorBlock title="Não foi possível carregar as configurações." error={q.error} onRetry={() => void q.refetch()} />
      ) : !d ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as configurações…</p>
      ) : (
        <>
          {q.isError && <ErrorBlock title="Não foi possível atualizar. Os valores abaixo podem estar desatualizados." error={q.error} onRetry={() => void q.refetch()} />}
          <FeesPanel data={d} />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
            <ReleasePanel data={d} />
            <div className="space-y-5">
              <TicketPanel data={d} />
              <SignupPanel data={d} />
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
            <HistoryPanel items={d.history} />
            <PremiumPanel title="Onde ficou o resto" icon={Compass}>
              <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">Estas opções não ficam aqui, cada uma tem a sua aba.</p>
              <ul className="divide-y divide-border/50">
                {ELSEWHERE.map((e) => (
                  <li key={e.tab}>
                    <button type="button" disabled={!onNavigate} onClick={() => onNavigate?.(e.tab)}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none">
                      <e.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-foreground">{e.title}</span>
                        <span className="block text-[12.5px] text-muted-foreground">{e.hint}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * SellerOnboarding — checklist de ativação da conta do seller.
 * Somente leitura: usa perfil, documentos KYC e chaves de recebimento já existentes.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ArrowRight, Check, Fingerprint, Landmark, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type StepState = "done" | "pending";

type Step = {
  id: string;
  label: string;
  desc: string;
  icon: typeof UserRound;
  to: string;
  state: StepState;
};

export function SellerOnboarding() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [hasDocs, setHasDocs] = useState<boolean | null>(null);
  const [hasPayout, setHasPayout] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    (async () => {
      try {
        const [docs, bank, pix] = await Promise.all([
          supabase.storage.from("kyc-documents").list(`${user.id}`),
          supabase.from("bank_accounts").select("id").eq("user_id", user.id).limit(1),
          supabase.from("pix_keys").select("id").eq("user_id", user.id).limit(1),
        ]);
        if (!active) return;
        setHasDocs((docs.data?.length ?? 0) > 0);
        setHasPayout(((bank.data?.length ?? 0) + (pix.data?.length ?? 0)) > 0);
      } catch {
        if (!active) return;
        setHasDocs(false);
        setHasPayout(false);
      }
    })();

    return () => { active = false; };
  }, [user?.id]);

  const approved = profile?.account_status === "approved";

  const steps = useMemo<Step[]>(() => {
    const profileDone = Boolean(profile?.full_name && (profile?.phone || profile?.document_number));
    return [
      {
        id: "perfil",
        label: "Perfil e contato",
        desc: "Nome completo, telefone e documento",
        icon: UserRound,
        to: "/perfil",
        state: profileDone ? "done" : "pending",
      },
      {
        id: "kyc",
        label: "Identidade (KYC)",
        desc: "Documento e selfie para verificação",
        icon: Fingerprint,
        to: "/perfil?tab=identidade&scrollTo=kyc",
        state: hasDocs ? "done" : "pending",
      },
      {
        id: "payout",
        label: "Dados de recebimento",
        desc: "Conta bancária ou chave PIX para saques",
        icon: Landmark,
        to: "/financeiro/config",
        state: hasPayout ? "done" : "pending",
      },
      {
        id: "ativacao",
        label: "Conta ativada",
        desc: approved ? "Vendas e saques liberados" : "Aguardando aprovação do time",
        icon: ShieldCheck,
        to: "/perfil?tab=identidade",
        state: approved ? "done" : "pending",
      },
    ];
  }, [profile?.full_name, profile?.phone, profile?.document_number, hasDocs, hasPayout, approved]);

  const doneCount = steps.filter((s) => s.state === "done").length;
  const complete = doneCount === steps.length;
  const next = steps.find((s) => s.state === "pending");

  useEffect(() => {
    if (!user?.id || !complete) return;
    try {
      const key = `venxpay_onboarding_done_${user.id}`;
      if (localStorage.getItem(key)) setDismissed(true);
      else localStorage.setItem(key, "1");
    } catch { /* noop */ }
  }, [complete, user?.id]);

  if (!profile || hasDocs === null || hasPayout === null) return null;
  if (complete && dismissed) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="dashboard-module overflow-hidden rounded-[12px] border border-border/60 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
        <div className="min-w-0">
          <p className="font-display text-[14px] font-bold tracking-[-0.02em] text-foreground">
            {complete ? "Conta ativada" : "Ative sua conta para vender e sacar"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground/70">
            {complete ? "Todas as etapas concluídas — bons negócios!" : `${doneCount} de ${steps.length} etapas concluídas`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-display text-[12px] font-bold tabular-nums text-foreground">{pct}%</span>
          {next && (
            <Link
              to={next.to}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:brightness-105"
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => {
          const Icon = s.icon;
          const done = s.state === "done";
          return (
            <Link
              key={s.id}
              to={s.to}
              className={cn(
                "group flex items-start gap-3 border-b border-r border-border/40 px-4 py-3.5 transition-colors last:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0",
                done ? "bg-primary/[0.035]" : "hover:bg-muted/20",
              )}
            >
              <span className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border",
                done ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground",
              )}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-foreground">{s.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground/70">{s.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default SellerOnboarding;

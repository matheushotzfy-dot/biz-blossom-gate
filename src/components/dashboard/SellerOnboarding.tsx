/**
 * SellerOnboarding — checklist de ativação da conta do seller.
 *
 * Regra principal: contas já aprovadas pelo time NUNCA veem este bloco.
 * O status do perfil é a fonte de verdade — a listagem de documentos no
 * storage é apenas um indicador auxiliar (pode falhar por RLS/latência e
 * não deve, sozinha, manter o aviso na tela).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ArrowRight, Check, Fingerprint, Landmark, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type StepState = "done" | "pending";

interface Step {
  id: string;
  label: string;
  desc: string;
  icon: typeof UserRound;
  to: string;
  state: StepState;
}

export function SellerOnboarding() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const kyc = useKycStatus();
  const [hasDocs, setHasDocs] = useState<boolean | null>(null);
  const [hasPayout, setHasPayout] = useState<boolean | null>(null);

  // Conta aprovada = ativação concluída. Nada é buscado nem exibido.
  const approved = kyc.approved;


  useEffect(() => {
    if (!user?.id || approved) return;
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
  }, [user?.id, approved]);

  const steps = useMemo<Step[]>(() => {
    const profileDone = Boolean(profile?.full_name && (profile?.phone || profile?.document_number));
    const inReview = profile?.account_status === "pending_review";
    return [
      {
        id: "perfil",
        label: "Perfil e contato",
        desc: "Nome, telefone e documento",
        icon: UserRound,
        to: "/perfil",
        state: profileDone ? "done" : "pending",
      },
      {
        id: "kyc",
        label: "Identidade (KYC)",
        desc: "Documento com foto e selfie",
        icon: Fingerprint,
        to: "/perfil?tab=identidade&scrollTo=kyc",
        state: hasDocs || inReview ? "done" : "pending",
      },
      {
        id: "payout",
        label: "Recebimento",
        desc: "Conta bancária ou chave PIX",
        icon: Landmark,
        to: "/financeiro/config",
        state: hasPayout ? "done" : "pending",
      },
      {
        id: "ativacao",
        label: "Liberação final",
        desc: inReview ? "Em análise pelo nosso time" : "Aprovação da equipe Venxpay",
        icon: ShieldCheck,
        to: "/perfil?tab=identidade",
        state: "pending",
      },
    ];
  }, [profile?.full_name, profile?.phone, profile?.document_number, profile?.account_status, hasDocs, hasPayout]);

  if (loading || !profile) return null;
  if (approved) return null;
  if (hasDocs === null || hasPayout === null) return null;

  const doneCount = steps.filter((s) => s.state === "done").length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => s.state === "pending");
  const inReview = profile.account_status === "pending_review";
  const rejected = profile.account_status === "rejected";

  const headline = rejected
    ? "Precisamos revisar seus documentos"
    : inReview
      ? "Estamos analisando sua conta"
      : "Falta pouco para você começar a vender";

  const sub = rejected
    ? "Alguma informação não pôde ser validada. Reenvie os documentos para liberarmos sua conta."
    : inReview
      ? "Seu envio está na fila de verificação. Assim que aprovado, vendas e saques são liberados automaticamente."
      : "Conclua as etapas abaixo para liberar recebimentos, saques e todas as ferramentas da plataforma.";

  return (
    <section
      className={cn(
        "dashboard-module relative overflow-hidden rounded-[16px] border bg-card",
        rejected ? "border-destructive/30" : "border-border/60",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[2px]",
          rejected ? "bg-destructive/60" : "bg-gradient-to-r from-primary/70 via-primary/25 to-transparent",
        )}
      />

      <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border",
              rejected
                ? "border-destructive/25 bg-destructive/10 text-destructive"
                : "border-primary/25 bg-primary/10 text-primary",
            )}
          >
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-bold leading-tight tracking-[-0.02em] text-foreground">
              {headline}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground/80">{sub}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            <div className="h-1.5 w-full min-w-[80px] overflow-hidden rounded-full bg-muted sm:w-28">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", rejected ? "bg-destructive" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-display text-[12px] font-bold tabular-nums text-foreground">{pct}%</span>
          </div>
          {next && (
            <Link
              to={rejected ? "/perfil?tab=identidade&scrollTo=kyc" : next.to}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              {rejected ? "Reenviar" : "Continuar"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>

      {/* Mobile: trilha horizontal estilo app. Desktop: grade. */}
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-5 xl:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = s.state === "done";
          return (
            <Link
              key={s.id}
              to={s.to}
              className={cn(
                "group flex min-w-[78%] snap-start items-start gap-3 rounded-[12px] border px-3.5 py-3 transition-colors sm:min-w-0",
                done
                  ? "border-primary/25 bg-primary/[0.05]"
                  : "border-border/60 bg-background/40 hover:bg-muted/25",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border",
                  done ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" strokeWidth={2} />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-[12.5px] font-semibold text-foreground">{s.label}</span>
                </span>
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

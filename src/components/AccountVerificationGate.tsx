import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { cn } from "@/lib/utils";

type AccountStatus = "approved" | "pending" | "pending_review" | "rejected" | "blocked" | string;

type GateCopy = {
  title: string;
  description: string;
  tone: "warning" | "destructive" | "success" | "primary";
};

const OPERATIONAL_PATHS = [
  "/vendas",
  "/financeiro",
  "/integracoes",
  "/marketplace",
  "/premiacoes",
];

const FREE_PATHS = ["/dashboard", "/perfil", "/suporte"];

function getCopy(status: AccountStatus | null | undefined): GateCopy {
  switch (status) {
    case "approved":
      return {
        title: "Conta aprovada",
        description: "Sua conta já está liberada para usar a operação da plataforma.",
        tone: "success",
      };
    case "rejected":
      return {
        title: "KYC recusado",
        description: "Reenvie seus documentos e corrija as informações solicitadas antes de liberar vendas, saques e integrações.",
        tone: "destructive",
      };
    case "blocked":
      return {
        title: "Conta bloqueada",
        description: "A operação da conta está bloqueada. Fale com o suporte para revisar o caso.",
        tone: "destructive",
      };
    case "pending_review":
      return {
        title: "Conta em análise",
        description: "Aguarde a revisão do administrador. As funções de venda, saque, produtos e integrações ficam bloqueadas até aprovação.",
        tone: "warning",
      };
    default:
      return {
        title: "Verificação obrigatória",
        description: "Preencha seus dados, cadastre as informações necessárias e envie o KYC para o administrador aprovar ou recusar sua conta.",
        tone: "warning",
      };
  }
}

function isFreePath(pathname: string) {
  return FREE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function isOperationalPath(pathname: string) {
  return OPERATIONAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function accountNeedsVerification(status: AccountStatus | null | undefined) {
  return status !== "approved";
}

export function AccountVerificationNotice({ compact = false }: { compact?: boolean }) {
  const { profile } = useProfile();
  const copy = getCopy(profile?.account_status);
  const Icon = copy.tone === "destructive" ? ShieldAlert : AlertTriangle;

  return (
    <section className={cn(
      "relative overflow-hidden rounded-2xl border border-border bg-card",
      compact ? "p-4" : "p-6 sm:p-8",
    )}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
            copy.tone === "destructive"
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-warning/25 bg-warning/10 text-warning",
          )}>
            <Icon className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Conta não liberada</p>
            <h2 className={cn("mt-1 font-display font-black tracking-tight text-foreground", compact ? "text-lg" : "text-2xl")}>{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">{copy.description}</p>
            <div className="mt-4 grid gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-3">
              <span className="inline-flex items-center gap-2"><FileCheck className="h-3.5 w-3.5 text-primary" /> Dados completos</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-warning" /> KYC enviado</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Aprovação admin</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button asChild className="h-11 rounded-xl px-5 text-xs font-black uppercase tracking-widest">
            <Link to="/perfil?tab=identidade&scrollTo=kyc">
              Completar KYC <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {copy.tone === "destructive" && (
            <Button asChild variant="outline" className="h-11 rounded-xl px-5 text-xs font-black uppercase tracking-widest">
              <Link to="/suporte">Falar com suporte</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export function AccountVerificationGate({ children }: { children: React.ReactNode }) {
  const kyc = useKycStatus();

  if (!kyc.resolved) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!kyc.approved) {
    return <AccountVerificationNotice />;
  }

  return <>{children}</>;
}

export function RouteAccountVerificationGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  if (isFreePath(location.pathname) || !isOperationalPath(location.pathname)) {
    return <>{children}</>;
  }

  return <AccountVerificationGate>{children}</AccountVerificationGate>;
}

export function ApprovedAccountRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <AccountVerificationGate>{children}</AccountVerificationGate>
    </ProfileProvider>
  );
}

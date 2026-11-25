import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LockKeyhole, ShieldBan, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { blockReasonLabel, clockLabel, parseWaiting, scopeLabel, shortHash, timeLeft, type Block, type Lockout } from "./abuseModel";
import { useAbuseActions } from "./useAbuseActions";

/** Relógio que vira a cada 30 s, só para os "faltam N min" não ficarem parados. */
function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]);
  return now;
}

const Tag = ({ children, tone }: { children: React.ReactNode; tone: "warning" | "muted" | "info" }) => (
  <span className={cn("inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold",
    tone === "warning" ? "border-warning/25 bg-warning/10 text-warning" : tone === "info" ? "border-info/25 bg-info/10 text-info" : "border-border bg-muted/40 text-muted-foreground")}>{children}</span>
);

export function WaitingPanel() {
  const now = useNow();
  const act = useAbuseActions();
  const q = useQuery({
    queryKey: ["admin-abuse-waiting"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_abuse_waiting" as never);
      if (error) throw error;
      return parseWaiting(data);
    },
    refetchInterval: 30000,
  });
  const lockouts = q.data?.lockouts ?? [];
  const blocks = q.data?.blocks ?? [];

  return (
    <PremiumPanel title="Em espera agora" icon={LockKeyhole}>
      <p className="mb-5 max-w-3xl text-[13px] text-muted-foreground">
        No login de vendedores e alunos, 5 senhas erradas travam o e-mail e 20 travam o IP, por até 15 minutos. Um IP que passa de 100 tentativas em 10 segundos entra em quarentena por 15 minutos. Aqui você libera quem foi pego por engano.
      </p>
      {q.isError ? (
        <ErrorBlock title="Não foi possível carregar o que está em espera." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : lockouts.length === 0 && blocks.length === 0 ? (
        <PremiumEmpty icon={LockKeyhole} title="Nada em espera" subtitle="Ninguém está travado nem em quarentena neste momento." />
      ) : (
        <div className="space-y-6">
          <section aria-label="Logins travados">
            <h3 className="mb-2 text-[13px] font-semibold text-foreground">Logins travados ({lockouts.length})</h3>
            {lockouts.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum login travado.</p> : (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {lockouts.map((l) => <LockoutRow key={`${l.kind}:${l.email ?? l.ip_hash}:${l.scope}`} l={l} now={now} busy={act.busy === `${l.kind}:${l.email ?? l.ip_hash}`} disabled={act.busy !== null} onRelease={() => void act.releaseLockout(l)} />)}
              </ul>
            )}
          </section>
          <section aria-label="IPs em quarentena">
            <h3 className="mb-2 text-[13px] font-semibold text-foreground">IPs em quarentena ({blocks.length})</h3>
            {blocks.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum IP em quarentena.</p> : (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {blocks.map((b) => <BlockRow key={b.id} b={b} now={now} busy={act.busy === b.id} disabled={act.busy !== null} onRelease={() => void act.releaseBlock(b.id, b.ip_hash)} />)}
              </ul>
            )}
          </section>
        </div>
      )}
      {act.dialogs}
    </PremiumPanel>
  );
}

const Row = ({ children, action }: { children: React.ReactNode; action: React.ReactNode }) => (
  <li className="flex flex-col gap-3 rounded-[12px] border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-1">{children}</div>
    <div className="shrink-0">{action}</div>
  </li>
);

function ReleaseButton({ label, busy, disabled, onClick }: { label: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={disabled} onClick={onClick} aria-label={label}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Liberar
    </Button>
  );
}

function LockoutRow({ l, now, busy, disabled, onRelease }: { l: Lockout; now: number; busy: boolean; disabled: boolean; onRelease: () => void }) {
  const name = l.kind === "email" ? l.email ?? "" : `IP ${shortHash(l.ip_hash ?? "")}`;
  return (
    <Row action={<ReleaseButton label={`Liberar o login de ${name}`} busy={busy} disabled={disabled} onClick={onRelease} />}>
      <div className="flex flex-wrap items-center gap-2">
        <p className={cn("break-all text-[13px] font-semibold text-foreground", l.kind === "ip" && "font-mono")}>{name}</p>
        <Tag tone="muted">{l.kind === "email" ? scopeLabel(l.scope) : "IP"}</Tag>
      </div>
      <p className="text-[12.5px] text-muted-foreground">{l.fails.toLocaleString("pt-BR")} {l.fails === 1 ? "erro" : "erros"} seguidos · destrava às {clockLabel(l.resets_at)} ({timeLeft(l.resets_at, now)})</p>
    </Row>
  );
}

function BlockRow({ b, now, busy, disabled, onRelease }: { b: Block; now: number; busy: boolean; disabled: boolean; onRelease: () => void }) {
  const r = blockReasonLabel(b.reason);
  return (
    <Row action={<ReleaseButton label={`Liberar o IP ${shortHash(b.ip_hash)}`} busy={busy} disabled={disabled} onClick={onRelease} />}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-foreground" title={b.ip_hash}><ShieldBan className="h-3.5 w-3.5 text-muted-foreground" />{shortHash(b.ip_hash)}</p>
        <Tag tone={r.manual ? "info" : "warning"}>{r.manual ? "Manual" : "Automático"}</Tag>
      </div>
      <p className="text-[12.5px] text-muted-foreground">{r.text} · até {clockLabel(b.blocked_until)} ({timeLeft(b.blocked_until, now)})</p>
    </Row>
  );
}

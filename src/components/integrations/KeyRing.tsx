import { useEffect, useState } from "react";
import { Hourglass, Infinity as InfinityIcon, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { KEY_EXPIRING_DAYS, keyLife, type ApiKeyRow, type KeyState } from "./intMeta";

const R = 25;
const C = 2 * Math.PI * R;

/**
 * O anel é a vida da chave: começa cheio no dia em que ela nasce e vai esvaziando até a data de validade.
 * No meio fica o número de dias que faltam. Verde enquanto há tempo, âmbar nos últimos dias, vermelho quando vence.
 * Revogada e pausada perdem a cor: não autenticam, então a validade deixa de ser o que importa.
 */
export function KeyRing({ k, state, now }: { k: ApiKeyRow; state: KeyState; now?: number }) {
  const { fraction, days } = keyLife(k, now);
  const dead = state === "revoked";
  const soon = state === "active" && days !== null && days <= KEY_EXPIRING_DAYS;
  const tone = state === "expired" ? "text-destructive" : dead || state === "paused" ? "text-muted-foreground" : soon ? "text-warning" : "text-primary";
  const arc = dead || state === "expired" ? 0 : fraction;

  // O arco se desenha uma vez, quando a lista aparece; com movimento reduzido ele já nasce no lugar.
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);

  return (
    <span className={cn("relative grid h-16 w-16 shrink-0 place-items-center", tone)} role="img" aria-label={label(state, days)}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeOpacity={dead || state === "paused" ? 0.18 : 0.14} strokeWidth="5" />
        {arc > 0 && (
          <circle
            cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${on ? Math.max(arc * C, 1) : 0} ${C}`}
            style={{ transition: "stroke-dasharray .7s cubic-bezier(.2,.7,.2,1)", opacity: state === "paused" ? 0.45 : 1 }}
            className="motion-reduce:!transition-none"
          />
        )}
      </svg>
      <span className="relative grid place-items-center leading-none">
        {state === "revoked" ? <ShieldOff className="h-[22px] w-[22px]" strokeWidth={1.9} />
          : state === "expired" ? <Hourglass className="h-[22px] w-[22px]" strokeWidth={1.9} />
          : days === null ? <InfinityIcon className="h-[22px] w-[22px]" strokeWidth={2} />
          : (
            <>
              <span className={cn("text-[19px] font-extrabold tracking-[-0.03em]", state === "paused" ? "text-muted-foreground" : "text-foreground")}>{days > 99 ? "99+" : days}</span>
              <span className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{days === 1 ? "dia" : "dias"}</span>
            </>
          )}
      </span>
    </span>
  );
}

function label(state: KeyState, days: number | null): string {
  if (state === "revoked") return "Chave revogada";
  if (state === "expired") return "Chave expirada";
  if (days === null) return "Chave sem validade";
  return `Faltam ${days} ${days === 1 ? "dia" : "dias"} para a chave expirar`;
}

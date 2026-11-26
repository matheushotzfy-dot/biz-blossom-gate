/**
 * Regras da página de status (`/status`). Pura, para testar sem rede.
 * A página só mede o que dá para medir do navegador de quem abre: se o servidor responde, quanto demora,
 * se o login está de pé e se a equipe pausou pagamentos ou saques. Não inventa histórico nem porcentagem de uptime.
 */

export type Health = "checking" | "ok" | "slow" | "down" | "paused" | "setup";

/** Acima disso a resposta conta como lenta (o servidor respondeu, mas devagar). */
export const SLOW_MS = 1500;

export interface Probe { ok: boolean; ms: number }

export interface StatusInput {
  api: Probe | null;
  auth: Probe | null;
  pauses: { payments: boolean; withdrawals: boolean } | null;
  /** O checkout já tem adquirente? (vem de `defaultCheckoutProcessor.available`) */
  paymentsLive: boolean;
}

export interface ServiceRow {
  id: "site" | "login" | "payments" | "withdrawals";
  name: string;
  detail: string;
  health: Health;
  ms?: number;
}

export const probeHealth = (p: Probe | null): Health => (p === null ? "checking" : !p.ok ? "down" : p.ms > SLOW_MS ? "slow" : "ok");

export function buildRows(input: StatusInput): ServiceRow[] {
  const api = probeHealth(input.api);
  const auth = probeHealth(input.auth);
  // Pagamentos e saques dependem do servidor: se ele caiu, eles caíram junto.
  const dependent = (when: () => Health): Health => (api === "checking" ? "checking" : api === "down" ? "down" : when());

  return [
    {
      id: "site",
      name: "Painel, checkout e área de membros",
      detail: "Páginas e dados da plataforma",
      health: api,
      ms: input.api?.ok ? input.api.ms : undefined,
    },
    {
      id: "login",
      name: "Entrar e criar conta",
      detail: "Login de vendedores e alunos",
      health: auth,
      ms: input.auth?.ok ? input.auth.ms : undefined,
    },
    {
      id: "payments",
      name: "Pagamentos",
      detail: input.pauses?.payments
        ? "Pausados pela equipe. Nenhuma cobrança nova é criada até a pausa acabar."
        : input.paymentsLive
          ? "Pix, cartão e boleto"
          : "A conexão com a adquirente está sendo configurada. O checkout ainda não cobra.",
      health: dependent(() => (input.pauses?.payments ? "paused" : input.paymentsLive ? "ok" : "setup")),
    },
    {
      id: "withdrawals",
      name: "Saques",
      detail: input.pauses?.withdrawals ? "Pausados pela equipe. Pedidos novos voltam quando a pausa acabar." : "Pedidos de saque por Pix",
      health: dependent(() => (input.pauses?.withdrawals ? "paused" : "ok")),
    },
  ];
}

export interface Summary { tone: "ok" | "warn" | "down" | "checking"; title: string }

/** Frase do topo. "Em configuração" não é falha: não conta como instabilidade. */
export function summarize(rows: ServiceRow[]): Summary {
  if (rows.some((r) => r.health === "checking")) return { tone: "checking", title: "Verificando os serviços…" };
  const down = rows.filter((r) => r.health === "down");
  if (down.length) return { tone: "down", title: down.length === 1 ? `${down[0].name} fora do ar` : "Alguns serviços estão fora do ar" };
  const warn = rows.filter((r) => r.health === "slow" || r.health === "paused");
  if (warn.length) return { tone: "warn", title: warn.length === 1 ? `${warn[0].name}: ${HEALTH_LABEL[warn[0].health].toLowerCase()}` : "Alguns serviços com aviso" };
  return { tone: "ok", title: "Tudo funcionando" };
}

export const HEALTH_LABEL: Record<Health, string> = {
  checking: "Verificando",
  ok: "Funcionando",
  slow: "Lento",
  down: "Fora do ar",
  paused: "Pausado",
  setup: "Em configuração",
};
